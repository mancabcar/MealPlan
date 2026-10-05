# Raciones en el Plan: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Se añade `servings?` a `DayPlanSlot` y se aprovechan los puntos de escalado que ya existen: `slotMacros` (#10), el factor de `collectSources` (#5/#17) y `recipeEntry` (#7). La UI añade un campo "Raciones" en la tarjeta de asignación y una hoja "Raciones" por franja, ambos con un `ServingsField` extraído del Diario. Sin migración, sin flag, sin dependencias nuevas. Esfuerzo M.

## Context
- `DayPlanSlot` (`src/lib/types.ts:81`): `{ mealType, recipeId, batchId?, cookedServings?, leftover? }`.
- `slotMacros(recipe, servings = 1)` (`src/lib/planMacros.ts:21`) ya es el único punto de escalado; `dayPlanSummary` lo llama sin raciones.
- `collectSources` (`src/lib/shopping/aggregate.ts:52`): factor `slot.cookedServings ?? 1`; las sobras (con su cocinada) no suman.
- `parseServings`, `stepServings`, `formatServings`, `servingsLabel`, `SERVINGS`, `SERVINGS_ERROR` y `recipeEntry` (`src/lib/diary.ts`). El campo −/valor/+ está escrito en línea en `src/app/page.tsx` (~L378–425).
- `pendingSlots` (`src/lib/diary.ts:99`) devuelve `{ mealType, recipe }`; "Hecho" y "Registrar todo" llaman a `recipeEntry` sin raciones (`src/app/page.tsx:240, 267`).
- `commitAssign` (`src/app/plan/page.tsx:65`) y `deleteOrigin("keep")` (`src/lib/plan/batch.ts:146`) reconstruyen la franja como `{ mealType, recipeId }` y perderían `servings`. `createBatch` usa `...slot` y lo conserva.
- Persistencia: `migrateWeekPlan` conserva campos desconocidos y el validador de copias solo exige `mealType`/`recipeId`. Sin migración.
- Hojas: `components/ui/Sheet` (usado por `BatchSheet.tsx`).
- Tests: Vitest en `tests/unit`, Playwright en `tests/e2e` (existen `raciones`, `sobras`, `macros-plan`, `shopping-list`).
- `AGENTS.md` avisa de que esta versión de Next.js difiere: todo el cambio es de cliente y de módulos puros; no se toca routing, `next.config` ni APIs de Next.

## Approaches considered
### A. Campo en la tarjeta de asignación + hoja para editar (chosen)
`ServingsField` en la tarjeta del Plan (se lee al elegir receta, como el Diario valida al pulsar "Añadir") y una hoja "Raciones" por franja para cambiarlas después. · **Pros** cumple R2 sin tocar el flujo de asignar; un solo componente de campo; encaja con el patrón de Sheets de #17. · **Cons** dos puntos de entrada de raciones. · **Effort** M
### B. Asignar en dos pasos con hoja
Elegir receta y luego abrir la hoja. · **Pros** un solo punto de entrada. · **Cons** un toque más al asignar, también con 1 ración. · **Effort** M
### C. Solo editar después
· **Pros** más barato. · **Cons** incumple R2. · **Effort** S

Elegida A por el usuario (2026-10-05); coincide con la recomendación.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipo | `src/lib/types.ts` | `servings?: number` en `DayPlanSlot` |
| Escalado | `src/lib/planMacros.ts` | `slotServings(slot)` (ausente/no finito/≤0 → 1); `dayPlanSummary` pasa `slotServings(slot)` a `slotMacros` |
| Compra | `src/lib/shopping/aggregate.ts` | factor `slot.cookedServings ?? slotServings(slot)` |
| Operaciones | `src/lib/plan/servings.ts` (nuevo) | `setSlotServings(plan, ref, n)`: omite el campo si n = 1; lanza si la franja no existe |
| Batch | `src/lib/plan/batch.ts` | `deleteOrigin("keep")` conserva `servings` de cada sobra |
| Pendientes | `src/lib/diary.ts` | `PendingSlot` gana `servings`; `pendingSlots` lo rellena con `slotServings` |
| Campo UI | `src/components/ui/ServingsField.tsx` (nuevo) | −/valor/+ y mensaje de error, extraído de `src/app/page.tsx`; lo usan Diario, tarjeta del Plan y hoja |
| Hoja | `src/components/plan/ServingsSheet.tsx` (nuevo) | Sheet con `ServingsField`, Guardar/Cancelar; llama a `setSlotServings` |
| Plan | `src/app/plan/page.tsx` | estado `servings` de la tarjeta (inicial = las de la franja); `commitAssign` recibe raciones; etiqueta "× N" y botón "Raciones" por franja con receta (también sobras); modal `servings` |
| Diario | `src/app/page.tsx` | usa `ServingsField`; tarjeta del pendiente con "× N"; `recipeEntry(..., { servings: p.servings })` en Hecho y Registrar todo |

