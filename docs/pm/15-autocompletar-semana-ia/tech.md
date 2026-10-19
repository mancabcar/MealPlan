# Rellenar la semana según mis objetivos de macros: Technical design
_Status: Draft · Updated: 2026-10-19_
_Related: [spec](spec.md) · [brief](brief.md) · [spike](spike.md)_

## Summary
Un módulo puro `src/lib/plan/fillWeek.ts` (como `copyWeek.ts`) con la búsqueda aleatoria del [spike](spike.md), endurecida: filtra candidatas (franja, dieta, alérgenos, «no me gusta»), busca por día combinaciones y raciones que cumplan kcal y proteína con reglas de coherencia y variedad, y devuelve el plan nuevo. La página del Plan añade «Rellenar semana» junto a «Copiar semana anterior» y comparte con ella el aviso y el Deshacer. Sin cambios de datos, sin dependencias, sin servidor. Esfuerzo **M**.

## Context
- Plan: `src/app/plan/page.tsx` (componente cliente único). Estado `weekPlan`/`setWeekPlan`, `recipes`, `favorites`, `ratings`, `profile` de `useApp()` (`src/lib/store.tsx`). Semana vista y hoy: `useWeekParam()` (`monday`, `dates`, `today`).
- Patrón a seguir: «Copiar semana anterior» (#53): lógica pura en `src/lib/plan/copyWeek.ts`; aviso `copyNotice` con `before` (los 7 días) y `Toast` de 10 s con Deshacer; reinicio al cambiar de semana con `shownWeek`.
- Reutilizable: `fitsSlot` (`src/lib/recipeSlots.ts`; Media mañana, Merienda y Pre-entreno = «snack»), `dayPlanSummary`/`macroTarget`/`macroStatus`/`slotMacros` (`src/lib/planMacros.ts`), `tolerancePct` (`src/lib/tolerance.ts`), `recipeViolations`/`ingredientMatches` (`src/lib/allergens.ts`), `safeAllergies` (`src/lib/recipePrompt.ts`).
- Hoy la dieta y los «no me gusta» solo se usan en el prompt de la IA; ningún filtro de recetas los aplica.
- Tests: Vitest (`tests/unit`), Playwright (`tests/e2e`, fixtures en `tests/fixtures`).

## Approaches considered
### A. Módulo puro con la búsqueda del spike (chosen)
Muestreo aleatorio ponderado de combinaciones por día + ajuste de raciones por descenso coordenado; reglas duras como filtros. · **Pros** validado en el spike (28/28 días), sin dependencias, mismo patrón que `copyWeek`, testeable con semilla · **Cons** heurístico: puede no encontrar un día factible · **Effort** M

Elegido por el usuario (implícito en la interfaz 4a, que es este módulo).

### B. Solver exacto (programación entera, p. ej. `javascript-lp-solver`)
Óptimo garantizado, pero añade una dependencia y la variedad y la coherencia se expresan mal como restricciones lineales. No compensa: A ya cumple.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica | `src/lib/plan/fillWeek.ts` (nuevo) | Candidatas, búsqueda del día, `fillWeek`, `emptySlots` |
| Lógica | `src/lib/plan/baseIngredients.ts` (nuevo) | Lista cerrada de ingredientes base y `baseIngredientsOf(recipe)` |
| UI | `src/app/plan/page.tsx` | Fila de dos botones; `copyNotice` → `planNotice` compartido; `startFill` |
| Tests | `tests/unit/plan-fill-week.test.ts`, `tests/e2e/rellenar-semana.spec.ts`, `tests/fixtures/rellenar-semana.ts` (nuevos) | Ver Testing strategy |

### Data model
Ninguno. Las franjas rellenadas son `DayPlanSlot` normales: `{ mealType, recipeId }` y `servings` solo si ≠ 1 (como #29). Ni `batchId` ni `leftover`.

### APIs / interfaces
```ts
// src/lib/plan/fillWeek.ts
export interface FillInput {
  plan: WeekPlan;
  dates: string[];          // solo los días a rellenar (la página pasa los de la semana ≥ today)
  meals: MealType[];        // profile.meals
  recipes: Recipe[];
  profile: UserProfile;
  favorites: string[];
  ratings: Record<string, number>;
  random: () => number;     // Math.random en la app; semilla en los tests
}
export interface FillResult { plan: WeekPlan; filled: number; unmetDays: string[] }
export function fillWeek(input: FillInput): FillResult;
/** Franjas vacías de `meals` en `dates` (para desactivar el botón, R1). */
export function emptySlots(plan: WeekPlan, dates: string[], meals: MealType[]): number;
```
Con `dates` de un solo día sirve para el follow-up «Completar el día» (E).

**Algoritmo (por día, en orden de `dates`):**
1. **Huecos:** comidas de `meals` sin franja en el día (cualquier franja de esa comida cuenta como ocupada: también sobras, tandas y recetas borradas).
2. **Fijo:** macros de lo asignado con `dayPlanSummary` (misma suma que el resumen del día; una receta borrada no suma).
3. **Candidatas por hueco** (filtros duros): `fitsSlot`; macros finitos; sin violaciones de `recipeViolations(r, safeAllergies(profile.allergies))`; dieta por tags (vegetariana → «vegetariano»/«vegano»; vegana → «vegano»; pescetariana → esas + «pescado»/«marisco»; omnívora sin filtro); sin ningún `dislikedIngredients` (con `ingredientMatches` sobre nombre e ingredientes); sin valoración 1 (R14). Pre-entreno: primero las de tag «pre-gym»; si no hay sin repetir, el resto de «snack» (R11).
4. **Búsqueda:** `ATTEMPTS` intentos (constante, se fija midiendo; el spike usó 400). En cada uno, por hueco, se elige una candidata con peso `(★ nutricionista ? 2,5 : 1) × (favorita ? 1,5 : 1) × (valoración ≥ 4 ? 1,3 : 1) / (1 + 2·usos en la semana)`, sin repetir receta ni ingrediente base en el día (incluido lo fijo). Luego raciones por descenso coordenado en `0,5…2` paso 0,25 (3 pasadas).
5. **Coste** (menor gana): fuera de rango de kcal y proteína ×4, desvío de kcal, HC y grasa ×0,4 (acerca, no exige), +0,12 por uso previo de la receta en la semana, −0,04 por ★, +0,03·|raciones−1|.
6. **Repetición (R7):** las usadas en la semana (incluidas las asignadas a mano) solo entran si un hueco no tiene otra candidata.
7. Sin candidatas para un hueco → queda vacío y el día va a `unmetDays`. El día va a `unmetDays` también si `macroStatus` de kcal o proteína ≠ `within` con `tolerancePct(profile)`.

Pesos y constantes son internos y ajustables; los tests fijan el comportamiento, no los números.

**Ingredientes base (R8)** — `baseIngredients.ts`, buscados en el **nombre** con la tokenización de `allergens.ts` (plurales incluidos):
- Legumbres: garbanzo, lenteja, alubia/judía blanca, edamame/soja
- Pescado y marisco: salmón, atún, merluza, bacalao, dorada, caballa, gamba/langostino
- Carnes: pollo, pavo, ternera, cerdo/lomo, jamón
- Cereales: arroz, pasta, quinoa, avena
- Huevo **no** cuenta (demasiado estricto).

### UI
- Fila con dos botones a partes iguales: «Copiar semana anterior» y «Rellenar semana», cada uno con su explicación debajo si está desactivado. «Rellenar semana» solo se renderiza si `monday ≥ mondayOf(today)` (R1); desactivado con «No quedan comidas vacías desde hoy» si `emptySlots(...) === 0`.
- `startFill`: cierra `editing` y el aviso; calcula `dates.filter(d => d >= todayStr())` en el momento (no en el render); llama a `fillWeek`; `setWeekPlan(plan)`; aviso con `before` de los 7 días.
- `copyNotice` pasa a `planNotice` (mismo shape) y lo usan las dos acciones; `undoCopy` → `undoPlanNotice` sin cambios de lógica.
- Texto: «Rellenada 1 franja» / «Rellenadas N franjas», más « · 1 día no cumple» / « · K días no cumplen» si K > 0.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Botón solo si semana ≥ actual; `emptySlots` lo desactiva con explicación |
| R2 | `dates` ≥ hoy, huecos solo de `meals`, franjas ocupadas intactas |
| R3 | Filtro de alérgenos (`recipeViolations`) y dieta por tags |
| R4 | Coste con kcal y proteína fuera de rango ×4; `macroStatus` + `tolerancePct` |
| R5 | `unmetDays` → aviso; el resumen del día lo muestra no cumplido |
| R6 | `planNotice.before` + Deshacer (patrón de #53) |
| R7 | Penalización por uso en la semana; repetir solo sin alternativa |
| R8 | `baseIngredientsOf` sin repetición en el día, incluido lo fijo |
| R9 | Raciones 0,5–2, paso 0,25 |
| R10 | Pesos ★ y favorita |
| R11 | Pre-entreno: «pre-gym» primero |
| R12 | Filtro de `dislikedIngredients` |
| R13 | Local y síncrono; test de presupuesto |
| R14 | Peso por valoración; valoración 1 excluida |
| R15 | Texto del aviso con `filled` y `unmetDays.length` |

## Risks & mitigations
- **Heurística que no encuentra un día factible** → test con el recetario real y 3 perfiles (2000 kcal; vegetariano; con alergias) que exige ≥ 95 % de días que cumplen (métrica del spec). Aceptado.
- **Rendimiento en móvil** (hilo principal) → `ATTEMPTS` constante y test de presupuesto: una semana < 300 ms en Node; si no, se baja `ATTEMPTS`. Web Worker descartado por ahora. Aceptado.
- **Recetas propias sin tags de dieta** quedan fuera con dietas vegetariana, vegana o pescetariana. Aceptado.
- **Ingrediente base por nombre** falla si el nombre no lo menciona. Aceptado.

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| `planNotice` al cambiar de semana | Se cierra | Reinicio `shownWeek` existente |
| Rellenar dos veces seguidas | El segundo aviso sustituye al primero; Deshacer deshace solo el último | `before` se toma del plan actual; `id` nuevo |
| Editar una franja con el aviso abierto y luego Deshacer | Restaura los 7 días de antes del relleno (se pierde la edición), igual que al copiar | Mismo `before` (decisión del usuario) |
| Pestaña abierta tras medianoche | No rellena el día ya pasado | `todayStr()` se evalúa al pulsar |
| Semana actual, hoy domingo | Solo el domingo | `dates ≥ hoy` |
| Semana pasada | Sin botón | `monday < mondayOf(today)` |
| Receta propia con macros vacíos o NaN | Excluida | Filtro `Number.isFinite` |
| Franja con receta borrada, sobras o tanda | No se toca; suma como en el resumen del día | Huecos por `mealType`; `dayPlanSummary` |
| Comida no activa con franja guardada | No se toca | Solo `meals` |
| Ninguna candidata para una franja | Vacía; día en `unmetDays` | Paso 7 |
| Recetario o perfil sin datos | Sin perfil el Plan no se ve (onboarding); recetario vacío → nada se rellena, `filled` 0 | — |
| `tolerancePct` ausente o fuera de 5–20 | 10 / límite más cercano | `tolerancePct()` |

## Testing strategy
- **Unit** `tests/unit/plan-fill-week.test.ts`, con `random` de semilla y recetas de fixture: un test por criterio de R2–R12 y R14 (franjas ocupadas intactas, días pasados, comidas inactivas, alérgenos, cada dieta, kcal y proteína, aviso de días no cumplidos, no repetir y repetir sin alternativa, ingredientes base incluido lo fijo, raciones en rango y sin `servings: 1`, ★ y favoritas preferidas, «pre-gym» primero, «no me gusta», valoración 1). Además: **métrica** ≥ 95 % de días que cumplen con `src/data/recipes.json` y 3 perfiles, y **presupuesto** < 300 ms por semana.
- **E2E** `tests/e2e/rellenar-semana.spec.ts` + `tests/fixtures/rellenar-semana.ts`, reloj de Playwright fijado en un miércoles: R1 (visible en la actual y futuras, no en pasadas, desactivado sin huecos), R2 (lunes y martes intactos), R6 (Deshacer) y R15 (texto del aviso).

## Tasks
1. [ ] Candidatas: `baseIngredients.ts` y filtros de franja, macros válidos, alérgenos, dieta, «no me gusta», valoración 1 y «pre-gym» primero, con sus tests (R3, R11, R12, R14)
2. [ ] Búsqueda del día: muestreo ponderado, raciones, coherencia, repetición y preferencias, con tests y los de métrica y presupuesto (R4, R7–R10, R13, R14)
3. [ ] `fillWeek` y `emptySlots` sobre los días: huecos, franjas ocupadas, comidas activas, `filled` y `unmetDays` (R2, R5)
4. [ ] UI: fila de botones, explicación, `planNotice` compartido, Deshacer y texto del aviso, con el e2e (R1, R6, R15)

## Spec feedback
- Sin cambios al spec. Decisiones del usuario en esta fase: hilo principal con test de presupuesto (no Web Worker); `random` inyectable para los tests (el relleno sigue siendo distinto cada vez); la lista de ingredientes base de arriba; interfaz `fillWeek` con `dates`; botones en fila; `planNotice` compartido; textos del botón y del aviso; Deshacer tras editar se comporta como al copiar.
