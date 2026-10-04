# Plan: navegar por semanas (anterior y siguiente)

_Status: in review · Updated: 2026-10-04 · Issue: [#78](https://github.com/mancabcar/MealPlan/issues/78) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#108](https://github.com/mancabcar/MealPlan/pull/108) · Review: [review.md](review.md) — 🔁 changes requested_

## Problema
El Plan solo muestra la semana lunes–domingo actual (`weekDates(todayStr())` en `src/app/plan/page.tsx`) y la lista de la compra también. No se puede mirar atrás ni planificar con antelación, ni dejar que las sobras ([#17](../17-sobras-batch-cooking/spec.md)) caigan en otra semana.

## Apuesta (resumen de la issue, pendiente de confirmar)
Permitir moverse a la semana anterior y a la siguiente en el Plan, con su lista de la compra correspondiente.

## Decisiones
- Entrada en el pipeline: spec (se salta brainstorm y prototipo; cambio de navegación pequeño). Sin comentarios en la issue.

## Follow-ups
- R7 (deslizar entre semanas): [#107](https://github.com/mancabcar/MealPlan/issues/107)
- Relacionadas: [#60](https://github.com/mancabcar/MealPlan/issues/60) / [#53](https://github.com/mancabcar/MealPlan/issues/53) (copiar semana anterior).
