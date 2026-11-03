# Escanear un ticket de compra: Technical design
_Status: Draft · Updated: 2026-10-30_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Una ruta nueva en `server/` (`POST /api/pantry/receipt`) recibe la foto del ticket ya reducida en el navegador y hace una sola llamada a Claude con visión (Sonnet 5.5, sin pensamiento), que devuelve las líneas con nombre, cantidad, ubicación y si son comida, eligiendo el nombre de la Base de alimentos cuando casa. En la Despensa, un sheet nuevo lleva el flujo foto → carga → lista editable → añadir, con Deshacer y chip «Nuevo». Esfuerzo M.

## Context
- Front estático (IONOS) y rutas de servidor en `server/app/api/*` (Vercel), llamadas con `apiUrl()` (`src/lib/apiBase.ts`) y CORS (`server/lib/cors.ts`).
- Patrón a copiar: el importador de recetas, `server/app/api/recipes/import/route.ts` + lógica pura compartida en `src/lib/recipeImport.ts` (un intento, `maxRetries: 0`, timeout con `AbortController`, `rateLimit`, códigos de error con mensaje).
- Sesión: token Bearer (`src/lib/auth.tsx`); en servidor `authenticate()` de `server/lib/auth.ts`.
- Base de alimentos local: 161 alimentos en `src/data/foods.json` (`FOODS` en `src/lib/foods.ts`).
- Despensa: `PantryItem` (`src/lib/types.ts`), `addPantryItems`/`removePantryItems` (`src/lib/store.tsx`), página `src/app/despensa/page.tsx` con aviso de Deshacer para la lista de la compra (`UNDO_MS`). La sincronización y el backup solo exigen `id` en cada artículo (`src/lib/backup.ts`).
- Vercel rechaza cuerpos de petición de más de ~4,5 MB.

## Approaches considered
### A. Ruta propia con visión de Claude (chosen)
El navegador reduce la imagen a JPEG y la manda en base64; una llamada a Claude con la imagen, la lista de 161 nombres de alimentos y un prompt que pide JSON. · **Pros** sigue el patrón del importador; una sola llamada resuelve lectura, limpieza de nombres (R6) y ubicación; sin dependencias nuevas. · **Cons** coste por escaneo; calidad atada al modelo. · **Effort** M. Elegida por el usuario.
### B. OCR en el navegador (Tesseract.js) + Claude con texto
Varios MB de WASM y peor lectura de tickets térmicos. Descartada.
### C. Servicio OCR (Google Vision) + Claude
Servicio y clave nuevos sin ventaja clara sobre la visión de Claude. Descartada.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica pura compartida | `src/lib/receiptScan.ts` (nuevo) | Tipos, prompt, `parseReceiptReply`, normalización de ubicación, errores y mensajes, `toPantryItems` |
| Reducción de imagen | `src/lib/receiptImage.ts` (nuevo) | `shrinkImage(file)` → JPEG base64, lado largo ≤ 1600 px, calidad 0,8 |
| Ruta | `server/app/api/pantry/receipt/route.ts` (nuevo) | `OPTIONS` + `POST` con sesión, límite, validación, llamada a Claude |
| Límite | `server/lib/rateLimit.ts` | `receiptLimiter` (10 / 10 min, por usuario) |
| Tipo | `src/lib/types.ts` | `PantryItem.addedFromReceiptAt?: string` |
| UI | `src/components/despensa/ScanReceiptSheet.tsx` (nuevo) | Sheet con estados elegir → cargando → lista → error |
| Página | `src/app/despensa/page.tsx` | Botón «Escanear ticket», Deshacer del escaneo, chip «Nuevo» también con `addedFromReceiptAt` |

### Data model
- `PantryItem.addedFromReceiptAt?: string` (YYYY-MM-DD). Opcional: sin migración; los artículos viejos no lo tienen.
- Nada nuevo en servidor ni en la base de datos. La foto no se guarda (ver Risks).

### APIs / interfaces
`POST /api/pantry/receipt` · cabecera `Authorization: Bearer <token>` · cuerpo `{ image: string /* base64 sin prefijo */, mediaType: "image/jpeg" }`.

Respuesta 200:
```ts
interface ReceiptLine {
  name: string;          // nombre legible; el de la Base de alimentos si casa (R6)
  quantity: string;      // texto legible: "2 uds", "512 g"
  category: PantryCategory; // Nevera | Despensa | Congelador
  isFood: boolean;       // false → la UI la muestra desmarcada (R2)
}
{ lines: ReceiptLine[] }
```
Errores `{ error: ReceiptErrorCode, message }`: `unauthorized` (401), `rate_limited` (429 + `Retry-After`), `invalid_image` (400: falta, no es JPEG o base64 > 4 MB), `unreadable` (422: la IA no devuelve líneas válidas, o ninguna línea), `ai_failed` (502: timeout o error de la API).

En la ruta: `export const maxDuration = 60`; `AI_MODEL = "claude-sonnet-5-5"`, `thinking: { type: "disabled" }`, `max_tokens` 4000, `AI_TIMEOUT_MS = 45_000`, `maxRetries: 0`. Sin `ANTHROPIC_API_KEY` → 500 con el mismo mensaje que el importador.

