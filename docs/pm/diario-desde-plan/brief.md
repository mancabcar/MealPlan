# Registrar en el Diario una comida planificada con un toque

_Status: reviewed: ⚠️ approve with follow-ups ([PR #25](https://github.com/mancabcar/MealPlan/pull/25), [review](review.md)) · Updated: 2026-09-23 · Rama: `feature/diario-desde-plan` · Origen: [issue #6](https://github.com/mancabcar/MealPlan/issues/6) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
Plan y Diario no están conectados. Si planificas una receta para una franja, para registrarla tienes que volver a buscarla en el desplegable del Diario. Yazio y Fitia permiten marcar la comida planificada como hecha.

## Apuesta
En el Diario, para la fecha seleccionada, mostrar las franjas planificadas que aún no tienen entrada, con un botón "✓ Hecho" que crea la `MealEntry` con los macros de la receta. Opcional: "Registrar todo el día".

## Criterios de aceptación (del issue)
- Si el plan tiene una receta para hoy en "Comida" y no hay entrada, el Diario la muestra como pendiente.
- Pulsar "Hecho" crea la `MealEntry` con los macros de la receta y la franja deja de aparecer como pendiente.
- Se puede registrar algo distinto a lo planificado sin romper nada.

## Contexto técnico
- `WeekPlan = Record<fecha, DayPlanSlot[]>`, con una receta como mucho por franja (`{ mealType, recipeId }`), en `src/lib/types.ts`.
- El Diario (`src/app/page.tsx`) ya crea entradas de receta en `submitAdd`; el botón "Hecho" reutiliza esa forma.
- Hay tests unitarios y e2e en `tests/`.

## Pasos del pipeline
- Brainstorm: saltado. El issue ya trae problema, propuesta y criterios.
- Prototipo: saltado (propuesta). Es una fila nueva dentro de las tarjetas por franja que ya tiene el Diario, sin pantallas ni flujos nuevos.
- Spec: [spec.md](spec.md), aprobada el 2026-09-23.
- Tech design: [tech.md](tech.md), 2026-09-23. Pendientes derivados (sin cambios de datos) dentro de cada tarjeta de comida; esfuerzo S. Aprobado.
- Tests: escritos antes del código el 2026-09-23 (dev-test): `tests/unit/diary.test.ts` (20), `tests/e2e/diario-desde-plan.spec.ts` (19) y el caso "Diario con pendientes" en `accessibility.spec.ts`. Fallan porque la funcionalidad aún no existe. Cobertura en [tech.md › Test coverage](tech.md#test-coverage). Siguiente: código (dev-code).

## Decisiones (Manuel, 2026-09-23)
- Brainstorm y prototipo saltados: de acuerdo.
- Una franja deja de estar pendiente cuando tiene **cualquier** entrada, sea o no la receta planificada.
- Los pendientes se muestran solo para **hoy y días pasados**, nunca para días futuros.
- "Registrar todo el día" es un **Should**, no un Must.
- Franjas planificadas cuyo tipo de comida ya no está en `profile.meals`: no se muestran como pendientes, igual que Plan ya las oculta (confirmado).
- Spec aprobada (Musts R1–R7). Sin aviso de "Deshacer" tras "Hecho": basta con la ✕ de la entrada (R6).
- Tech design aprobado. "Registrar todo el día": botón secundario a todo lo ancho encima de las tarjetas, solo con 2 o más pendientes. R10 (aviso de alérgenos) se incluye.
