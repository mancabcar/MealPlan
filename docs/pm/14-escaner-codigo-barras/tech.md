# Escáner de código de barras: Technical design
_Status: Draft · Updated: 2026-09-28_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Extiende el patrón de #13 (base de alimentos) con un tercer camino de búsqueda: por código de barras en vez de por nombre. Un botón «Escanear» abre un visor de cámara (`BarcodeDetector` nativo, o el polyfill `barcode-detector` donde no exista) dentro del `Sheet` ya usado en la app; al detectar un código, o al escribirlo a mano, se busca en un nuevo proxy `GET /api/foods/barcode` a la API de producto de Open Food Facts. El resultado reutiliza la tarjeta de cantidad que ya existe para productos de marca. Efecto: M.

## Context
- `src/components/diario/FoodPicker.tsx` — pestaña Alimento de «Añadir comida»: búsqueda por nombre, bloques «Básicos»/«Productos de marca», tarjeta de cantidad (`Selected`/`pick`), `onManual` para caer a Personalizada.
- `src/lib/useBrandSearch.ts` — hook de búsqueda de marca: state machine (`idle/loading/ok/offline/error/rate_limited`), límite de peticiones por minuto en `sessionStorage` (`OFF_LIMIT`, `offCooldown` en `src/lib/foods.ts`), cuenta atrás con `Date.now()`.
- `src/app/api/foods/search/route.ts` — proxy server-side a Search-a-licious (`search.openfoodfacts.org`) con `User-Agent` fijo, timeout de 8 s con `AbortController`, y validación de que el producto trae los 4 macros por 100 g antes de devolverlo.
- `src/lib/foods.ts` — tipos `Per100`, `BrandProduct` (con `code`, ya pensado para `MealEntry.foodId = "off:<code>"`), `FOODS`, límites (`OFF_LIMIT`).
- `src/components/ui/Sheet.tsx` — hoja modal reutilizable: overlay, foco atrapado, cierre con Escape o toque fuera, `role="dialog"`.
- `src/lib/types.ts` — `MealEntry.foodId` ya admite `"off:<code>"`: no hace falta ningún cambio de modelo de datos.
- Tests: `tests/unit/foods-route.test.ts` (proxy de búsqueda, fetch simulado), `tests/unit/useBrandSearch.test.tsx` (hook), `tests/e2e/food.spec.ts` (Playwright). `vitest.config.mts` usa `environment: "node"` por defecto; los archivos de componente añaden `// @vitest-environment jsdom`.

## Approaches considered
### A. Extender el patrón de #13 con un tercer camino (código en vez de nombre) (chosen)
Nuevo proxy `GET /api/foods/barcode`, nuevo hook `useBarcodeLookup` (mismo state machine que `useBrandSearch`, con su propio contador de límite), nuevo componente `BarcodeScanner` sobre `Sheet`, y cableado en `FoodPicker`. Reutiliza `BrandProduct`, la tarjeta de cantidad y `onManual` tal cual.
**Pros**: coherente con el código y las convenciones ya revisadas en #13; superficie nueva pequeña y aislada (un endpoint, un hook, un componente); nada toca el modelo de datos.
**Cons**: dos hooks casi gemelos (`useBrandSearch`/`useBarcodeLookup`) en vez de uno parametrizado.
**Effort**: M.

### B. Buscar en OFF directamente desde el cliente, sin proxy propio
El navegador llama directamente a `world.openfoodfacts.org` con `fetch`.
**Pros**: menos código (sin ruta de servidor).
**Cons**: pierde el `User-Agent` fijo que #13 ya decidió necesario para identificarse ante OFF; sujeto a los CORS que OFF decida permitir; el manejo de límite de peticiones y errores quedaría duplicado en el cliente en vez de centralizado como en R4/R11 de #13. Descartado (decisión del usuario).
**Effort**: S, pero rechazado por consistencia y control.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Proxy de código de barras | `src/app/api/foods/barcode/route.ts` | Nuevo. `GET ?code=<ean>` → `world.openfoodfacts.org/api/v2/product/<code>.json`. |
| Tipos y helpers compartidos | `src/lib/foods.ts` | Añade `BARCODE_LIMIT` (o reutiliza forma de `OFF_LIMIT` con su propia constante) y un helper de validación de macros compartido entre las dos rutas si se puede extraer sin forzarlo. |
| Hook de búsqueda por código | `src/lib/useBarcodeLookup.ts` | Nuevo. Mismo state machine que `useBrandSearch`, con claves de `sessionStorage` propias (`mp_barcode_searches`, `mp_barcode_blocked_until`). |
| Visor de cámara | `src/components/diario/BarcodeScanner.tsx` | Nuevo. `Sheet` + `<video>` + bucle de detección (`BarcodeDetector` nativo o polyfill). |
| Integración en Alimento | `src/components/diario/FoodPicker.tsx` | Añade botón «Escanear», campo «o escribe el código» + botón «Buscar», y el `BarcodeScanner` condicional. Al encontrar producto, reutiliza `pick(fromBrand(product))`; al fallar, reutiliza `onManual`. |
| Dependencia nueva | `package.json` | Añade `barcode-detector` (polyfill, carga perezosa). |
| Datos de prueba | `tests/fixtures/foods.ts` | Añade fixtures de respuesta de `v2/product/<code>.json` (encontrado, no encontrado, sin macros). |

