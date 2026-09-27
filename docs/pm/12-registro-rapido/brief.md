# Registro rápido: comidas recientes en «Añadir comida»

_Status: in review · Updated: 2026-09-27 · Issue: [#12](https://github.com/mancabcar/MealPlan/issues/12) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#61](https://github.com/mancabcar/MealPlan/pull/61)_

## Follow-ups
- Favoritos en «Añadir comida» (recetas y comidas personalizadas). (spec) → [#58](https://github.com/mancabcar/MealPlan/issues/58)
- Diario: copiar una comida o un día completo a otra fecha. (spec) → [#59](https://github.com/mancabcar/MealPlan/issues/59)
- Plan: copiar la semana anterior sin pisar franjas asignadas sin confirmación. (spec) → [#60](https://github.com/mancabcar/MealPlan/issues/60)

## Problema
Registrar lo mismo de siempre exige buscarlo cada vez en un desplegable largo (`src/app/page.tsx`, «Añadir comida»), o volver a teclear nombre y macros si es una comida personalizada.

## Apuesta
Una sección «Recientes» en «Añadir comida» con las últimas comidas registradas, sin duplicados, que se añaden con un toque.

## Por qué se entra en el spec
El issue ya trae el problema, la propuesta y los criterios de aceptación, así que no hace falta brainstorm ni prototipo (decidido en chat el 2026-09-27). En el spec se recortó el alcance a Recientes; lo demás del issue pasó a #58, #59 y #60.

## Contexto
- Encaje con #13 (ver [13-base-alimentos](../13-base-alimentos/brief.md)): «Añadir comida» queda como franja → Recientes → Guardados → pestañas.
