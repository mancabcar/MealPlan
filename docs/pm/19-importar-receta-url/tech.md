# Importar una receta desde una URL: Technical design
_Status: Draft · Updated: 2026-09-30_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Una ruta nueva `POST /api/recipes/import` en `server/` (Vercel) descarga la página de forma segura, extrae el JSON-LD `Recipe` sin IA y, solo si no hay, pide a Claude Haiku 4.5 que extraiga la receta del texto y estime macros. En el front, un Sheet pide la URL y abre `RecipeForm` prerrellenado con avisos. Sin dependencias nuevas. Esfuerzo: M.

## Context
- Front estático (`output: "export"`, IONOS) en la raíz; rutas de servidor en el proyecto aparte `server/` (Vercel, Node) por #69: `server/app/api/recipes/route.ts`, `server/app/api/foods/*`. Comparten lógica pura importando `../../../../src/lib/...` por ruta relativa.
- El cliente llama con `apiUrl(path)` ([src/lib/apiBase.ts](../../../src/lib/apiBase.ts)).
- CORS: [server/lib/cors.ts](../../../server/lib/cors.ts), único origen `CORS_ALLOWED_ORIGIN`. **Hoy `/api/recipes` no tiene más protección**: ni auth ni límite de peticiones; CORS solo lo aplican los navegadores.
- Modelo: `Recipe` en [src/lib/types.ts](../../../src/lib/types.ts), macros por ración, `calories` obligatorio al guardar ([src/lib/recipeEdit.ts](../../../src/lib/recipeEdit.ts) `validateRecipeDraft`). El backup solo valida que la receta tenga `id` ([src/lib/backup.ts](../../../src/lib/backup.ts)).
- Formulario: [src/components/recetas/RecipeForm.tsx](../../../src/components/recetas/RecipeForm.tsx) (Sheet; con `recipe` edita, sin él crea `custom_<uuid>`). Página: [src/app/recetas/page.tsx](../../../src/app/recetas/page.tsx) (`editing: Recipe | "new" | null`).
- Tests de servidor en `server/tests/unit` (Vitest, alias `@` → `../src`); tests de la raíz en `tests/unit` y `tests/e2e` (Playwright).

## Approaches considered
### A. Una ruta que hace todo, lógica pura compartida (chosen)
`POST /api/recipes/import {url}` → descarga segura → JSON-LD → fallback a IA → respuesta única con la receta. Parser y utilidades puras en `src/lib/recipeImport.ts`, red y límite en `server/lib/`. **Pros:** un solo viaje, la clave de Claude no sale del servidor, testeable por capas, sigue el patrón de #69. **Cons:** código propio para SSRF y HTML. **Effort:** M.
### B. Dos rutas (JSON-LD gratis, IA a petición)
Más control de coste, pero la spec (R3) pide fallback automático y duplicaría descarga y validación. Descartada.
### C. Librerías (parser HTML, anti-SSRF)
Menos código propio, pero dependencias nuevas en `server/` para lo que se resuelve con regex y `node:https`. Descartada por el usuario.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica pura | `src/lib/recipeImport.ts` (nuevo) | `findRecipeJsonLd(html)`, `recipeFromJsonLd(node)` (nombre, ingredientes, pasos aplanando `HowToStep`/`HowToSection`, `PT30M`→minutos, `nutrition` → números, `recipeYield`→`servingsHint`, `recipeCategory`→`tagHint`), `htmlToText(html, maxChars)`, `validateImportUrl(raw)`, `isPrivateAddress(ip)`, `parseAiRecipe(text)`, prompt de extracción, tipos `ImportedRecipe` / `ImportResponse` |
| Servidor | `server/lib/safeFetch.ts` (nuevo) | DNS con `dns.lookup(all)`, rechaza si alguna IP es privada/loopback/link-local, conecta con `node:https`/`node:http` con `lookup` fijado a la IP validada, redirecciones a mano (máx. 3, revalidando cada salto), timeout 8 s, corta a 2 MB |
| Servidor | `server/lib/rateLimit.ts` (nuevo) | Ventana en memoria por IP (`x-forwarded-for`), 10 peticiones/10 min, con limpieza de entradas viejas |
| Servidor | `server/app/api/recipes/import/route.ts` (nuevo) | `OPTIONS` + `POST` con `withCors`; `maxDuration = 30`; orden: límite → validar URL → descargar → JSON-LD → si no, Claude `claude-haiku-4-5-20251001` → respuesta; errores con código estable (`invalid_url`, `blocked`, `fetch_failed`, `no_recipe`, `rate_limited`) |
| Modelo | `src/lib/types.ts` | `Recipe.macrosEstimated?: true`, `Recipe.sourceUrl?: string` |
| Front | `src/components/recetas/ImportRecipeSheet.tsx` (nuevo) | Campo URL, estados carga/error con "Crear a mano", llama con `apiUrl("/api/recipes/import")` |
| Front | `src/components/recetas/RecipeForm.tsx` | Prop `imported?: { recipe: Partial<Recipe>, notices: string[] }`: modo "Nueva receta" con borrador precargado y avisos; al editar un macro/kcal se quita `macrosEstimated`; al guardar conserva `sourceUrl`/`macrosEstimated` |
| Front | `src/app/recetas/page.tsx` | Botón "Importar desde URL" junto a "Nueva receta"; ficha con chip "Macros estimados" y enlace de origen |
| Docs | `README.md` | Nota sobre la ruta nueva y sus límites |

