# Tolerancia de «cumplido» editable en Perfil: Review
_PR: [#143](https://github.com/mancabcar/MealPlan/pull/143) · Reviewed: 2026-10-05 · Verdict: ⚠️ approved with follow-ups_

## Summary
La PR cumple los 7 requisitos de la spec: tolerancia editable en Perfil (5–20, defecto 10), un único valor para Plan y Diario, `macroStatus` con la tolerancia como parámetro obligatorio, y el campo viaja en el perfil (backup y sync) sin cambios de servidor. Typecheck, lint, build, 1411 tests unitarios y los e2e de Perfil, Plan y fibra pasan. No hay bugs confirmados, solo hallazgos menores, que el usuario decidió dejar como no bloqueantes. Divergencia aceptada: `MacroBar` usa `TOLERANCE_DEFAULT` porque solo juzga rangos.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/app/perfil/page.tsx:207, src/lib/tolerance.ts:20 | ✅ tolerance.test.ts, tolerancia.spec.ts |
| R2 | ✅ Done | src/components/plan/DayMacroSummary.tsx:46, src/lib/diaryStats.ts:45 | ✅ diaryStats-tolerance, DayMacroSummary-tolerance |
| R3 | ✅ Done | src/lib/planMacros.ts:104 | ✅ macroStatus-tolerance.test.ts |
| R4 | ✅ Done | src/lib/types.ts:155 (campo del perfil; backup y sync sin cambios) | ✅ backup-tolerance.test.ts |
| R5 | ✅ Done | src/lib/tolerance.ts:13 | ✅ tolerance.test.ts, backup-tolerance.test.ts |
| R6 | ✅ Done | derivado en `periodStats` (src/lib/diaryStats.ts) | ✅ diaryStats-tolerance.test.ts |
| R7 | ✅ Done | src/app/perfil/page.tsx:222 | ✅ tolerancia.spec.ts |

## Blocking
Ninguno.

## Non-blocking
- `src/lib/planMacros.ts:17`: el comentario de `MacroTarget` sigue diciendo «se juzga con ±10 %»; debería remitir a la tolerancia del perfil.
- `src/app/page.tsx:74` (divergencia de tech.md, aceptada): `MacroBar` pasa `TOLERANCE_DEFAULT` porque solo juzga rangos. Si algún día juzga un objetivo numérico, tendrá que recibir `tolerancePct(profile)`.
- `src/app/perfil/page.tsx:207`: `ToleranceRow` copia la estructura de `FiberGoalRow` y `WaterGoalRow`; un `GoalRow` genérico evitaría la triple copia.
- `tests/unit/diaryStats-tolerance.test.ts:10` y `tests/unit/macroStatus-tolerance.test.ts:8`: `const status = macroStatus;` es un alias sin función.
- `src/lib/tolerance.ts:23`: `parseTolerance` acepta «7,0» y «7.0» como 7 (no hay test que fije el criterio).
- Verificar en un entorno real que la sincronización entre dos dispositivos conserva el campo (no probado, se apoya en que el perfil viaja entero).

## Code review findings
Pasada 1 (high): 5 hallazgos, todos recogidos arriba; ninguno es un bug.