`src/lib/receiptScan.ts` (puro, probado en unit):
- `buildReceiptPrompt(foodNames: string[])`: pide JSON `{lines:[...]}`; ignorar totales, IVA, pagos y cabeceras; marcar `isFood:false` bolsas, droguería y descuentos; usar el nombre de la lista si casa, si no un nombre legible sin abreviaturas ni marca; cantidad legible; ubicación sugerida.
- `parseReceiptReply(text): ReceiptLine[] | null`: extrae el JSON (también dentro de ```json```), descarta líneas sin nombre, recorta textos, `category` desconocida → `"Despensa"`, `isFood` no booleano → `true`. `null` si no hay ninguna línea válida.
- `toPantryItems(lines, today): PantryItem[]`: un artículo nuevo por línea marcada, `id` nuevo, `addedFromReceiptAt: today`.

### UI
- Botón «Escanear ticket» junto al formulario de la Despensa. Abre `ScanReceiptSheet`.
- **Elegir:** «Hacer foto» (`<input type="file" accept="image/*" capture="environment">`) y «Elegir imagen» (`accept="image/*"`). Cancelar el selector deja el sheet en este estado.
- **Cargando:** texto de estado; la petición lleva `AbortController` y se aborta al cerrar el sheet.
- **Lista:** una fila por línea: casilla, nombre, cantidad, selector de ubicación. Líneas `isFood:false` desmarcadas. Botón «Añadir N productos», desactivado con N = 0 o con alguna línea marcada sin nombre.
- **Error:** mensaje del código + «Reintentar» (vuelve a Elegir) y «Añadir a mano» (cierra el sheet y enfoca el formulario de la Despensa).
- Al añadir: `addPantryItems(toPantryItems(...))`, se cierra el sheet y la página muestra «N añadidos · Deshacer» durante `UNDO_MS`, con los `id` en estado local de la página; Deshacer llama a `removePantryItems(ids)`.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Dos `input type=file` en el sheet (cámara y galería) |
| R2 | Ruta + `parseReceiptReply`; líneas no comida desmarcadas; cantidad legible desde el prompt |
| R3 | Estado editable por fila en el sheet; validación de nombre vacío |
| R4 | `toPantryItems` solo con marcadas, siempre artículos nuevos; nada se escribe antes de confirmar |
| R5 | Códigos de error → estado Error con Reintentar / Añadir a mano |
| R6 | Lista de 161 nombres en el prompt; nombre legible si no casa |
| R7 | Aviso Deshacer con ids locales; chip «Nuevo» con `addedFromReceiptAt === today` |
| R8 | (Could) no entra en esta entrega salvo que sobre tiempo: un campo fecha opcional por fila |

## Risks & mitigations
- **Coste y abuso:** solo con sesión + 10 escaneos / 10 min por usuario; imagen reducida (menos tokens).
- **Tamaño de petición en Vercel (~4,5 MB):** reducción en el navegador; la ruta rechaza base64 > 4 MB con `invalid_image`.
- **Tiempo:** 45 s de IA dentro de 60 s de función; respuesta JSON siempre antes del corte.
- **Calidad de lectura:** riesgo principal de la métrica; el modelo está en una constante para cambiarlo sin tocar nada más.
- **Privacidad (datos de compra):** la imagen se manda a Claude y se descarta; no se registra en logs ni se guarda.
- **HEIC del iPhone:** el selector de iOS entrega JPEG con `accept="image/*"`; si una imagen no se puede dibujar en canvas, error `invalid_image` en el cliente.
- **Límite en memoria por instancia** (como el importador): frena abuso casual, no uno decidido. Aceptado.

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| Estado del sheet (paso, líneas editadas, error) | Se pierde al cerrar; al reabrir empieza en Elegir | El sheet se desmonta al cerrar |
| Petición en curso al cerrar el sheet | Se cancela y no escribe nada | `AbortController` en el cleanup |
| «Reintentar» | Borra líneas y error, vuelve a Elegir | `setState` a estado inicial |
| Aviso de Deshacer | Desaparece a los `UNDO_MS` o al salir de la página | Estado local + timeout |
| Deshacer tras borrar a mano uno de los artículos | Quita los que queden de esa operación | `removePantryItems` ignora ids ausentes |
| Respuesta con 0 líneas válidas | Error `unreadable` | `parseReceiptReply` → `null` |
| Líneas todas `isFood:false` | Lista con todas desmarcadas, botón desactivado | N = 0 |
| `category` fuera de las tres | `"Despensa"` | `parseReceiptReply` |
| Nombre o cantidad con espacios o vacíos | Se recortan; nombre vacío descarta la línea; cantidad vacía se permite | `parseReceiptReply` |
| Imagen > 4 MB tras reducir, o no JPEG | `invalid_image` | Validación en la ruta |
| Sin sesión / token caducado | 401 → mensaje de iniciar sesión | `authenticate()` |
| Sin red | Error `ai_failed` en cliente, mismo estado Error | `catch` del `fetch` |
| Ticket con la misma línea dos veces | Dos filas independientes | Sin deduplicar |