### Data model
`Recipe` gana dos campos opcionales: `macrosEstimated?: true` y `sourceUrl?: string`. Sin migración: localStorage y backup no exigen más que `id`. La respuesta de la ruta:
```ts
type ImportResponse =
  | { recipe: { name: string; ingredients: string[]; instructions: string[]; prepTimeMinutes?: number;
                calories?: number; protein?: number; carbs?: number; fat?: number };
      source: "jsonld" | "ai"; servingsHint?: string; tagHint?: string }
  | { error: "invalid_url" | "blocked" | "fetch_failed" | "no_recipe" | "rate_limited"; message: string };
```

### APIs / interfaces
- **`POST /api/recipes/import`** body `{ url: string }`. Límites: 2 MB de descarga, 8 s por descarga, 3 redirecciones, 30.000 caracteres de texto a Claude, `maxDuration` 30 s, 10 peticiones/10 min por IP. CORS igual que el resto (`CORS_ALLOWED_ORIGIN`).
- Contexto de la IA: solo el texto de la página; el resultado se valida en forma (`parseAiRecipe`) antes de devolverse, y `macrosEstimated` se deriva de `source === "ai"`.

### UI
Sin prototipo (`pm-prototype` no aplica; se reutilizan Sheet, Chip e inputs del sistema). `ImportRecipeSheet` → al éxito cierra y abre `RecipeForm` con `imported`. Avisos en el formulario: "Macros estimados por IA: revísalos" (source ai) o "La web indica N raciones; revisa que los macros sean por ración" (`servingsHint`). Cancelar/cerrar no guarda nada (R5) porque la receta solo existe como borrador del formulario.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Botón + `ImportRecipeSheet` + `RecipeForm imported` en `page.tsx` |
| R2 | `findRecipeJsonLd`/`recipeFromJsonLd`; la ruta no llama a Anthropic si hay `Recipe` (incl. `@graph`, listas) |
| R3 | Fallback `htmlToText` → Claude Haiku 4.5 → `parseAiRecipe` |
| R4 | `source: "ai"` → aviso en el formulario + `macrosEstimated: true` al guardar, mostrado con Chip; se quita si se edita un macro |
| R5 | La receta es solo borrador de formulario; `saveRecipe` solo se llama en "Guardar" |
| R6 | Errores con código estable y mensaje por causa; "Crear a mano" abre el formulario vacío con `sourceUrl`; sin reintentos de IA |
| R7 | CORS + `rateLimit` + `validateImportUrl` + `safeFetch` (IP validada y fijada, redirecciones revalidadas) + límites de tamaño/tiempo; clave solo en servidor |
| R8 | Cambiada (ver Spec feedback): `servingsHint` como pista, sin convertir |
| R9 | `sourceUrl` guardado y enlace en la ficha |

