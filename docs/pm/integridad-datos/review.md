# Integridad de datos al cargar (#123, #81, #116): Review
_PR: rama `fix/integridad-carga` · Reviewed: 2026-10-10 · Verdict: ⚠️ approved with follow-ups_

## Summary
Lo que llega de una copia de seguridad, de la sincronización o de un localStorage editado se corrige al cargar en `LOAD_OPTIONS` (`src/lib/userData.ts`), en silencio, como ya pasaba con el agua y las valoraciones. Los dos hallazgos que la review marcó para arreglar en esta PR (raciones por debajo de sobras + 1 y días del plan con forma inválida) quedan resueltos en `0754449`. El tercero es un follow-up: [#163](https://github.com/mancabcar/MealPlan/issues/163).

Decisiones del usuario:
- `cookedServings` se ajusta a 2–8;
- una sobra huérfana pasa a franja normal;
- objetivo de fibra no válido → 38 y fibra de receta no válida → «sin dato»;
- las correcciones no se avisan;
- pasos: tests → fix → review → PR.

## Spec conformance
Contra los issues y la sección PR C de [handoff.md](handoff.md).

| Req | Status | Where | Tested |
|---|---|---|---|
| #123 objetivo de fibra no válido → 38 | ✅ Done | src/lib/fiber.ts › `fiberGoal` | ✅ unit `integridad-carga` |
| #123 fibra de receta no válida → sin dato (la ficha no lanza) | ✅ Done | src/lib/fiber.ts › `sanitizeRecipeFiber`, src/lib/userData.ts › `userRecipes` | ✅ unit |
| #81 sobra huérfana / batchId suelto → franja normal (`createBatch` no lanza) | ✅ Done | src/lib/plan/batch.ts › `sanitizeBatches` | ✅ unit |
| #81 `cookedServings` no válido → 2–8, ≥ sobras + 1 | ✅ Done | src/lib/plan/batch.ts › `sanitizeBatches` | ✅ unit (incl. `editBatch` no lanza) |
| #81 también en la copia de seguridad | ✅ Done (backup usa `LOAD_OPTIONS`) | src/lib/backup.ts:141 | ✅ indirecto |
| #116 semanas y `lastMove` con clave que no es lunes → descartadas | ✅ Done | src/lib/shopping/state.ts › `loadShoppingState` | ✅ unit |
| #116 mover a la Despensa poda las marcas caducadas | ✅ Done | src/lib/shopping/useShoppingList.ts › `tidy` | ✅ unit (hook) |

## Blocking
Ninguno pendiente.

## Non-blocking
- ✅ fixed in `0754449`: el ajuste de `cookedServings` no tenía en cuenta las sobras (una tanda «×2» con 3 sobras dejaba la compra corta y hacía lanzar `editBatch`). Ahora sube hasta sobras + 1 con tope 8, y si hay más de 7 sobras las últimas pasan a franja normal. Tests: «nunca por debajo de sobras + 1», «más de 7 sobras».
- ✅ fixed in `0754449`: un día del plan que no era una lista (p. ej. `null`) hacía lanzar la carga. Ahora `planShape` descarta esos días y las franjas que no son objetos. Test: «un día que no es una lista…».
- Follow-up [#163](https://github.com/mancabcar/MealPlan/issues/163): mover a la Despensa (como ya pasaba al marcar como comprado) poda la semana vista si es de hace más de 26 semanas.
- Pendiente: no hay e2e de «importar una copia rara y abrir las pantallas». El usuario eligió cubrirlo solo con tests unitarios.

## Code review findings
Code review a esfuerzo medium: 3 hallazgos, recogidos arriba (2 arreglados, 1 follow-up).

Verificación final: lint (un warning previo de #111), typecheck, Vitest 1632/1632, Playwright 604 passed / 5 skipped, build OK. En una pasada anterior falló `plan-semanas.spec.ts:72`, que pasa 3/3 aislado y encaja con [#115](https://github.com/mancabcar/MealPlan/issues/115).

## History
- 2026-10-10 pass 1: 3 hallazgos. El usuario marcó el 1 (raciones vs sobras) y el 3 (días no array) para arreglar en esta PR, y el 2 como follow-up (#163).
- 2026-10-10 pass 2: ⚠️ approved with follow-ups. 1 y 3 arreglados en `0754449` con 3 tests que fallaban antes.
