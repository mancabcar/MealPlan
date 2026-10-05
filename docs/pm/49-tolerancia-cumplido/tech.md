# Tolerancia de «cumplido» editable en Perfil: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Un campo opcional `tolerancePct` en `UserProfile`, con un helper puro en `lib/tolerance.ts`, sigue el patrón de `fiberGoal`. `macroStatus` recibe la tolerancia como parámetro obligatorio y sus llamadas la sacan del perfil. Perfil gana una fila de edición. Esfuerzo: S–M.

## Context
- `src/lib/planMacros.ts`: `PLAN_TOLERANCE_PCT = 10` y `macroStatus(value, target)`, que lo lee directamente.
- `src/lib/diaryStats.ts`: `isCompliantDay` y `periodStats` juzgan con `macroStatus` y ya reciben `profile`.
- `src/components/plan/DayMacroSummary.tsx` y `src/app/page.tsx` (Diario) llaman a `macroStatus` y tienen `profile` a mano.
- Precedente: `fiberGoal` (`src/lib/fiber.ts`, `src/lib/types.ts`, fila de edición en `src/app/perfil/page.tsx`, validación en `src/lib/backup.ts`).
- Sync: el perfil viaja entero como la sección `profile` (`server/lib/sync.ts › SYNC_KEYS` lista secciones, no campos), así que el campo nuevo viaja sin cambios en el servidor.

## Approaches considered
### A. Campo opcional `tolerancePct` en `UserProfile` + `lib/tolerance.ts` (chosen)
Mismo patrón que `fiberGoal`. **Pros**: sin cambios de servidor, backup y sync gratis, coherente con el código. **Cons**: ninguno relevante. **Effort** S–M.
### B. Clave de almacenamiento propia
Nueva sección en `USER_DATA_KEYS` y `SYNC_KEYS`. **Pros**: ajuste aislado. **Cons**: migración de sync y cambios de servidor para un solo número. **Effort** M–L.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipo | `src/lib/types.ts` | `tolerancePct?: number` en `UserProfile` (entero 5–20; ausente = 10) |
| Lógica | `src/lib/tolerance.ts` (nuevo) | `TOLERANCE_DEFAULT = 10`, `TOLERANCE_MIN = 5`, `TOLERANCE_MAX = 20`, `TOLERANCE_ERROR`, `tolerancePct(profile)` (ausente o no válido = 10, ajusta a 5–20), `parseTolerance(text)` (entero 5–20, si no `null`) |
| Cálculo | `src/lib/planMacros.ts` | `macroStatus(value, target, tolerancePct)` obligatorio; se retira `PLAN_TOLERANCE_PCT` |
| Diario | `src/lib/diaryStats.ts` | `isCompliantDay` y `periodStats` pasan `tolerancePct(profile)` |
| Plan | `src/components/plan/DayMacroSummary.tsx` | pasa `tolerancePct(profile)`; con `profile` nulo no se juzga (como hoy) |
| Diario UI | `src/app/page.tsx` | pasa `tolerancePct(profile)` en el chip de rango |
| Perfil | `src/app/perfil/page.tsx` | fila «Tolerancia de cumplido» con el patrón de `fiberGoal` y línea de ayuda |
| Backup | `src/lib/backup.ts` | sin cambios: conserva el campo del perfil; se normaliza al leer con `tolerancePct(profile)` |
### Data model
`UserProfile.tolerancePct?: number`. Sin migración: ausente = 10.
### APIs / interfaces
`macroStatus(value: number, target: MacroTarget, tolerancePct: number): MacroStatus`. La comparación sigue en aritmética entera con `tolerancePct` en lugar de la constante.
### UI
Fila de edición en Perfil con valor en %, botón de editar, error «Un número entero entre 5 y 20 %» y una línea que dice que afecta al Plan y al Diario.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Fila de Perfil, `parseTolerance`, defecto 10 |
| R2 | Plan y Diario pasan `tolerancePct(profile)` a `macroStatus` para todo objetivo numérico; el rango de proteína no usa tolerancia |
| R3 | Tercer parámetro obligatorio de `macroStatus`; el compilador detecta llamadas sin él |
| R4 | Campo del perfil: viaja en backup y sync sin cambios de servidor |
| R5 | `tolerancePct(profile)` da 10 si falta o no es válido y ajusta a 5–20 |
| R6 | Nada se guarda por día; Diario deriva el estado en cada render |
| R7 | Línea de ayuda en la fila de Perfil |

