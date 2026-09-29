# Sugerencias para aprovechar lo que caduca en la despensa

_Status: merged · Updated: 2026-09-29 · Issue: [#16](https://github.com/mancabcar/MealPlan/issues/16) (@mancabcar) · PR: [#71](https://github.com/mancabcar/MealPlan/pull/71) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
La Despensa avisa de lo que caduca ("caduca pronto"), pero no conecta con las recetas. Hoy solo alimenta la generación con IA.

## Apuesta
- En Despensa, junto a los ítems "caduca pronto": "Recetas con esto" (búsqueda en el recetario por ingrediente).
- En Recetas: filtro "Usa lo que tengo", ordenado por los ingredientes de la despensa que se aprovechan (prioridad a lo que caduca antes).

## Criterios de aceptación (del issue)
- Un ítem que caduca en 2 días muestra las recetas que lo contienen.
- El filtro ordena por nº de ingredientes que ya tengo, desempatando por caducidad.
- Las recetas con alérgenos del perfil siguen mostrando su aviso.

## Contexto técnico
- `src/lib/shopping/pantryMatch.ts`: cruce ingrediente↔despensa (ignora caducados), reutilizable.
- `src/app/despensa/page.tsx` ya marca `isExpiringSoon`; `src/app/recetas/page.tsx` ya muestra `AllergenBadge`.
- `Recipe.ingredients` es `string[]` (`src/lib/types.ts`).

## Pasos del pipeline
- Brainstorm: saltado. El issue ya trae problema, propuesta y criterios.
- Prototipo: saltado. Son dos añadidos sobre pantallas existentes.
- Spec: [spec.md](spec.md), Musts R1–R7 aprobados el 2026-09-29.
- Tech design: [tech.md](tech.md), 2026-09-29 (lógica pura + estado efímero en el store, esfuerzo S–M, 7 tareas).
- Tests: escritos antes del código el 2026-09-29 (dev-test): `tests/unit/pantry-recipes.test.ts` (19) y `tests/e2e/despensa-recetas.spec.ts` (12). Fallan porque la funcionalidad no existe (1 e2e, "sin pasar por la Despensa no hay chip", es guardia de regresión y pasa). Cobertura y contrato de UI en [tech.md › Test coverage](tech.md#test-coverage). Siguiente: código (dev-code).

## Follow-ups
- R9 "caduca en X días" en la tarjeta (Could, fuera de alcance): [#72](https://github.com/mancabcar/MealPlan/issues/72).
- Follow-ups de la review: [#73](https://github.com/mancabcar/MealPlan/issues/73), [#74](https://github.com/mancabcar/MealPlan/issues/74), [#75](https://github.com/mancabcar/MealPlan/issues/75), [#76](https://github.com/mancabcar/MealPlan/issues/76).
