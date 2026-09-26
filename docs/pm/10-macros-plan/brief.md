# Macros por día en el Plan semanal (frente a los objetivos)

_Status: tech design · Updated: 2026-09-26 · Issue: [#10](https://github.com/mancabcar/MealPlan/issues/10) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
El Plan semanal (`src/app/plan/page.tsx`) solo muestra el total de kcal del día seleccionado. No enseña proteínas, carbohidratos ni grasas, así que no hay forma de saber si un día planificado cumple el plan de la nutricionista antes de comerlo. Hoy eso solo se ve a posteriori, en el Diario (`MacroBar` en `src/app/page.tsx`), cuando ya se ha comido.

## Apuesta
Un resumen por día en el Plan con kcal, P, C y G planificados y su estado frente al objetivo del perfil: dentro, por debajo o por encima. La proteína con rango prescrito (`profile.proteinRange`) cuenta como cumplida dentro del rango, igual que en `MacroBar` (R17 de onboarding-profile).

## Por qué se entra en el spec
El issue ya trae el problema, la propuesta y los criterios de aceptación, así que no hace falta brainstorm. También se salta el prototipo: la UI reutiliza el patrón de `MacroBar`, que ya existe, en una pantalla conocida.

## Contexto
- **Raciones (#7):** solo existen en el Diario. `DayPlanSlot` no tiene `servings`: se dejó fuera a propósito en [raciones/spec.md](../raciones/spec.md) y se movió al issue #29. El criterio "respeta las raciones cuando existan" se cumple hoy trivialmente (multiplicador 1). Si el cálculo usa el mismo punto de entrada, #29 lo heredará.

## Follow-ups
- Criterio de "cumplido" con tolerancia (±10 %) también en el Diario (`MacroBar`), para que Plan y Diario digan lo mismo. (spec)
- Marcar en el selector de días los días que cumplen (R8, Could). (spec) Sale casi gratis con `dayPlanSummary` + `macroStatus` por fecha: candidato a issue pequeño. (tech)
- Si `MacroBar` pasa a usar `macroStatus` (tech.md › Spec feedback 1), el Diario marca cumplida la proteína a menos de 0,5 g del límite del rango (p. ej. 129,6 con 130–160); comprobarlo con raciones. (tech)
- Cuando llegue #29, `dayPlanSummary` debe pasar `slot.servings` a `slotMacros` (único punto, R9). (tech)
