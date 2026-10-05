# Marcar los días que cumplen en la gráfica semanal: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Una función pura `weekDayStates` en `src/lib/diaryStats.ts` calcula el estado de cada día con `dailyTotals` e `isCompliantDay`, los mismos que usa la tarjeta de adherencia. `page.tsx` la llama al construir `week` y `WeekBarChart` solo pinta: icono `Check`, texto `sr-only` por barra y leyenda. Sin datos nuevos ni migración. Esfuerzo S.

## Context
- `src/app/page.tsx:185`: `week` son 7 `{label, value}` que terminan en la fecha seleccionada (incluye hoy si es la seleccionada). `date` y `todayStr()` ya están en ese componente.
- `src/components/ui/WeekBarChart.tsx`: barras sin nombre accesible; su único consumidor es `page.tsx:238`.
- `src/lib/diaryStats.ts`: `dailyTotals` (suma 0 si un macro falta o es NaN) e `isCompliantDay` (usa `tolerancePct` del perfil).
- `src/lib/week.ts`: `dayName(date)` → «Lunes». `PeriodSummary` ya usa `Check` de lucide.

## Approaches considered
### A. Función pura en `diaryStats.ts` (chosen)
`weekDayStates({entries, profile, dates, today})` → estado por fecha; el gráfico no conoce el dominio. **Pros** testeable sin React; mismo cálculo que la tarjeta (R1). **Cons** ninguno relevante. **Effort** S.
### B. Inline en `page.tsx`
Descartada: lógica sin test unitario fácil y duplica el criterio.
### C. Pasar `entries` y `profile` a `WeekBarChart`
Descartada: acopla el gráfico al dominio.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica | `src/lib/diaryStats.ts` | `weekDayStates` y tipo `DayState` |
| UI | `src/components/ui/WeekBarChart.tsx` | recibe `state` y `name`; icono, `sr-only`, leyenda |
| Diario | `src/app/page.tsx` | `week` usa `weekDayStates` y `dayName` |
| Tests | `tests/unit/diaryStats.test.ts`, `tests/unit/WeekBarChart.test.tsx`, `tests/e2e/medias-adherencia.spec.ts` | ver Testing strategy |
### Data model
Ninguno: nada se guarda.
### APIs / interfaces
- `type DayState = "met" | "missed" | "empty" | "today"`.
- `weekDayStates({entries, profile, dates, today}): Map<string, DayState>`: `today` si `date === today`; `empty` si `date > today` o sin entradas; `met`/`missed` según `isCompliantDay` sobre el total del día.
- `WeekBarChart` data: `{ label, value, state, name }[]`.
### UI
- Barra, luego `Check` (`w-3 h-3`, acento, `aria-hidden`) solo si `met`; los demás estados reservan el mismo hueco para que las letras no salten. Letra visible en `aria-hidden`.
- `sr-only` por barra: «Lunes, 1850 kcal, cumple el objetivo» · «Martes, sin registros» · «martes, 900 kcal, día en curso» (siempre el nombre del día, sin caso especial para hoy). «No cumple el objetivo» para `missed`.
- Leyenda siempre visible bajo las barras: «✓ día dentro del objetivo (kcal y proteína)».

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `met` desde `isCompliantDay`; icono `Check` |
| R2 | `today` y fechas ≥ hoy nunca son `met`; `empty` sin registros; `missed` sin icono |
| R3 | `sr-only` por barra con los 4 estados, día y kcal |
| R4 | leyenda fija dentro de `WeekBarChart` |

