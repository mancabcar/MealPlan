# Seguimiento de agua y fibra en el Diario: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Se amplía el modelo con fibra opcional (`fiber`) en entradas, alimentos y productos de Open Food Facts, con funciones puras en `src/lib/fiber.ts` que calculan el total del día y si es parcial, y se añade una novena clave sincronizada `water` ({fecha: ml}) con su tarjeta en el Diario. Se entrega en dos PRs sin feature flag (fibra, luego agua), sin dependencias nuevas. Esfuerzo: fibra L, agua M.

## Context
- Stack: Next.js 16.2.9 (AGENTS.md avisa de que difiere de lo conocido), React 19, Tailwind 4, Vitest + Playwright; servidor aparte en `server/` (rutas `/api/foods/*`, `/api/sync/*`).
- Datos por usuario en `localStorage` bajo `mp_<userId>_<clave>`; las ocho claves están en `USER_DATA_KEYS` ([src/lib/userData.ts](../../../src/lib/userData.ts)), con `LOAD_OPTIONS` (migraciones) y se repiten en `SYNC_KEYS` ([server/lib/sync.ts](../../../server/lib/sync.ts)). `store.tsx` las expone con `usePersisted`, `backup.ts` valida su forma (`SECTION_SHAPE`) y `syncMigration.ts` las recorre.
- `MealEntry` guarda una copia de los macros del momento ([src/lib/types.ts](../../../src/lib/types.ts)); `recipeEntry` y `foodEntry` ([src/lib/diary.ts](../../../src/lib/diary.ts)) los construyen; `scaleMacros` ([src/lib/foods.ts](../../../src/lib/foods.ts)) escala por gramos.
- `UserProfile` tiene `calorieGoal`, `proteinGoal`, `carbsGoal`, `fatGoal`; el Diario ([src/app/page.tsx](../../../src/app/page.tsx)) pinta kcal con `ProgressRing` y P/C/G con `MacroBar`.
- Estado ya existente (PR #119, mergeado en main el 2026-10-05): `Recipe.fiber?` y fibra por ración en las 107 recetas de `src/data/recipes.json`.
- `foods.json` (161) se genera con [scripts/build-foods.mjs](../../../scripts/build-foods.mjs) desde `scripts/foods-list.json` y el XML de CIQUAL (código de fibra 34100); los alimentos USDA llevan sus valores copiados a mano.
- Las rutas OFF ([server/app/api/foods/search/route.ts](../../../server/app/api/foods/search/route.ts) y `barcode`) normalizan con `num()` y descartan productos sin los cuatro macros.

## Approaches considered
### A. Campo `fiber` opcional + funciones puras + clave `water` (chosen)
Fibra como un campo más, opcional, que viaja en las claves existentes; el cálculo del total y del estado «parcial» vive en funciones puras; el agua es una clave sincronizada nueva `water: Record<YYYY-MM-DD, ml>`. · **Pros** sigue los patrones del repo (entradas con copia de macros, claves como `measurements`/`favorites`), la fibra no necesita migración de datos, el agua es testeable de forma aislada. · **Cons** la clave nueva toca ~8 archivos y obliga a coordinar el despliegue del servidor. · **Effort** fibra L, agua M.

### B. Fibra solo derivada de recetas y alimentos (sin guardar en la entrada)
Calcular la fibra al mostrar, buscándola en receta/alimento. · **Pros** sin cambios en `MealEntry`. · **Cons** no cubre «Personalizada» ni OFF (no hay caché local de OFF), y rompería la regla de que la entrada es una copia. · **Effort** M. Descartada.

### C. Agua como entradas especiales en `entries`
· **Pros** sin clave nueva. · **Cons** ensucia el Diario, las medias y el historial. Descartada.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipos | `src/lib/types.ts` | `MealEntry.fiber?`, `UserProfile.fiberGoal?` (PR 1); `UserProfile.waterGoalMl?`, `glassMl?` (PR 2) |
| Fibra pura | `src/lib/fiber.ts` (nuevo) | `FIBER_GOAL_DEFAULT = 38`, `fiberGoal(profile)`, `entryFiber(entry, recipes)`, `dayFiber(entries, recipes)` → `{ total, missing, count }`, `scaleFiber(per100, grams)`, `parseFiber`, límites 0–200 g y 10–100 g, formato (1 decimal) |
| Macros | `src/lib/planMacros.ts`, `src/lib/foods.ts` | `Macros.fiber?`; `slotMacros` incluye `recipe.fiber × raciones`; `Per100.fiber?` y `scaleMacros` lo escala |
| Entradas | `src/lib/diary.ts` | `recipeEntry`, `foodEntry` y la entrada «Personalizada» guardan `fiber` si hay dato; `repeatEntry` ya copia todo |
| Alimentos | `scripts/build-foods.mjs`, `scripts/foods-list.json`, `src/data/foods.json`, `src/lib/foods.ts` | El script lee la fibra de CIQUAL (34100); los USDA llevan `fiber` en la lista; `LocalFood.fiber?` y `BrandProduct.fiber?` |
| OFF | `server/app/api/foods/search/route.ts`, `barcode/route.ts` | `fiber_100g` → `fiber` con `num()`; ausente o inválido (negativo, > 100) → sin campo; no descarta el producto |
| Cliente OFF | `src/lib/useBrandSearch.ts`, `useBarcodeLookup.ts`, `FoodPicker.tsx` | Pasan `fiber` y la tarjeta del alimento lo muestra |
| Diario | `src/app/page.tsx`, `src/components/diario/` | Cuarta barra de fibra en la tarjeta de macros con chip «parcial» y aviso; etiqueta «Fibra X g / sin dato» en cada entrada; campo opcional de fibra en «Personalizada» |
| Receta | `src/app/recetas/page.tsx`, `src/components/recetas/RecipeForm.tsx`, `src/lib/recipeEdit.ts` | Quinta celda de fibra en la ficha («—» sin dato); campo opcional en el formulario |
| Perfil | `src/app/perfil/page.tsx`, `src/components/perfil/*` | Fila editable «Fibra» (10–100 g); en PR 2, «Agua» (0,5–6 L) y selector «Tamaño del vaso» |
| Agua pura | `src/lib/water.ts` (nuevo) | `WATER_GOAL_DEFAULT_ML = 2000`, `GLASS_DEFAULT_ML = 250`, `GLASS_OPTIONS`, `WATER_MAX_ML = 6000`, `addGlass/removeGlass`, `glassesFor`, `sanitizeWater` |
| Agua datos | `src/lib/userData.ts`, `store.tsx`, `backup.ts`, `syncMigration.ts`, `sync.ts`, `server/lib/sync.ts` | Novena clave `water` con `LOAD_OPTIONS`, `SECTION_SHAPE`, recarga y marca de sync |
| Agua UI | `src/components/diario/WaterCard.tsx` (nuevo), `src/app/page.tsx` | Tarjeta bajo macros+fibra con vasos tocables y − / +, «Objetivo cumplido» |
| Tests | `tests/unit/`, `server/tests/unit/`, `tests/e2e/`, `tests/fixtures/` | Ver Testing strategy |

### Data model
- `MealEntry.fiber?: number` (g, sin redondear como los macros). Ausente = sin dato; `0` es un dato. Sin migración: las entradas antiguas no lo tienen.
- Fibra de una entrada de receta antigua: `entryFiber` devuelve `entry.fiber` y, si falta y hay `recipeId` con receta que tenga `fiber`, `recipe.fiber × (entry.servings ?? 1)`. Las demás entradas sin campo cuentan como sin dato.
- `UserProfile.fiberGoal?`, `waterGoalMl?`, `glassMl?`: opcionales; `fiberGoal(profile) = profile.fiberGoal ?? 38`, etc. Sin migración de datos, `schemaVersion` sigue en 2; una copia anterior carga sin errores.
- Clave `water`: `Record<string, number>` (fecha YYYY-MM-DD → ml). `fallback: {}`; `sanitizeWater` descarta fechas mal formadas y valores no finitos, negativos o > 6000 (el tope se aplica al sumar y al cargar). Sin `*_v1_backup`.
- `SYNC_KEYS` y `USER_DATA_KEYS` pasan de ocho a nueve (PR 2); el test del servidor que cuenta ocho se actualiza.

### APIs / interfaces
- `GET /api/foods/search` y `GET /api/foods/barcode`: respuesta de cada producto gana `fiber?: number` (g/100 g). Cambio aditivo, no rompe clientes antiguos.
- Contrato de sync: `/api/sync/water` y la clave en el listado. Un cliente nuevo contra un servidor antiguo recibiría error en esa clave; mitigación en Risks.

### UI
Mapea al prototipo:
- `1`, `2`, `3` (Diario): la barra de fibra va como cuarta barra de la tarjeta de macros, sin línea divisoria; `MacroBar` se reutiliza con tono `fiber` (verde, nuevo token `--color-fiber`) y un chip opcional «parcial». El aviso «Faltan datos de fibra en N de M entradas» va bajo la barra; el día sin entradas no muestra chip.
- `1`, `6` (agua): `WaterCard` con una cuadrícula de 4 columnas de vasos tocables (botones ≥ 44 px), − / +, texto «1,25 / 2 L» y «Objetivo cumplido»; color cian nuevo (`--color-water`).
- `4` (receta): quinta celda «Fibra» en la fila de macros; «—» sin dato.
- `5` (Perfil): filas «Fibra» y «Agua» en «Objetivos diarios» y tarjeta «Tamaño del vaso» (200/250/330/500 ml).

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `fiber?` opcional en `MealEntry`, `Recipe` (ya en main), `Per100`, `LocalFood`, `BrandProduct`; ninguna ruta de código trata la ausencia como 0 |
| R2 | `dayFiber` suma `entryFiber` y cuenta las entradas sin dato; la barra y el chip salen de su resultado |
| R3 | `fiberGoal(profile)` con 38 por defecto; fila editable en Perfil con validación 10–100 g |
| R4 | Datos y tipo ya hechos en #119; esta entrega añade la quinta celda en la ficha |
| R5 | `build-foods.mjs` + `foods-list.json` con fibra; `foodEntry` usa `scaleMacros` con `fiber` |
| R6 | Rutas OFF devuelven `fiber`; la entrada se crea con `foodEntry` |
| R7 | `slotMacros` multiplica `recipe.fiber` por raciones |
| R8 | Campo opcional en `RecipeForm`/`recipeEdit` y en «Personalizada»; vacío = sin campo; `parseFiber` valida 0–200 |
| R9 | Línea de aviso y etiqueta por entrada derivadas de `dayFiber` / `entryFiber` |
| R10 | `water.ts` + `WaterCard`; el día lo marca la fecha seleccionada del Diario |
| R11 | `waterGoalMl` y `glassMl` en el perfil con helpers; Perfil los edita; los ml guardados no cambian al variar el vaso |
| R12 | `WaterCard` muestra «Objetivo cumplido» cuando `ml ≥ objetivo`; `+` sigue activo hasta 6000 ml |
| R13 | La fibra viaja en `entries`, `profile` y `recipes`, que ya se copian y sincronizan; el agua con la clave nueva en backup, store, sync y servidor |

## Risks & mitigations
- **Despliegue del servidor antes que el cliente (PR 2).** Un cliente que sincronice `water` contra un servidor sin esa clave fallaría solo en esa clave. Mitigación: desplegar `server/` antes; documentar el orden en el PR; el fallo de una clave no impide usar la app (comprobar en `sync.ts`). Riesgo aceptado: sí.
- **Total de fibra engañoso con datos incompletos.** Mitigación: chip «parcial» y aviso (R2, R9).
- **Valores de fibra aproximados** (recetas #119 estimadas; alimentos USDA copiados a mano). Se muestran como exactos, igual que los macros. Aceptado.
- **Regenerar `foods.json`** puede cambiar otros valores si el XML de CIQUAL descargado difiere del usado antes. Mitigación: comparar el diff de `foods.json` y solo aceptar cambios en el campo `fiber`; el script ya comprueba códigos y nombres.
- **`foods-data.test.ts` y snapshots** pueden depender de la forma de `foods.json`. Mitigación: ejecutar la batería completa en la tarea 5.
- **Hosting estático (#69)**: las rutas `/api/*` no existen allí, así que OFF y sync dependen del servidor; sin cambios respecto a hoy.

## Testing strategy
Unitarios (Vitest):
- `tests/unit/fiber.test.ts`: `entryFiber` (campo, receta × raciones, sin dato, 0 explícito), `dayFiber` (completo, parcial, ninguna entrada, sin entradas), `scaleFiber` (2,5 g/100 g × 150 g = 3,8), límites de `parseFiber`, formato con 1 decimal.
- `diary.test.ts`/`diary-food.test.ts`: `recipeEntry` con 2 raciones duplica la fibra; `foodEntry` con y sin fibra; personalizada con 0.
- `foods-data.test.ts`: todos los alimentos con fibra válida (0–100) o sin campo.
- `backup.test.ts`, `migrate.test.ts`: copias anteriores cargan; copia con fibra y agua se restaura.
- `tests/unit/water.test.ts`: sumar/restar, − en 0, tope 6000, vasos para 250/330/500, redondeo hacia arriba del objetivo, cambio de vaso sin alterar ml, `sanitizeWater`.
- `sync-engine.test.ts` y `server/tests/unit/sync-routes.test.ts`: nueve claves.
- `server/tests/unit/foods-route.test.ts` y `foods-barcode-route.test.ts`: `fiber_100g` presente, ausente, negativo y > 100.
e2e (Playwright):
- PR 1: Diario con entradas con y sin fibra → «parcial» y aviso; objetivo de fibra editado en Perfil se refleja; ficha de receta con y sin fibra.
- PR 2: sumar/restar vasos, recarga conserva el agua, cambio de vaso, objetivo cumplido.
Los criterios de aceptación de cada R se verifican con los tests anteriores; los de sincronización entre dispositivos, con el motor de sync en Vitest y una comprobación manual con dos sesiones.

## Tasks
PR 1 (fibra)
1. [x] Tipos (`MealEntry.fiber?`, `Macros.fiber?`, `Per100.fiber?`) y `src/lib/fiber.ts` puro con tests (R1, R2, R3, R7, R9).
2. [x] `UserProfile.fiberGoal?` y fila «Fibra» en Perfil con validación (R3).
3. [~] Las entradas guardan fibra: `recipeEntry`, `foodEntry` y «Personalizada» con `parseFiber` (R1, R7, R8).
4. [ ] Rutas OFF (`search`, `barcode`) con `fiber_100g` y tests; `BrandProduct.fiber?` y hooks del cliente (R6).
5. [ ] `build-foods.mjs` y `foods-list.json` con fibra; regenerar `foods.json`; `LocalFood.fiber?` (R5).
6. [ ] Diario: barra de fibra, chip «parcial», aviso, etiqueta por entrada, tarjeta del alimento (R2, R9).
7. [ ] Ficha de receta con la quinta celda y campo en `RecipeForm`/`recipeEdit` (R4, R8).
8. [ ] e2e de la entrega 1 y abrir el PR.

PR 2 (agua)
9. [ ] `src/lib/water.ts` con tests (R10, R11).
10. [ ] Clave `water`: `userData`, `store`, `backup`, `syncMigration`, `sync` y `server/lib/sync.ts` con sus tests (R13).
11. [ ] `waterGoalMl`/`glassMl` y filas de Perfil (R11).
12. [ ] `WaterCard` en el Diario (R10, R12).
13. [ ] e2e de agua y abrir el PR.

## Spec feedback
- R4: el dato y el tipo ya están en main por el PR #119; queda mostrarlo en la ficha. (Decidido por el usuario.)
- R1 / Edge cases: las entradas de receta anteriores recuperan su fibra de la receta (receta × raciones) en vez de ser «sin dato». Las demás entradas antiguas siguen sin dato. (Decidido por el usuario; el `spec.md` no se ha modificado todavía.)
- Abierto: dónde se obtiene el XML de CIQUAL para regenerar `foods.json` (el script no lo trae y no se commitea); lo descarga quien implemente la tarea 5.

## UI test contract (entrega 1)
Acordado con Manuel al escribir los tests (dev-test, 2026-10-05); lo fijan `tests/e2e/fibra.spec.ts` y `tests/unit/*fiber*`:
- Diario, tarjeta de macros: cuarta barra «Fibra» con chip «28 / 38»; si el día es parcial, chip «parcial» y bajo la barra «Faltan datos de fibra en N de M entradas». Cada entrada: «Fibra 9 g» o «Fibra: sin dato». Día sin entradas: «0 / 38» sin «parcial» ni aviso.
- «Añadir comida» › «Personalizada»: campo «fibra» (vacío = sin dato). «Alimento»: la tarjeta muestra «Fibra».
- Perfil › «Objetivos diarios»: fila «Fibra» («38 g») y botón «Editar fibra» → campo «Objetivo de fibra (g)» con «Guardar» (deshabilitado fuera de enteros 10–100) y «Cancelar».
- Recetas › detalle: celda «Fibra» en la fila de macros, «14 g» o «—».
- `RecipeForm`: campo «Fibra (g)» (opcional, 0–200).
- `src/lib/fiber.ts`: `FIBER_GOAL_DEFAULT`, `fiberGoal`, `entryFiber(entry, recipes)`, `dayFiber(entries, recipes)` → `{ total, missing, count }`, `scaleFiber`, `parseFiber` (número | undefined vacío | null inválido), `parseFiberGoal`, `formatFiber`.
- `recipeEdit`: `RecipeDraft.fiber: string`; `validateRecipeDraft` devuelve `recipe.fiber` solo si hay dato y `errors.fiber` si no es válido.
- Rutas OFF: `fiber` (g/100 g, 2 decimales) solo si existe y está entre 0 y 100; si no, sin la propiedad.

## Test coverage
Entrega 1 (fibra). Estado a 2026-10-05, antes de escribir el código: «🔴» = falla porque falta la función/UI; «🟢 guarda» = ya pasa y protege que no se rompa.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/unit/fiber.test.ts` › R1 / R8 y R1 / R2 (sin dato ≠ 0, receta antigua, 0 explícito) | unit | 🔴 failing (not built) |
| R1 | `tests/unit/backup-fiber.test.ts` › R1: una copia anterior carga sin errores | unit | 🟢 guarda |
| R1 / R7 | `tests/unit/diary-fiber.test.ts` › R7, R1 (recetas con/sin fibra, raciones, repetir) | unit | 🔴 failing (not built) |
| R2 | `tests/unit/fiber.test.ts` › R2: total del día (completo, parcial, sin datos, vacío, 0) | unit | 🔴 failing (not built) |
| R2 | `tests/e2e/fibra.spec.ts` › R2 (barra, chip «parcial», día vacío, receta antigua, supera objetivo) | e2e | 🔴 failing (not built) |
| R3 | `tests/unit/fiber.test.ts` › R3 (38 por defecto, `parseFiberGoal` 10–100 enteros) | unit | 🔴 failing (not built) |
| R3 | `tests/e2e/fibra.spec.ts` › R3 (Perfil: ver, editar, validar, cancelar; el Diario lo usa) | e2e | 🔴 failing (not built) |
| R4 | `tests/e2e/fibra.spec.ts` › R4 (ficha con «14 g» y con «—») | e2e | 🔴 failing (not built) |
| R5 | `tests/unit/fiber.test.ts` › R5 (`scaleFiber`, formato) y `diary-fiber.test.ts` › R5 | unit | 🔴 failing (not built) |
| R5 | `tests/unit/foods-fiber-data.test.ts` (161 alimentos con fibra válida y valores razonables) | unit | 🔴 failing (not built) |
| R5 | `tests/e2e/fibra.spec.ts` › R5 (150 g de lentejas cocidas) | e2e | 🔴 failing (not built) |
| R6 | `server/tests/unit/foods-fiber-routes.test.ts` (search y barcode: presente, 0, ausente, negativa, > 100) | unit (servidor) | 🔴 con fibra (4) · 🟢 guarda sin fibra (6) |
| R7 | `tests/unit/diary-fiber.test.ts` › R7 (1, 2 y 0,5 raciones) | unit | 🔴 failing (not built) |
| R8 | `tests/unit/recipe-edit-fiber.test.ts`, `tests/unit/RecipeForm-fiber.test.tsx` | unit / componente | 🔴 failing (not built) |
| R8 | `tests/e2e/fibra.spec.ts` › R8 («Personalizada» con 4,5 / vacía / 0) | e2e | 🔴 failing (not built) |
| R9 | `tests/e2e/fibra.spec.ts` › R9 (aviso «3 de 5» y etiquetas por entrada) | e2e | 🔴 failing (not built) |
| R13 (fibra) | `tests/unit/backup-fiber.test.ts` › R13: restaura fibra y objetivo | unit | 🟢 guarda |

Pendiente de la entrega 2 (agua, R10–R13): sus tests se escriben antes de esa entrega (`water.test.ts`, sync de la novena clave, `water.spec.ts`).
