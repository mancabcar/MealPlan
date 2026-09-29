# Sobras y batch cooking: Technical design
_Status: Draft · Updated: 2026-09-29_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Ampliamos `DayPlanSlot` con tres campos opcionales (`batchId`, `cookedServings`, `leftover`) y concentramos las reglas de las tandas en un módulo puro nuevo, `src/lib/plan/batch.ts`. La lista de la compra escala la receta cocinada por N y omite las sobras; Plan y Diario no cambian su cálculo porque cada franja ya vale 1 ración. Esfuerzo: **M**.

## Context
- `DayPlanSlot = { mealType, recipeId }` en `src/lib/types.ts`; `WeekPlan` es `Record<fecha, DayPlanSlot[]>` y el Plan admite una franja por comida y día.
- `src/app/plan/page.tsx` solo muestra la semana lunes–domingo actual (`weekDates(todayStr())`); asigna receta al instante desde un `<select>` (`assign`).
- `collectSources` (`src/lib/shopping/aggregate.ts`) recorre las franjas de la semana y emite un `ItemSource` por ingrediente, sin escalar. `useShoppingList` calcula `plannedMeals` a partir de esas fuentes.
- `dayPlanSummary` (`src/lib/planMacros.ts`) y `pendingSlots` (`src/lib/diary.ts`) tratan cada franja como 1 ración.
- El estado se guarda con `usePersisted` en `src/lib/store.tsx` (`setWeekPlan`); el backup solo valida `mealType` y `recipeId` de cada franja (`src/lib/backup.ts`) y `migrateWeekPlan` conserva los campos extra.
- Pruebas existentes: vitest en `tests/unit`, Playwright en `tests/e2e`, fixtures en `tests/fixtures`. El proyecto es 100 % cliente (export estático): no hay rutas ni API nuevas, así que las guías de Next no aplican a este diseño.

## Approaches considered
### A. Campos opcionales en `DayPlanSlot` con id de tanda (chosen)
Cocinada: `batchId` + `cookedServings`. Sobra: `batchId` + `leftover: true`. · **Pros** sin claves nuevas en localStorage, sin migración, backup intacto; el enlace sobrevive a cualquier edición. · **Cons** el estado de la tanda está repartido entre franjas, así que las reglas de coherencia viven en `batch.ts`. · **Effort** M
### B. Enlazar por fecha + comida (`leftoverOf: { date, mealType }`)
· **Pros** sin ids. · **Cons** el enlace se rompe si cambia la franja origen. · **Effort** M
### C. Clave nueva `batches` en el store
· **Pros** entidad explícita. · **Cons** toca `USER_DATA_KEYS`, backup, `importData` y migración. · **Effort** L
Elegida A por Manuel (2026-09-29); coincide con mi recomendación.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipos | `src/lib/types.ts` | `DayPlanSlot` gana `batchId?`, `cookedServings?`, `leftover?` |
| Reglas de tandas | `src/lib/plan/batch.ts` (nuevo) | Funciones puras `WeekPlan → WeekPlan` |
| Lista de la compra | `src/lib/shopping/aggregate.ts`, `src/lib/shopping/useShoppingList.ts` | `collectSources` escala por `cookedServings` y omite sobras; `plannedMeals` cuenta franjas con receta, sobras incluidas |
| Plan | `src/app/plan/page.tsx` | Botón "Cocinar para varias comidas", etiquetas, apertura del Sheet |
| UI de tanda | `src/components/plan/BatchSheet.tsx` (nuevo) | Sheet (`components/ui/Sheet.tsx`) con N, franjas libres y acciones |
| Datos | `src/lib/backup.ts`, `src/lib/migrate.ts` | Sin cambios (campos opcionales; ver Data model) |

