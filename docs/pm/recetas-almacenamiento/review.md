# Separar el catálogo de recetas de las del usuario: Review
_PR: [#133](https://github.com/mancabcar/MealPlan/pull/133) · Reviewed: 2026-10-05 · Verdict: ⚠️ approved with follow-ups_

## Summary
El PR cumple los 6 Must (R1–R6) y el Should relajado (R7), cada uno con test automático, y las suites completas pasan (unit 1349/1349, e2e 517 con 5 saltados previos; `tsc`, `eslint` y `build` limpios). El code review (nivel `high`) no encontró bugs que rompan un requisito: quedan 5 hallazgos menores, todos non-blocking por decisión del usuario. Se acepta la guardia de `removeRecipe` (solo recetas del usuario), no prevista en `tech.md`.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/lib/catalog.ts:9`, `src/lib/store.tsx:118` | ✅ `store-catalog-change.test.tsx` |
| R2 | ✅ Done | `src/lib/userData.ts:48`, `src/lib/store.tsx:117` | ✅ `store-catalog.test.tsx`, `recipe-catalog.test.ts` |
| R3 | ✅ Done | `src/lib/userData.ts:48-53` | ✅ unit + `tests/e2e/recetas-catalogo.spec.ts` |
| R4 | ✅ Done | `buildBackup` sin cambios; el almacén ya es solo del usuario (`src/lib/backup.ts`) | ✅ `store-catalog.test.tsx` |
| R5 | ✅ Done | `parseBackup` aplica `LOAD_OPTIONS` (`src/lib/backup.ts`) | ✅ `recipe-catalog.test.ts` |
| R6 | ✅ Done | `recipes = [...CATALOG, ...ownRecipes]` (`src/lib/store.tsx:118`) | ✅ unit + e2e |
| R7 (Should, relajado) | ✅ Done | comportamiento previo de Plan, diario, macros y compra | ✅ unit + e2e (fija el comportamiento) |

## Blocking
Ninguno.

## Non-blocking
1. `hasUserData` cuenta como datos del usuario las recetas con id retirado (`recipe_009/010/012`): `src/lib/syncMigration.ts:40`. Un dispositivo con solo el catálogo antiguo guardado vería el diálogo de confirmar en el primer sync. Ya ocurría antes → excluir también `RETIRED_RECIPE_IDS`.
2. `saveRecipe` acepta un id del catálogo y lo persiste, y la carga siguiente lo borra sin avisar: `src/lib/store.tsx:180`. No es alcanzable desde la interfaz y ya está en los follow-ups del brief → decidir la precedencia si #18 edita in situ.
3. Comentario obsoleto en `src/lib/migrate.ts:85` («la siembra solo añade…»): ya no hay siembra.
4. Comentarios obsoletos: «siembra» en `src/lib/userData.ts:42` y «ocho claves/datos» en `src/lib/store.tsx:54` y `:130` (son nueve desde #23).
5. `MemoryStorage` copiado por tercera vez en `tests/unit/recipe-catalog.test.ts` → fixture compartido.

## Decisiones tomadas en la review
- Guardia de `removeRecipe` (solo `ownRecipes`): aceptada, no estaba en `tech.md`.
- Tareas 1 y 2 en un solo commit para que la suite quedase en verde: cambio de proceso, sin efecto en el diseño.
- Todos los hallazgos, non-blocking; veredicto confirmado por el usuario.

## Code review findings
Los 5 hallazgos de la pasada 1 son los de «Non-blocking»; no hay otros.
