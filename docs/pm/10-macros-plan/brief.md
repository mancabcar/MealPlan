# Macros por día en el Plan semanal (frente a los objetivos)

_Status: in review ([PR #38](https://github.com/mancabcar/MealPlan/pull/38)) · review: ⚠️ approved with follow-ups ([review](review.md)) · Updated: 2026-09-26 · Issue: [#10](https://github.com/mancabcar/MealPlan/issues/10) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

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
- La frase sr-only de cada celda solo tiene ejemplos para Grasas y Proteínas; los e2e aceptan la unidad tras el objetivo como opcional ("Calorías 2030 de 2000( kcal), dentro"). Decidido: unidad solo en Calorías ("Calorías 2030 de 2000 kcal, dentro"). (tests)
- R5 del spec dice "icono con nombre accesible"; la tech lo resuelve con icono `aria-hidden` + frase sr-only, y el e2e de R5 lo fija con un snapshot del árbol accesible (sin `img` dentro de la lista). Resuelto: el spec se alinea con la tech. (tests)
- "Sin perfil" es inalcanzable en `/plan` (AppShell muestra el onboarding): solo lo cubre un test de componente de `DayMacroSummary`. (tests)
- Correr vitest en Windows reescribe `tests/unit/__snapshots__/shopping-parse.test.ts.snap` con finales de línea LF (diff vacío salvo EOL): falta un `.gitattributes` (`*.snap text eol=lf`) o similar. Preexistente. (tests) → [#37](https://github.com/mancabcar/MealPlan/issues/37)
- `playwright.config.ts` fija el puerto 3000 y reutiliza el servidor que haya: con varios worktrees los e2e de uno pueden correr contra el código de otro. Permitir `PORT` por variable de entorno. (tests) → [#36](https://github.com/mancabcar/MealPlan/issues/36)
