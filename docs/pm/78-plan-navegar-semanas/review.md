# Plan: navegar por semanas: Review
_PR: [#108](https://github.com/mancabcar/MealPlan/pull/108) · Reviewed: 2026-10-04 · Verdict: 🔁 changes requested_

## Summary
R1–R6 están implementados y el CI del PR pasa (build, server, test, Vercel). Dos hallazgos bloqueantes: «Hoy» no restablece el día de hoy en un caso real (criterio de R1) y una hoja de edición abierta sobrevive al cambio de semana y puede escribir en una fecha que ya no se ve. Veredicto confirmado por el usuario; se prevé `⚠️ approved with follow-ups` tras arreglarlos.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ⚠️ Partial («Hoy» conserva el día elegido) | src/app/plan/page.tsx:52, src/components/plan/WeekNav.tsx | ✅ (no cubre el caso del día elegido) |
| R2 | ✅ Done | src/lib/useWeekParam.ts, src/app/plan/compra/page.tsx | ✅ |
| R3 | ✅ Done | src/lib/shopping/state.ts, src/lib/shopping/useShoppingList.ts, src/lib/syncMigration.ts | ✅ |
| R4 | ⚠️ Done con el bug de la hoja abierta | src/app/plan/page.tsx:111 | ✅ |
| R5 | ✅ Done | src/app/plan/compra/page.tsx (DetailSheet) | ✅ |
| R6 | ✅ Done (texto acordado: rango + etiqueta) | src/components/plan/WeekNav.tsx | ⚠️ solo el rango |
| R7 | — Fuera de alcance acordado (#107) | — | — |

## Blocking
1. «Hoy» no deja seleccionado el día de hoy si antes había otro día elegido: src/app/plan/page.tsx:52. `selectedDate` se conserva entre semanas; incumple el criterio de R1 → reiniciar `selectedDate` al pulsar «Hoy» (y al cambiar de semana) y añadir un e2e que elija otro día antes.
2. La hoja de edición (`editing`) y los `modal` siguen abiertos al cambiar de semana: src/app/plan/page.tsx:111. El título pasa a «undefined» y elegir receta escribe en una fecha de la semana que ya no se ve → limpiar `editing` y `modal` cuando cambia `monday`, con un e2e.

## Non-blocking
- Toques rápidos en › / ‹: el efecto de `WeekNav` pisa `target.current` con la URL y se pierde o retrocede un salto (src/components/plan/WeekNav.tsx:33).
- `loadShoppingState` no valida que las claves de `weeks` sean lunes YYYY-MM-DD (src/lib/shopping/state.ts).
- `moveToPantry` ya no pasa por `pruneBought` (src/lib/shopping/useShoppingList.ts): una marca caducada puede quedar en `bought`.
- La Despensa calcula toda la lista de la semana actual solo para leer `lastMove` (src/app/despensa/page.tsx:34); conviene un acceso ligero.
- `relativeLabel` calcula la diferencia de semanas en un componente; mejor un helper en `lib/week.ts` con test (src/components/plan/WeekNav.tsx).
- R6: sin test de la etiqueta relativa (Esta semana / Semana siguiente / Semana pasada).
- Sin verificar la sincronización real entre dos dispositivos con el formato nuevo (solo servidor simulado).

## Code review findings
Pass 1 (`code-review`, nivel `high`): 8 hallazgos, todos recogidos arriba (2 bloqueantes, 6 no bloqueantes). Ninguno más.