## Risks & mitigations
- Cambia el tipo de datos de `WeekBarChart`: único consumidor, lo cubre `typecheck`.
- La gráfica incluye hoy y la tarjeta no: es intencionado (R2); el test de coherencia compara solo días pasados.
- La leyenda ocupa una línea más en móvil: se verifica en la app (viewport móvil).

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| Estado de cada día | Se recalcula al cambiar fecha, entradas o perfil | Se deriva en cada render de `page.tsx` (sin estado propio) |
| Fecha futura seleccionada | Ningún día ≥ hoy se marca, tenga o no entradas | `weekDayStates` compara con `today` |
| Fecha seleccionada borrada (`""`) | La gráfica ya se comporta como antes; no se marca ningún día incierto | Se prueba que no lanza |
| Macro ausente o NaN en una entrada | Suma 0, no rompe la marca | `dailyTotals` |
| Día sin entradas | `empty`, sin icono | `weekDayStates` |
| Cambio de tolerancia o rango de proteína | Los iconos siguen el perfil actual | `isCompliantDay` lee el perfil |

## Testing strategy
- **Unit** (`diaryStats.test.ts`): cumple (2150 kcal / 135 g); no cumple por proteína (125 g); vacío; hoy con entradas cumplidas → `today`; fecha futura con entradas → `empty`; macro NaN; coherencia: nº de `met` en días pasados = `periodStats(...).compliantDays`.
- **Componente** (`WeekBarChart.test.tsx`): icono solo en `met`, los 4 textos `sr-only`, leyenda presente, misma altura de hueco.
- **E2E** (`medias-adherencia.spec.ts`, fixture existente): los días con icono coinciden con «2 de 3 días dentro del objetivo»; hoy sin icono.

## Tasks
1. [x] Tests rojos con dev-test (R1–R4)
2. [x] `DayState` y `weekDayStates` en `diaryStats.ts` (R1, R2)
3. [x] `WeekBarChart` con `state`/`name`, icono, `sr-only` y leyenda, y `page.tsx` que construye `week` con ellos, en un solo commit para no romper la app (R1–R4)
4. [ ] Verificar en la app (claro/oscuro, móvil) y pasar lint, typecheck, tests y build

## Spec feedback
Sin cambios en el spec. La open question del icono queda resuelta: `Check` de lucide bajo la barra.

## Test coverage
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/unit/diaryStats.test.ts` › «#50 R1 · R2» (cumple 2150/135, no cumple 2150/125, fixture 16/18/20 sep) | unit | 🔴 failing (not built) |
| R1 | `tests/unit/WeekBarChart.test.tsx` › «#50 R1 · R2: icono solo en los días cumplidos» | component | 🔴 failing (not built) |
| R1 | `tests/e2e/medias-adherencia.spec.ts` › «R1 · R2 · R3: los días cumplidos llevan icono…» y «fecha 14 sep» | e2e | 🔴 failing (not built) |
| R2 | `diaryStats.test.ts` › hoy → today, vacío, futuro con entradas → empty | unit | 🔴 failing (not built) |
| R2 | `medias-adherencia.spec.ts` › «hoy no se marca aunque cumpla» y «fecha futura» | e2e | 🔴 failing (not built) |
| R3 | `WeekBarChart.test.tsx` › «#50 R3» (4 textos, 7 barras, redondeo, letra aria-hidden) | component | 🔴 failing (not built) |
| R3 | `medias-adherencia.spec.ts` › «R1 · R2 · R3» (7 textos en la app) | e2e | 🔴 failing (not built) |
| R4 | `WeekBarChart.test.tsx` › «#50 R4» (con y sin días cumplidos) | component | 🔴 failing (not built) |
| R4 | `medias-adherencia.spec.ts` › «R1 · R2 · R3» (leyenda visible) | e2e | 🔴 failing (not built) |
| Métrica | `diaryStats.test.ts` › «Métrica…periodStats» y `medias-adherencia.spec.ts` › «Métrica…2 de 3» | unit · e2e | 🔴 failing (not built) |
| Edge | `diaryStats.test.ts` › macro ausente o NaN, sin fechas | unit | 🔴 failing (not built) |
| Edge | Fecha seleccionada borrada, hueco reservado bajo cada barra | — | no probado: ver hand-off (el hueco se verifica en la app, tarea 4) |