### Data model
`DayPlanSlot.servings?: number` (0,25–4, pasos de 0,25; ausente = 1; no se guarda con 1). Sin migración ni cambio de esquema. `cookedServings` (raciones cocinadas, entero 2–8) y `servings` (raciones que se comen) son campos independientes; en un batch la compra solo mira `cookedServings`.

### APIs / interfaces
```ts
slotServings(slot: Pick<DayPlanSlot, "servings">): number            // planMacros.ts
setSlotServings(plan: WeekPlan, ref: SlotRef, n: number): WeekPlan   // plan/servings.ts
PendingSlot = { mealType; recipe; servings: number }                 // diary.ts
<ServingsField value onChange error id label? />                     // ui/ServingsField.tsx
```
Validación en un solo sitio: `parseServings` de `diary.ts`.

### UI
- **Tarjeta de asignación:** bajo `RecipePicker`, "Raciones" con la de la franja (1 si no hay). Al elegir receta se valida; si es inválido no se asigna y se muestra el error. Se reinicia al cambiar de franja (`key` ya existente).
- **Franja:** "× 0,5" como texto junto a la receta (misma línea que la etiqueta de batch); botón "Raciones: × 0,5" / "Raciones: 1" junto a "Cocinar para varias comidas".
- **Hoja "Raciones":** campo + Guardar; cierra al guardar.
- **Diario:** tarjeta de pendiente con "× N" si ≠ 1 (`servingsLabel`).
No hay prototipo (el brief lo omite); el diseño copia los patrones de #7 y #17.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `servings?` en el tipo; `setSlotServings` y `commitAssign` omiten el campo con 1 |
| R2 | `ServingsField` en la tarjeta; `parseServings` valida al elegir receta |
| R3 | etiqueta "× N" + botón "Raciones" + `ServingsSheet` |
| R4 | `dayPlanSummary` → `slotMacros(recipe, slotServings(slot))` |
| R5 | `collectSources` factor `cookedServings ?? slotServings`; las líneas sin cantidad (qty null) no escalan |
| R6 | `PendingSlot.servings`, `recipeEntry` con raciones en Hecho y Registrar todo, etiqueta en la tarjeta |
| R7 | `slotServings` devuelve 1 si falta; sin migración |
| R8 | `ServingsSheet` disponible en cocinada y sobras; la compra del batch no cambia (`cookedServings` tiene prioridad) |
| R9 | `commitAssign` conserva `servings` salvo que el campo diga otra cosa; `deleteOrigin("keep")` las conserva |

