# Medias semanales y adherencia en el Diario

_Status: tests · Updated: 2026-09-27 · Issue: [#11](https://github.com/mancabcar/MealPlan/issues/11) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
La gráfica semanal del Diario (`src/app/page.tsx`) solo muestra calorías. No enseña medias de proteínas, carbohidratos ni grasas, ni cuántos días se ha cumplido el plan de la nutricionista. Cada día se puede ver si se cumple (`MacroBar`), pero no la tendencia: una semana con dos días muy por encima y cinco correctos se ve igual que una semana entera fuera del objetivo.

## Apuesta
Un bloque de resumen en el Diario con:
- **Medias** de kcal y de cada macro en el periodo, contando **solo los días con algún registro**.
- **Adherencia**: «5 de 7 días dentro del objetivo». Un día cumple si las kcal están dentro de la tolerancia (±10 % por defecto, configurable) y la proteína está en rango (`profile.proteinRange` si existe; si no, objetivo ± tolerancia).
- **Selector 7 / 30 días** que recalcula medias y adherencia.

## Por qué se entra en el spec
El issue ya trae el problema, la propuesta y los criterios de aceptación, así que no hace falta brainstorm. Se salta el prototipo (decidido en chat el 2026-09-26): es una tarjeta de estadísticas y un selector en una pantalla conocida.

## Contexto
- El criterio de «cumplido» ya existe para el Plan: `macroStatus` y `PLAN_TOLERANCE_PCT = 10` en `src/lib/planMacros.ts` (#10). Conviene reutilizarlo para que el Plan y el Diario digan lo mismo, que era un follow-up de [10-macros-plan](../10-macros-plan/brief.md).
- Raciones (#7) ya se aplican a los registros del Diario, así que los totales diarios deberían salir del mismo cálculo que usa `MacroBar`.

## Criterios de aceptación (del issue)
- Las medias ignoran los días sin ningún registro.
- La adherencia usa el rango de proteína cuando existe.
- Cambiar a 30 días recalcula medias y adherencia.

## Decisiones (chat, 2026-09-26)
- Adherencia «X de N» con N = días con registros, no todos los días del periodo.
- El día en curso no cuenta: el periodo termina en la fecha seleccionada si es pasada y, si no, ayer.
- Tolerancia fija ±10 % (la del Plan). Hacerla editable es un follow-up.

## Follow-ups
- Tolerancia editable en Perfil, compartida por Plan y Diario (y en el backup). (spec)
- Marcar en `WeekBarChart` los días que cumplen (pregunta abierta del spec). (spec)
- Gráfica de 30 días, periodos personalizados y comparativas entre periodos. (spec, non-goals)
- Unificar el estado «por debajo / por encima» de kcal, carbohidratos y grasas en el Diario (`MacroBar`) con `macroStatus`, para que el día y las medias se presenten igual. (tech)
