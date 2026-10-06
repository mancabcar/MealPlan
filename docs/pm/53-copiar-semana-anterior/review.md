# Copiar la semana anterior en el Plan: Review
_PR: [#148](https://github.com/mancabcar/MealPlan/pull/148) · Reviewed: 2026-10-06 · Verdict: ⚠️ approved with follow-ups_

## Summary
R1–R5 están implementadas como dicen la spec y el tech design, sin cambios ajenos al alcance y con los tests en verde (544 e2e, 1456 unitarios). El code-review (high) no halló nada bloqueante; el único hallazgo con efecto visible (el Toast no se remontaba) se arregló en esta misma PR. El resto son follow-ups; el punto 2 (Deshacer restaura los 7 días) se acepta tal cual por decisión del usuario.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/lib/plan/copyWeek.ts` (`build`, `applyCopy`), botón en `src/app/plan/page.tsx` | ✅ unit + e2e |
| R2 | ✅ Done | `planCopy.conflicts`, `src/components/plan/CopyWeekSheet.tsx`, `startCopy` | ✅ unit + e2e |
| R3 | ✅ Done | `build` (`newBatchIds`), `applyCopy` (`deleteOrigin "keep"`) | ✅ unit + e2e |
| R4 | ✅ Done | `isSourceEmpty`, botón desactivado en `page.tsx` | ✅ unit + e2e |
| R5 | ✅ Done | `copyNotice`/`undoCopy` en `page.tsx` | ⚠️ e2e sí; el alcance «solo 7 días» no tiene test |

Ni los no-objetivos ni el diseño se incumplen. Divergencias menores respecto a `tech.md`: se exporta además `isSourceEmpty` (la UI lo usa para el botón) y se añade un `id` al aviso para remontar el Toast (hallazgo 1).

## Blocking
Ninguno.

## Non-blocking
- ✅ fixed in the feature branch (`866b88d`): el Toast no llevaba `key`, así que un segundo aviso heredaba el temporizador del primero (`src/app/plan/page.tsx`). Test: «un segundo aviso remonta el Toast».
- Deshacer restaura los 7 días enteros y pisa las ediciones hechas tras copiar en esa semana (`undoCopy`, `page.tsx`). Aceptado por el usuario (ventana de 10 s; es el diseño elegido).
- Falta un test de que Deshacer no toca otras semanas ni borra días con `delete restored[d]`; una función pura `restoreDays` extraída de `undoCopy` lo permitiría sin UI.
- «Copiadas N franjas» cuenta también franjas de comidas que el perfil no muestra (p. ej. Pre-entreno); está permitido por la spec, pero el recuento puede no coincidir con lo visible.
- `planCopy().slots` y `CopySlot` no se usan fuera de los tests (previsto en `tech.md`); se puede simplificar si nadie los necesita.
- Sin conflictos, `planCopy` y `applyCopy` repiten `build` (coste despreciable); un único paso `{conflicts, apply(mode)}` lo evitaría.

## Code review findings
Ver los anteriores: los 6 hallazgos de la pasada 1 (`code-review high`) ya están clasificados arriba.

## History
- 2026-10-06 pass 1: ⚠️ approved with follow-ups. 6 hallazgos no bloqueantes; el del Toast se arregló en la PR; el resto quedan como follow-ups en el brief.