## Risks & mitigations
- Olvidar pasar la tolerancia en alguna llamada: parámetro obligatorio y `tsc`. Aceptado.
- Redondeo entero de `macroStatus` con distintos porcentajes: tests de límites con 5, 10 y 20. Aceptado.
- Valor corrupto en un backup: `tolerancePct(profile)` lo normaliza. Aceptado.
- Cliente antiguo que reescriba el perfil y pierda el campo: se vuelve a 10 (R5). Riesgo aceptado por el usuario, pregunta cerrada.

## Testing strategy
- Unit: `tolerance.ts` (defecto, clamp, parse); `macroStatus` con 5/10/20 incluidos los límites enteros; `isCompliantDay` y `periodStats` con distinta tolerancia; backup (ida y vuelta, campo ausente, valor inválido).
- Component: `DayMacroSummary` y fila de Perfil.
- E2E: un archivo `tests/e2e/tolerancia.spec.ts` (decidido en dev-test). Que el servidor conserva el campo se verifica leyendo `server/lib/sync.ts`.

## Test coverage
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/tolerance.test.ts › "R1: constantes y defecto", "R1: parseTolerance" | unit | 🟢 passing |
| R1 | tests/e2e/tolerancia.spec.ts › "R1: la tolerancia persiste tras recargar", "R1: fuera de 5–20 muestra el error…" | e2e | 🟢 passing |
| R2 | tests/unit/macroStatus-tolerance.test.ts › "R2: el rango de proteína no depende de la tolerancia" | unit | 🟢 passes (protege la regresión) |
| R2 | tests/unit/diaryStats-tolerance.test.ts › "R2: isCompliantDay usa la tolerancia del perfil" | unit | 🟢 passing |
| R2 | tests/unit/DayMacroSummary-tolerance.test.tsx › "R2: el estado de cada macro usa la tolerancia del perfil" | component | 🟢 passing |
| R2, R7 | tests/e2e/tolerancia.spec.ts › "R1 · R2 · R7: cambiar la tolerancia en Perfil cambia el estado en el Plan" | e2e | 🟢 passing |
| R3 | tests/unit/macroStatus-tolerance.test.ts › "R3: …" (5/10/20, límites enteros, hidratos 230) | unit | 🟢 passing |
| R4 | tests/unit/backup-tolerance.test.ts › "R4: la tolerancia viaja en la copia de seguridad" | unit | 🟢 passing |
| R5 | tests/unit/tolerance.test.ts › "R5: …"; tests/unit/backup-tolerance.test.ts › "R5: …" | unit | 🟢 passing |
| R6 | tests/unit/diaryStats-tolerance.test.ts › "R6: periodStats recalcula la adherencia…" | unit | 🟢 passing |
| R7 | tests/e2e/tolerancia.spec.ts (línea de ayuda, en el primer caso) | e2e | 🟢 passing |

Los tests antiguos de `planMacros.test.ts` y `diaryStats.test.ts` que llaman a `macroStatus(v, t)` se actualizaron a la firma de tres parámetros (con 10) en la tarea 2.

## Tasks
1. [x] Tipo `tolerancePct` y `lib/tolerance.ts` con sus tests unitarios (covers R1, R5)
2. [x] `macroStatus` con parámetro obligatorio; adaptar `planMacros`, `diaryStats`, `DayMacroSummary`, `page.tsx` y los tests existentes (covers R2, R3, R6)
3. [x] Backup: sin código nuevo, `backup.ts` conserva los campos del perfil y `tolerancePct(profile)` normaliza al leer; probado ida y vuelta, ausente e inválido (covers R4, R5)
4. [x] Perfil: fila de edición con ayuda, cubierta por el e2e `tolerancia.spec.ts` (covers R1, R7)
5. [x] Tests de `macroStatus`, `isCompliantDay` y `periodStats` con distintas tolerancias (escritos antes del código en dev-test) (covers R2, R6)

## Spec feedback
- Hallazgo: la tolerancia ya se aplica a kcal, hidratos, grasas y proteína sin rango, no solo a proteína (recogido en la spec).
- Pregunta abierta de la spec sobre clientes antiguos: cerrada, riesgo aceptado.
