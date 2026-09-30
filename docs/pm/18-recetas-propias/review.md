# Crear y editar recetas propias: Review
_PR: [#85](https://github.com/mancabcar/MealPlan/pull/85) · Reviewed: 2026-09-30 · Verdict: ✅ approved_

## Summary
R1–R10 están implementados y con test. Los 867 tests unitarios y los 19 e2e de la feature pasan; el único fallo es `BarcodeScanner.test.tsx`, por `barcode-detector` sin instalar en el worktree (ajeno al PR). No falta ningún Must ni hay bugs serios; los hallazgos son mejoras. Veredicto inicial ⚠️ approved with follow-ups, confirmado por Manuel; actualizado a ✅ approved el 2026-09-30 tras resolver los follow-ups (commit 7d50d5a), a petición de Manuel.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/components/recetas/RecipeForm.tsx, src/lib/recipeEdit.ts:30 | ✅ |
| R2 | ✅ Done | src/lib/store.tsx:133, src/app/recetas/page.tsx | ✅ |
| R3 | ✅ Done | src/lib/recipeEdit.ts:107, src/app/recetas/page.tsx (diálogo "Borrar receta") | ✅ |
| R4 | ✅ Done | src/lib/recipeEdit.ts:84, src/app/recetas/page.tsx | ✅ |
| R5 | ✅ Done | Diario, Plan y Compra leen `recipes` del store sin cambios | ⚠️ Recetas, Plan y Diario sí; Compra y macros del Plan sin test |
| R6 | ✅ Done | Las entradas guardan sus macros; `saveRecipe` no las toca | ✅ |
| R7 | ✅ Done | `AllergenBadge` se calcula desde `ingredients` | ✅ |
| R8 | ✅ Done | src/lib/recipeEdit.ts:120 (`withoutRecipe`) | ✅ |
| R9 | ✅ Done | `suggestedTags`, chip "Propia" | ✅ |
| R10 | ✅ Done | `suggestCalories`, botón "Usar N kcal" | ✅ |

## Blocking
Ninguno.

## Non-blocking
_Resueltos después del review en el mismo PR: los cuatro primeros (test de R5 en `tests/unit/recipe-consumers.test.ts`, `removeRecipe` con setters funcionales, sin sugerencia de kcal con macros inválidos y `dayName` movido a `lib/week.ts`)._
- R5 sin test automatizado para la lista de la compra y los macros del Plan → añadir un test con dev-test.
- `src/lib/store.tsx:133`: `removeRecipe` usa `entries` y `weekPlan` del render, no el último valor escrito (`usePersisted` encadena escrituras con `latest`). Hoy ningún caller lo dispara en el mismo evento que otra escritura → pasar funciones a los setters.
- `src/components/recetas/RecipeForm.tsx:97`: "Usar N kcal" cuenta como 0 un macro inválido y sugiere un valor engañoso; al guardar, la validación sí lo rechaza → no ofrecer la sugerencia mientras algún macro no sea válido.
- `src/app/recetas/page.tsx`: `dayName` se importa de `components/plan/BatchSheet`; mejor moverlo a `lib/week.ts` para no acoplar Recetas a un componente del Plan.
- Cambio en el test e2e (acordado al abrir el PR): la receta de prueba pasa de "Crema de calabaza" a "Gazpachuelo casero" porque chocaba con dos recetas del catálogo; no se relajó ninguna comprobación.

## Code review findings
Pase 1 (`code-review`, nivel `high`): 2 hallazgos, ambos listados arriba como no bloqueantes.
