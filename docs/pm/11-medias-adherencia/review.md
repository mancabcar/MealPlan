# Medias y adherencia en el Diario: Review
_PR: [#46](https://github.com/mancabcar/MealPlan/pull/46) · Reviewed: 2026-09-27 · Verdict: ✅ approved (tras arreglar los 4 no bloqueantes, decidido por el usuario el 2026-09-27)_

## Summary
La PR implementa los 11 requisitos del spec (7 Must, 3 Should, 1 Could) siguiendo el enfoque A de `tech.md`: módulo puro `src/lib/diaryStats.ts` que reutiliza `macroStatus`/`macroTarget` del Plan, tarjeta propia `PeriodSummary` debajo de «Calorías esta semana» y `ChipRadios` extraído a `components/ui`. Todo en verde: 610 unit (Vitest), 83 e2e de las suites afectadas (`medias-adherencia`, `accessibility`, `macros-plan`, `evolucion`), typecheck y lint sin errores. No hay hallazgos bloqueantes; se proponen `⚠️ approved with follow-ups` por un detalle visual en la línea de adherencia y la redacción «Últimos N días» con fechas pasadas. **Clasificaciones y veredicto propuestos por Claude, pendientes de confirmación (decisión del usuario).**

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 (Must) | ✅ Done | src/components/diario/PeriodSummary.tsx:79 (`DayMacroSummary` con `averages`); src/lib/diaryStats.ts:51 (`periodStats`) | ✅ unit + e2e |
| R2 (Must) | ✅ Done | src/lib/diaryStats.ts:26-40 (`dailyTotals`, solo fechas con entradas), :51-75 (divide entre `loggedDays`) | ✅ unit + e2e |
| R3 (Must) | ✅ Done | src/components/diario/PeriodSummary.tsx:77 («X de N días dentro del objetivo», singular «día») | ✅ unit + e2e |
| R4 (Must) | ✅ Done | src/lib/diaryStats.ts:43-48 (`isCompliantDay` con `macroStatus` + `macroTarget` compartidos); src/lib/planMacros.ts:32 | ✅ unit (casos del spec, límites, sin rango, equivalencia con el Plan) |
| R5 (Must) | ✅ Done | src/components/diario/PeriodSummary.tsx:61-67; src/app/page.tsx:100 (7 por defecto) | ✅ unit + e2e |
| R6 (Must) | ✅ Done | src/lib/diaryStats.ts:15-23 (`statsPeriod`: hoy/futuro/`""` → ayer) | ✅ unit (incl. DST 25 oct y cambio de mes) + e2e |
| R7 (Must) | ✅ Done | src/components/diario/PeriodSummary.tsx:82; src/lib/diaryStats.ts:61 (`null`) | ✅ unit + e2e |
| R8 (Should) | ✅ Done | src/lib/diaryStats.ts:78-82 (`formatPeriod`); PeriodSummary.tsx:70 | ✅ unit + e2e |
| R9 (Should) | ✅ Done | src/components/plan/DayMacroSummary.tsx (reutilizado con `label="Medias del periodo"`) | ✅ e2e + componente |
| R10 (Should) | ✅ Done | src/components/ui/ChipRadios.tsx (radios nativos en `radiogroup`); PeriodSummary.tsx:77 (un solo nodo de texto) | ✅ e2e (radios, flechas, axe) |
| R11 (Could) | ✅ Done | src/components/diario/PeriodSummary.tsx:14-32 (`localStorage` por usuario, `try/catch`, fuera del backup) | ✅ e2e (recarga) |

Cobertura: 7/7 Must, 3/3 Should y 1/1 Could hechos y con test automatizado. Ningún test se ha borrado, saltado ni relajado en la PR.

Edge cases del spec: día con 0 kcal (cuenta y no cumple, unit ✅), macro ausente/`NaN` (suma 0, unit ✅), cruce de mes y DST (unit ✅), objetivo 0 / sin proteína (delegado en `macroStatus`, sin lógica nueva ✅), registros futuros (fuera, unit ✅), menos de 7 días de historial (N = días registrados ✅).

## Blocking
Ninguno.

## Non-blocking
- **Icono de éxito aunque no se cumpla ningún día**: src/components/diario/PeriodSummary.tsx:75: la línea de adherencia lleva siempre un `Check` en `--color-accent`, también con «0 de 1 día dentro del objetivo» (caso real del e2e de R6 con el 14 sep). Visualmente indica éxito cuando no lo hay. → Quitar el icono, o elegirlo según la proporción (p. ej. `Check` solo si `compliantDays === loggedDays`, o icono neutro en otro caso).
- **«Últimos N días» con una fecha pasada**: src/components/diario/PeriodSummary.tsx:70 y :82: con el Diario en el 14 sep se lee «Últimos 7 días · 8–14 sep» y, si está vacío, «Sin registros en los últimos 7 días». Es el punto 3 del *Spec feedback* de `tech.md`, que el diseño dejó así pero no consta confirmado por el usuario. → Aceptarlo tal cual (recomendado: el rango de fechas lo aclara) o usar «7 días · 8–14 sep» sin «últimos». **Decisión del usuario.**
- **Cambios no relacionados en la PR**: `docs/pm/10-macros-plan/brief.md`, `docs/pm/design-refresh/brief.md` y `docs/pm/lista-compra/brief.md` solo actualizan líneas de estado a `merged`. Son documentación inocua; propuesta: aceptarlos. **Decisión del usuario.**
- **Divergencia menor con `tech.md`**: `loadStatsDays`/`saveStatsDays` viven en `PeriodSummary.tsx` y el `name` del radiogroup es `${headingId}-days` en vez de `stats-days`. Sin impacto funcional; propuesta: aceptar. **Decisión del usuario.**

## Code review findings
Pasada 1 (`code-review`, esfuerzo high) — además de los dos primeros puntos de arriba:
- **Reutilización**: src/app/page.tsx:148: el array `week` de la gráfica sigue construyendo fechas a mano (`new Date` + `setDate` + formateo) cuando esta PR añade `addDays`/`toDateStr` en `src/lib/week.ts`. Dos implementaciones de fecha local en la misma página. → Reescribir `week` con `addDays(date, i - 6)` en un follow-up.
- **Eficiencia**: src/components/diario/PeriodSummary.tsx:52: `statsPeriod` + `periodStats` recorren todas las entradas en cada render del Diario (también al escribir en la hoja de añadir). Trivial con el volumen actual y aceptado en `tech.md`; un `useMemo` sobre `[entries, profile, date, days]` lo evitaría si crece el historial.

No se han encontrado errores de corrección en la lógica de periodo, medias ni adherencia. Revisado también: `AppShell` no renderiza la página hasta tener usuario (sin desajuste de hidratación al leer `localStorage` en el inicializador) y `AppProvider` se remonta por usuario, así que R11 no mezcla preferencias entre cuentas.

## Arreglos tras la revisión (2026-09-27)
Decisiones del usuario: arreglar los cuatro hallazgos en esta PR y aceptar los cambios de briefs ajenos y las divergencias menores con `tech.md`.
- **Icono de adherencia** → arreglado: el `Check` solo aparece si cumplen todos los días (`compliantDays === loggedDays`). Nuevos e2e «R3: el check de la adherencia solo si cumplen todos los días».
- **«Últimos N días»** → arreglado: subtítulo «7 días · 15–21 sep» y vacío «Sin registros en estos 7 días». Spec (R7, User flows) y e2e actualizados.
- **`week` con `addDays`** → arreglado en `src/app/page.tsx`.
- **Recalcular en cada render** → arreglado con `useMemo` en `PeriodSummary`.

Verificación: 610 unit, 232 e2e, typecheck, lint y build en verde.
