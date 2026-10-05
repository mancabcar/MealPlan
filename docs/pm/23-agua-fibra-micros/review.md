# Seguimiento de agua y fibra en el Diario: Review (entrega 1, fibra)
_PR: [#120](https://github.com/mancabcar/MealPlan/pull/120) · Reviewed: 2026-10-05 · Verdict: ⚠️ approved with follow-ups_

## Summary
La entrega 1 implementa R1–R9 con tests, y typecheck, lint, build, 1182 tests unitarios, 181 del servidor y 451 e2e están en verde. La primera revisión pidió cambios porque las recetas semilla ya guardadas no recibían la fibra del catálogo (R4); está corregido en d03c979 con test y verificado. Verdict decidido por el usuario tras el arreglo: ⚠️ approved with follow-ups (los hallazgos menores y la actualización del spec quedan como seguimientos).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/lib/types.ts`, `src/lib/fiber.ts:33` | ✅ `fiber.test.ts`, `backup-fiber.test.ts` |
| R2 | ✅ Done | `src/app/page.tsx` (barra «Fibra», chip «parcial»), `src/lib/fiber.ts:49` | ✅ unit + e2e `fibra.spec.ts` |
| R3 | ✅ Done | `src/app/perfil/page.tsx` (`FiberGoalRow`), `src/lib/fiber.ts:17` | ✅ unit + e2e |
| R4 | ✅ Done | `src/app/recetas/page.tsx` (celda «Fibra»), `src/lib/userData.ts` (`withSeedRecipes` rellena la fibra en las semilla guardadas) | ✅ e2e + `seed-recipes-fiber.test.ts` |
| R5 | ✅ Done | `scripts/build-foods.mjs`, `src/data/foods.json`, `src/lib/foods.ts:84` | ✅ `foods-fiber-data`, `diary-fiber`, e2e |
| R6 | ✅ Done | `server/app/api/foods/search/route.ts`, `barcode/route.ts` | ✅ `foods-fiber-routes.test.ts` |
| R7 | ✅ Done | `src/lib/planMacros.ts` (`slotMacros`) | ✅ `diary-fiber.test.ts` |
| R8 | ✅ Done | `RecipeForm.tsx`, `recipeEdit.ts`, «Personalizada» en `page.tsx` | ✅ unit + e2e |
| R9 | ✅ Done | `src/app/page.tsx` (aviso y etiqueta por entrada) | ✅ e2e |
| R13 (fibra) | ✅ Done | viaja en `entries`, `recipes` y `profile` | ✅ `backup-fiber.test.ts` |

Desviaciones aceptadas: la fibra de las entradas de receta antiguas se recupera de la receta (decisión del usuario, documentada en `tech.md › Spec feedback`; el `spec.md` aún no lo refleja); `MacrosWithFiber` separa la fibra opcional de `Macros` (documentada en el PR); la celda de fibra de la ficha usa «14 g» con espacio (contrato acordado). Sin alcance extra ni cambios sin relación.

## Blocking
1. (Resuelto en d03c979) Las recetas semilla ya guardadas no reciben la fibra: `src/lib/userData.ts:55` (`withSeedRecipes`) solo añade las recetas cuyo id falta, así que quien ya tenía las 107 recetas en `mp_<user>_recipes` las conserva sin `fiber`. La ficha muestra «—», las entradas nuevas de esas recetas salen «sin dato» y el día queda «parcial». El e2e no lo detecta porque siembra recetas con fibra. → Rellenar `fiber` desde el JSON semilla en las recetas guardadas no propias (`!isCustom`) que no lo tengan, e incluir un test unitario con una receta guardada sin fibra.

## Non-blocking
- Fibra y objetivo sin validar al llegar por copia o sincronización: `src/app/recetas/page.tsx:248` (`formatFiber` con `null` o texto lanza) y `fiberGoal()` con `0`/texto muestra «x / 0». → Guard `typeof === "number" && isFinite` en la ficha y validar en `fiberGoal()`.
- `scaleFiber` (`src/lib/fiber.ts`) solo se usa en tests y `scaleMacros` (`src/lib/foods.ts:84`) repite la lógica. → Llamarla desde `scaleMacros`.
- `fiberOf` está copiado en `search/route.ts` y `barcode/route.ts` (junto a `num`/`text` ya duplicados). → Módulo compartido en `server/lib`.
- `entryFiber` se calcula dos veces por entrada con `recipes.find` lineal (`src/app/page.tsx:341`). → Un `Map` por id por render.
- `spec.md` sin actualizar con el cambio de las entradas viejas de receta.

## Code review findings
Los cinco de arriba salen de la pasada de `code-review` (nivel high) y de la comprobación contra el spec; no hay otros.
