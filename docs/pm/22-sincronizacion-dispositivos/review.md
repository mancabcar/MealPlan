# Sincronización entre dispositivos: Review
_PR: [#98](https://github.com/mancabcar/MealPlan/pull/98) · Reviewed: 2026-10-02 · Verdict: 🔁 changes requested_

## Summary
R1–R12 están implementados y las suites pasan (unitarios 856/856, servidor 84/84, e2e 331/331). Se pide cambios por dos problemas confirmados por Manuel como bloqueantes: cerrar sesión sin red borra cambios sin subir, y el registro no limita los intentos con el código de invitación. Las divergencias del tech design (indicador sin `role="status"`, sin confirmación de R7 en un dispositivo ya sincronizado) están documentadas y se aceptan; el riesgo de dos pestañas se acepta como follow-up.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | server/app/api/auth/{register,login}/route.ts, src/components/Login.tsx | ✅ |
| R2 | ✅ Done | server/lib/auth.ts, src/lib/auth.tsx | ✅ (sin test de «Recordar sesión» desmarcado) |
| R3 | ✅ Done | server/lib/store.ts, server/app/api/sync/[key]/route.ts | ✅ (SQL real solo a mano) |
| R4 | ✅ Done | server/lib/store.ts:putData, src/lib/sync.ts | ✅ (SQL real solo a mano) |
| R5 | ✅ Done | src/lib/sync.ts, src/lib/syncContext.tsx | ✅ (≤ 30 s real solo a mano) |
| R6 | ✅ Done | src/lib/auth.tsx:finishSignIn, src/lib/syncMigration.ts | ✅ |
| R7 | ✅ Done | src/lib/auth.tsx, src/components/Login.tsx | ✅ |
| R8 | ✅ Done | src/lib/sync.ts | ✅ |
| R9 | ✅ Done | server/lib/auth.ts:authenticate | ⚠️ solo con fake de store |
| R10 | ✅ Done | src/components/SyncStatus.tsx | ✅ |
| R11 | ✅ Done | src/lib/store.tsx:importData | ✅ (unit) |
| R12 | ⚠️ Partial | src/lib/auth.tsx:196 | ✅ (ver bloqueante 1) |

## Blocking
1. **Cerrar sesión sin red borra cambios sin subir**: `src/lib/auth.tsx:196`. El flush previo falla, el error se traga y `clearUserData` borra la copia local con cambios pendientes → no borrar si quedan pendientes (avisar y pedir confirmación) y añadir test.
2. **Registro sin límite de intentos**: `server/app/api/auth/register/route.ts:10`. El código de invitación se puede adivinar por fuerza bruta → limitar intentos de registro fallidos (p. ej. con `login_attempts` bajo una clave de registro o por IP) y añadir test.

## Non-blocking
- Dos pestañas del mismo navegador (riesgo del tech design sin implementar; evento `storage`): aceptado como follow-up.
- Adoptar una cuenta local en un dispositivo conocido pisa datos ya sincronizados (`src/lib/auth.tsx:147`).
- El polling no tiene timeout y encadena pulls si uno se cuelga (`src/lib/sync.ts:205`).
- La píldora muestra «Sincronizando…» en cada ciclo de polling (`src/lib/sync.ts:75`).
- `scryptSync` bloquea el hilo (`server/lib/auth.ts:20`); usar la versión asíncrona.
- El bloqueo de login es solo por usuario, no por IP como decía el tech design (`server/app/api/auth/login/route.ts:19`).
- `login_attempts` y sesiones caducadas no se purgan (`server/lib/store.ts:87`).
- Duplicación de `userKey`, la lista de 7 claves y la descarga del backup (`src/lib/syncMigration.ts:5`).
- Tests pendientes: «Recordar sesión» desmarcado; SQL real contra Neon.
- La spec no recoge el código de invitación (`REGISTRATION_CODE`); decidir si se añade como requisito.

## Code review findings
Los 9 hallazgos de la pasada 1 (code-review, esfuerzo high) están integrados arriba.