## Risks & mitigations
- **Perder `servings` al reconstruir la franja** (commitAssign, deleteOrigin keep): hay tests específicos por cada reconstrucción. 
- **Regresiones en Diario al extraer `ServingsField`**: `raciones.spec.ts` y los unit del Diario deben seguir en verde antes y después de la extracción (tarea propia, sin cambio de comportamiento).
- **Copias de seguridad con `servings` raro** (texto, 0, negativo): `slotServings` lo trata como 1; no se rechaza la copia.
- **Raciones fraccionarias en la compra** (0,5 huevo): aceptado en el spec (non-goal).
- **Firma de cantidad:** al cambiar las raciones, cambia la cantidad y el ítem comprado se desmarca (regla de #5); aceptado, es el comportamiento diseñado.

## Testing strategy
Los tests se escriben antes del código (dev-test, decisión del usuario).
- **Unit:** `planMacros` (slotServings, resumen escalado, valores inválidos), `aggregate` (0,5 / 1,5, dos franjas suman, batch ignora `servings`, "al gusto", sobras normales escalan), `diary` (`pendingSlots` con raciones), `plan/servings` (`setSlotServings`, `deleteOrigin` keep), `ServingsField`.
- **E2E (nuevo `tests/e2e/raciones-plan.spec.ts`):** asignar con 0,5; error con 0,3; editar desde la hoja; total del día; compra; Hecho y Registrar todo; persistencia tras recargar; etiqueta en el pendiente.
- **Regresión:** `raciones`, `sobras`, `macros-plan`, `shopping-list` y `diario-desde-plan` siguen en verde.

## Tasks
1. [x] Tipo + `slotServings` + `dayPlanSummary` escalado (covers R1, R4, R7)
2. [x] `aggregate` escala por `servings` (covers R5, R8)
3. [x] `setSlotServings` + conservar en `commitAssign` y `deleteOrigin("keep")` (covers R9)
4. [x] Extraer `ServingsField` del Diario sin cambiar comportamiento
5. [x] Campo en la tarjeta de asignación + etiqueta "× N" en la franja (covers R2, R3)
6. [x] `ServingsSheet` + botón "Raciones" por franja, incluidas sobras (covers R3, R8)
7. [x] Pendientes: etiqueta, Hecho y Registrar todo con raciones (covers R6)
8. [x] E2E `raciones-plan.spec.ts` y docs

Sin flag: ausente = 1, nada cambia si no se toca.

## Spec feedback
- **R3 cambiado** (decidido, 2026-10-05): la etiqueta no es un botón (iría dentro del botón que abre el selector); se edita con un botón propio "Raciones". El spec y el flujo "Editar raciones" ya están actualizados.
- **R6 ampliado** (decidido, 2026-10-05): la tarjeta del pendiente muestra "× N" antes de Hecho. Spec actualizado.
- Sin preguntas abiertas.

## Test coverage
Tests escritos antes del código (dev-test, 2026-10-05). Ajuste a la estrategia: no hay unit test aparte de `ServingsField` (su API es diseño de dev-code); lo cubren los e2e de raciones del Diario y del Plan. Datos: `tests/fixtures/raciones-plan.ts`. Los unit viven en `plan-servings.test.ts` (reglas de escalado) y `plan-set-servings.test.ts` (`setSlotServings`, módulo aún inexistente).

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/plan-servings.test.ts › "R1 / R7: slotServings" | unit | 🟢 passing |
| R1 | tests/unit/plan-set-servings.test.ts › "R1: setSlotServings guarda las raciones de la franja" | unit | 🟢 passing |
| R1 | tests/e2e/raciones-plan.spec.ts › "R1: con 1 ración la franja guardada no tiene el campo servings…" | e2e | 🟢 passing |
| R2 | tests/e2e/raciones-plan.spec.ts › "R2: asignar una receta con raciones" (valor inicial, 0,5 / 0.5, − / +, inválidos 0,3 · 5 · 0 · abc) | e2e | 🟢 passing |
| R3 | tests/e2e/raciones-plan.spec.ts › "R3: editar las raciones sin reasignar la receta" (hoja, persistencia, volver a 1, inválido/Cancelar, otras franjas) | e2e | 🟢 passing |
| R3 | tests/unit/plan-set-servings.test.ts › "R3: cambiar 0,5 → 0,75 no altera la receta…" | unit | 🟢 passing |
| R4 | tests/unit/plan-servings.test.ts › "R4: el total del día multiplica por las raciones" | unit | 🟢 passing |
| R4 | tests/e2e/raciones-plan.spec.ts › "R4: el total del día multiplica por las raciones" | e2e | 🟢 passing |
| R5 | tests/unit/plan-servings.test.ts › "R5: la lista de la compra escala por las raciones de franjas normales" | unit | 🟢 passing |
| R5 | tests/e2e/raciones-plan.spec.ts › "R5: la lista de la compra escala por las raciones" | e2e | 🟢 passing |
| R6 | tests/unit/plan-servings.test.ts › "R6: pendingSlots lleva las raciones planificadas" | unit | 🟢 passing |
| R6 | tests/e2e/raciones-plan.spec.ts › "R6: Hecho y Registrar todo el día usan las raciones planificadas" | e2e | 🟢 passing |
| R7 | tests/unit/plan-servings.test.ts › "R7: …" (slotServings, total y lista sin servings) | unit | 🟢 passing |
| R7 | tests/e2e/raciones-plan.spec.ts › "R7: un plan guardado antes de este cambio…" | e2e | 🟢 passing |
| R8 | tests/unit/plan-servings.test.ts › "R8: …" (total, batch en compra, pendiente) | unit | 🟢 passing |
| R8 | tests/e2e/raciones-plan.spec.ts › "R8: raciones en cocinada y sobras (batch de #17)" | e2e | 🟢 passing |
| R9 | tests/unit/plan-servings.test.ts › "R9: 'Dejar como normales' conserva las raciones…" | unit | 🟢 passing |
| R9 | tests/e2e/raciones-plan.spec.ts › "R9: cambiar la receta o dejar las sobras como normales…" | e2e | 🟢 passing |

**Contrato de UI que fijan los e2e** (dev-code debe implementarlo tal cual): campo "Raciones" con botones "Quitar 0,25 raciones" / "Añadir 0,25 raciones" y error `SERVINGS_ERROR` (role="alert", aria-invalid) en la tarjeta de asignación; texto "× 0,5" en la franja (nada con 1); botón "Raciones: × 0,5 (Cena)" / "Raciones: 1 (Cena)" por franja con receta, también sobras; diálogo con el campo "Raciones", "Guardar" y "Cancelar"; "× 0,5" en la tarjeta del pendiente del Diario. Resultado inicial: 34 unit (10 pasan, guardas de regresión) y 28 e2e (2 pasan).

**Resultado final (2026-10-05):** 1268 unit y 495 e2e en verde; `lint`, `typecheck` y `next build` limpios. Ajustes durante el código: el test de media cebolla espera "½" (formato actual de fracciones de la lista, que el spec manda mantener) y la aserción de `pendingSlots` de `diary.test.ts` incluye `servings: 1`. La tarjeta del pendiente muestra las kcal escaladas (decidido con Manuel, 2026-10-05).
