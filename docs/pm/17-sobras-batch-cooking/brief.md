# Sobras y batch cooking: cocinar una vez, varias comidas
_Status: tests · Updated: 2026-09-29 · Issue: [#17](https://github.com/mancabcar/MealPlan/issues/17) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
Cocinar un guiso el domingo para tres comidas obliga a asignarlo tres veces en el Plan, y la lista de la compra cuenta los ingredientes triple.

## Apuesta
Al asignar una receta se puede "cocinar N raciones" y elegir en qué otras franjas se come. Esas franjas quedan marcadas como *sobras*, enlazadas a la cocinada, y no suman ingredientes a la lista de la compra.

## Criterios del issue
- Asignar 3 raciones rellena las franjas elegidas marcadas como "sobras".
- La lista de la compra cuenta los ingredientes una vez, escalados a las raciones cocinadas.
- Borrar la franja original pregunta qué hacer con las sobras.

## Dependencias
- #5 lista de la compra: mergeado ([PR #24](https://github.com/mancabcar/MealPlan/pull/24)).
- #7 raciones: shipped ([PR #30](https://github.com/mancabcar/MealPlan/pull/30)).

## Huecos para la spec
- Edición de las raciones cocinadas.
- Mover o desenlazar una sobra.
- Cómo se ven las sobras en el Plan.
- Efecto en macros y en el diario.

## Follow-ups
- Sobras en otras semanas: requiere que el Plan navegue por semanas → [#78](https://github.com/mancabcar/MealPlan/issues/78).
- Revisar [#29](https://github.com/mancabcar/MealPlan/issues/29) tras el merge para apoyarse en `cookedServings`.
