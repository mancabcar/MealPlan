# Recetas: valoración 1–5, filtros y orden: Review
_PR: [#157](https://github.com/mancabcar/MealPlan/pull/157) · Reviewed: 2026-10-09 · Verdict: ⚠️ approved with follow-ups_

## Summary
Los 7 requisitos (R1–R5 Must, R6–R7 Should) están implementados y cada criterio de aceptación tiene test unitario o e2e (1595 unitarios, 185 del servidor y 25 e2e nuevos con axe). No hay bloqueantes. Las dos divergencias de `tech.md` (estrellas ámbar y botón de filtros separado del panel) eran decisiones del usuario y quedan documentadas. Los hallazgos de la pasada 1 se aceptan como no bloqueantes (decidido por el usuario).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/components/recetas/RatingStars.tsx:11, src/lib/store.tsx:223 | ✅ |
| R2 | ✅ Done | src/lib/userData.ts, src/lib/backup.ts, src/lib/syncMigration.ts, server/lib/sync.ts:5 | ✅ |
| R3 | ✅ Done | src/lib/recipeFilters.ts:19, src/app/recetas/page.tsx | ✅ |
| R4 | ✅ Done | src/lib/recipeFilters.ts:19, src/components/recetas/RecipeFilters.tsx | ✅ (sin test de alérgenos + «Solo favoritas») |
| R5 | ✅ Done | src/lib/recipeFilters.ts:36 | ✅ |
| R6 | ✅ Done | src/components/recetas/RatingBadge.tsx, RecipeCard.tsx:66 | ✅ |
| R7 | ✅ Done | src/components/recetas/RecipeFilters.tsx, src/app/recetas/page.tsx | ✅ |

## Blocking
Ninguno.

## Non-blocking
- `countActiveFilters` cuenta `hideAllergens` aunque el perfil ya no tenga alergias: «Filtros (1)» y Destacadas ocultas sin filtro real ni interruptor visible (src/lib/recipeFilters.ts:49) → ignorar `hideAllergens` cuando no hay alergias, o ocultar el contador en ese caso.
- `setRating` poda ids con el `recipes` del render (src/lib/store.tsx:223): añadir y valorar una receta en el mismo evento puede descartar la nota → leer las recetas conocidas con una referencia al último valor.
- Edge case del spec sin test: ocultar alérgenos + «Solo favoritas» a la vez → añadir un e2e (dev-test).
- Despliegue: el servidor debe ir antes que el cliente (SYNC_KEYS pasa a diez claves; ver #122). Anotado en el PR.
- La pregunta abierta del spec sobre #42 ya está resuelta (fusionado antes de codificar, sin conflictos).

## Code review findings
- Reuse: `byName` en src/lib/recipeFilters.ts:34 repite `sortByName` de recipeSearch.ts.
- Simplificación: `describeFilters` repite los textos de los tramos de los chips (RecipeFilters.tsx:49); las constantes de tramos y `NO_FILTERS` son mutables (recipeFilters.ts:5).
- Accesibilidad: las cinco estrellas son botones `aria-pressed` independientes, no una escala de selección única (RatingStars.tsx:17); cumple el contrato de tests.

## History
- 2026-10-09 pass 1: ⚠️ approved with follow-ups. 7/7 requisitos hechos, sin bloqueantes; divergencias de diseño aceptadas y documentadas, 6 hallazgos no bloqueantes.
