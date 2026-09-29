# Aprovechar lo que caduca: Review
_PR: [#71](https://github.com/mancabcar/MealPlan/pull/71) · Reviewed: 2026-09-29 · Verdict: ⚠️ approved with follow-ups_

## Summary
R1–R8 implementados y cubiertos por tests unitarios y e2e (R9 fuera de alcance, como se acordó). Un hallazgo bloqueante menor (mensaje de vacío engañoso al combinar con la búsqueda) que se corrige en este mismo PR antes de mergear; el resto quedan como follow-ups. Veredicto y clasificación confirmados por Manuel. CI: `build` y `server` pasan; `test` seguía pendiente en el momento de la revisión.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/app/despensa/page.tsx:107 | ✅ e2e |
| R2 | ✅ Done | src/app/recetas/page.tsx:41, src/lib/pantryRecipes.ts:34 | ✅ unit + e2e |
| R3 | ✅ Done | src/lib/pantryRecipes.ts:39 | ✅ unit + e2e |
| R4 | ✅ Done | src/lib/pantryRecipes.ts:44 | ✅ unit + e2e |
| R5 | ✅ Done | src/app/recetas/page.tsx:219 (`AllergenBadge` intacto) | ✅ e2e |
| R6 | ⚠️ Partial | src/app/recetas/page.tsx:198 (mensaje engañoso con búsqueda, ver Blocking 1) | ✅ e2e |
| R7 | ✅ Done | src/app/recetas/page.tsx:41 | ✅ e2e |
| R8 | ✅ Done | src/app/recetas/page.tsx:220 | ✅ unit + e2e |
| R9 | ⚪ Not planned | — | — |

## Blocking
1. Mensaje de vacío engañoso: src/app/recetas/page.tsx:198: con el chip "con: leche" o "Usa lo que tengo" activo, una búsqueda sin resultados muestra "Ninguna receta usa leche" / "Nada que aprovechar todavía", que es falso → mostrar el mensaje solo si el vacío persiste sin texto de búsqueda (o usar "Sin resultados para «<texto>»" cuando `search` no está vacío).
   **Resuelto** en el commit siguiente a esta revisión: con texto de búsqueda el vacío muestra "Sin resultados para «texto»"; 2 e2e nuevos; suite completa verde (299 e2e).

## Non-blocking
- `recipeFocus` sobrevive a la navegación (src/lib/store.tsx:100): el chip reaparece al volver a Recetas desde otra página → limpiarlo al salir de Recetas.
- `soonest` cuenta ítems que casan por palabras sueltas (src/lib/pantryRecipes.ts:27): "leche" casa con "chocolate con leche" y puede subir la receta y mostrar "caduca pronto". Es el falso positivo del matcher ya aceptado en tech.md.
- `matchingItems` duplica la lógica de `matchIndexed` (src/lib/shopping/pantryMatch.ts:36) → que `matchIndexed` se apoye en `matchingItems`.
- El vacío no tiene botón propio a "Sugerir con IA" (src/app/recetas/page.tsx:198): hoy se usa el del encabezado, siempre visible.
- R9 ("caduca en X días") queda como follow-up anotado en el brief.

## Code review findings
Sin hallazgos adicionales a los ya listados.
