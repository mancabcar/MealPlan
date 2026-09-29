# Sobras y batch cooking: Review
_PR: [#80](https://github.com/mancabcar/MealPlan/pull/80) · Reviewed: 2026-09-29 · Verdict: 🔁 changes requested_

## Summary
Los 8 Must (R1–R7, R10) y los 2 Should (R8, R9) están implementados y tienen tests unitarios y e2e; las divergencias del tech design (`eligibleLeftoverSlots` sin `today`, sin "Deshacer tanda", `plannedMeals` desde `leftoverSlotKeys`) están documentadas en `tech.md`. Se pide cambios por un hallazgo confirmado del code review: editar una tanda borra en silencio las sobras de comidas desactivadas en el perfil. Cuando se arregle, el veredicto pasa a `⚠️ approved with follow-ups` con el resto como follow-ups. Clasificación y veredicto confirmados por Manuel (2026-09-29).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/lib/plan/batch.ts:97 · src/components/plan/BatchSheet.tsx:42 | ✅ |
| R2 | ✅ Done | src/lib/plan/batch.ts:97 · src/app/plan/page.tsx:169 | ✅ |
| R3 | ✅ Done | src/lib/shopping/aggregate.ts:52 | ✅ |
| R4 | ✅ Done | src/lib/plan/batch.ts:146 · src/components/plan/BatchSheet.tsx:223 | ✅ |
| R5 | ✅ Done | src/lib/plan/batch.ts:137 · src/components/plan/BatchSheet.tsx:187 | ✅ |
| R6 | ✅ Done (sin cambios de código) | src/lib/planMacros.ts · src/lib/diary.ts | ✅ guardas de regresión |
| R7 | ✅ Done | src/lib/plan/batch.ts:49 | ✅ |
| R8 | ⚠️ Done con un fallo (ver Blocking 1) | src/lib/plan/batch.ts:118 | ✅ |
| R9 | ✅ Done | src/app/plan/page.tsx (`assign`) | ✅ |
| R10 | ✅ Done, con una salvedad (ver Non-blocking 1) | src/lib/shopping/aggregate.ts:24 | ✅ |

## Blocking
1. Editar una tanda borra sobras de comidas desactivadas: `src/components/plan/BatchSheet.tsx:87`. Los destinos se calculan filtrando las franjas elegibles, que solo incluyen las comidas activas del perfil; una sobra existente en una comida desactivada no aparece como casilla, queda fuera de `targets` y `editBatch` la elimina sin aviso. → Incluir en la lista (o conservar en `targets`) las sobras existentes de la tanda aunque su comida no esté activa.

## Non-blocking
1. Una sobra huérfana no puede iniciar una tanda: `src/lib/plan/batch.ts:107`. El Plan la trata como franja normal y muestra "Cocinar para varias comidas", pero `createBatch` lanza porque el slot ya tiene `batchId`. → Aceptar slots huérfanos en `createBatch` (descartando sus campos) o limpiarlos al cargar.
2. `cookedServings` sin validar: `src/lib/shopping/aggregate.ts:56`. Con datos importados a mano (0, negativo o texto) salen cantidades absurdas o `NaN` en la lista. → Ignorar valores que no sean enteros de 2 a 8.
3. `leftoverSlotKeys` repite el recorrido y el escaneo del plan de `collectSources`: `src/lib/shopping/aggregate.ts:68`. → Una única pasada sobre `plannedSlots`.
4. `batchOf` recorre todo el plan por cada fila de sobras en cada render: `src/app/plan/page.tsx:169`. → Calcular el índice de tandas una vez.
5. `dayName` vive en un componente: `src/components/plan/BatchSheet.tsx:24`. → Moverlo a `src/lib/week.ts`.
6. El detalle de un ingrediente muestra la línea original de la receta sin escalar (`150g pechuga`) aunque el total va ×N (nota ya recogida en la PR).

## Code review findings
Los 6 hallazgos de la pasada `code-review` (nivel high) son los listados arriba: 1 bloqueante y los números 1–5 no bloqueantes. El 6 sale de la revisión de la spec.
