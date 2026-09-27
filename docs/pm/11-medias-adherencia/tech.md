# Medias y adherencia en el Diario: Technical design
_Status: Draft · Updated: 2026-09-27_
_Related: [spec](spec.md) · [brief](brief.md) · [issue #11](https://github.com/mancabcar/MealPlan/issues/11) · sin prototipo_

## Summary
Un módulo puro nuevo, `src/lib/diaryStats.ts`, calcula el periodo (N días completos que acaban en la fecha elegida o, si es hoy o posterior, ayer), agrupa las entradas por fecha una sola vez y devuelve medias y adherencia reutilizando `macroStatus` de `src/lib/planMacros.ts`, así que el Plan y el Diario juzgan un día con el mismo criterio. En el Diario (`src/app/page.tsx`) se añade una tarjeta propia debajo de «Calorías esta semana» con un selector 7 / 30 días (el `ChipRadios` de Evolución, extraído a `src/components/ui/`), el rango de fechas, las medias con el aspecto de `DayMacroSummary` y el texto «X de N días dentro del objetivo». Esfuerzo: **S/M** (≈ 1 día con tests); sin cambios de datos, de backup ni de APIs de Next.

## Context
- Stack: Next 16.2.9 App Router, React 19.2.4, Tailwind v4 con tokens, `lucide-react`. El Diario (`src/app/page.tsx`) es una página cliente que lee todo de `useApp()` (`src/lib/store.tsx`, localStorage por usuario con `userKey`). La feature no toca rutas, server code ni APIs de Next, así que el aviso de `AGENTS.md` no afecta al diseño.
- **Diario**: `date` (estado, `todayStr()` por defecto; `""` si se borra el input) controla el anillo, `MacroBar` y la gráfica. `totals` suma las entradas del día sin redondear; `week` (líneas 141–148) construye 7 fechas locales acabando en `date` con `new Date(date + "T00:00:00")` + `setDate`, **incluye** la fecha elegida y filtra `entries` una vez por día.
- **`MealEntry`** (`src/lib/types.ts`): los cuatro macros ya vienen multiplicados por `servings` (`recipeEntry()` en `src/lib/diary.ts`), así que las medias solo suman.
- **Criterio «cumplido»** (`src/lib/planMacros.ts`): `macroStatus(value, target)` redondea el valor, compara rango `min ≤ v ≤ max` o banda ±`PLAN_TOLERANCE_PCT` (10) en aritmética entera, y trata `NaN` como `below`. `finiteOr0` es privado. El objetivo por macro (`calorieGoal`, `proteinRange ?? proteinGoal`, `carbsGoal`, `fatGoal`) vive en `targetFor()`, privado de `src/components/plan/DayMacroSummary.tsx`.
- **UI reutilizable**: `Card`, `Chip`, `DayMacroSummary` (rejilla 2 × 2 con «N / objetivo», estado con icono + texto y frase `sr-only`; `<ul aria-label="Macros del día">`), y `ChipRadios` (grupo de radios nativos con aspecto de chip y `role="radiogroup"`), hoy definido dentro de `src/app/perfil/evolucion/page.tsx`.
- **Fechas**: `src/lib/week.ts` tiene `toDateStr()` (privado) y `mondayOf`/`weekDates`; `src/lib/measurements.ts` tiene `formatShortDate("2026-09-19") → "19 sep"`.
- **Tests**: Vitest (`tests/unit/*.test.ts`, entorno node; `// @vitest-environment jsdom` para componentes) y Playwright (`tests/e2e/*.spec.ts`; `signIn()` en `helpers.ts` siembra localStorage y fija hoy = martes 2026-09-22 con `page.clock.setFixedTime`), axe en `tests/e2e/accessibility.spec.ts`, fixtures en `tests/fixtures/` (`diario.ts` con `entry()` y `TODAY`/`YESTERDAY`; `profiles.ts` con `lucia` sin rango y `manuel` con rango).

## Approaches considered
### A. Módulo puro `diaryStats.ts` + tarjeta propia en el Diario (recomendado)
Funciones puras para periodo, totales por día, medias y adherencia; la página solo guarda la opción 7/30 y pinta. · **Pros**: todos los criterios de aceptación de R2–R7 se prueban en unit sin navegador (como `planMacros`); un solo punto que llama a `macroStatus`, así que Plan y Diario no pueden divergir; agrupa entradas por fecha una vez (riesgo de rendimiento del spec). · **Cons**: un archivo más en `src/lib`. · **Effort** S/M
### B. Calcularlo inline en `src/app/page.tsx` como hoy se hace `week`
· **Pros**: ningún módulo nuevo. · **Cons**: la página ya tiene 400 líneas; la lógica de periodo (hoy no cuenta, fecha futura, `""`) y los límites de adherencia solo se podrían probar en e2e, más lentos y menos exactos en los límites. Descartado.
### C. Fusionar el resumen con la tarjeta «Calorías esta semana»
Una sola tarjeta con gráfica + selector + medias. · **Pros**: menos altura. · **Cons**: la gráfica incluye la fecha elegida (hoy) y el resumen no; con 30 días el selector cambiaría las medias pero no la gráfica (non-goal), lo que en una misma tarjeta parece un bug. Resuelve la pregunta abierta del spec a favor de **tarjeta propia debajo**.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Fechas | `src/lib/week.ts` | Exportar `toDateStr()` y añadir `addDays(date, n)` (fecha local, sin DST: `setDate`). |
| Objetivos | `src/lib/planMacros.ts` | Mover `targetFor()` de `DayMacroSummary` aquí como `macroTarget(key, profile)` (exportado) y exportar `finiteOr0`. Sin cambio de comportamiento. |
| Cálculo | `src/lib/diaryStats.ts` (nuevo) | `STATS_PERIODS`, `statsPeriod()`, `dailyTotals()`, `isCompliantDay()`, `periodStats()`, `formatPeriod()`. Puro, sin React ni store. |
| UI | `src/components/ui/ChipRadios.tsx` (nuevo) | `ChipRadios` extraído tal cual de `src/app/perfil/evolucion/page.tsx`, que pasa a importarlo. |
| UI | `src/components/plan/DayMacroSummary.tsx` | Usa `macroTarget`. Nuevo prop opcional `label` (por defecto «Macros del día»); `summary` pasa a `{ totals; planned?; total? }` y el aviso «N de M comidas planificadas» solo sale si vienen ambos. El test existente sigue igual. |
| UI | `src/components/diario/PeriodSummary.tsx` (nuevo) | Tarjeta del resumen: cabecera, selector, rango, medias, adherencia, estado vacío. |
| Página | `src/app/page.tsx` | Estado `days` (7/30, recordado en R11), `<PeriodSummary>` entre «Calorías esta semana» y la tarjeta de `MacroBar`. |
| Tests | `tests/unit/diaryStats.test.ts`, `tests/fixtures/medias-adherencia.ts`, `tests/e2e/medias-adherencia.spec.ts` (nuevos); `tests/e2e/accessibility.spec.ts` | Ver Testing strategy. |

### Data model
Ninguno en los datos del usuario: no cambian `MealEntry`, `UserProfile`, `USER_DATA_KEYS` ni el backup, no hay migración. Las medias se derivan en cada render.

R11: la opción 7/30 se guarda en `localStorage` con la clave `userKey(userId, "diary_stats_days")` (`"7"` | `"30"`), leída en el inicializador de `useState` y escrita en `onChange`, ambas en `try/catch`. Es una preferencia de vista, no un dato: queda fuera de `USER_DATA_KEYS` y del backup. Un valor que no sea 7 o 30 → 7.

### APIs / interfaces
```ts
// src/lib/week.ts
export function toDateStr(d: Date): string;
/** "2026-09-22", -1 → "2026-09-21". Por fecha local: siempre un día de calendario, también con cambio de hora. */
export function addDays(date: string, n: number): string;

// src/lib/planMacros.ts
export const finiteOr0: (n: number) => number;
/** Objetivo de un macro desde el perfil: proteína = proteinRange ?? proteinGoal. Único mapeo, lo usan Plan y Diario. */
export function macroTarget(key: keyof Macros, profile: UserProfile): MacroTarget;

// src/lib/diaryStats.ts
export const STATS_PERIODS = [7, 30] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/**
 * R6: N fechas (YYYY-MM-DD, ascendentes) que acaban en `selected` si es anterior a `today`; si es hoy,
 * posterior o "" (input borrado), acaban ayer. El día en curso nunca entra.
 */
export function statsPeriod(selected: string, today: string, days: StatsPeriod): { start: string; end: string; dates: string[] };

/** Totales por fecha, sin redondear, solo de las fechas pedidas que tienen ≥ 1 entrada. Una pasada por `entries`. finiteOr0 por macro. */
export function dailyTotals(entries: MealEntry[], dates: string[]): Map<string, Macros>;

/** R4: kcal dentro de calorieGoal Y proteína dentro de macroTarget("protein"). Mismo macroStatus que el Plan. */
export function isCompliantDay(totals: Macros, profile: UserProfile): boolean;

/** R1–R3/R7: null si ningún día del periodo tiene entradas. Medias sin redondear (la UI redondea). */
export function periodStats(args: { entries: MealEntry[]; profile: UserProfile; dates: string[] }):
  { loggedDays: number; compliantDays: number; averages: Macros } | null;

/** R8: "19–25 sep"; si cambia el mes, "27 ago–25 sep" (formatShortDate). Sin año. */
export function formatPeriod(start: string, end: string): string;
```
Reglas:
- `statsPeriod`: `end = selected !== "" && selected < today ? selected : addDays(today, -1)`; `dates = [addDays(end, -(days-1)) … end]`. Comparar `YYYY-MM-DD` como string, como `pendingSlots`.
- `dailyTotals`: construye un `Set(dates)` y recorre `entries` una vez; las entradas de hoy y futuras quedan fuera solas.
- `periodStats`: `loggedDays = map.size`; `averages = suma / loggedDays` por macro; `compliantDays` = días con `isCompliantDay`. Un día registrado con 0 kcal cuenta y no cumple (edge case del spec).
- La media se juzga en la UI (R9) con `macroStatus(average, macroTarget(...))`, igual que un día.

### UI
Sin prototipo; se decide aquí la pregunta abierta: **tarjeta propia debajo de «Calorías esta semana»** (enfoque A, ver C).

`<PeriodSummary days entries profile date today onDaysChange>` dentro de un `Card as="section" aria-labelledby`:
- Cabecera: `<h2>` «Medias y adherencia» (`font-display text-sm font-semibold`, como «Calorías esta semana») y, a la derecha, `<ChipRadios label="Periodo del resumen" name="stats-days" options={[{value:"7",label:"7 días"},{value:"30",label:"30 días"}]}>` (R5, R10: radios nativos, la opción activa se anuncia como marcada).
- Subtítulo `text-xs` muted: «Últimos 7 días · 19–25 sep» (R8). Se muestra también en el estado vacío.
- Con datos:
  - Adherencia en una sola línea de texto, en un único nodo para que el lector la lea completa (R3, R10): **«5 de 6 días dentro del objetivo»**, con `Check` `aria-hidden` en `--color-accent`. Singular: «1 de 1 día».
  - Medias: `<DayMacroSummary summary={{ totals: averages }} profile={profile} label="Medias del periodo" />` (R1, R9). Reutiliza celdas, objetivos, rango de proteína, estado «Dentro / Por debajo / Por encima» y frase `sr-only`, sin aviso de comidas planificadas.
- Sin días registrados (R7): `<p>` «Sin registros en los últimos 7 días» (o «30 días»); ni medias ni adherencia.
- Recalcular (R5/R6): todo se deriva en render de `entries`, `profile`, `date`, `todayStr()` y `days`; con 30 días × pocas entradas por día es trivial y no necesita `useMemo`.
- Móvil (375 px): cabecera con `flex-wrap` para que los dos chips bajen si no caben junto al título; la rejilla 2 × 2 ya está validada a 375 px en el Plan.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `periodStats().averages` → `DayMacroSummary` con las cuatro medias. |
| R2 | `dailyTotals` solo devuelve fechas con ≥ 1 entrada; la media divide entre `loggedDays`. Varias entradas del mismo día se suman antes de promediar. |
| R3 | «X de N días dentro del objetivo» con `compliantDays` / `loggedDays`. |
| R4 | `isCompliantDay` = `macroStatus(kcal, calorieGoal)` y `macroStatus(prot, macroTarget("protein"))` `=== "within"`; `macroTarget` compartido con el Plan. |
| R5 | `ChipRadios` 7/30, 7 por defecto; cambiar recalcula en render. |
| R6 | `statsPeriod` (hoy/futuro/`""` → acaba ayer; pasado → acaba en la fecha). |
| R7 | `periodStats` → `null` → mensaje vacío. |
| R8 | `formatPeriod(start, end)` en el subtítulo. |
| R9 | `DayMacroSummary` muestra objetivo/rango y estado de cada media con `macroStatus`. |
| R10 | Radios nativos en `role="radiogroup"`; adherencia en un nodo de texto; frases `sr-only` de las medias; escaneo axe. |
| R11 | `localStorage` `mp_<userId>_diary_stats_days`, con `try/catch`; fuera del backup. |

## Risks & mitigations
- **Divergencia con el Plan**: mitigada con `macroTarget` + `macroStatus` compartidos y un unit test que juzga los mismos totales con `DayMacroSummary`/`macroStatus` y con `isCompliantDay`.
- **Fechas y cambio de hora**: `addDays` usa `setDate` sobre fecha local (como `week.ts` y la gráfica), nunca sumas de 86 400 000 ms. Test que cruza el 25 oct 2026 (fin del horario de verano) y el cambio de mes.
- **Refactor de `DayMacroSummary`**: el prop `summary` se amplía sin romper su contrato; los e2e de `macros-plan.spec.ts` y el unit existente lo vigilan.
- **Extraer `ChipRadios`**: movimiento sin cambios; los e2e de Evolución (`evolucion.spec.ts`) lo cubren.
- **`MacroBar` sigue sin estado por debajo/por encima** para kcal, hidratos y grasas: el anillo del día y la tarjeta de medias usan criterios de presentación distintos. No afecta a la adherencia; ya es follow-up de #10.
- Reversible por completo: solo una clave de preferencia nueva en localStorage.

## Testing strategy
**Unit** (`tests/unit/diaryStats.test.ts`, entorno node; datos en `tests/fixtures/medias-adherencia.ts`, con hoy = 2026-09-22 como el resto de fixtures):
- `statsPeriod`: fecha = hoy → 15–21 sep (7) y 23 ago–21 sep (30); fecha pasada 14 sep → 8–14 sep; fecha futura y `""` → acaba ayer; cruce de mes y del 25 oct (DST) → exactamente 7/30 fechas distintas.
- `dailyTotals` / `periodStats` (R1/R2): 1800, 2000, 2200 en 3 de 7 días → media 2000; un día con 1200 + 800 → 2000; entradas con raciones (macros ya escalados, decimales) se suman sin redondear; entradas de hoy o futuras no cuentan; macro `NaN`/ausente suma 0; sin días → `null`; día con 0 kcal cuenta y no cumple.
- `isCompliantDay` (R4): perfil 2000 + rango 130–160: 2150/135 cumple, 2150/125 no, 2201/140 no, límites 1800/2200 y 130/160 cumplen; sin rango `proteinGoal` 140: 2000/128 cumple; equivalencia con `macroStatus` del Plan en los mismos totales.
- `periodStats` (R3): 6 días registrados, 5 cumplen → `{ loggedDays: 6, compliantDays: 5 }`.
- `formatPeriod` (R8): «15–21 sep», «23 ago–21 sep».

**Componente** (`DayMacroSummary.test.tsx`, jsdom): con `label="Medias del periodo"` y sin `planned`/`total` no sale el aviso.

**E2E** (`tests/e2e/medias-adherencia.spec.ts`, hoy fijado al 22 sep):
- R1/R2/R3: con registros en 3 días de la semana anterior, la tarjeta muestra «Últimos 7 días · 15–21 sep», «2000 / 2000» en Calorías y «X de 3 días dentro del objetivo».
- R6: un registro hoy no cambia medias ni adherencia; cambiar la fecha a 14 sep → «8–14 sep».
- R5: pulsar «30 días» cambia rango, medias y adherencia; volver a «7 días» restaura; por defecto 7.
- R7: sin registros en el periodo (o solo hoy) → «Sin registros en los últimos 7 días», sin lista «Medias del periodo».
- R10: el radio «7 días» está `checked` en el `radiogroup` «Periodo del resumen»; aria snapshot de la adherencia.
- R11: elegir 30, recargar → sigue en 30.
- Accesibilidad: escaneo axe del Diario con la tarjeta llena en `accessibility.spec.ts`.
- Captura manual a 375 px en dev-code.

## Tasks
1. [ ] Tests primero (dev-test): `tests/fixtures/medias-adherencia.ts`, `tests/unit/diaryStats.test.ts`, `tests/e2e/medias-adherencia.spec.ts`, caso nuevo en `DayMacroSummary.test.tsx` y escaneo en `accessibility.spec.ts`, en rojo. (R1–R11)
2. [x] `week.ts`: exportar `toDateStr` y añadir `addDays`; `planMacros.ts`: `macroTarget` y `finiteOr0` exportados, y `DayMacroSummary` usa `macroTarget`. Sin cambios visibles; tests existentes en verde. (R4)
3. [x] `src/lib/diaryStats.ts`: `statsPeriod`, `dailyTotals`, `isCompliantDay`, `periodStats`, `formatPeriod`; unit en verde. (R1–R4, R6–R8)
4. [x] Extraer `ChipRadios` a `src/components/ui/ChipRadios.tsx` y usarlo desde Evolución; e2e de Evolución en verde. (R5, R10)
5. [ ] `DayMacroSummary`: prop `label` y aviso opcional. (R9)
6. [ ] `src/components/diario/PeriodSummary.tsx` e integración en `src/app/page.tsx` con `days` en estado (7 por defecto); e2e de R1–R10 y axe en verde. (R1–R10)
7. [ ] Recordar 7/30 en `localStorage` por usuario. (R11)
8. [ ] Revisión a 375 px, lint, typecheck, build.

## Spec feedback
1. **Pregunta abierta resuelta: ubicación.** Tarjeta propia debajo de «Calorías esta semana», no fusionada (enfoque C descartado): la gráfica incluye hoy y no cambia con 30 días; en la misma tarjeta parecería un fallo.
2. **Pregunta abierta: marcar en `WeekBarChart` los días que cumplen.** De acuerdo con dejarlo fuera. Con `isCompliantDay` exportado cuesta poco (un icono por barra), pero toca `WeekBarChart` y su accesibilidad; queda como follow-up.
3. **Texto «últimos» con una fecha pasada (sin bloqueo).** Con el Diario en el 14 sep se leerá «Últimos 7 días · 8–14 sep» y, si está vacío, «Sin registros en los últimos 7 días». Es exacto (los 7 días que acaban en la fecha elegida) y el rango lo aclara; el diseño lo deja así. Alternativa si se prefiere: «7 días» sin «últimos».
4. **La media de un macro «Dentro» no implica días que cumplen.** Una media de 2000 kcal puede salir de días a 1500 y 2500 (0 de 2 cumplen). Es lo esperado (R9 juzga la media, R3 los días), pero puede sorprender al leerlo junto; no requiere cambio.
5. **R11 fuera del backup.** La preferencia 7/30 no viaja en la copia de seguridad. Parece lo correcto para una preferencia de vista; lo anoto para que no sorprenda.

Ninguno de estos puntos bloquea empezar a programar.

## Test coverage
Datos en `tests/fixtures/medias-adherencia.ts` (hoy = 2026-09-22). «Hecho» = todo en verde.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/diaryStats.test.ts › «R1 · R2: medias solo de los días con registros»; tests/e2e/medias-adherencia.spec.ts › «R1 · R2 · R3 · R8…» | unit + e2e | 🔴 failing (not built) |
| R2 | tests/unit/diaryStats.test.ts › «1800, 2000 y 2200 kcal en 3 de 7 días → media 2000», «un día con dos registros…», raciones, `NaN` | unit | 🔴 failing (not built) |
| R3 | tests/unit/diaryStats.test.ts › «R3: adherencia…» (2 de 3, 5 de 6, día con 0 kcal); e2e «2 de 3 días dentro del objetivo» | unit + e2e | 🔴 failing (not built) |
| R4 | tests/unit/diaryStats.test.ts › «R4: un día cumple…» (casos del spec, límites, sin rango, equivalencia con `macroStatus` del Plan), «macroTarget» | unit | 🔴 failing (not built) |
| R5 | tests/unit/diaryStats.test.ts › «R5: cambiar a 30 días…»; e2e › «R5: selector 7 / 30 días» | unit + e2e | 🔴 failing (not built) |
| R6 | tests/unit/diaryStats.test.ts › «addDays…», «R6: el periodo son N días completos…»; e2e › «R6: días completos; hoy no cuenta» | unit + e2e | 🔴 failing (not built) |
| R7 | tests/unit/diaryStats.test.ts › «R7…»; e2e › «R7: sin registros en el periodo» | unit + e2e | 🔴 failing (not built) |
| R8 | tests/unit/diaryStats.test.ts › «R8: rango de fechas del periodo»; e2e subtítulos | unit + e2e | 🔴 failing (not built) |
| R9 | tests/e2e/medias-adherencia.spec.ts › «R9…»; tests/unit/DayMacroSummary.test.tsx › «Medias del periodo…» | e2e + componente | 🔴 failing (not built) |
| R10 | tests/e2e/medias-adherencia.spec.ts › «R10…» (radios + flechas); tests/e2e/accessibility.spec.ts › «Diario con medias y adherencia» | e2e | 🔴 failing (not built) |
| R11 | tests/e2e/medias-adherencia.spec.ts › «R11: se recuerda la opción elegida» | e2e | 🔴 failing (not built) |
