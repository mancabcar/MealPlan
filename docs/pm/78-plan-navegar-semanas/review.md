# Plan: navegar por semanas: Review
_PR: [#108](https://github.com/mancabcar/MealPlan/pull/108) · Reviewed: 2026-10-04 · Verdict: ⚠️ approved with follow-ups_

## Summary
R1–R6 están implementados y el CI del PR pasa. La primera revisión (🔁 changes requested) encontró dos bloqueantes —«Hoy» no restablecía el día de hoy y una hoja de edición abierta sobrevivía al cambio de semana—; ambos están arreglados en `46d95ea`, con un e2e cada uno que falla sin el arreglo (1111 unitarios y 425 e2e en verde). Quedan seis no bloqueantes como follow-ups. Veredicto tras la repetición de la revisión, siguiendo lo acordado con el usuario.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done (arreglado en 46d95ea) | src/app/plan/page.tsx:52, src/components/plan/WeekNav.tsx | ✅ |
| R2 | ✅ Done | src/lib/useWeekParam.ts, src/app/plan/compra/page.tsx | ✅ |
| R3 | ✅ Done | src/lib/shopping/state.ts, src/lib/shopping/useShoppingList.ts, src/lib/syncMigration.ts | ✅ |
| R4 | ✅ Done (arreglado en 46d95ea) | src/app/plan/page.tsx:111 | ✅ |
| R5 | ✅ Done | src/app/plan/compra/page.tsx (DetailSheet) | ✅ |
| R6 | ✅ Done (texto acordado: rango + etiqueta) | src/components/plan/WeekNav.tsx | ⚠️ solo el rango |
| R7 | — Fuera de alcance acordado (#107) | — | — |

## Blocking
Ninguno. Los dos bloqueantes de la primera revisión están arreglados en `46d95ea`:
1. «Hoy» no dejaba seleccionado el día de hoy (src/app/plan/page.tsx) → se reinicia `selectedDate` al cambiar de semana; e2e «R1: «Hoy» deja seleccionado el día de hoy…».
2. La hoja de edición y los `modal` seguían abiertos al cambiar de semana → se cierran al cambiar `monday`; e2e «R4: la hoja de edición abierta se cierra…».

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
