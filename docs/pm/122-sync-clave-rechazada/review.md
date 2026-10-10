# Una clave rechazada no bloquea la sincronización: Review
_PR: rama `fix/122-sync-clave-rechazada` (issue [#122](https://github.com/mancabcar/MealPlan/issues/122)) · Reviewed: 2026-10-10 · Verdict: ✅ approved_

## Summary
`pushPending` paraba en la primera clave con una respuesta distinta de 2xx/401/409. Como la cola no cambia de orden, una clave rechazada (400 «Clave desconocida», 413 «El bloque supera 1 MB») bloqueaba para siempre las claves de detrás **y la bajada** de cambios en `pull()`. Ahora un 4xx deja la clave pendiente (estado «Sin sincronizar») y el bucle sigue. Los 5xx y los errores de red siguen parando. Son decisiones del usuario: mantener la clave pendiente en vez de descartarla, incluir el 413 y no añadir ningún texto nuevo en la píldora.

## Spec conformance
Contra [docs/pm/22-sincronizacion-dispositivos/spec.md](../22-sincronizacion-dispositivos/spec.md) y la sección PR B de [docs/pm/integridad-datos/handoff.md](../integridad-datos/handoff.md).

| Req | Status | Where | Tested |
|---|---|---|---|
| R4 | ✅ Done (las claves de detrás de una rechazada se suben) | src/lib/sync.ts:124 | ✅ unit `sync-engine` #122 (400 y 413) |
| R5 | ✅ Done (el pull ya no se bloquea) | src/lib/sync.ts:124 → `pull()` | ✅ unit `sync-engine` #122 (400) |
| R8 | ✅ Done (5xx y sin red sin cambios; lo rechazado se conserva) | src/lib/sync.ts:129 | ✅ unit R8 (500) + #122 |
| R10 | ✅ Done («Sin sincronizar» mientras quede una clave rechazada) | src/lib/sync.ts › `computeStatus` | ✅ unit #122 |

## Blocking
Ninguno.

## Non-blocking
- Un 408 o 429 (transitorios) cae en la misma rama que los rechazos: la clave sigue pendiente y se reintenta en el siguiente ciclo, así que no se pierde nada.
- Un e2e ajeno a este cambio es inestable en la suite completa (`temporada.spec.ts:251`): [#161](https://github.com/mancabcar/MealPlan/issues/161).

## Code review findings
Code review a esfuerzo low sobre el diff de producción: sin hallazgos.

Verificación: lint (un warning previo de #111), typecheck, Vitest 1598/1598, Playwright 602 passed / 5 skipped / 1 inestable (#161, pasa 3/3 aislado), build OK. Los tests de 400 y 413 fallan sin el fix.

## History
- 2026-10-10 pass 1: ✅ approved. Sin hallazgos; e2e inestable de temporada registrado en #161.
