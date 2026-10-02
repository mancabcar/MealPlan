# Recetas: favoritos y selector por franja: Review
_PR: [#89](https://github.com/mancabcar/MealPlan/pull/89) · Reviewed: 2026-10-02 · Verdict: 🔁 changes requested_

## Summary
Los 5 requisitos (4 Must y 1 Should) están implementados y cubiertos por tests unitarios y e2e, y CI pasa. Se piden cambios porque hay dos bugs de estado en los selectores, ambos de arreglo mínimo: una receta elegida que no se ve al cambiar de franja en el Diario, y un selector del Plan que arrastra buscador y «Ver todas» entre franjas. El veredicto lo confirmó el usuario.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/lib/recipeSlots.ts:63, src/components/recetas/RecipePicker.tsx, src/app/plan/page.tsx:104, src/app/page.tsx:373 | ✅ unit + e2e |
| R2 | ✅ Done | src/components/recetas/RecipePicker.tsx, src/components/recetas/FavoriteStar.tsx | ✅ unit + e2e |
| R3 | ✅ Done | src/lib/recipeSlots.ts:72, src/components/recetas/RecipePicker.tsx | ✅ unit + e2e |
| R4 | ✅ Done | src/lib/userData.ts, src/lib/backup.ts, src/lib/store.tsx | ✅ unit + e2e |
| R5 | ✅ Done | src/app/recetas/page.tsx | ✅ e2e |

Edge cases del spec: recetas de IA/importadas/propias (cubierto), franja con menos de 5 (unit), receta con dos tags de franja (unit).

## Blocking
1. **Diario: una receta elegida deja de verse al cambiar de franja** · [src/app/page.tsx:373](../../../src/app/page.tsx): `RecipePicker` se remonta con `key={mealType}`, pero `recipeId` sobrevive. La vista previa y «Añadir» siguen usando la receta anterior sin que la lista la resalte → limpiar `recipeId` al cambiar de franja (y un test e2e).
2. **Plan: el selector arrastra su estado entre franjas** · [src/app/plan/page.tsx:104](../../../src/app/plan/page.tsx): sin `key`, buscador y «Ver todas» persisten si se toca otra franja con el selector abierto → `key` con fecha y franja de `editing` (y un test e2e).

## Non-blocking
- `removeRecipe` limpia `favorites` después de borrar la receta, contra el orden seguro documentado (entradas → plan → receta al final): [src/lib/store.tsx:150](../../../src/lib/store.tsx). Inocuo, los huérfanos se ignoran.
- `toggleFavorite` poda ids con las recetas del render y no con el último valor escrito: [src/lib/store.tsx:165](../../../src/lib/store.tsx). Mejor podar al cargar o con el estado más reciente.
- La búsqueda de la página Recetas usa `toLowerCase` y el selector usa `normalize` (sin tildes): [src/app/recetas/page.tsx:73](../../../src/app/recetas/page.tsx). Exportar el matcher de `recipeSlots.ts` y usarlo en ambos.
- El test «2 toques» no cuenta interacciones, solo ejecuta dos clics: [tests/e2e/favoritos-franja.spec.ts:57](../../../tests/e2e/favoritos-franja.spec.ts). El criterio ≤2 toques no queda protegido por un conteo real.
- El fallback «Otras recetas» (franja con <5) solo tiene test unitario, no e2e.

## Code review findings
Los 6 hallazgos de la primera pasada (`code-review`, nivel high) están reflejados arriba; no hubo otros.

## Divergencias aceptadas (tech.md)
El usuario aceptó estas divergencias de `tech.md`, coherentes con el diseño y con el spec:
- `FavoriteStar` como componente compartido por el selector y la página Recetas.
- `removeRecipe` también quita la receta de favoritas.
- 11 specs e2e migrados en lugar de los 7 previstos (también recetas-propias, allergen-badges y backup-datos), con los helpers `pickRecipe`, `clearRecipe` y `showAllRecipes`.

Sin cambios de alcance ni trabajo ajeno en el PR. El diff de Recetas es grande por el reindentado del bloque envuelto.