### Data model
Ninguno. `MealEntry.foodId = "off:<code>"` ya cubre tanto el producto encontrado por nombre como por código de barras; no hay forma de distinguir el origen en el dato guardado (ver Open questions del spec, sobre la métrica de éxito).

### APIs / interfaces
**`GET /api/foods/barcode?code=<ean>`**
- Valida `code` (dígitos, longitud típica de EAN/UPC 8–14); `400` si no es válido.
- Llama a `https://world.openfoodfacts.org/api/v2/product/<code>.json?fields=code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_quantity_unit` con el mismo `User-Agent` y timeout de 8 s que `/api/foods/search`.
- Respuesta de OFF: `{ status: 1, product: {...} }` si existe, `{ status: 0 }` si no.
- Mapea `product` al mismo `BrandProduct` (reutilizando la lógica de `toProduct` de `route.ts`, extraída o duplicada — a decidir al implementar, sin que cambie el comportamiento).
- Devuelve:
  - `{ product: BrandProduct }` si existe y tiene los 4 macros.
  - `{ error: "not_found" }` (`404`) si OFF no tiene el código, o el producto no tiene los 4 macros (mismo criterio que R4 de #13).
  - `{ error: "rate_limited", retryAfter }` (`429`) si OFF limita.
  - `{ error: "unavailable" }` (`502`) sin red, timeout o error de OFF.

### UI
- **`FoodPicker`**: antes del buscador por nombre (o justo debajo, a decidir en la maqueta del propio código, sin prototipo previo), botón «Escanear» y, siempre visible bajo él, un campo de texto «o escribe el código» con un botón «Buscar». Al encontrar, mismo camino que un resultado de marca (`pick(fromBrand(...))`). Al fallar (no encontrado, sin macros, error, límite), llama a `onManual` con el código anotado en el nombre (p. ej. `Código 8410000123456`), igual que hace hoy con el texto buscado (R14 de #13).
- **`BarcodeScanner`**: se monta dentro de un `Sheet` con título «Escanear código». Al montar, pide `getUserMedia({ video: { facingMode: "environment" } })`.
  - Si se concede: muestra el `<video>` con el stream y arranca un bucle (`requestAnimationFrame`) que llama a `detector.detect(video)` en cada frame (`BarcodeDetector.detect()` acepta `HTMLVideoElement` directamente, sin canvas intermedio). Al primer código válido, para el stream, cierra el Sheet y entrega el código al padre.
  - Si se deniega o falla (`NotAllowedError`, `NotFoundError`, sin `mediaDevices`): muestra el mensaje «No se ha podido acceder a la cámara» con un botón «Escribe el código» que cierra el Sheet sin más (R6: el campo ya está visible en `FoodPicker`).
  - `BarcodeDetector`: si `window.BarcodeDetector` existe, se usa tal cual; si no, se importa `barcode-detector` de forma perezosa (`await import("barcode-detector/pure")` o equivalente) antes de instanciar, para no cargar el WASM en quien sí tiene soporte nativo.
  - Cerrar el Sheet (botón, Escape, tocar fuera) para el stream (`track.stop()`) y no busca nada.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Botón «Escanear» + campo «o escribe el código» + «Buscar», siempre visibles en `FoodPicker`. |
| R2 | `BarcodeScanner` pide permiso y abre el visor; usa `BarcodeDetector` nativo o el polyfill `barcode-detector`. |
| R3 | Al detectar, el visor se cierra y se llama a `GET /api/foods/barcode?code=...`. |
| R4 | Producto con los 4 macros → `pick(fromBrand(product))`, misma tarjeta que hoy. |
| R5 | `not_found` (no existe, sin macros, o error de red/límite) → `onManual` con el código anotado. |
| R6 | Campo «o escribe el código» + botón «Buscar» siempre visible, mismo camino que R3–R5. |
| R7 | Botón de cerrar del propio `Sheet` (ya trae Escape y toque fuera). |
| R8 | El bucle de detección para en el primer código válido y cierra el Sheet. |

## Risks & mitigations
- **`getUserMedia` requiere contexto seguro** (HTTPS, o `localhost` en desarrollo): `next dev` en `http://localhost` cae dentro de la excepción de "secure context" de los navegadores, así que funciona en desarrollo sin certificado. En producción, la app ya se sirve por HTTPS (ver despliegue existente). Riesgo aceptado, sin mitigación adicional.
- **Safari/iOS sin `BarcodeDetector` nativo** (a 2026): cubierto por el polyfill `barcode-detector`, cargado solo cuando falta el nativo.
- **Tamaño del polyfill** (usa zxing-wasm): con `import()` perezoso, solo se descarga la primera vez que se abre el visor en un navegador sin soporte nativo; no afecta al bundle inicial ni a quien nunca escanea.
- **OFF puede no tener el producto, o tenerlo incompleto**: mismo riesgo ya aceptado en #13 para la búsqueda por nombre; se resuelve igual, cayendo a Personalizada.
- **Dos contadores de límite de peticiones** (búsqueda por nombre y por código) podrían confundir si se documentan mal: se anota en el código de cada hook a qué API de OFF corresponde cada uno.

## Testing strategy
- **`tests/unit/foods-barcode-route.test.ts`** (mismo patrón que `foods-route.test.ts`, `fetch` simulado): código válido con macros completos → `BrandProduct`; código inexistente (`status: 0`) → `404 not_found`; producto sin algún macro → `404 not_found`; `429` de OFF → `rate_limited` con `retryAfter`; timeout/red/JSON inválido → `502 unavailable`; código con formato inválido → `400`.
- **`tests/unit/useBarcodeLookup.test.tsx`** (mismo patrón que `useBrandSearch.test.tsx`): transición de estados, contador de límite propio en `sessionStorage`, reintento.
- **`tests/unit/BarcodeScanner.test.tsx`** (`// @vitest-environment jsdom`, mocks de `navigator.mediaDevices.getUserMedia` y de una clase `BarcodeDetector` falsa en `window`): permiso concedido → arranca el bucle y entrega el primer código detectado, cerrando el Sheet (R2, R3, R8); permiso denegado → mensaje + botón que cierra sin buscar nada (R6); cerrar sin escanear → no llama a la API (R7); sin `BarcodeDetector` nativo → importa el polyfill (se verifica con un mock del módulo).
- **`tests/e2e/food.spec.ts`** (mismo patrón que #13: sin componente aparte para `FoodPicker`, la integración se prueba en e2e): añade el camino de código escrito a mano (sin cámara real), interceptando `/api/foods/barcode` con Playwright (`page.route`): botón y campo visibles (R1); código encontrado con macros completos → tarjeta de cantidad (R4, R6); código no encontrado → Personalizada con «Código `<código>`» ya escrito (R5); error de red → «Reintentar», que repite la búsqueda (R5); límite de peticiones (429) → mismo bloque de error (R5). La cámara/`BarcodeDetector` no se prueban en e2e (decisión del usuario): los cubre `BarcodeScanner.test.tsx`.

#### UI test contract
Nombres accesibles que usan `tests/unit/BarcodeScanner.test.tsx` y `tests/e2e/food.spec.ts` (acordados en dev-test, 2026-09-28):
- Botón «Escanear» y campo con etiqueta «Código de barras», junto al buscador por nombre en `FoodPicker`.
- Botón «Buscar código» junto al campo (distinto de «Buscar «‹q›» en productos de marca»).
- `BarcodeScanner`: al detectar, llama a `onDetected(code)` una sola vez y para el stream de cámara; al cerrarse sin detectar (Escape, botón de `Sheet`), llama a `onClose()` sin llamar a `onDetected`.
- Permiso de cámara denegado o no disponible: texto «No se ha podido acceder a la cámara» y botón «Escribe el código» que cierra el visor (llama a `onClose()`).
- Código no encontrado / sin macros: cae a Personalizada con el campo «Nombre» relleno con «Código `<código>`» (mismo mecanismo `onManual(name)` que R14 de #13).
- Error de red o límite de peticiones al buscar por código: botón «Reintentar» (igual que el bloque de errores de marcas de #13).
- Sin `BarcodeDetector` nativo en `window`, `BarcodeScanner` importa `"barcode-detector/side-effects"` (define `window.BarcodeDetector` como efecto secundario) antes de instanciarlo, para no bifurcar el código de detección entre nativo y polyfill.

## Test coverage
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/e2e/food.spec.ts › "R1: el botón Escanear y el campo de código son visibles junto al buscador" | e2e | 🔴 failing (not built) |
| R2 | tests/unit/BarcodeScanner.test.tsx › "R2: apertura del visor y permiso de cámara" (3 tests) | unit/component | 🔴 failing (not built) |
| R3 | tests/unit/foods-barcode-route.test.ts › "R3: petición al endpoint de producto de OFF" (4 tests); tests/unit/BarcodeScanner.test.tsx › "R3 · R8: detección" | unit | 🔴 failing (not built) |
| R4 | tests/unit/foods-barcode-route.test.ts › "R4: normalización del producto encontrado" (2 tests); tests/unit/useBarcodeLookup.test.tsx › "R4: búsqueda por código" (3 tests); tests/e2e/food.spec.ts › "R4 · R6: un código que existe en OFF..." | unit + e2e | 🔴 failing (not built) |
| R5 | tests/unit/foods-barcode-route.test.ts › "R5: código no encontrado..." y "R5: error de red o límite de peticiones" (9 tests); tests/unit/useBarcodeLookup.test.tsx › "R5: límite propio de peticiones" (3 tests); tests/e2e/food.spec.ts › 3 tests "R5: ..." | unit + e2e | 🔴 failing (not built) |
| R6 | tests/unit/BarcodeScanner.test.tsx › "R6: permiso denegado o sin cámara"; cubierto también por los e2e de código manual (R4/R5) | unit/component + e2e | 🔴 failing (not built) |
| R7 | tests/unit/BarcodeScanner.test.tsx › "R7: cerrar sin escanear" | unit/component | 🔴 failing (not built) |
| R8 | tests/unit/BarcodeScanner.test.tsx › "R3 · R8: detección" | unit/component | 🔴 failing (not built) |

Los 3 archivos nuevos (`foods-barcode-route.test.ts`, `useBarcodeLookup.test.tsx`, `BarcodeScanner.test.tsx`) fallan hoy porque los módulos de producción no existen (`Cannot find module`/`Failed to resolve import`), no por ningún error de sintaxis: son los tests que dev-code debe poner en verde. El resto de la suite (779 tests) sigue en verde; `tests/e2e/food.spec.ts` no se ha podido ejecutar en este paso (Playwright necesita el servidor de la app), pero pasa `npx eslint` y `tsc --noEmit` sin avisos nuevos.

## Tasks
1. [x] `GET /api/foods/barcode` + fixtures + tests (R3, R4, R5 red/límite) — sin tocar UI. **Tests que debe poner en verde**: `tests/unit/foods-barcode-route.test.ts`.
2. [x] `useBarcodeLookup` + tests (state machine, límite propio). **Tests**: `tests/unit/useBarcodeLookup.test.tsx`.
3. [x] Añadir dependencia `barcode-detector`; componente `BarcodeScanner` (Sheet + getUserMedia + bucle de detección + polyfill perezoso vía `barcode-detector/side-effects`) + tests con mocks (R2, R3, R6, R7, R8). **Tests**: `tests/unit/BarcodeScanner.test.tsx`.
4. [x] Cablear en `FoodPicker`: botón «Escanear», campo «Código de barras» + «Buscar código», integración con `useBarcodeLookup` y `BarcodeScanner`, caída a `onManual` con «Código `<código>`» (R1, R3–R6). **Tests que debe poner en verde**: los e2e de `tests/e2e/food.spec.ts › "Escáner de código de barras (#14)"`.
5. [x] Verificación manual en el móvil (criterio de aceptación del issue: escanear un producto real conocido) antes de abrir el PR. Hecha en escritorio contra la API real de OFF (ver PR): sin cámara real disponible en el entorno de verificación, queda pendiente que @mancabcar confirme el camino de cámara en un móvil real antes o después de mergear.

## Spec feedback
Ninguno: el spec se mantiene tal cual. La única pregunta abierta del spec (cómo instrumentar el % de escaneo vs. búsqueda por nombre para la métrica de éxito) sigue abierta — no bloquea estas tareas, ya que `MealEntry` no distingue el origen y añadirlo excede el alcance de esta entrega.
