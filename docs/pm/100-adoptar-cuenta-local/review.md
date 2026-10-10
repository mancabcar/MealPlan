# Adoptar una cuenta local en un dispositivo ya sincronizado: Review
_PR: rama `fix/100-adoptar-cuenta-local` (issue [#100](https://github.com/mancabcar/MealPlan/issues/100)) · Reviewed: 2026-10-10 · Verdict: ✅ approved_

## Summary
`finishSignIn` copiaba la cuenta local elegida antes de comprobar si el dispositivo ya había sincronizado con esa cuenta. Al volver a entrar tras caducar la sesión, los datos viejos pisaban los sincronizados sin marcarse pendientes. Ahora se comprueba `knownDevice` primero y, si el dispositivo ya es conocido, la cuenta local se ignora en silencio (decisión del usuario). Sin hallazgos.

## Spec conformance
Contra [docs/pm/22-sincronizacion-dispositivos/spec.md](../22-sincronizacion-dispositivos/spec.md) y la sección PR A del handoff de integridad de datos.

| Req | Status | Where | Tested |
|---|---|---|---|
| R6 | ✅ Done (sin cambios: un dispositivo nuevo sigue adoptando) | src/lib/auth.tsx:160 | ✅ e2e `sync.spec` R1/R6 |
| R7 | ✅ Done (sin cambios) | src/lib/auth.tsx:161 | ✅ e2e `sync.spec` R7 ×2 |
| R12 | ✅ Done (no se toca) | — | ✅ e2e `sync.spec` R2/R12 |
| #100 | ✅ Done | src/lib/auth.tsx:159-160 | ✅ e2e `sync.spec` «#100: volver a entrar tras caducar la sesión» (fallaba en `main`) |

## Blocking
Ninguno.

## Non-blocking
Ninguno.

## Code review findings
Code review a esfuerzo low sobre el diff de producción: sin hallazgos.

Verificación: lint (un warning previo de #111, ajeno a este PR), typecheck, Vitest 1595/1595, Playwright 605 passed / 5 skipped, build OK.

## History
- 2026-10-10 pass 1: ✅ approved. Sin hallazgos; R6, R7 y R12 intactos y regresión cubierta.
