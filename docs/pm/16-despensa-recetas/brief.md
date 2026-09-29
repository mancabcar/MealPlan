# Sugerencias para aprovechar lo que caduca en la despensa

_Status: spec · Updated: 2026-09-29 · Issue: [#16](https://github.com/mancabcar/MealPlan/issues/16) (@mancabcar)_

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
- Spec: pendiente.

## Follow-ups
_(ninguno todavía)_
