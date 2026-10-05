# Marcar en la gráfica semanal los días que cumplen el objetivo

_Status: in review · Updated: 2026-10-05 · Issue: [#50](https://github.com/mancabcar/MealPlan/issues/50) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#146](https://github.com/mancabcar/MealPlan/pull/146) · Review: [review.md](review.md) — ✅ approved_

## Problema
La gráfica «Calorías esta semana» del Diario (`WeekBarChart`) no enseña qué días cumplieron el objetivo. Esa información solo aparece como un número en la tarjeta «Medias y adherencia» ([#11](../11-medias-adherencia/brief.md)), así que no se puede relacionar con las barras.

## Apuesta
Marcar con un icono bajo cada barra los días que cumplen (kcal ±10 % y proteína en rango), usando `isCompliantDay` de `src/lib/diaryStats.ts` para que coincida con la adherencia de esa tarjeta.

## Reglas (del issue)
- Hoy (día en curso) y los días sin registros no se marcan.
- El estado no depende solo del color ni del icono: texto o `sr-only` por barra.

## Por qué se entra en el spec
El issue ya trae el comportamiento acordado y el cambio es un icono bajo la barra: se salta brainstorm y prototipo (decidido en chat el 2026-10-05).

## Contexto
- `WeekBarChart` solo recibe `{label, value}[]` y el objetivo; habrá que pasarle qué días cumplen desde `src/app/page.tsx`.
- Fuera de alcance: marcar los días en el selector del Plan (R8 de [#10](../10-macros-plan/brief.md)).

## Follow-ups
