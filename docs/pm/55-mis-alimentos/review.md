# Favoritos en «Añadir comida»: Review
_PR: [#167](https://github.com/mancabcar/MealPlan/pull/167) · Reviewed: 2026-10-19 · Verdict: ⚠️ approved with follow-ups_

## Summary
Review hecha a posteriori: la PR #167 se mergeó el 2026-10-11, así que todos los hallazgos son follow-ups. Están hechos y probados los 6 Must, los 5 Should y R12 (Could); R13 se dejó fuera a propósito (Spec feedback de `tech.md`). La pasada 1 (code-review, esfuerzo high) encontró casos límite en Deshacer, en el formulario de Personalizada y en la identidad de los favoritos de alimento, y ninguno toca datos ya registrados en el Diario. Veredicto y follow-ups confirmados por el usuario.

Pruebas en `docs/55-review` (con el contenido de #167): `vitest` 90 ficheros y 1745 tests en verde; `tests/e2e/favoritos-anadir.spec.ts` 12/12 en verde. Los tests existentes que se tocaron solo excluyen el botón ☆ nuevo de los selectores de filas o pasan de 10 a 11 claves: ninguno se ha relajado sin motivo.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/app/page.tsx (`FavoriteMeals` antes de `RecentMeals`, `onPick`); src/lib/mealFavorites.ts › `favoriteEntry` | ✅ unit, component, e2e |
| R2 | ✅ Done | src/components/diario/RecentMeals.tsx (☆), page.tsx › `onStar`; mealFavorites.ts › `favoriteFromEntry`, `upsertCustom` | ✅ unit, component, e2e |
| R3 | ✅ Done | src/components/diario/CustomMealForm.tsx (casilla), page.tsx › `submitCustom` | ✅ component, e2e |
| R4 | ✅ Done | CustomMealForm.tsx (modo edit, `nameTaken`), FavoriteMeals.tsx, store.tsx › `saveMealFavorite` | ✅ component, e2e |
| R5 | ✅ Done (ver #168) | FavoriteMeals.tsx (★), page.tsx › `changeFavorites` + Toast sin temporizador | ✅ component, e2e |
| R6 | ✅ Done | src/lib/userData.ts, backup.ts, syncMigration.ts, server/lib/sync.ts (clave `mealFavorites`) | ✅ unit |
| R7 | ✅ Done | mealFavorites.ts › `hiddenInRecents`; diary.ts › `recentMeals({ exclude })` | ✅ unit, e2e |
| R8 | ✅ Done | mealFavorites.ts › `rankFavorites` | ✅ unit |
| R9 | ✅ Done | FavoriteMeals.tsx (`FAVORITES_LIMIT`, «Ver todos (N)») | ✅ component, e2e |
| R10 | ✅ Done | FavoriteMeals.tsx (`FAVORITES_HINT`) | ✅ component, e2e |
| R11 | ✅ Done | page.tsx › `favNotice`; Toast.tsx (`durationMs: null`) | ✅ component, e2e |
| R12 | ✅ Done | src/components/diario/FoodQuantityForm.tsx | ✅ component |
| R13 | ➖ Fuera de alcance | Decidido en el Spec feedback de `tech.md`; anotado en Follow-ups del brief | — |

## Blocking
Ninguno.

## Non-blocking
1. **Deshacer restaura una instantánea vieja**: src/app/page.tsx › `changeFavorites`. Editar un favorito (R4/R12) no cierra el aviso, y Deshacer revierte también esa edición (quitar A → editar B → Deshacer ⇒ B pierde el cambio). También pisa lo que llegue por sincronización mientras el aviso está abierto. Además, `setFavorites` (store.tsx) no descarta los ids de recetas borradas, como sí hace `toggleFavorite`. → Que Deshacer invierta solo la operación hecha y sanear `setFavorites`. Issue [#168](https://github.com/mancabcar/MealPlan/issues/168).
2. **Personalizada pierde lo escrito sin fecha**: CustomMealForm.tsx › `submit`. El modo add se vacía después de `onSubmit` aunque el Diario no registre nada por tener la fecha vacía. Es una regresión frente a page.tsx antes de #167. El reseteo manual sobra porque ya lo hace la `key`. → Quitarlo. Issue [#169](https://github.com/mancabcar/MealPlan/issues/169).
3. **Identidad de los favoritos de alimento**: mealFavorites.ts › `favoriteFromEntry` y `foodKey`. Un alimento sin `customName` se guarda con nombre vacío y `sanitizeMealFavorites` lo descarta al recargar. Los gramos con decimales de coma flotante tras editar las unidades pueden no coincidir con las entradas del buscador (afecta a R7 y R8). Issue [#170](https://github.com/mancabcar/MealPlan/issues/170).
4. **Aviso sin cambio**: page.tsx › `onStar`. La ☆ en una receta que ya es favorita muestra «Guardado en Favoritos» y cierra el aviso «Añadido · Deshacer». Issue [#171](https://github.com/mancabcar/MealPlan/issues/171).

## Code review findings
- Descartado: R7 oculta en Recientes las personalizadas con el mismo nombre aunque cambien los macros. Es lo decidido en el Spec feedback de `tech.md`, no un defecto.
- La limpieza del reseteo manual de `CustomMealForm` va en #169 (es el mismo arreglo).

## History
- 2026-10-19 pass 1 (a posteriori, PR ya mergeada): ⚠️ approved with follow-ups. Todos los Must hechos y probados; 4 hallazgos no bloqueantes convertidos en los issues #168–#171.
