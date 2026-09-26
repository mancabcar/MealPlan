# Historial de peso y medidas corporales: Technical design
_Status: Approved · Updated: 2026-09-26_
_Related: [spec](spec.md) · [brief](brief.md) · [prototype](https://claude.ai/artifact/UC1WMWf2YsQwbkVU88LGEz)_

## Summary
Una colección nueva `measurements` en el store (localStorage por usuario, como el resto), una librería pura `src/lib/measurements.ts` (catálogo de métricas, validación, tendencia, peso del perfil) y una subruta `/perfil/evolucion` con una gráfica SVG propia, sin dependencias nuevas. La oferta de recalcular se extrae de `src/app/perfil/page.tsx` a un componente compartido para usarla en Evolución. Esfuerzo **M** (unos 11 commits pequeños), casi todo UI; el riesgo principal es mantener sincronizados los dos campos de peso del perfil.

## Context
- **Stack:** Next 16.2.9 (App Router), React 19.2, Tailwind 4, `lucide-react`. Sin librería de gráficas. Todo es cliente: `AppProvider` (`src/lib/store.tsx`) persiste cada colección con `usePersisted(key, fallback, { upgrade })` en `localStorage` bajo `mp_<userId>_<dato>` (`userKey`, `src/lib/auth.tsx`). `upgrade` es el sitio de las migraciones/saneado (`src/lib/migrate.ts`).
- **Peso del perfil:** `UserProfile.body?.weightKg` (objetivos calculados, o de la nutricionista con datos corporales) y `UserProfile.weightKg` (nutricionista sin datos corporales) (`src/lib/types.ts:133`). `BodySection` (`src/app/perfil/page.tsx:315`) escribe `{ body }` con «Calculado» y `{ body, weightKg }` con «De tu nutricionista»; sin `body`, solo `weightKg`.
- **Oferta de recalcular:** estado local `recalc` y banner `role="status"` dentro de `ProfilePage` (`src/app/perfil/page.tsx:486-539`), alimentado por `calculateTargets` (`src/lib/nutrition.ts:91`). Botones «Recalcular» y «Mantener los actuales».
- **Subrutas:** `/plan/compra` (`src/app/plan/compra/page.tsx`) es el precedente: una carpeta con `page.tsx` "use client", cabecera con `ArrowLeft` y `Link` de vuelta, y `AppShell` mantiene activa la pestaña padre (`src/components/AppShell.tsx:54`, `startsWith(tab.href + "/")`).
- **Piezas reutilizables:** `Sheet` (hoja modal con foco atrapado, `src/components/ui/Sheet.tsx`), `Toast` (`src/components/ui/Toast.tsx`), `Card`, `Chip`, `Field`/`inputCls` (`src/components/perfil/ui.tsx`), `parseDecimal` (`src/lib/nutrition.ts:150`, coma y punto), `todayStr()` (`src/lib/types.ts:72`), `WeekBarChart` como referencia de gráfica hecha a mano con tokens.
- **Tests:** Vitest (`tests/unit`, jsdom + Testing Library) y Playwright (`tests/e2e`, con `signIn(page, data)` que siembra `localStorage` y fija la fecha en `2026-09-22`), axe en `accessibility.spec.ts`, CI en `.github/workflows/ci.yml`.

## Approaches considered
### A. SVG propio + lib pura + subruta en Perfil (recommended)
Las series se calculan en `src/lib/measurements.ts` (puro, testeable en unit) y un componente `LineChart` pinta puntos, línea y ejes en SVG con los tokens de color, como `WeekBarChart`. · **Pros:** cero dependencias; son decenas de puntos, sin zoom ni tooltips; control total del contraste y del nombre accesible; encaja con el tema oscuro sin pelearse con estilos de terceros. · **Cons:** hay que escribir ejes y escalas (unas 120 líneas). · **Effort** M

### B. Recharts
Declarativo, ejes y tooltips hechos. · **Pros:** menos código de ejes. · **Cons:** ~100 kB más de bundle para un solo gráfico; su compatibilidad con React 19 ha ido por detrás; tematizar al tema oscuro y pasar axe (SVG sin nombre, textos de ejes) cuesta lo que ahorra. · **Effort** M

### C. Evolución como sección dentro de la página de Perfil
Sin subruta: la gráfica e historial van en una tarjeta más de `/perfil`. · **Pros:** menos navegación. · **Cons:** `perfil/page.tsx` ya tiene 565 líneas; la spec (R7) y el prototipo piden pantalla propia con historial largo. · **Effort** S, pero descartado por la spec.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipos | `src/lib/types.ts` | `Measurement`, `MeasurementSource`, `MetricKey`. |
| Lógica | `src/lib/measurements.ts` (nuevo) | Catálogo `METRICS`, `parseMeasurementDraft`, `sanitizeMeasurements`, `weightTrend`, `latestWeightMeasurement`, `profileWeightPatch`, `skinfoldSum`, `metricSeries`, `filterByRange`, `unusualValues` (R16). |
| Copia de seguridad | `src/lib/userData.ts`, `src/lib/backup.ts` | Séptima clave `measurements` (ver Data model). |
| Store | `src/lib/store.tsx` | `measurements` persistido en `mp_<userId>_measurements` con `upgrade: sanitizeMeasurements`; `saveMeasurement(m)` (alta o edición por id) y `removeMeasurement(id)`. |
| Recalcular | `src/components/perfil/RecalcOffer.tsx` (nuevo), `src/app/perfil/page.tsx` | Extraer el banner y `applyRecalc` sin cambiar el copy ni el comportamiento. |
| Gráfica | `src/components/evolucion/LineChart.tsx` (nuevo) | SVG responsive: series de puntos (Casa relleno / Nutricionista anillo), línea (`trend` o `connect`), rejilla y etiquetas de eje; modo `compact` para la minigráfica. |
| Formulario | `src/components/evolucion/MeasurementForm.tsx` (nuevo) | Segmentado «Solo peso» / «Informe completo», fecha (`type="date"`, `max` hoy), origen, grupos BIA / Perímetros / Pliegues, suma de pliegues, errores por campo, avisos R16, «Eliminar medición». |
| Pantalla | `src/app/perfil/evolucion/page.tsx` (nuevo) | Estado vacío, chips de métrica, resumen, periodo, gráfica, historial, botón «Añadir», `Sheet` con el formulario, `RecalcOffer` / `Toast`. |
| Perfil | `src/app/perfil/page.tsx` | Tarjeta `EvolutionCard` (R12) con `Link` a `/perfil/evolucion`. |

### Data model
```ts
export type MeasurementSource = "home" | "nutritionist";
export type MetricKey =
  | "weightKg" | "muscleKg" | "fatKg" | "fatPct" | "bmi" | "visceralFat"          // BIA
  | "bicepsL" | "bicepsR" | "waist" | "hip" | "legL" | "legR"
  | "calfL" | "calfR" | "chestBack" | "glutes"                                      // perímetros (cm)
  | "skinBiceps" | "skinTriceps" | "skinAbdominal" | "skinSuprailiac"
  | "skinQuadriceps" | "skinCalf";                                                  // pliegues (mm)

export interface Measurement {
  id: string;                 // crypto.randomUUID()
  date: string;               // "YYYY-MM-DD", como MealEntry.date
  source: MeasurementSource;
  values: Partial<Record<MetricKey, number>>;   // solo las métricas introducidas
  savedAt: string;            // ISO; se renueva al editar. Desempata el mismo día (R9)
}
```
- `values` como mapa: añadir una métrica es añadir una entrada al catálogo, sin migrar datos. Se guarda el número parseado; «tal cual» (R4) significa sin recalcular ni redondear, no la cadena.
- La suma de pliegues **no se guarda**: se deriva (`skinfoldSum`) con los seis presentes (R14), así editar un pliegue no la deja desfasada. En el selector de métrica es la clave virtual `"skinSum"`.
- Catálogo `METRICS: { key, label, unit, group, range: [min, max], pair?: "L" | "R" de <base> }[]` con los rangos de la spec (Edge cases). Los bilaterales comparten `pairKey` («bíceps», «pierna», «gemelo») para pintarse como dos líneas (decisión de la spec).
- **Almacenamiento:** clave nueva `mp_<userId>_measurements`, sin migración de nada existente. `sanitizeMeasurements` descarta entradas mal formadas y valores fuera de catálogo (idempotente, como las demás `upgrade`). No se toca `UserProfile.schemaVersion`.
- **Copia de seguridad (añadido en dev-test, 2026-09-26).** Desde el PR #32 (backup-datos, posterior a esta tech design) los datos del usuario se registran en `src/lib/userData.ts`: `USER_DATA_KEYS`, `UserData`, `EMPTY_USER_DATA` y `LOAD_OPTIONS`, que usan tanto `AppProvider` como `parseBackup`/`writeUserData` (`src/lib/backup.ts`). `measurements` es la **séptima clave**, al final de la lista: `LOAD_OPTIONS.measurements = { fallback: [], upgrade: sanitizeMeasurements }` (sin `*_v1_backup`), `SECTION_SHAPE.measurements` = lista de objetos con `id` y `date` de texto y `values` objeto, e `importData` relee también las mediciones. Una copia sin `measurements` (anterior a esta feature) es válida y deja el historial vacío. `BACKUP_SCHEMA_VERSION` no cambia: una sección nueva y opcional no rompe las copias existentes. El store usa `usePersisted(k("measurements"), LOAD_OPTIONS.measurements)`.

### APIs / interfaces
Todas puras en `src/lib/measurements.ts`, con `today` inyectable para los tests:
- `parseMeasurementDraft(draft: MeasurementDraft, today: string): { value?: Omit<Measurement, "id" | "savedAt">; errors: FieldErrors<MetricKey | "date" | "form"> }`: `parseDecimal` por campo, rango del catálogo, fecha ≤ hoy, al menos un valor (R1, R4).
- `weightTrend(ms: Measurement[]): { date: string; value: number }[]`: media de los pesos con fecha en `[d−6, d]` para cada fecha con peso (R8). Aritmética de fechas en días UTC a partir de la cadena, sin `Date` local, para no depender de la zona horaria.
- `latestWeightMeasurement(ms): Measurement | undefined`: mayor `date` con `values.weightKg`, empate por `savedAt` (R9, spec Edge cases).
- `profileWeightPatch(profile: UserProfile, weightKg: number): Partial<UserProfile>`: con `body`, `{ body: { ...body, weightKg } }` más `weightKg` si es «De tu nutricionista» (igual que `BodySection`); sin `body`, `{ weightKg }`.
- `weightChangeOnSave(before: Measurement[], saved: Measurement, profile): number | null`: el peso nuevo del perfil si `saved` pasa a ser la última con peso y su peso difiere del actual; si no, `null` (R9, R10). Borrar no la llama (decisión de la spec).
- `metricSeries(ms, key)`, `skinfoldSum(values)`, `filterByRange(points, "1M" | "3M" | "6M" | "all", today)`, `unusualValues(values, previous)` (R16).
- Store: `saveMeasurement(m: Measurement)` y `removeMeasurement(id: string)`. La página orquesta: calcula `weightChangeOnSave` con la lista previa, guarda, y si hay cambio aplica `profileWeightPatch` y decide oferta o aviso.

### UI
| Artboard | Implementación |
|---|---|
| 1 · Perfil | `EvolutionCard` entre «Objetivos diarios» y «Datos corporales»: último peso, tendencia a 30 días (`weightTrend` hoy frente a hace 30 días), `LineChart compact`, `Link` «Ver evolución». Sin mediciones: texto y «Añadir primera medición» (R12). |
| 2 · Vacía | `evolucion/page.tsx` sin mediciones: icono, copy del prototipo, dos botones que abren el `Sheet` en cada modo (R11). |
| 3 · Peso | Chips de métrica (`Chip`/botones con `aria-pressed`), resumen, periodo (grupo de 4 botones), `LineChart` con serie de puntos más `trend`, leyenda, historial (`<ul>` de botones que abren edición; `Chip` «Nutricionista»). Botón flotante «Añadir». |
| 4 · Apuntar peso | `Sheet` «Añadir medición», `MeasurementForm` en «Solo peso»: fecha, peso y «Última: 75,0 kg el 22 sep». |
| 5 · Informe | Mismo `MeasurementForm` en «Informe completo», 22 campos en 3 `fieldset` con `legend`; bilaterales en rejilla de 2. En edición: título «Editar medición» y «Eliminar medición» (`confirm()`, como «Borrar perfil»). |
| 6 · Recalcular | `RecalcOffer` sobre la gráfica tras guardar (R10). |
| 7 · Nutricionista | `Toast` sin acción: «Peso guardado: 74,8 kg. Tus objetivos son los de tu nutricionista y no cambian.» |
| 8 · Cintura | Misma pantalla con `metricSeries("waist")`, línea `connect`, historial con diferencia respecto a la anterior (R13). Bilaterales: dos series, izq. y der. |

`LineChart`: `<svg role="img" aria-label="…">` con un resumen textual («Peso del 5 may al 24 sep: de 85,0 a 74,8 kg»); el historial es la alternativa accesible completa. Colores: la serie principal y la tendencia en `--color-accent`, los puntos de Casa en `--color-text-muted`; para izq./der., `--color-accent` y `--color-protein` (se distinguen también por trazo discontinuo, no solo por el tono).

### UI test contract
Lo que fijan los tests (`tests/e2e/evolucion.spec.ts`, `accessibility.spec.ts`); cambiarlo es cambiar los tests.
- **Ruta** `/perfil/evolucion`, `h1` «Evolución», enlace «Volver a Perfil». En Perfil, región «Evolución» (h2) con enlace «Ver evolución».
- **Vacío:** texto «Aún no hay mediciones», botones «Apuntar peso» y «Añadir informe completo» (abren la hoja en cada modo). Sin lista «Historial» ni gráfica.
- **Botón flotante** con nombre accesible «Añadir medición» (texto visible «Añadir»).
- **Hoja** `role="dialog"` (`Sheet`) llamada «Añadir medición» o «Editar medición», con «Cerrar» y «Guardar». Al añadir, radios «Solo peso» / «Informe completo» (por defecto «Solo peso»). Al editar no hay radios: siempre el formulario completo, con «Eliminar medición» (confirmación con `window.confirm`).
- **Campos:** «Fecha» (`type="date"`, hoy por defecto); en «Solo peso», el texto «Última: 75 kg el 22 sep». Informe completo: radios «Casa» / «Nutricionista» (por defecto «Nutricionista»), tres `fieldset` con `legend` «Bioimpedancia», «Perímetros» y «Pliegues cutáneos», y un campo por métrica con nombre accesible exacto `METRICS[].fieldLabel` (`tests/fixtures/measurements.ts` › `FIELD_LABELS`: «Peso (kg)», «Bíceps izq. (cm)», «Pliegue gemelo (mm)»…). «Suma de pliegues»: elemento etiquetado (`<output aria-label>`) con «56 mm», o «—» si faltan pliegues.
- **Errores:** `role="alert"` junto al campo y `aria-invalid="true"`: «La fecha no puede ser futura», «Elige una fecha», «Añade al menos un valor» y, por métrica, `rangeError` («Entre 30 y 250 kg», «Entre 1 y 80 mm»…). Avisos R16: «Muy distinto de la izquierda (49,6). ¿Es correcto? Se guarda igual.», sin bloquear.
- **Al reabrir**, cada campo muestra el número con coma y sin ceros de más (`draftFrom`): «76,0» se guardó como 76 y se ve «76».
- **Resumen:** último valor y «Tendencia 75 kg». **Gráfica:** `role="img"` con nombre «<Métrica> del <d mmm> al <d mmm>…», del primer al último punto del periodo («Peso del 23 ago al 22 sep: …»). Sin puntos en el periodo: «No hay mediciones en este periodo».
- **Selectores:** radiogroup «Métrica» solo con las métricas que tienen datos (las bilaterales como una opción: «Bíceps», «Pierna», «Gemelo»; más «Suma de pliegues»), por defecto «Peso» si hay pesos; radiogroup de periodo «1M», «3M», «6M», «Todo» (por defecto «Todo»; 30, 90 y 180 días, hoy incluido).
- **Historial:** `<ul aria-label="Historial">` con las mediciones que tienen la métrica elegida, de la más reciente a la más antigua. Cada `<li>` contiene un botón que abre la edición, la fecha «22 sep 2026», el valor («75 kg», «84,5 cm») y, si no es la primera, la diferencia con la anterior («−8,5 cm», signo menos U+2212); las de origen Nutricionista llevan la etiqueta «Nutricionista».
- **Tras guardar:** oferta `role="status"` con «¿Recalculamos?», «Recalcular» y «Mantener los actuales» (`RecalcOffer`); con objetivos de la nutricionista, `Toast` con «Tus objetivos son los de tu nutricionista y no cambian.».
- **Tarjeta de Perfil (R12):** último peso («75 kg»), «−1,1 kg en 30 días» y una minigráfica `role="img"`; sin mediciones, «Aún no hay mediciones».

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `parseMeasurementDraft`: fecha por defecto `todayStr()`, `max` y error si es futura, `source` por defecto `home`, error `form` si no hay valores. |
| R2 | `MeasurementForm` en modo «Solo peso». |
| R3 | Catálogo `METRICS` (22 claves) y modo «Informe completo». |
| R4 | `parseDecimal` y rangos del catálogo; se guarda el número sin transformar. |
| R5 | Tocar una fila → `Sheet` en edición → `saveMeasurement` (mismo id) o `removeMeasurement` tras `confirm()`. |
| R6 | `usePersisted(k("measurements"))`, claves por usuario. |
| R7 | `/perfil/evolucion` y `EvolutionCard`; `AppShell` no cambia (5 pestañas). |
| R8 | `weightTrend` + `LineChart` (puntos por origen y línea de tendencia). |
| R9 | `latestWeightMeasurement`, `weightChangeOnSave`, `profileWeightPatch`. |
| R10 | `RecalcOffer` con `calculateTargets({ ...body, weightKg, goal })` si `targetSource === "calculated"` y hay `body`; `Toast` si es «De tu nutricionista». |
| R11 | Rama sin mediciones de la página; no se lee el peso del perfil como punto. |
| R12 | `EvolutionCard` (Should). |
| R13 | Chips con las métricas que tienen datos; `metricSeries` + línea `connect`; diferencias en el historial (Should). |
| R14 | `skinfoldSum` en el formulario y como clave virtual (Should). |
| R15 | `filterByRange` y grupo de periodo (Should). |
| R16 | `unusualValues`: aviso bajo el campo, sin bloquear (Could). |
| R17 | `BodySection.onSave`: si el peso cambia, `saveMeasurement({ date: todayStr(), source: "home", values: { weightKg } })`; la oferta de recalcular de Perfil sigue como hoy. |

## Risks & mitigations
- **Desincronizar los dos pesos del perfil.** Toda escritura pasa por `profileWeightPatch`, con tests unitarios de las tres formas del perfil (calculado con `body`, nutricionista con y sin `body`).
- **«Datos corporales» sigue editando el peso a mano,** así que puede divergir del historial (ver Spec feedback). Mitigación mínima: el próximo peso del historial manda.
- **Fechas y zona horaria:** `todayStr()` ya da la fecha local; la ventana de 7 días se calcula con días enteros desde la cadena `YYYY-MM-DD`, no con `Date` locales, para evitar saltos por el cambio de hora (27/10).
- **Formulario de 22 campos dentro del `Sheet`:** el `Sheet` ya hace scroll (`max-h-[85vh]`), pero su cabecera solo tiene título y ✕. «Guardar» va en una barra `sticky bottom-0` dentro de la hoja, siempre visible al desplazarse (el prototipo lo ponía arriba; el efecto es el mismo sin tocar `Sheet`). Los campos usan `inputMode="decimal"`.
- **La oferta de recalcular vive en dos páginas:** al extraerla a `RecalcOffer`, el e2e existente de Perfil (`tests/e2e/perfil.spec.ts`) cubre que no cambie.
- **Tamaño de `localStorage`:** una medición completa ocupa unos 600 B; años de pesadas diarias caben de sobra.

## Testing strategy
- **Unit** (`tests/unit/measurements.test.ts`): `parseMeasurementDraft` (coma/punto, rangos por grupo, fecha futura, vacío), `weightTrend` con los datos del criterio de R8 (74,9 el 24/09 y 74,95 el 22/09; el 15/09 fuera), un solo punto, varios el mismo día; `latestWeightMeasurement` con empate por `savedAt`; `weightChangeOnSave` (nueva más reciente, antigua, mismo peso, edición que quita el peso); `profileWeightPatch` en las tres formas del perfil; `skinfoldSum` (seis presentes y cinco); `filterByRange`; `sanitizeMeasurements` idempotente. Los valores del 31/07 de `evolucion-agosto-2026.md` como fixture en `tests/fixtures/measurements.ts`.
- **Unit store** (`tests/unit/store.test.tsx`): `saveMeasurement` inserta y sustituye por id, `removeMeasurement`, clave `mp_<userId>_measurements`.
- **E2E** (`tests/e2e/evolucion.spec.ts`): un test por escenario de la spec. Pesada en casa con «Calculado» → oferta → «Recalcular» cambia objetivos; lo mismo con «De tu nutricionista» → aviso y objetivos intactos. Informe completo del 31/07 → reabrir y comprobar los 22 valores. Editar y borrar con confirmación. Estado vacío. Medición antigua no toca el perfil. Recarga conserva los datos. Periodo y cintura (Should).
- **Accesibilidad:** añadir Evolución (con datos y vacía) y el `Sheet` con el formulario completo y un error a `accessibility.spec.ts`.
- **Regresión:** `perfil.spec.ts` sigue verde tras extraer `RecalcOffer`.

## Tasks
1. [x] Tipos `Measurement`/`MetricKey` y `src/lib/measurements.ts` con catálogo, `parseMeasurementDraft` y `sanitizeMeasurements` (R1, R3, R4)
2. [x] Lógica de series: `weightTrend`, `latestWeightMeasurement`, `weightChangeOnSave`, `profileWeightPatch`, `skinfoldSum`, `metricSeries`, `filterByRange` (R8, R9, R13–R15)
3. [ ] Store: `measurements` persistido con `saveMeasurement` / `removeMeasurement` (R5, R6)
4. [ ] Extraer `RecalcOffer` de `perfil/page.tsx` sin cambios de comportamiento
5. [ ] `LineChart` SVG (puntos por origen, `trend`/`connect`, modo compacto)
6. [ ] `/perfil/evolucion`: estado vacío, resumen, gráfica del peso, historial y `Sheet` con «Solo peso» (R2, R7, R8, R11)
7. [ ] `MeasurementForm` en «Informe completo», edición y borrado (R3, R5)
8. [ ] Sincronizar el peso del perfil al guardar: `RecalcOffer` o `Toast` (R9, R10)
9. [ ] Selector de métrica (bilaterales como dos líneas), periodo y suma de pliegues (R13, R14, R15)
10. [ ] `EvolutionCard` en Perfil (R12)
11. [ ] Avisos de valores raros (R16, Could; se puede dejar para un follow-up)
12. [ ] `BodySection` (y su variante solo peso): un peso distinto del actual añade una medición de hoy, origen Casa, con `saveMeasurement` (R17). Va después de la tarea 3; el orden con el resto da igual.

Los tests (unit, e2e y axe) se escriben antes con dev-test; cada tarea los va poniendo en verde.

## Spec feedback
- **«Datos corporales» y el historial.** Hoy «Editar» en Datos corporales cambia el peso sin fecha; tras esta feature, eso contradice R9 («el peso del perfil es el de la medición más reciente»). Propuesta: **guardar un peso distinto en Datos corporales crea también una medición de hoy con origen Casa**. **Aceptado (Manuel, 2026-09-26) → spec R17**, tarea 12.
- **Copy del botón secundario de la oferta:** la spec y el prototipo decían «Ahora no», pero la oferta existente dice «Mantener los actuales». **Aceptado (Manuel, 2026-09-26): se mantiene «Mantener los actuales»**; spec R10 corregida.
- **R16 (Could)** es lo único que no aporta a los criterios del issue. Propongo implementarlo al final si la PR va holgada y, si no, sacarlo a un follow-up.
- **Tendencia en R12 («−0,9 kg en 30 días»):** la calculo como tendencia de hoy menos tendencia en la pesada más cercana a hace 30 días. Si no hay pesadas de hace 25–35 días, no se muestra la cifra.

## Test coverage
Escritos antes del código el 2026-09-26 (dev-test). 🔴 = falla porque la funcionalidad no existe; 🟢 = ya pasa (guardia de regresión). `measurements.test.ts` falla entero al importar `@/lib/measurements`, que aún no existe.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/unit/measurements.test.ts` › "R1: fecha, origen y al menos un valor" (6) | unit | 🔴 failing (not built) |
| R1 | `tests/e2e/evolucion.spec.ts` › "R1: una fecha futura no se guarda", "R1: sin ningún valor no se guarda", "«Añadir medición» abre «Solo peso» con la fecha de hoy" | e2e | 🔴 failing (not built) |
| R1, R5 | `tests/unit/store.test.tsx` › "historial-medidas R1 · R5: saveMeasurement y removeMeasurement" (4) | unit | 🔴 failing (not built) |
| R2 | `evolucion.spec.ts` › "guardar 61,5 kg: aparece en el historial y en la gráfica, y se guarda como Casa" | e2e | 🔴 failing (not built) |
| R3 | `measurements.test.ts` › "R3: catálogo de métricas…" (3), "R3 · R4: los valores se guardan tal cual…" (7) | unit | 🔴 failing (not built) |
| R3 | `evolucion.spec.ts` › "«Informe completo» tiene los 22 campos agrupados…", "copiar la toma del 31/07 y reabrirla…", "solo cintura y cadera…" | e2e | 🔴 failing (not built) |
| R4 | `measurements.test.ts` › "R4 · Edge cases: rangos válidos y su mensaje" (9) | unit | 🔴 failing (not built) |
| R4 | `evolucion.spec.ts` › "R4: algo que no es un número…", "R4: coma o punto decimal", "R4: un IMC incoherente se guarda tal cual", "R4: un pliegue fuera de rango…" | e2e | 🔴 failing (not built) |
| R5 | `measurements.test.ts` › "R5: editar parte de la medición guardada" (2) | unit | 🔴 failing (not built) |
| R5 | `evolucion.spec.ts` › "R5: editar y borrar (escenario 3)" (4) | e2e | 🔴 failing (not built) |
| R6 | `store.test.tsx` › "historial-medidas R6: las mediciones persisten por usuario" (4); `measurements.test.ts` › "sanitizeMeasurements…" (5) | unit | 🔴 failing (not built) |
| R6 | `evolucion.spec.ts` › "R6: tras recargar la página, siguen ahí" | e2e | 🔴 failing (not built) |
| R6 (copia) | `backup.test.ts` › claves, `EMPTY_USER_DATA`, `LOAD_OPTIONS` (3), R2, R10, copia sin measurements, forma de measurements, última escritura (9 en total); `store.test.tsx` › importData (2) | unit | 🔴 failing (not built) |
| R6 (copia) | `backup-datos.spec.ts` › "R2: contiene los siete datos…", "de la cuenta A a una cuenta B…" | e2e | 🔴 failing (not built) |
| R7 | `evolucion.spec.ts` › "R7: Perfil tiene una tarjeta «Evolución»…", "R7: «Volver a Perfil»…", "R7: el historial va de la más reciente…" | e2e | 🔴 failing (not built) |
| R8 | `measurements.test.ts` › "R8: tendencia del peso…" (7) | unit | 🔴 failing (not built) |
| R8 | `evolucion.spec.ts` › "R8: el resumen muestra el último peso y la tendencia de 7 días" | e2e | 🔴 failing (not built) |
| R9, R10 | `measurements.test.ts` › "R9: el peso del perfil es el de la medición con peso más reciente" (4), "R9 · R10: cuándo cambia el peso del perfil al guardar" (9), "R9: profileWeightPatch…" (3) | unit | 🔴 failing (not built) |
| R9, R10 | `evolucion.spec.ts` › "R9 · R10: el peso nuevo actualiza el perfil" (6), "R9: una toma más antigua…" | e2e | 🔴 failing (not built) |
| R11 | `evolucion.spec.ts` › "R11: sin mediciones, estado vacío…", "R11: «Apuntar peso» abre…" | e2e | 🔴 failing (not built) |
| R12 | `measurements.test.ts` › "R12: cambio de la tendencia en 30 días" (2); `evolucion.spec.ts` › "R12 (Should)…" (2) | unit + e2e | 🔴 failing (not built) |
| R13 | `measurements.test.ts` › "R13: serie de una métrica" (3); `evolucion.spec.ts` › "R13 · R14 (Should)…" (3) | unit + e2e | 🔴 failing (not built) |
| R14 | `measurements.test.ts` › "R14: suma de pliegues" (3); `evolucion.spec.ts` › "R14: «Suma de pliegues» como métrica…", "R14: en el formulario…" | unit + e2e | 🔴 failing (not built) |
| R15 | `measurements.test.ts` › "R15: periodo de la gráfica" (3); `evolucion.spec.ts` › "R15 (Should)…" (2) | unit + e2e | 🔴 failing (not built) |
| R16 | `measurements.test.ts` › "R16 (Could)…" (3); `evolucion.spec.ts` › "R16 (Could)…" (1) | unit + e2e | 🔴 failing (not built) |
| R17 | `evolucion.spec.ts` › "un peso distinto crea una medición de hoy…", "con objetivos de la nutricionista (solo peso) también" | e2e | 🔴 failing (not built) |
| R17 | `evolucion.spec.ts` › "guardar sin cambiar el peso no crea ninguna medición" | e2e | 🟢 passing (guard) |
| Edge | `evolucion.spec.ts` › "Edge case: borrar la última pesada no cambia el peso del perfil" | e2e | 🔴 failing (not built) |
| — | `measurements.test.ts` › "Formato (contrato de UI)" (2) | unit | 🔴 failing (not built) |
| A11y | `accessibility.spec.ts` › "Evolución", "Evolución vacía", "Evolución: informe completo con un error" | e2e (axe) | 🔴 failing (not built) |

Regresión: el resto sigue en verde. Unit: 444 tests que ya pasaban; e2e de `perfil.spec.ts`, `backup-datos.spec.ts` (salvo los 2 de arriba) y `accessibility.spec.ts` (salvo los 3 nuevos).
