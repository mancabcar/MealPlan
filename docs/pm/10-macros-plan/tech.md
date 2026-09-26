# Macros por día en el Plan semanal: Technical design
_Status: Draft · Updated: 2026-09-26_
_Related: [spec](spec.md) · [brief](brief.md) · [issue #10](https://github.com/mancabcar/MealPlan/issues/10) · sin prototipo_

## Summary
Un módulo puro nuevo, `src/lib/planMacros.ts`, concentra todo el cálculo: `slotMacros()` (receta × raciones, el único punto que tocará #29), `dayPlanSummary()` (totales del día y "N de M comidas planificadas") y `macroStatus()` (dentro / por debajo / por encima, con rango o con ±10 %). En `src/app/plan/page.tsx` la tarjeta del día sustituye el "N kcal" de la cabecera por un resumen compacto de 2 × 2 (Calorías, Proteínas, Carbohidratos, Grasas) con valor, objetivo, icono y texto de estado, más el aviso de comidas sin asignar. Esfuerzo: **S** (medio día con tests); sin cambios de datos ni de APIs de Next.

## Context
- Stack: Next 16.2.9 App Router, React 19.2.4, Tailwind v4 con tokens (`src/app/globals.css`), `lucide-react`. `/plan` es una página cliente (`"use client"`) que lee todo de `useApp()` (`src/lib/store.tsx`, localStorage). Nada de esta feature usa rutas, server code ni otras APIs de Next, así que el aviso de `AGENTS.md` no afecta al diseño.
- **Plan** (`src/app/plan/page.tsx`): `meals = profile?.meals ?? MEAL_TYPES`; `slots` = franjas del día efectivo filtradas por `meals`; `dayKcal` (línea 45) suma `recipe.calories` de **todas** las franjas filtradas (sin redondear) y se pinta en la cabecera de la tarjeta solo si es > 0. La lista de comidas usa `slots.find()` (la primera franja de cada comida). `assign()` garantiza una franja por comida, así que la diferencia solo aparecería con datos importados o corruptos.
- **`DayPlanSlot`** (`src/lib/types.ts`): `{ mealType, recipeId }`, sin `servings` (issue #29).
- **`Recipe`**: `calories`, `protein`, `carbs`, `fat` como `number` (pueden tener decimales).
- **`UserProfile`**: `calorieGoal`, `proteinGoal`, `proteinRange?: { min, max }`, `carbsGoal`, `fatGoal`, `meals`.
- **`MacroBar`** (`src/app/page.tsx`, líneas 34–77): barra + `Chip` con "N / objetivo" o "N / min–max"; `inBand = range && value >= min && value <= max` sobre el valor **sin redondear**, y entonces pinta `Check` con `role="img" aria-label="Cumplido"`. Kcal no usa `MacroBar` (anillo `ProgressRing`). No hay estado "por debajo / por encima".
- **`recipeEntry()`** (`src/lib/diary.ts`) escala los cuatro macros por `servings` sin redondear; **`pendingSlots()`** recorre `MEAL_TYPES` filtrando por `meals` y toma la primera franja de cada comida. Es el patrón que sigue `dayPlanSummary()`.
- **UI disponible**: `Card`, `Chip` (tonos `protein`, `carbs`, `fat`, `accent`, `expiring`, `expired`, `neutral`, con contraste verificado en `globals.css`), `DaySelector`.
- **Tests**: Vitest (`tests/unit/*.test.ts`, entorno node por defecto) y Playwright (`tests/e2e/*.spec.ts`, `signIn()` siembra localStorage y fija hoy = martes 2026-09-22), axe en `tests/e2e/accessibility.spec.ts`, fixtures en `tests/fixtures/` (`profiles.ts`: `lucia` con 4 comidas y sin rango; `manuel` con 5 comidas y rango 130–170). CI en `.github/workflows/ci.yml`.

## Approaches considered
### A. Módulo puro `planMacros.ts` + resumen compacto 2 × 2 dentro de la tarjeta del día (recomendado)
Todo el cálculo en funciones puras testeables sin React; un componente pequeño pinta cuatro celdas (etiqueta, "N / objetivo", icono + texto de estado) en rejilla de dos columnas entre el nombre del día y la lista de comidas. · **Pros**: añade ~3 líneas de altura en móvil (2 filas de celdas + aviso), no empuja la lista de comidas fuera de pantalla; un único punto de cálculo para #29 y para R8; los tests de aceptación de R3/R4 son unitarios y exactos. · **Cons**: no reutiliza el aspecto de barra de `MacroBar`, así que Plan y Diario se ven distintos. · **Effort** S
### B. Reutilizar `MacroBar` (extraída a `src/components/ui/`) dentro de la tarjeta del día
Mover `MacroBar` a un componente compartido y pintar cuatro barras (una nueva para kcal) con el estado añadido. · **Pros**: mismo lenguaje visual que el Diario. · **Cons**: cuatro barras con su fila de texto ocupan ~4 × 30 px más que A y compiten con la lista de comidas (el riesgo de densidad del spec); la barra expresa "cuánto me falta para llenar", que tiene sentido durante el día comido pero aporta poco al planificar, donde lo que importa es el estado; hay que ampliar `MacroBar` con el estado por debajo / por encima y tocar el Diario, que es non-goal. · **Effort** S/M
### C. Resumen en una tarjeta propia encima de la lista de comidas
Igual que A pero en una `Card` separada. · **Pros**: la tarjeta del día no cambia. · **Cons**: R1 pide el resumen en la tarjeta del día; separarlo desliga los números del nombre del día y añade un borde y márgenes más en móvil. Resuelve la pregunta abierta del spec a favor de **dentro de la tarjeta**. · **Effort** S

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Cálculo | `src/lib/planMacros.ts` (nuevo) | `Macros`, `MacroTarget`, `MacroStatus`, `PLAN_TOLERANCE`, `slotMacros()`, `dayPlanSummary()`, `macroStatus()`. Puro, sin React ni store. |
| UI | `src/components/plan/DayMacroSummary.tsx` (nuevo) | Rejilla 2 × 2 con las cuatro celdas y el aviso R7. Recibe `summary` y `profile` (o `null`). |
| Página | `src/app/plan/page.tsx` | Sustituir `dayKcal` por `dayPlanSummary({ slots: weekPlan[effectiveSelectedDate] ?? [], recipes, meals })`; quitar el "N kcal" de la cabecera; pintar `<DayMacroSummary>` entre la cabecera y la lista si `summary` no es `null`. |
| Diario | `src/app/page.tsx` | (Pendiente de confirmar, ver Spec feedback 1.) `MacroBar`: `inBand` pasa a `range && macroStatus(value, range) === "within"`. Sin cambios visuales. |
| Tests | `tests/unit/planMacros.test.ts`, `tests/e2e/macros-plan.spec.ts`, `tests/fixtures/plan-macros.ts` (nuevos); `tests/e2e/accessibility.spec.ts` | Ver Testing strategy. |

### Data model
Ninguno. No cambian `DayPlanSlot`, `WeekPlan`, `UserProfile` ni el backup; no hay migración. El resumen se deriva en cada render.

### APIs / interfaces
```ts
// src/lib/planMacros.ts
export interface Macros { calories: number; protein: number; carbs: number; fat: number }
export type MacroTarget = number | { min: number; max: number };
export type MacroStatus = "below" | "within" | "above";
export const PLAN_TOLERANCE = 0.1; // ±10 % (R4)

/** R9: macros de una franja = receta × raciones. Único punto de escalado; #29 pasará slot.servings. */
export function slotMacros(recipe: Recipe, servings = 1): Macros;

/**
 * R1/R7: suma, sin redondear, las franjas de `meals` (primera franja de cada comida, como la lista
 * y pendingSlots) cuya receta existe. null si ninguna suma (R1: día sin recetas → sin resumen).
 */
export function dayPlanSummary(args: {
  slots: DayPlanSlot[]; recipes: Recipe[]; meals: MealType[];
}): { totals: Macros; planned: number; total: number } | null;

/** R3/R4: compara Math.round(value). Rango: min ≤ v ≤ max. Número: banda ±10 % en aritmética entera. */
export function macroStatus(value: number, target: MacroTarget): MacroStatus;
```
Reglas de `macroStatus`:
1. `v = Math.round(value)`.
2. Rango: `v < min` → `below`; `v > max` → `above`; si no, `within`.
3. Objetivo numérico `g`: `10·v < 9·g` → `below`; `10·v > 11·g` → `above`; si no, `within`. Se compara así, y no con `g * 0.9`, porque `230 * 0.9` y `230 * 1.1` no son exactos en coma flotante y los criterios de R4 caen justo en los límites (207, 253). Con `g = 0` sale sola la regla del spec: `0` → `within`, cualquier `v > 0` → `above`.

Objetivo por macro desde el perfil: `calories → calorieGoal`, `protein → proteinRange ?? proteinGoal`, `carbs → carbsGoal`, `fat → fatGoal`. Vive en `DayMacroSummary` (o en un helper `planTargets(profile)` si R8 lo necesita después).

`dayPlanSummary` itera `meals` en el orden de `MEAL_TYPES`; `total = meals.length`; `planned` = comidas con receta existente. Una franja cuya receta se borró no suma ni cuenta como planificada, igual que la lista, que la muestra como "Añadir".

### UI
Sin prototipo; se decide aquí (pregunta abierta del spec): **dentro de la tarjeta del día, compacto**.

- Cabecera de la tarjeta: solo el nombre del día (desaparece el "N kcal", que pasa a la celda Calorías).
- Debajo, `<ul aria-label="Macros del día" class="grid grid-cols-2 gap-2">` con cuatro `<li>` en orden Calorías, Proteínas, Carbohidratos, Grasas (mismas etiquetas que el Diario). Cada celda (fondo `--color-surface-2`, `rounded-xl`, `px-2.5 py-2`):
  - Línea 1: etiqueta en `text-xs` con un punto del tono del macro (`protein`/`carbs`/`fat`; kcal en `accent`), y a la derecha icono + texto de estado.
  - Línea 2: `N / objetivo` o `N / min–max` en `font-semibold text-sm`, N con `Math.round`. Sin perfil: solo `N` (kcal con " kcal", resto con " g").
- Estados (R5): `within` → `Check`, texto "Dentro", color `--color-accent`; `below` → `ArrowDown`, "Por debajo", `--color-text-muted`; `above` → `ArrowUp`, "Por encima", `--color-expiring`. El icono es `aria-hidden`; la parte visual de la celda va `aria-hidden` y cada `<li>` lleva un `<span className="sr-only">` con la frase completa: "Grasas 80 de 69, por encima" / "Proteínas 142 de 130 a 160, dentro". Así el lector no lee "barra" ni duplica el estado.
- Por debajo en gris y no en ámbar: en un día a medias todo está por debajo y no debe parecer un error (escenario 3); por encima sí se resalta.
- Aviso R7, solo si `planned < total`: `<p class="text-xs text-[var(--color-text-muted)]">2 de 4 comidas planificadas</p>` bajo la rejilla.
- Móvil (375 px): cada celda mide ~160 px; "Carbohidratos" + icono + "Por debajo" cabe en una línea a `text-xs`; si no cupiese, el estado baja con `flex-wrap`. Altura total añadida ≈ 2 filas de 52 px + aviso.
- R6 sale gratis: el resumen se deriva de `weekPlan`, `recipes`, `profile` y `effectiveSelectedDate` en cada render.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `dayPlanSummary` suma las franjas de `profile.meals` con receta existente; `null` → no se pinta el resumen. |
| R2 | `DayMacroSummary` muestra "N / objetivo" o "N / min–max" con los objetivos del perfil en cada render. |
| R3 | `macroStatus` con `MacroTarget` rango. |
| R4 | `macroStatus` con objetivo numérico, `Math.round` y banda ±10 % en aritmética entera. |
| R5 | Icono distinto por estado + texto visible + frase `sr-only`. |
| R6 | Derivado en render; sin estado propio. |
| R7 | `planned` / `total` → aviso "N de M comidas planificadas" si faltan. |
| R8 | Fuera de alcance (Could). `dayPlanSummary` + `macroStatus` por fecha lo harían trivial; queda en Follow-ups. |
| R9 | `slotMacros(recipe, servings = 1)` es el único punto de escalado; `dayPlanSummary` lo llama por franja. |

## Risks & mitigations
- **Dos criterios de "cumplido"** (spec › Risks): el Plan marca kcal, hidratos y grasas con ±10 % y el Diario no. Aceptado por el spec; follow-up ya anotado en el brief. Para la proteína con rango ambos usan `macroStatus` si se acepta Spec feedback 1.
- **Coma flotante en los límites de ±10 %**: mitigado con la comparación entera y tests en los valores límite de R4.
- **Densidad en móvil**: rejilla 2 × 2 en vez de barras; se revisa con captura a 375 px en dev-code.
- **Contraste**: `--color-expiring` como texto sobre `--color-surface-2` y el gris muted; el escaneo axe de `/plan` en `accessibility.spec.ts` lo cubre.
- **#29 antes que esto**: solo cambia la llamada `slotMacros(recipe, slot.servings ?? 1)` en `dayPlanSummary`.
- Reversible por completo: no hay datos persistidos.

## Testing strategy
**Unit** (`tests/unit/planMacros.test.ts`, entorno node):
- `macroStatus`: tabla de R3 (rango 130–160: 129, 130, 160, 161), de R4 (2000: 1799, 1800, 2200, 2201; 230: 206, 207, 253, 254), objetivo 0 (0 → within, 1 → above), redondeo (206,5 → 207 → within; 129,4 → below).
- `dayPlanSummary`: P 30 + 50 + 40 = 120 y los otros tres macros (R1); receta en comida desmarcada no suma; receta borrada no suma ni cuenta como planificada; día sin recetas → `null`; `planned`/`total` 2 de 4; decimales sumados sin redondear; franja duplicada de la misma comida → solo la primera.
- `slotMacros`: `servings` por defecto 1 y multiplicador 0,5 / 2 (R9).

**E2E** (`tests/e2e/macros-plan.spec.ts`, fixtures en `tests/fixtures/plan-macros.ts`: recetas con P 30/50/40 y un perfil con rango 130–160 y 4 comidas):
- R1/R2: con el día planificado, la lista "Macros del día" contiene "120 / 130–160" y los otros totales.
- R3/R5: el `li` de Proteínas contiene "Por debajo" y su frase `sr-only`; al cambiar la cena por una receta más proteica (select de la franja) pasa a "Dentro" (R6).
- R6: "— Sin asignar —" en una franja actualiza los totales; cambiar de día en `DaySelector` muestra el resumen del día nuevo; un día sin recetas no muestra la lista.
- R7: con 2 de 4 comidas, se ve "2 de 4 comidas planificadas"; con todas asignadas, no.
- Accesibilidad: añadir un escaneo axe de `/plan` con un día planificado en `accessibility.spec.ts`.
- Captura manual a 375 px (dev-code) para la densidad.

## Tasks
1. [ ] Tests primero (dev-test): `tests/unit/planMacros.test.ts`, `tests/fixtures/plan-macros.ts`, `tests/e2e/macros-plan.spec.ts` y el escaneo de `/plan` en `accessibility.spec.ts`, en rojo. (R1–R7, R9)
2. [ ] `src/lib/planMacros.ts`: `slotMacros`, `dayPlanSummary`, `macroStatus`; unit tests en verde. (R1, R3, R4, R7, R9)
3. [ ] `src/components/plan/DayMacroSummary.tsx` e integración en `src/app/plan/page.tsx` (quitar `dayKcal` y el kcal de la cabecera); e2e y axe en verde. (R1, R2, R5, R6, R7)
4. [ ] (Si se confirma Spec feedback 1) `MacroBar` usa `macroStatus` para el rango de proteína. Sin cambios visuales; e2e del Diario en verde. (Goal "sin dos verdades")
5. [ ] Revisión en móvil a 375 px, lint, typecheck, build.

## Spec feedback
1. **Redondeo en la proteína con rango (necesita decisión).** R4 dice que se redondea el valor antes de comparar, pero R3 pide "igual que `MacroBar`", que compara el valor **sin redondear**. Con decimales (raciones en el Diario, o recetas con decimales) 129,6 g se muestra como "130 / 130–160" y `MacroBar` no lo marca como cumplido. Propuesta por defecto: `macroStatus` redondea siempre (lo que se ve es lo que se juzga) y `MacroBar` pasa a usarlo para el rango (tarea 4), lo que cambia el Diario solo en valores a menos de 0,5 g de un límite. Alternativa: el Plan redondea y el Diario se queda como está (tarea 4 se cae).
2. **Texto "hidratos" frente a "Carbohidratos".** El spec escribe "hidratos"; el Diario muestra "Carbohidratos". El diseño usa "Carbohidratos" para que las dos pantallas coincidan. Sin impacto si se prefiere lo contrario.
3. **Kcal de la cabecera.** El "N kcal" de la cabecera de la tarjeta desaparece porque queda duplicado en la celda Calorías. El spec no lo menciona; lo anoto para que no sorprenda.
4. **Pregunta abierta resuelta:** el resumen va dentro de la tarjeta del día (enfoque A), no en tarjeta propia.
