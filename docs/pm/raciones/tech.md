# Raciones al registrar recetas: Technical design
_Status: Approved · Updated: 2026-09-23_
_Related: [spec](spec.md) · [brief](brief.md) · [issue #7](https://github.com/mancabcar/MealPlan/issues/7) · sin prototipo_

## Summary
`MealEntry` gana un campo opcional `servings?: number` que **solo se escribe cuando es distinto de 1**; los macros de la entrada se guardan **ya escalados y sin redondear**, así que todos los totales (anillo, barras, gráfica semanal) funcionan sin tocarlos y las entradas antiguas son 1 ración por construcción (sin migración). `recipeEntry()` (`src/lib/diary.ts`) acepta las raciones; nuevos helpers puros `parseServings()` y `formatServings()` validan y formatean con coma. En el Diario (`src/app/page.tsx`), el formulario "Receta" añade el campo "Raciones" con − / + y mensaje de error, y la lista muestra "× 0,5" junto al nombre. Esfuerzo: **S** (medio día a un día, con tests).

## Context
- Stack: Next 16.2.9 App Router, React 19.2.4, Tailwind v4 con tokens. El Diario es una página cliente y los datos viven en localStorage vía `AppProvider` (`src/lib/store.tsx`): nada de esta feature depende de APIs de Next (ni rutas, ni server code, ni search params).
- **`MealEntry`** (`src/lib/types.ts`): `{ id, date, mealType, recipeId?, customName?, calories, protein, carbs, fat }`. Los macros viven en la entrada; nadie los recalcula desde la receta.
- **`recipeEntry(recipe, date, mealType, id = crypto.randomUUID())`** (`src/lib/diary.ts`) copia los cuatro macros. Lo llaman tres sitios de `src/app/page.tsx`: `submitAdd` (línea 119), "Registrar todo el día" (157) y "Hecho" (184). `tests/unit/diary.test.ts` lo llama con `id` posicional (4 llamadas) y compara con `toEqual` exacto.
- **Totales** (`page.tsx` 95–113): `dayEntries.reduce` suma los macros sin redondear; el anillo, "N / objetivo" y `MacroBar` redondean con `Math.round` al mostrar; `WeekBarChart` solo usa el valor para alturas. **La fila de la entrada** (línea 203) muestra `{e.calories} kcal` sin redondear: hoy da igual porque las recetas tienen macros enteros, con 0,25 raciones no.
- **Formulario de añadir** (`page.tsx` 215–297): estado local (`mode`, `recipeId`, `customName`, `customMacros`); `submitAdd` hace `return` silencioso si falta la receta. No hay validación con mensaje en este formulario; el patrón de la app para errores de campo es `Field` en `src/components/perfil/ui.tsx` (borde `--color-expired`, `aria-invalid`, texto de error debajo).
- **`parseDecimal`** (`src/lib/nutrition.ts:150`): acepta "0,5" y "0.5", devuelve `NaN` para vacío, negativos, "abc" o ".5".
- **Persistencia**: `usePersisted` guarda `entries` tal cual; `upgrade: migrateEntries` (`src/lib/migrate.ts`) solo renombra "Snack" y conserva el resto de campos con spread, así que un `servings` guardado sobrevive a la carga.
- **Otros consumidores de `entries`**: solo `page.tsx` y `pendingSlots` (que mira `date` y `mealType`). Plan y lista de la compra no leen entradas.
- **Tests**: Vitest (`tests/unit`, entorno node) y Playwright (`tests/e2e`, `signIn` fija el reloj en `TODAY = 2026-09-22` y siembra `mp_<user>_<key>`; `readStored` lee lo guardado). Fixtures del Diario en `tests/fixtures/diario.ts`. `tests/e2e/accessibility.spec.ts` pasa axe sobre `/`.

## Approaches considered

### A. Macros escalados en la entrada + `servings` opcional solo si ≠ 1 (recomendado)
`recipeEntry` multiplica los cuatro macros por las raciones y añade `servings` solo cuando no es 1. La lista muestra la etiqueta si `servings` es un número distinto de 1.
- **Pros:** los totales, la gráfica, `pendingSlots` y la persistencia no cambian. R5 sale gratis: "sin campo = 1 ración", sin migración ni reescritura de datos. R7 también: "Hecho" y "Registrar todo el día" siguen llamando a `recipeEntry` sin raciones y producen exactamente la misma entrada que hoy (el test unitario con `toEqual` sigue verde). Encaja con la regla del spec "la entrada no se recalcula a partir de la receta".
- **Cons:** una entrada de 1 ración no lleva el `1` explícito (ver Spec feedback 1). El multiplicador es solo informativo: si alguien edita a mano el localStorage, macros y etiqueta podrían no cuadrar (irrelevante con un único usuario).
- **Effort:** S.

### B. Guardar `servings` siempre en las entradas de receta
Igual que A, pero `servings: 1` también se escribe.
- **Pros:** R3 literal ("la entrada guarda el multiplicador") también con 1.
- **Cons:** conviven entradas con `servings: 1` y sin campo, así que el código de lectura tiene que tratar "ausente = 1" igualmente; rompe el `toEqual` del test R2 de `diary.test.ts` sin beneficio real. Descartado.

### C. Guardar los macros por ración y multiplicar al leer
La entrada guarda los macros de la receta y `servings`; los totales multiplican.
- **Cons:** hay que tocar cada suma (`totals`, `week`, fila de la entrada) y cualquier consumidor futuro; más riesgo de olvidar un sitio. Sin ventaja: no se editan entradas. Descartado.

**Recomendación: A.**

## Design

### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipos | `src/lib/types.ts` | `MealEntry.servings?: number` con comentario (solo en entradas de receta con raciones ≠ 1; macros ya escalados). |
| Lógica pura | `src/lib/diary.ts` | `recipeEntry` con opciones `{ servings, id }` y escalado; `SERVINGS` (min/max/paso), `SERVINGS_ERROR`, `parseServings()`, `stepServings()`, `formatServings()`, `servingsLabel()`. |
| Diario | `src/app/page.tsx` | Estado `servingsText` + `servingsError`; campo "Raciones" con − / + en modo "Receta"; `submitAdd` valida y pasa `servings`; reset a "1" al abrir el formulario y tras añadir; etiqueta "× n" y `Math.round` en la fila de la entrada; vista previa de kcal (R9). |
| Unit | `tests/unit/diary.test.ts` | Adaptar las 4 llamadas con `id` a `{ id }`; tests de escalado, `parseServings`, `stepServings`, `formatServings`, `servingsLabel`. |
| E2E | `tests/e2e/raciones.spec.ts` **(nuevo)**, `tests/e2e/accessibility.spec.ts` | Un test por criterio de aceptación; caso axe con el formulario abierto y un error visible. |

Sin cambios: `store.tsx`, `migrate.ts`, Plan, lista de la compra, `pendingSlots`.

### Data model
```ts
export interface MealEntry {
  // ...campos actuales
  /** Raciones registradas (0,25–4). Solo existe si ≠ 1; ausente = 1 ración. Los macros ya vienen multiplicados. */
  servings?: number;
}
```
- Los macros se guardan **sin redondear** (`recipe.calories * servings`). Con raciones múltiplo de 0,25 y macros enteros el resultado es exacto en coma flotante (x · k/4 tiene como mucho dos decimales binarios exactos), así que la suma del día no acumula error y el redondeo se hace solo al mostrar (AC R1/R2 "el redondeo no acumula error").
- **Sin migración.** Las entradas existentes no tienen `servings` → 1 ración, mismos macros, sin etiqueta (R5). `migrateEntries` ya conserva campos desconocidos.

### APIs / interfaces
```ts
// src/lib/diary.ts
export const SERVINGS = { min: 0.25, max: 4, step: 0.25 } as const;
export const SERVINGS_ERROR = "Entre 0,25 y 4, en pasos de 0,25";

/** Entrada de receta. Con servings ≠ 1 multiplica los cuatro macros y guarda `servings`. */
export function recipeEntry(
  recipe: Recipe,
  date: string,
  mealType: MealType,
  { servings = 1, id = crypto.randomUUID() }: { servings?: number; id?: string } = {},
): MealEntry;

/** "0,5" / "0.5" → 0.5. null si no es número, está fuera de [0,25, 4] o no va en pasos de 0,25. Usa parseDecimal. */
export function parseServings(text: string): number | null;

/** − / + (R8): parte del valor válido actual (o de 1 si el texto no es válido), suma ±0,25 y acota a [0,25, 4]. */
export function stepServings(text: string, delta: 1 | -1): number;

/** 0.5 → "0,5", 1.25 → "1,25", 2 → "2". Coma decimal fija, sin depender de Intl. */
export function formatServings(n: number): string;

/** "× 0,5" para la lista, o null si no hay que mostrar nada (ausente, 1, o valor no numérico en datos viejos/raros). */
export function servingsLabel(entry: Pick<MealEntry, "servings">): string | null;
```
Reglas de `parseServings`: `v = parseDecimal(text)`; válido si `Number.isFinite(v) && v >= 0.25 && v <= 4 && Number.isInteger(v * 4)`. `v * 4` es exacto para cualquier decimal que el usuario escriba con dos cifras múltiplo de 0,25; "0,1" da 0,4 → no entero → error.

`recipeEntry` con `servings === 1` devuelve exactamente el objeto de hoy (sin campo `servings`), así que las llamadas de "Hecho" y "Registrar todo el día" no cambian de comportamiento (R7) y basta con que sigan sin pasar opciones.

### UI
Sin prototipo (brief: "un campo más en el formulario de añadir… y una etiqueta en la lista").

- **Campo "Raciones"** (solo en modo "Receta", debajo del desplegable de recetas): una fila con botón "−", `<input inputMode="decimal">` con `<label>` visible "Raciones" y botón "+". Botones con nombre accesible "Quitar 0,25 raciones" / "Añadir 0,25 raciones" (icono Lucide `Minus` / `Plus`, `aria-hidden`), deshabilitados con 0,25 y con 4 respectivamente (R8). Estilo: botones cuadrados con borde como los toggles Receta/Personalizada; input con `inputCls`. Se muestra aunque no haya receta elegida (el valor se conserva al cambiar de receta, caso límite del spec).
- **Error (R6)**: al pulsar "Añadir" con un valor no válido, `submitAdd` no añade, deja el formulario abierto y muestra `SERVINGS_ERROR` debajo del campo, con el mismo patrón que `Field` de `src/components/perfil/ui.tsx` (borde `--color-expired`, `aria-invalid`, `aria-describedby` al texto de error, que lleva `role="alert"` como el error de rango de proteínas). El error se borra al editar el campo o pulsar − / +. Validar al enviar (no mientras se teclea) evita marcar en rojo el estado intermedio "0," al escribir "0,5".
- **Vista previa (R9, Could)**: junto a la fila, `"= {Math.round(recipe.calories * servings)} kcal"` en `--color-text-muted`, solo con receta elegida y valor válido.
- **Reset (flujo paso 5)**: `servingsText = "1"` y sin error al pulsar "Añadir comida" (abrir) y tras añadir. Cancelar no necesita reset porque abrir ya lo hace. Cambiar a "Personalizada" oculta el campo; `submitAdd` en ese modo ignora `servingsText`.
- **Lista del Diario (R4)**: `<span>{nombre}{label && <span className="text-[var(--color-text-muted)]"> {label}</span>}</span>`, con `label = servingsLabel(e)`; y `{Math.round(e.calories)} kcal`. El texto queda "Lentejas × 0,5", buscable en e2e con `getByText`. Usar el signo "×" (U+00D7) como en el spec.
- **Totales, anillo, gráfica**: sin cambios (leen macros ya escalados).

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Campo "Raciones" en modo "Receta", valor inicial "1", rango y paso validados por `parseServings`. |
| R2 | `recipeEntry(..., { servings })` multiplica los 4 macros; los totales ya suman macros de entradas. Sin redondear al guardar, redondeo solo al mostrar. |
| R3 | `servings` guardado en la entrada cuando ≠ 1; persiste con el resto del array `entries`. |
| R4 | `servingsLabel` → "× 0,5" junto al nombre; `null` con 1 o ausente. |
| R5 | Ausente = 1: macros sin tocar y sin etiqueta. Sin migración. |
| R6 | `parseServings` (coma y punto vía `parseDecimal`); `null` → no añade + `SERVINGS_ERROR` junto al campo. |
| R7 | "Hecho" y "Registrar todo el día" siguen llamando a `recipeEntry` sin opciones → entrada idéntica a la de hoy. |
| R8 | Botones − / + con `stepServings`, deshabilitados en los extremos. |
| R9 | Vista previa `= N kcal` junto al campo. |
| Caso: receta borrada después | La entrada conserva macros escalados; la etiqueta sale de la entrada, no de la receta. |
| Caso: cambiar de receta | `servingsText` es independiente de `recipeId`. |
| Caso: modo "Personalizada" | Campo oculto; la entrada custom nunca lleva `servings`. |

## Risks & mitigations
- **Cambio de firma de `recipeEntry`** (`id` pasa de posicional a opción): lo detecta TypeScript en las 4 llamadas de `tests/unit/diary.test.ts`; se adaptan en la misma tarea. Las 3 llamadas de `page.tsx` no pasan `id`, no cambian.
- **Redondeo en pantalla**: la fila de la entrada hoy no redondea. Añadir `Math.round` no cambia nada para las entradas existentes (macros enteros) y evita mostrar "37.5 kcal".
- **Validación nueva en un formulario que hoy no valida**: el error solo aparece en modo "Receta" y solo por el campo nuevo; el `return` silencioso por falta de receta se mantiene igual (fuera de alcance).
- **Contraste / accesibilidad** del error y de los botones −/+: solo tokens existentes (`--color-expired`, `--color-border`, `--color-text-muted`), y un caso axe nuevo con el formulario abierto y el error visible.
- **Datos raros en localStorage** (`servings` no numérico o `NaN`): `servingsLabel` devuelve `null` si no es un número finito ≠ 1, así que nunca se pinta "× NaN". Los macros no dependen de `servings`.

## Testing strategy
- **Unit** `tests/unit/diary.test.ts` (añadir `describe` "Raciones"):
  - `recipeEntry` con 0,5 sobre una receta 600/40/60/20 → 300/20/30/10 y `servings: 0.5`; con 1,5 → 900/60/90/30; sin opciones o `servings: 1` → objeto idéntico al actual, sin clave `servings` (R2, R3, R7).
  - Sin acumulación: tres entradas de 0,25 de una receta de 150 kcal suman 112,5 (→ 113 al mostrar, no 114).
  - `parseServings`: "0,75" y "0.75" → 0.75; "0,25" y "4" → válidos; "0", "0,1", "4,25", "5", "abc", "", " " → `null` (R6).
  - `stepServings`: "1", −1 → 0.75; "0,25", −1 → 0.25; "4", +1 → 4; "abc", +1 → 1.25 (R8).
  - `formatServings` / `servingsLabel`: 0.5 → "× 0,5"; 1.5 → "× 1,5"; 1 → `null`; ausente → `null`; `NaN` o string → `null` (R4, R5).
  - Adaptar las llamadas existentes `recipeEntry(X, d, m, "id")` → `recipeEntry(X, d, m, { id: "id" })`.
- **E2E** `tests/e2e/raciones.spec.ts` (fixture nueva en `tests/fixtures/diario.ts`, p. ej. "Guiso" 600/40/60/20, sin plan para que no haya pendientes):
  - R1/R2: abrir formulario → "Raciones" vale "1"; elegir Guiso, "0,5", "Añadir" → anillo "300 kcal", `readStored("entries")[0]` con 300/20/30/10 y `servings: 0.5`; con "1,5" → 900. Sin tocar el campo → 600 y sin `servings`.
  - R3/R4: lista muestra "Guiso × 0,5"; con 1 ración, solo "Guiso"; `page.reload()` → etiqueta y anillo se conservan.
  - R5: sembrar una entrada de receta sin `servings` → sus kcal y ningún "×" en la página.
  - R6: "0.75" y "0,75" → mismo resultado (450); para cada uno de "0", "0,1", "4,25", "5", "abc", "" → no se guarda nada y aparece "Entre 0,25 y 4, en pasos de 0,25"; "0,25" y "4" → se añaden.
  - R7: con un plan sembrado, "Hecho" → entrada de 600 sin `servings` y sin "×". (Ya lo cubre en parte `diario-desde-plan.spec.ts` › R2 con `toMatchObject`; añadir la aserción de "sin `servings`".)
  - R8: − desde 1 → "0,75"; en 0,25 − deshabilitado; en 4 + deshabilitado.
  - R9: con Guiso y "0,5" se ve "300 kcal" en el formulario antes de "Añadir".
  - Casos límite: cambiar de receta mantiene "0,5"; en "Personalizada" no hay campo "Raciones"; tras añadir, al reabrir vale "1".
- **Accesibilidad**: caso "Diario con formulario de raciones y error" en `accessibility.spec.ts`.

Según el pipeline, dev-test puede escribir estos tests antes del código; las tareas de abajo dan por hecho que dev-code los hace pasar (o los escribe si no existen).

## Test coverage
Comandos: `npm test` (unit), `npm run test:e2e` (e2e), `npm run typecheck`. Fixtures: `tests/fixtures/diario.ts` (`GUISO` 600/40/60/20, `CALDO` 150/8/12/6, `RACIONES_RECIPES`; hoy = 2026-09-22). Estado tras dev-test (2026-09-23): 🔴 = falla porque la funcionalidad no existe (unit: `parseServings` & co. no se exportan de `src/lib/diary.ts` → "is not a function", y `recipeEntry` aún recibe `id` posicional; e2e: no hay campo "Raciones" ni botones − / +). `tsc` da 17 errores, todos en `tests/unit/diary.test.ts` (exports y firma de `recipeEntry`), que desaparecen con la tarea 1. 🟢 = guardia de regresión que ya pasa hoy por construcción. Estos tests definen "hecho" para dev-code.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/unit/diary.test.ts` › "Raciones · SERVINGS y SERVINGS_ERROR" › rango 0,25–4 en pasos de 0,25 | unit | 🔴 failing (not built) |
| R1 | `tests/e2e/raciones.spec.ts` › "R1 · R2" › al abrir el formulario, "Raciones" vale 1 | e2e | 🔴 failing (not built) |
| R2 | `diary.test.ts` › "Raciones · recipeEntry con { servings }" › 0,5 → 300/20/30/10; 1,5 → 900/60/90/30; macros sin redondear (37,5); 3 × 0,25 de 150 = 112,5 → 113; todos los múltiplos de 0,25 exactos; solo `{ servings }` genera id | unit | 🔴 failing (not built) |
| R2 | `diary.test.ts` › "sin opciones → los macros exactos de la receta y sin clave servings" | unit | 🟢 passing (regression guard) |
| R2 | `raciones.spec.ts` › "R1 · R2" › 0,5 → anillo 300, "300 / 1750", entrada 300/20/30/10; 1,5 → 900; sin tocar el campo → 600 sin `servings`; 3 × 0,25 de Caldo → filas "38 kcal", anillo 113 | e2e | 🔴 failing (not built) |
| R3 | `diary.test.ts` › 0,5 / 1,5 guardan `servings`; `servings: 1` → entrada idéntica sin clave (Spec feedback 1) | unit | 🔴 failing (not built) |
| R3 | `raciones.spec.ts` › "R3 · R4" › entrada guardada con `servings: 0.5`; tras recargar se conservan etiqueta y anillo | e2e | 🔴 failing (not built) |
| R4 | `diary.test.ts` › "R4 · formatServings" (0,25…4 con coma, "2" sin decimales) y "R4 · R5 · servingsLabel" ("× 0,5", "× 1,5", 1 → null) | unit | 🔴 failing (not built) |
| R4 | `raciones.spec.ts` › "R3 · R4" › "Guiso × 0,5", "Guiso × 1,5"; 1 ración → solo "Guiso", sin "×" | e2e | 🔴 failing (not built) |
| R5 | `diary.test.ts` › "servingsLabel" › sin campo → null; NaN / Infinity / string → null | unit | 🔴 failing (not built) |
| R5 | `raciones.spec.ts` › "R5" › entradas antiguas de Guiso y Lentejas: 600 y 520 kcal, sin "×", anillo 1120, datos sin reescribir | e2e | 🟢 passing (regression guard) |
| R6 | `diary.test.ts` › "R6 · parseServings" › "0,75" = "0.75"; "0,25", "4", "1", "0,5", "1,5", "3,75" válidos; "0", "0,1", "4,25", "5", "abc", "", " ", "-1", "0,3", "1,33", ".5" → null; `SERVINGS_ERROR` literal | unit | 🔴 failing (not built) |
| R6 | `raciones.spec.ts` › "R6" › "0,75" y "0.75" → 450 cada una; "0", "0,1", "4,25", "5", "abc", "" → no se guarda nada, `role="alert"` con el mensaje, `aria-invalid`, descripción accesible; extremos "0,25" y "4" se aceptan; el error sale solo al pulsar "Añadir" y se borra al editar (Spec feedback 2) | e2e | 🔴 failing (not built) |
| R6 | `tests/e2e/accessibility.spec.ts` › "Diario con formulario de raciones y error" (color-contrast del campo, − / + y error) | e2e | 🔴 failing (not built) |
| R7 | `raciones.spec.ts` › "R7" › "Hecho" en Guiso → 600 sin `servings` ni "×"; "Registrar todo el día" → sin `servings` | e2e | 🟢 passing (regression guard) |
| R7 | `diario-desde-plan.spec.ts` › "R2" › "Hecho" → entrada sin `servings` (aserción añadida) | e2e | 🟢 passing (regression guard) |
| R8 | `diary.test.ts` › "R8 · stepServings" › 1 → 0,75 / 1,25; con coma; acotado en 0,25 y 4; texto no válido parte de 1 (Spec feedback 3) | unit | 🔴 failing (not built) |
| R8 | `raciones.spec.ts` › "R8" › − desde 1 → "0,75"; + → "1,25", "1,5"; en 0,25 − deshabilitado; en 4 + deshabilitado; − − y "Añadir" → "Guiso × 0,5" | e2e | 🔴 failing (not built) |
| R9 | `raciones.spec.ts` › "R9" › Guiso + "0,5" → "= 300 kcal", + → "= 450 kcal", nada guardado aún | e2e | 🔴 failing (not built) |
| Flujo paso 5 | `raciones.spec.ts` › "Flujo y casos límite" › tras añadir, y tras cancelar, reabrir → "1" | e2e | 🔴 failing (not built) |
| Caso: cambiar de receta | `raciones.spec.ts` › mantiene "0,5" → "Lentejas × 0,5", anillo 260 | e2e | 🔴 failing (not built) |
| Caso: "Personalizada" | `raciones.spec.ts` › campo visible sin receta en "Receta", oculto en "Personalizada"; la entrada custom no lleva `servings` | e2e | 🔴 failing (not built) |
| Caso: receta borrada | `raciones.spec.ts` › la entrada conserva 300 kcal y muestra "Receta × 0,5" | e2e | 🔴 failing (not built) |

## Tasks
1. [x] **Tipo y lógica pura**: `MealEntry.servings?`; en `src/lib/diary.ts`, `recipeEntry` con `{ servings, id }` y escalado, `SERVINGS`, `SERVINGS_ERROR`, `parseServings`, `stepServings`, `formatServings`, `servingsLabel`; adaptar las llamadas de `tests/unit/diary.test.ts` y añadir los tests unitarios. Sin cambios visibles. (R2, R3, R5–R8 lógica)
2. [x] **Lista del Diario**: etiqueta "× n" junto al nombre y `Math.round` en las kcal de la fila. Sin cambios visibles para datos existentes. (R4, R5)
3. [x] **Campo "Raciones" en el formulario**: estado `servingsText`/`servingsError`, input con label, validación en `submitAdd` con mensaje, reset al abrir y tras añadir, oculto en "Personalizada". Entrega todos los Musts. (R1, R2, R3, R6, R7)
4. [x] **Botones − / +** con `stepServings` y deshabilitado en los extremos. (R8)
5. [ ] **Vista previa de kcal** en el formulario. (R9, Could; se puede quitar sin afectar al resto)
6. [ ] **E2E** `tests/e2e/raciones.spec.ts` + caso de accesibilidad + aserción "sin `servings`" en `diario-desde-plan.spec.ts` › R2. (todos)

Cada tarea deja la app funcionando; 1–2 son invisibles con los datos actuales y 3 entrega los Musts.

## Spec feedback
Nada bloqueante; el spec se puede construir tal cual. Propuestas por defecto que dev-code seguirá salvo que Manuel diga otra cosa:
1. **R3 con 1 ración: no se guarda el campo.** Una entrada de 1 ración no lleva `servings` (ausente = 1, igual que las antiguas). Así "Hecho" y el formulario sin tocar producen exactamente la entrada de hoy (R7) y no hay dos representaciones de "1 ración". El AC de R3 solo comprueba 0,5, así que se cumple. **Confirmar.**
2. **Validar al pulsar "Añadir", no al teclear.** El mensaje aparece al intentar añadir y se borra al editar; evita marcar en rojo "0," mientras se escribe "0,5". R6 no dice cuándo.
3. **− / + con un texto no válido** (p. ej. "abc"): parten de 1 (→ 0,75 / 1,25) y quitan el error. El spec no lo cubre.
4. **".5" (sin cero delante) se rechaza**, porque `parseDecimal` lo rechaza en toda la app (peso, etc.). Mantenerlo coherente; si se quiere aceptar, es un cambio en `parseDecimal` que afecta también a Perfil.
5. **R9 (Could) incluido**: son pocas líneas y ayuda a elegir la ración. Quitar la tarea 5 si no se quiere.
6. **Aclaración, sin decisión:** las kcal de cada fila del Diario pasan a mostrarse redondeadas (`Math.round`), como ya lo están los totales. Con las recetas actuales (macros enteros) no cambia nada visible.