### Data model
```ts
interface DayPlanSlot {
  mealType: MealType;
  recipeId: string;
  batchId?: string;        // cocinada y sobras
  cookedServings?: number; // solo la cocinada (N entero, 2–8)
  leftover?: true;         // solo las sobras
}
```
- Ausencia de los tres campos = franja normal de 1 ración (R10); no hay migración.
- Una sobra sin cocinada con su `batchId` (por ejemplo tras importar una copia editada a mano) se interpreta como franja normal y suma su ración a la lista, para no perder ingredientes.
- `cookedServings` (raciones que se cocinan) queda separado de un posible `servings` de [#29](https://github.com/mancabcar/MealPlan/issues/29) (raciones que se comen).

### APIs / interfaces
`src/lib/plan/batch.ts` (todas puras, sin React):
- `eligibleLeftoverSlots(plan, origin, meals)`: devuelve `{ date, mealType, free }[]` desde la comida siguiente a la cocinada hasta el domingo de la semana de `origin.date`, solo con las comidas del perfil, en orden de calendario y `MEAL_TYPES`. Las ocupadas llevan `free: false`.
- `createBatch(plan, origin, servings, targets, { id }?)`: `origin` y cada destino son `{ date, mealType }`; marca la origen y crea las sobras. Lanza `Error` si N no es entero de 2–8, hay N o más destinos, un destino repetido, ocupado, anterior a la cocinada o de otra semana, o la origen no tiene receta. `id` opcional fija el `batchId` (por defecto `crypto.randomUUID()`).
- `editBatch(plan, batchId, servings, targets)`: `targets` es el conjunto completo de sobras que debe quedar; cambia N y añade o quita sobras. Lanza `Error` si N < 1 + `targets.length`, un destino nuevo está ocupado o el id no existe (R8).
- `removeLeftover(plan, { date, mealType })`: quita una sobra; N no cambia (R5). Lanza `Error` si esa franja no es una sobra.
- `deleteOrigin(plan, batchId, mode)`: `mode` = `"all"` (quita todo) o `"keep"` (las sobras pasan a franjas normales) (R4). También lo usa el cambio de receta (R9).
- `batchOf(plan, batchId)`: `{ origin: { date, mealType, ... }, leftovers: { date, mealType, ... }[] }` o `null` si no existe.

Todas devuelven un plan nuevo (no mutan el de entrada). Cambio en la lista de arriba: `deleteOrigin` con un id inexistente devuelve el plan sin cambios.

### UI
- Plan: tras asignar la receta como hoy, la franja con receta muestra el botón "Cocinar para varias comidas" y, si ya es tanda, "Cocinar ×N" (la cocinada) o "Sobras · de <día>" (la sobra). Sin colores solos: siempre texto.
- `BatchSheet`: stepper de N (2–8), lista de franjas libres para las sobras, acciones "Guardar", "Quitar esta sobra" (en una sobra) y "Deshacer tanda" (en la cocinada). Tocar una franja de sobras abre el Sheet de su tanda; no hay select de receta.
- Aviso de borrado o de cambio de receta de una cocinada con sobras (R4, R9): "Borrar todo" / "Dejarlas como comidas normales" / "Cancelar", en el mismo Sheet.
- No hay artboard de prototipo para este issue; la disposición sale de esta sección.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `createBatch` + `eligibleLeftoverSlots` (semana actual, desde la comida de la cocinada) + BatchSheet |
| R2 | Campos `batchId`/`cookedServings`/`leftover` y etiquetas en `plan/page.tsx` |
| R3 | `collectSources` multiplica `qty` por `cookedServings` y omite las sobras |
| R4 | `deleteOrigin` (`"all"` / `"keep"`) + aviso en el Sheet |
| R5 | `removeLeftover` no toca `cookedServings` |
| R6 | Sin cambios en `planMacros`/`diary`: cada franja ya vale 1 ración |
| R7 | `eligibleLeftoverSlots` devuelve las ocupadas como no seleccionables |
| R8 | `editBatch` (N ≥ 1 + sobras) |
| R9 | El cambio de receta de una origen con sobras llama a `deleteOrigin` |
| R10 | Campos opcionales; ausentes = franja normal |

## Risks & mitigations
- **Coherencia del enlace** entre cocinada y sobras: toda mutación pasa por `batch.ts` y se cubre con tests unitarios.
- **Datos importados con sobras huérfanas**: se tratan como franjas normales (se suman a la lista). Aceptado.
- **Comidas desactivadas en el perfil (`meals`)**: la cocinada oculta con sobras visibles no suma a la lista, como el comportamiento actual. Aceptado.
- **`plannedMeals`** ya no sale solo de las fuentes (las sobras no emiten ingredientes): se calcula aparte desde el plan. Cubierto por un test.
- **Solape con #29**: nombres de campo distintos (`cookedServings` vs un futuro `servings`); revisar #29 tras el merge.
- **Fuera de la semana actual**: no se ofrecen días de otras semanas (el Plan no navega); si se quiere, es una feature aparte.

## Testing strategy
- **Unit** (`tests/unit/plan-batch.test.ts`): `createBatch`, `editBatch`, `removeLeftover`, `deleteOrigin` (ambos modos), `eligibleLeftoverSlots`, rangos de N y compatibilidad R10.
- **Unit** (`shopping-aggregate.test.ts`): escalado ×N, sobras sin ingredientes, igualdad con el comportamiento previo sin batch, conteo de `plannedMeals`.
- **E2E** (`tests/e2e/sobras.spec.ts`): escenario del domingo (crear tanda, etiquetas, lista una vez ×3), borrar la cocinada con las tres opciones, quitar una sobra, "Hecho" en una sobra y macros del día.
- Los criterios de aceptación de la spec se cubren uno a uno con `dev-test` antes del código.

## Tasks
1. [ ] Tipos y `plan/batch.ts` con tests unitarios (covers R1, R2, R4, R5, R7, R8, R9, R10)
2. [ ] Escalado y omisión de sobras en `collectSources`; `plannedMeals` desde el plan (covers R3)
3. [ ] `BatchSheet`, botón y etiquetas en el Plan: crear tanda (covers R1, R2, R7)
4. [ ] Borrado de la cocinada, cambio de receta y quitar una sobra con el aviso (covers R4, R5, R9)
5. [ ] Editar N y las sobras desde la cocinada (covers R8)
6. [ ] E2E y comprobación de "Hecho" y macros con sobras (covers R6)

## Spec feedback
Cambios decididos por Manuel (2026-09-29), ya aplicados en `spec.md`:
- R1: las sobras van desde la comida de la cocinada hasta el domingo de la semana actual, nunca antes (el Plan solo muestra la semana actual).
- Sobras en otra semana pasan a fuera de alcance.
- Pregunta abierta sobre "limpiar día o semana": no existe esa acción en el Plan.
- Sigue abierto: revisar #29 tras el merge para apoyarse en `cookedServings`.

## Test coverage
Rama de trabajo: `feature/17-sobras-batch-cooking` (worktree propio). Datos: `tests/fixtures/sobras.ts`. Contrato de UI de los e2e: cabecera de `tests/e2e/sobras.spec.ts`.
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/plan-batch.test.ts › "R1: crear una tanda (createBatch)" (7 tests: 3 franjas, sin mutar, 0/1/N−1 destinos, N de 2 a 8, origen con receta, destinos inválidos) | unit | 🔴 failing (not built) |
| R1 | tests/e2e/sobras.spec.ts › "R1 / R2: …" (escenario 1, persistencia tras recargar, rango de N, asignar sin tanda como hoy) | e2e | 🔴 failing (not built); "sin usar…" 🟢 guarda de regresión |
| R2 | tests/unit/plan-batch.test.ts › "R2: cada franja guarda su papel…" (campos exactos, id compartido, batchOf) | unit | 🔴 failing (not built) |
| R2 | tests/e2e/sobras.spec.ts › "R1 / R2: escenario 1" (etiquetas "Cocinar ×3" y "Sobras · de Martes") | e2e | 🔴 failing (not built) |
| R3 | tests/unit/shopping-aggregate.test.ts › "R3: la lista cuenta la tanda una vez…" (450 g/600 g, una fuente, sobras sin fuentes, quitar sobra, N sin sobras, cebolla ×3, comida desactivada) | unit | 🔴 failing (not built); "receta borrada" 🟢 guarda |
| R3 | tests/e2e/sobras.spec.ts › "R3: …" (450 g con 1 sobra, "2 comidas planificadas"; crear desde el Plan pasa de 150 g a 450 g) | e2e | 🔴 failing (not built) |
| R4 | tests/unit/plan-batch.test.ts › "R4: borrar la franja cocinada (deleteOrigin)" ("all", "keep", otras tandas, sin mutar, sin sobras) | unit | 🔴 failing (not built) |
| R4 | tests/e2e/sobras.spec.ts › "R4: …" (3 opciones sin borrar hasta elegir, Cancelar, Borrar todo, Dejarlas normales + lista 300 g) | e2e | 🔴 failing (not built); sin sobras / franja normal 🟢 guarda |
| R5 | tests/unit/plan-batch.test.ts › "R5: quitar una sobra (removeLeftover)" | unit | 🔴 failing (not built) |
| R5 | tests/e2e/sobras.spec.ts › "R5: quitar una sobra" (sin select, N y lista sin cambios) | e2e | 🔴 failing (not built) |
| R6 | tests/unit/plan-sobras-macros.test.ts (`dayPlanSummary` y `pendingSlots` con sobras) | unit | 🟢 passes (guarda de regresión) |
| R6 | tests/e2e/sobras.spec.ts › "R6: …" (600 kcal en cocinada y sobra; "Hecho" en la sobra de hoy) | e2e | 🟢 passes (guarda de regresión) |
| R7 | tests/unit/plan-batch.test.ts › "R7: franjas que se pueden elegir (eligibleLeftoverSlots)" | unit | 🔴 failing (not built) |
| R7 | tests/e2e/sobras.spec.ts › "R7: franjas que se pueden elegir" (ocupadas disabled, no se ofrecen las anteriores) | e2e | 🔴 failing (not built) |
| R8 | tests/unit/plan-batch.test.ts › "R8: editar la tanda (editBatch)" | unit | 🔴 failing (not built) |
| R8 | tests/e2e/sobras.spec.ts › "R8: …" (subir N y añadir sobra, N ≥ 1 + sobras, desmarcar sobra) | e2e | 🔴 failing (not built) |
| R9 | tests/e2e/sobras.spec.ts › "R9: …" (aviso al cambiar la receta; "Dejarlas normales" con la nueva receta) | e2e | 🔴 failing (not built) |
| R10 | tests/unit/plan-batch.test.ts › "R10: …" y tests/unit/shopping-aggregate.test.ts › "R10: …" (sobra huérfana suma 1 ración) | unit | 🔴 failing (not built) / 🟢 guarda de regresión |
| R10 | tests/e2e/sobras.spec.ts › "R10: …" (plan sin campos; sobra huérfana) | e2e | 🟢 passes (guarda de regresión) |

Los que dicen "guarda de regresión" pasan ya y no deben dejar de pasar. `npm run typecheck` falla hasta la tarea 1 (los tests usan `batchId`, `cookedServings`, `leftover` y `@/lib/plan/batch`), como los demás tests en rojo.