## Testing strategy
- **Unit (vitest, `tests/unit/receipt-scan.test.ts`):** `parseReceiptReply` (JSON limpio, en bloque ```json```, basura, categoría desconocida, nombres vacíos, `isFood` ausente), `toPantryItems` (solo marcadas, ids nuevos, `addedFromReceiptAt`), `buildReceiptPrompt` incluye los nombres.
- **Server (vitest, `server/tests/unit/pantry-receipt-route.test.ts`):** SDK de Anthropic simulado, como `recipes-import-route.test.ts`: 401 sin token, 429 al pasar el límite, 400 sin imagen o demasiado grande, 422 con respuesta ilegible, 502 con timeout, 200 con líneas; sin `maxRetries`; CORS.
- **E2E (Playwright, `tests/e2e/escanear-ticket.spec.ts`):** la ruta se intercepta con `page.route` (como `importar-receta.spec.ts`); subir una imagen fixture por el input de galería → lista → editar, desmarcar → añadir → artículos en la Despensa con chip «Nuevo» → Deshacer; error → Reintentar y Añadir a mano; nada cambia si se cierra sin confirmar.
- La cámara real (`capture`) se prueba a mano en el móvil.

## Tasks
1. [ ] `receiptScan.ts`: tipos, prompt, `parseReceiptReply`, `toPantryItems`, errores (R2, R4, R6)
2. [ ] `PantryItem.addedFromReceiptAt` y chip «Nuevo» en la Despensa (R7)
3. [ ] `receiptLimiter` y ruta `POST /api/pantry/receipt` con sesión, validación y Claude (R2, R5, R6)
4. [ ] `receiptImage.ts`: reducción a JPEG en el navegador (R1)
5. [ ] `ScanReceiptSheet`: elegir, cargando, lista editable, error (R1, R3, R5)
6. [ ] Botón en la Despensa, añadir y aviso de Deshacer (R4, R7)
7. [ ] Prueba manual con tickets reales en el móvil; ajustar el prompt

## Spec feedback
Ninguno: la spec se construye tal cual. Las tres preguntas abiertas de la spec quedan resueltas aquí (imagen ≤ 1600 px y ≤ 4 MB con 45 s de IA; Sonnet 5.5 con visión, sin OCR aparte; casado con la Base de alimentos dentro del mismo prompt).

## Test coverage
Escritos antes del código (dev-test, 2026-11-03). Todos fallan porque la función aún no existe.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/e2e/escanear-ticket.spec.ts › "R1: …" (sheet con cámara y galería, foto con cámara, reducción a JPEG ≤ 1600 px y ≤ 4 MB, sesión en la petición) | e2e | 🔴 failing (not built) |
| R2 | tests/unit/receipt-scan.test.ts › "R2: leer la respuesta de Claude" | unit | 🔴 failing (not built) |
| R2 | server/tests/unit/pantry-receipt-route.test.ts › "R2: un ticket legible devuelve sus líneas" (Sonnet 5.5, sin pensamiento, sin reintentos, imagen en base64) | server | 🔴 failing (not built) |
| R2 | tests/e2e/escanear-ticket.spec.ts › "R2: …" (cargando, filas, no comida desmarcada) | e2e | 🔴 failing (not built) |
| R2 | Cantidades legibles («2 x» → «2 uds»), detección de no comida, nombres limpios: dependen del modelo | manual | ⏳ tarea 7, tickets reales |
| R3, R4 | tests/unit/receipt-scan.test.ts › "R4: …" | unit | 🔴 failing (not built) |
| R3, R4 | tests/e2e/escanear-ticket.spec.ts › "R3 y R4: …" (editar, desmarcar, nombre vacío, ninguna marcada, cerrar sin confirmar, sin sumar a lo existente) | e2e | 🔴 failing (not built) |
| R5 | server/tests/unit/pantry-receipt-route.test.ts › "R5: errores" (401, 400, 422, 502, timeout 45 s, sin API key) y "Límite" (429 por usuario) | server | 🔴 failing (not built) |
| R5 | tests/e2e/escanear-ticket.spec.ts › "R5: …" (mensajes, sin red, Reintentar, Añadir a mano) | e2e | 🔴 failing (not built) |
| R6 | tests/unit/receipt-scan.test.ts › "R6: …" y server › "R6: el prompt lleva la Base de alimentos" | unit, server | 🔴 failing (not built) |
| R7 | tests/e2e/escanear-ticket.spec.ts › "R7: …" (chip Nuevo, Deshacer, Deshacer tras borrar uno) | e2e | 🔴 failing (not built) |
| R7 | El aviso de Deshacer desaparece a los 10 s | — | sin test (mismo mecanismo que la lista de la compra; decidido por el usuario) |
| R8 | — | — | Could, fuera de esta entrega |
| State | tests/e2e/escanear-ticket.spec.ts › "Estado del sheet" (reabrir empieza de cero, cerrar mientras lee cancela) | e2e | 🔴 failing (not built) |
| — | `shrinkImage` sin unit test (jsdom no dibuja imágenes); lo cubre el e2e de R1 | — | decidido por el usuario |