## Risks & mitigations
- **Límite de peticiones en memoria no es global** (una instancia de Vercel por región/concurrencia). Frena abuso casual, no un ataque decidido; el coste máximo por importación queda acotado. **Aceptado.** Mejora real cuando lleguen cuentas (#22).
- **SSRF / DNS rebinding:** mitigado conectando a la IP ya validada y revalidando cada redirección; tests con IPs privadas, IPv6 y redirección a interna.
- **Webs con JavaScript o anti-bot** fallarán o darán texto vacío → `fetch_failed`/`no_recipe` con "Crear a mano". **Aceptado.**
- **Prompt injection** desde el contenido de la página hacia Claude: el resultado solo rellena un formulario que el usuario revisa y se valida su forma. **Aceptado.**
- **Macros de la web mal declarados:** no detectable; se muestra pista de raciones. **Aceptado.**
- **Proyecto `server/` desplegado en Vercel:** la ruta nueva requiere redeploy; `ANTHROPIC_API_KEY` y `CORS_ALLOWED_ORIGIN` ya existen.

## Testing strategy
- **Unit (raíz, `tests/unit`)** para `recipeImport.ts`: JSON-LD directo, `@graph`, lista, `HowToSection`, `PT1H30M`, `nutrition` con textos ("350 kcal"), sin `nutrition`, `htmlToText`, `validateImportUrl`, `isPrivateAddress` (v4/v6).
- **Unit (`server/tests/unit`)**: `safeFetch` (IP privada rechazada, redirección a interna, tamaño, timeout) con red simulada; `rateLimit`; ruta con `safeFetch` y Anthropic mockeados: JSON-LD → Anthropic no se llama; sin JSON-LD → IA; errores por código; 429; CORS (origen permitido/no).
- **E2E (Playwright, `page.route`)**: importar JSON-LD sin aviso; importar IA con aviso y chip tras guardar; error con "Crear a mano"; cerrar el formulario no guarda; editar un macro quita el distintivo.
- Cada criterio de aceptación de la spec se cubre con al menos uno de los anteriores.

## Tasks
1. [x] `src/lib/recipeImport.ts` + unit tests: parser JSON-LD, ISO 8601, HTML→texto, validación de URL/IP, tipos (covers R2, R7)
2. [x] `server/lib/safeFetch.ts` y `server/lib/rateLimit.ts` + tests (covers R7)
3. [x] `POST /api/recipes/import` con prompt y `parseAiRecipe`, CORS y errores + tests con mocks (covers R2, R3, R6, R7)
4. [ ] `Recipe.macrosEstimated`/`sourceUrl` y chip/enlace en la ficha (covers R4, R9)
5. [ ] `ImportRecipeSheet`, prop `imported` en `RecipeForm`, botón en Recetas, avisos y limpieza de `macrosEstimated` (covers R1, R4, R5, R6, R8)
6. [ ] E2E con la ruta interceptada y nota en README (covers R1–R6, R9)

## Spec feedback
- **R7 ajustada** (decidido por el usuario): "las mismas protecciones que `/api/recipes`" significaba solo CORS. Se sustituye por CORS + límite de peticiones por IP en memoria + límites de tamaño/tiempo; sin autenticación (queda para #22).
- **R8 cambiada** (decidido por el usuario): en `schema.org` `nutrition` ya es por ración y no se puede detectar de forma fiable si es de la receta entera. En lugar de convertir, se muestra `recipeYield` como pista para que el usuario revise.
- Límites concretos fijados: 2 MB, 8 s, 3 redirecciones, 30.000 caracteres, `maxDuration` 30 s, 10 peticiones/10 min por IP.
- Modelo de IA del fallback: Haiku 4.5.
- Sin preguntas abiertas que bloqueen la implementación.

## Test coverage
Todos los tests están escritos antes del código (🔴 = falla porque la feature no está construida). El contrato de cada módulo y los textos de UI acordados están en el encabezado de cada fichero. Datos compartidos: `tests/fixtures/importar-receta.ts`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/e2e/importar-receta.spec.ts › "R1: el botón y el flujo de importación" (botón, diálogo, "Importando…", formulario prerrellenado) | e2e | 🔴 failing (not built) |
| R1, R2 | tests/unit/RecipeForm-import.test.tsx › "R1/R2: el formulario se abre prerrellenado con lo importado" | unit | 🔴 failing (not built) |
| R2 | tests/unit/recipe-import.test.ts › "R2: extractJsonLdRecipe" (directo, `@graph`, lista, HowToSection, ISO 8601, sin `nutrition`, JSON mal formado, sin Recipe) | unit | 🔴 failing (not built) |
| R2 | server/tests/unit/recipes-import-route.test.ts › "R2: con JSON-LD no se llama a la IA" (Anthropic no se llama, sin API key) | unit | 🔴 failing (not built) |
| R2, R8, R9 | tests/e2e/importar-receta.spec.ts › "R2 / R8 / R9: importación con JSON-LD" | e2e | 🔴 failing (not built) |
| R3 | tests/unit/recipe-import.test.ts › "R3: htmlToText" y "R3: parseAiRecipe" | unit | 🔴 failing (not built) |
| R3 | server/tests/unit/recipes-import-route.test.ts › "R3: sin JSON-LD, Claude extrae la receta" (Haiku 4.5, 30.000 caracteres, por ración) | unit | 🔴 failing (not built) |
| R3, R4 | tests/e2e/importar-receta.spec.ts › "R3 / R4: importación con IA" (aviso, chip, quitar marca al editar) | e2e | 🔴 failing (not built) |
| R4 | tests/unit/RecipeForm-import.test.tsx › "R4: macros estimados por IA" (aviso, `macrosEstimated`, quitar al cambiar kcal/P/C/G, conservar al cambiar solo el nombre, receta guardada) | unit | 🔴 failing (not built) |
| R5 | tests/unit/RecipeForm-import.test.tsx › "R5: nada se guarda sin confirmar" | unit | 🟢 passes (guarda de regresión; no prueba la feature hasta que exista `imported`) |
| R5 | tests/e2e/importar-receta.spec.ts › "R5: nada se guarda sin confirmar" (cerrar formulario y cerrar diálogo) | e2e | 🔴 failing (not built) |
| R6 | server/tests/unit/recipes-import-route.test.ts › "R6: errores" (sin reintentos de IA) y server/tests/unit/safe-fetch.test.ts › "R6: fallos de descarga" | unit | 🔴 failing (not built) |
| R6 | tests/e2e/importar-receta.spec.ts › "R6: errores" (los 5 códigos, sin conexión, reintento, "Crear a mano") | e2e | 🔴 failing (not built) |
| R7 | tests/unit/recipe-import.test.ts › "R7: validateImportUrl" / "R7: isPrivateAddress" | unit | 🔴 failing (not built) |
| R7 | server/tests/unit/safe-fetch.test.ts › "R7: destinos internos", "redirecciones", "tamaño máximo", "tiempo máximo" | unit | 🔴 failing (not built) |
| R7 | server/tests/unit/rate-limit.test.ts › "R7: createRateLimiter" / "importLimiter" | unit | 🔴 failing (not built) |
| R7 | server/tests/unit/recipes-import-route.test.ts › "R7: validación de la URL", "límite de peticiones por IP", "CORS" | unit | 🔴 failing (not built) |
| R8 | tests/unit/RecipeForm-import.test.tsx › "R8: pista de raciones" y tests/unit/recipe-import.test.ts › `servingsHint` | unit | 🔴 failing (not built) |
| R9 | tests/unit/RecipeForm-import.test.tsx › "R9: URL de origen" y tests/e2e/importar-receta.spec.ts (enlace "Ver receta original") | unit + e2e | 🔴 failing (not built) |
| — | tests/e2e/importar-receta.spec.ts › "Accesibilidad" (axe en el diálogo y el formulario importado) | e2e | 🔴 failing (not built) |

Supuestos de los tests que Manuel puede revisar (ver el hand-off de dev-test): las peticiones con URL inválida cuentan para el límite; sin `x-forwarded-for` todas comparten la clave "unknown"; el texto "Importando…"; el botón "Cerrar" de los diálogos.
