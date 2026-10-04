# Selector de recetas: búsqueda resaltada y orden A–Z: Review
_PR: [#104](https://github.com/mancabcar/MealPlan/pull/104) · Reviewed: 2026-10-04 · Verdict: ⚠️ approved with follow-ups_

## Summary
R1–R5 (todos Must) están hechos y probados; 1098 unit y 407 e2e en verde, `tsc` y `eslint` limpios, y el resaltado verificado en móvil. La implementación sigue el tech design sin divergencias. Los cinco hallazgos de la pasada 1 son de mantenimiento y cobertura, y el usuario los clasificó como no bloqueantes. El PR incluye además la corrección de estado de los briefs 14, 17 y 69, cambio de docs ajeno a #84 que el usuario aceptó.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/lib/text.ts:21`, `src/components/ui/Highlight.tsx`, `RecipePicker.tsx:49`, `recetas/page.tsx:384` | ✅ unit + e2e |
| R2 | ✅ Done | `src/app/recetas/page.tsx:70` | ✅ A–Z y ranking; ítem enfocado sin test propio |
| R3 | ✅ Done | `src/lib/recipeSearch.ts`, `recetas/page.tsx:71` | ✅ unit + e2e |
| R4 | ✅ Done | `groupRecipes` sin tocar | ✅ e2e existentes |
| R5 | ✅ Done | `recetas/page.tsx:359` | ✅ e2e |

## Blocking
Ninguno.

## Non-blocking
- `groupRecipes` (`src/lib/recipeSearch.ts` frente a `src/lib/recipeSlots.ts:38,65`) duplica el filtro y el orden de `searchRecipes`/`sortByName` → hacer que llame a las funciones nuevas para que selector y Recetas busquen siempre igual.
- `highlightRanges` (`src/lib/text.ts:43`) no colapsa espacios como el filtro: con «Pollo  al limón» (doble espacio o U+00A0) el filtro encuentra la receta y no hay resaltado → alinear el tratamiento de espacios.
- `recetas/page.tsx:71`: el `Set` intermedio filtra por identidad de objeto; basta un `matchesQuery(recipe, query)` exportado de `recipeSearch.ts`.
- `recetas/page.tsx:70`: `sortByName` se recalcula en cada tecla porque está en el `useMemo` que depende de `search` → separar un `useMemo` del orden o usar un `Intl.Collator` compartido.
- Cobertura: falta un test de `<Highlight>` con varios tramos y del tercer criterio de R2 (ítem enfocado sin «Usa lo que tengo» sale A–Z); sugerido con dev-test.

## Code review findings
Los cinco anteriores salen de la pasada 1 (`code-review`, nivel high). No hay bugs confirmados.
