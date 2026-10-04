# Plan: navegar por semanas (anterior y siguiente)

_Status: shipped (2026-10-04) · Updated: 2026-10-04 · Issue: [#78](https://github.com/mancabcar/MealPlan/issues/78) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#108](https://github.com/mancabcar/MealPlan/pull/108) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Problema
El Plan solo muestra la semana lunes–domingo actual (`weekDates(todayStr())` en `src/app/plan/page.tsx`) y la lista de la compra también. No se puede mirar atrás ni planificar con antelación, ni dejar que las sobras ([#17](../17-sobras-batch-cooking/spec.md)) caigan en otra semana.

## Apuesta (resumen de la issue, pendiente de confirmar)
Permitir moverse a la semana anterior y a la siguiente en el Plan, con su lista de la compra correspondiente.

## Decisiones
- Entrada en el pipeline: spec (se salta brainstorm y prototipo; cambio de navegación pequeño). Sin comentarios en la issue.

## Qué vigilar tras el despliegue
Sin métricas de uso (spec). Comprobar a mano: (1) que el estado de la compra de la semana actual se conserva tras la migración al formato `weeks`; (2) que la compra y su estado se sincronizan entre dos dispositivos; (3) que un dispositivo con la versión antigua cacheada se actualiza y no deja la compra vacía.

## Follow-ups
- R7 (deslizar entre semanas): [#107](https://github.com/mancabcar/MealPlan/issues/107)
- Relacionadas: [#60](https://github.com/mancabcar/MealPlan/issues/60) / [#53](https://github.com/mancabcar/MealPlan/issues/53) (copiar semana anterior).
