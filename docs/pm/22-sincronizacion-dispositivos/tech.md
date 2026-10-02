# Sincronización entre dispositivos: Technical design
_Status: Draft · Updated: 2026-10-02_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Ampliamos el `server/` de Vercel con Neon Postgres, cuentas propias (scrypt + token opaco en tabla `sessions`) y dos rutas de sincronización (GET de todo y PUT por clave con `baseVersion`). En el cliente, una capa nueva `src/lib/sync.ts` se engancha a `usePersisted`: `localStorage` sigue siendo la copia principal, cada escritura se sube con debounce y los cambios remotos se bajan al recuperar el foco y cada 15 s. Esfuerzo: L.

## Context
- `src/lib/auth.tsx`: cuentas locales (`mp_users`), hash PBKDF2 en el navegador, sesión en `mp_session`, `rememberedUsers`. `userKey(userId, key)` → `mp_<userId>_<clave>`.
- `src/lib/store.tsx`: `usePersisted` (lee y escribe `localStorage`, expone `reload()` por clave) y `AppProvider`, que ya tiene `importData` con `writeUserData` + los siete `reload*`.
- `src/lib/userData.ts`: las 7 claves (`USER_DATA_KEYS`), `UserData`, `LOAD_OPTIONS` (migraciones idempotentes).
- `src/lib/backup.ts`: `parseBackup`/`writeUserData`, export/import JSON.
- `src/lib/apiBase.ts`: `apiUrl()` hacia el `server/`; `server/lib/cors.ts`: CORS solo a `CORS_ALLOWED_ORIGIN`, con `GET, POST, OPTIONS` y `Content-Type`.
- `server/app/api/{recipes,foods}`: patrón de ruta (`OPTIONS` → `preflight`, respuesta con `withCors`); tests en `server/tests/unit/*.test.ts` (Vitest). El server importa código compartido de `../src/lib`.
- Frontend estático en IONOS (`output: "export"`), servidor en Vercel (orígenes distintos → token en cabecera, no cookies).
- Next 16.2.9: `AGENTS.md` pide leer `node_modules/next/dist/docs/` antes de escribir código (en especial `01-app/01-getting-started/15-route-handlers.md`) y respetar avisos de deprecación.

## Approaches considered
### A. Capa de sincronización sobre `usePersisted`, `localStorage` como copia principal (chosen)
Una capa `sync.ts` observa las escrituras, las sube y aplica lo remoto con `reload()`. **Pros:** la API de `useApp()` no cambia, funciona sin red como hoy, camino incremental. **Cons:** hay que tratar a mano la carrera entre edición local y pull. **Effort** L.
### B. Reescribir el store para leer/escribir del servidor
Estado en memoria alimentado por el servidor. **Pros:** modelo más limpio, cercano a filas (dirección B del brief). **Cons:** toca toda la app y rompe el uso sin red de R8. **Effort** L+. Descartada.

Decisiones de proveedor y protocolo (elegidas por Manuel, recomendaciones aceptadas):
- **BD:** Neon Postgres vía Vercel (driver `@neondatabase/serverless`). Alternativas: Upstash Redis (más simple pero peor camino a filas) y Supabase (dirección B ahora, más piezas).
- **Auth:** contraseñas con `scrypt` de `node:crypto` (sin dependencia) y token opaco aleatorio guardado hasheado en `sessions`. Alternativas: JWT (no revocable) y librería de auth (pensada para cookies).
- **Escritura:** concurrencia optimista con `baseVersion`; en 409 gana el servidor.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| BD | `server/lib/db.ts`, `server/db/schema.sql` | Conexión Neon y esquema (`users`, `sessions`, `user_data`, `login_attempts`) |
| Auth servidor | `server/lib/auth.ts`, `server/app/api/auth/{register,login,logout}/route.ts` | scrypt, tokens, invitación, bloqueo por intentos |
| Sync servidor | `server/app/api/sync/route.ts`, `server/app/api/sync/[key]/route.ts` | GET (todo o `?since=`), PUT con `baseVersion` |
| CORS | `server/lib/cors.ts` | Añadir `PUT` y `Authorization` |
| Auth cliente | `src/lib/auth.tsx`, `src/components/Login.tsx` | Login/registro contra el servidor, token, «Recordar sesión», campo de código de invitación, se elimina `rememberedUsers`/`mp_users` |
| Sync cliente | `src/lib/sync.ts` (nuevo), `src/lib/store.tsx` | Cola de claves pendientes, push con debounce, pull con foco y polling, estado |
| Estado UI | `src/components/` (indicador en cabecera o Perfil), `DataSection.tsx` | Indicador «al día / sin sincronizar»; el import sube a servidor |
| Migración | `src/lib/sync.ts`, `src/components/Login.tsx` | Selector de cuenta local a adoptar; confirmación servidor-gana |
| Docs | `README.md`, `server/.env` ejemplos | Variables: `DATABASE_URL`, `REGISTRATION_CODE`, `CORS_ALLOWED_ORIGIN` |

### Data model
Servidor (Postgres):
- `users(id uuid pk, username text unique (normalizado), password_hash text, salt, created_at)`
- `sessions(token_hash text pk, user_id fk, created_at, expires_at)` (caduca a los 90 días, renovable)
- `user_data(user_id, key text, value jsonb, version int, updated_at, pk(user_id,key))`; `key` ∈ las 7 claves; tope 1 MB por clave.
- `login_attempts(username, ip, failed_at)` para el bloqueo temporal.

Cliente: sin cambios en las claves `mp_<userId>_<clave>`; `userId` pasa a ser el uuid del servidor. Nuevas claves locales: `mp_<userId>_syncmeta` con `{version por clave, pendientes}` y el token de sesión (`mp_token` en `localStorage` o `sessionStorage` según «Recordar sesión»). Migración de cuentas locales: no se migra el hash; los datos de la cuenta local elegida (`mp_<idLocal>_*`) se suben al servidor bajo el uuid nuevo.

### APIs / interfaces
- `POST /api/auth/register {username, password, invite}` → `{token, user}`; requiere `REGISTRATION_CODE`.
- `POST /api/auth/login {username, password}` → `{token, user}`; bloqueo temporal tras 5 fallos por usuario/IP.
- `POST /api/auth/logout` (Bearer) → borra la sesión.
- `GET /api/sync[?since=<json versiones>]` (Bearer) → `{ key: { value, version } }` solo de lo que cambió.
- `PUT /api/sync/[key] {value, baseVersion}` (Bearer) → `200 {version}` o `409 {value, version}` (gana el servidor, el cliente lo adopta).
- Todas con `withCors`/`preflight` del patrón actual; `Authorization: Bearer <token>`.

### UI
Reutiliza `Login.tsx` (se quita la lista de usuarios recordados; añade campo de invitación en registro, casilla «Recordar sesión» y, si hay cuentas en `mp_users`, el selector «traer los datos de este dispositivo»). Diálogo de confirmación para R7 (servidor gana, con descarga opcional del backup JSON de lo local, reutilizando `backup.ts`). Indicador de estado sencillo (R10). Sin prototipo: no hay artboards.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `auth/register` y `auth/login`; scrypt en servidor; `Login.tsx` contra la API |
| R2 | Token opaco hasheado en `sessions`; `mp_token` en `localStorage`/`sessionStorage`; `auth/logout` borra la fila |
| R3 | `user_data` con un bloque JSON y `version` por clave |
| R4 | `PUT` con `baseVersion`; el cliente al día gana, 409 se resuelve en el servidor |
| R5 | `sync.ts`: pull al volver a la pestaña y polling de 15 s solo con la pestaña visible |
| R6 | Registro con servidor vacío → sube las 7 claves de la cuenta local elegida |
| R7 | Ambos con datos → confirmación, backup JSON opcional, adopta lo del servidor |
| R8 | `localStorage` sigue siendo la fuente; si falla la red, aviso «sin sincronizar»; al volver, 409 → adopta el servidor |
| R9 | Todas las consultas filtran por `user_id` de la sesión; HTTPS de Vercel |
| R10 | Indicador de estado desde el estado de `sync.ts` |
| R11 | `importData` marca las 7 claves como pendientes |
| R12 | Logout borra `mp_<userId>_*` y `syncmeta` |

## Risks & mitigations
- **Pérdida por conflicto/offline:** una edición sin red sobre datos desfasados se pierde en la v1 (gana el servidor). *Aceptado*; la cola offline de la segunda entrega lo resuelve. Mitigación parcial: el cliente con cambios pendientes sube antes de aceptar el pull, y avisa si descarta algo.
- **Carrera pull ↔ edición local:** no aplicar un pull a una clave con cambios pendientes sin resolver primero la subida.
- **Registro abierto:** `REGISTRATION_CODE` obligatorio.
- **Fuerza bruta:** scrypt + bloqueo temporal en `login_attempts`.
- **Token en `localStorage` (XSS):** aceptado por IONOS↔Vercel; la app no inyecta HTML de terceros; tokens revocables y con caducidad.
- **Datos de salud sin E2E:** HTTPS, acceso por sesión y cifrado en reposo del proveedor (decisión de Manuel).
- **Capa gratuita de Neon / Vercel:** autosuspensión (~1 s de arranque en frío) y límites; el polling es una petición ligera. Vigilar el coste (objetivo 0 €).
- **Dos pestañas del mismo navegador:** `syncmeta` compartido en `localStorage` y evento `storage` para no subir datos viejos.
- **Punto sin retorno:** al sustituir `auth.tsx` las cuentas locales dejan de funcionar; los datos locales se conservan hasta cerrar sesión y el backup JSON sigue disponible.

## Testing strategy
- **Servidor (Vitest, `server/tests/unit/`, BD simulada, patrón de `recipes-route.test.ts`):** registro (con/sin invitación, usuario duplicado), login (ok, error, bloqueo), logout, sesión caducada; sync GET/PUT, 409 con versión desfasada, aislamiento entre usuarios (R9), tope de tamaño; CORS con `Authorization`/`PUT`.
- **Cliente (Vitest, `tests/unit/`):** `sync.ts` (cola, debounce, 409 → adopta servidor, pendientes no pisados por el pull, offline), migración local→servidor (R6) y confirmación (R7).
- **E2E (Playwright, API interceptada):** registro con datos locales → los datos aparecen; segundo contexto de navegador inicia sesión y ve lo mismo; un cambio llega tras el polling; sin red muestra «sin sincronizar».
- **Manual:** PC↔móvil con ≤ 30 s (criterio de la spec) y coste 0 € en el panel del proveedor.

## Tasks
1. [ ] BD: `@neondatabase/serverless`, `server/lib/db.ts` y esquema SQL (covers R3, R9)
2. [ ] Auth en servidor: scrypt, `register/login/logout`, sesiones, invitación y bloqueo (covers R1, R2, R9)
3. [ ] CORS: `PUT` y `Authorization`; actualizar `cors.test.ts` (covers R2)
4. [ ] Sync en servidor: `GET /api/sync` y `PUT /api/sync/[key]` con `baseVersion` y 409 (covers R3, R4, R9)
5. [ ] Cliente de auth: `auth.tsx` y `Login.tsx` contra el servidor, token, «Recordar sesión», sin `rememberedUsers` (covers R1, R2)
6. [ ] `src/lib/sync.ts`: cola de pendientes, push con debounce, 409, enganche a `usePersisted` (covers R4, R8)
7. [ ] Pull con foco y polling de 15 s, aislamiento de pestañas (covers R5)
8. [ ] Migración: selector de cuenta local, R6 (servidor vacío) y R7 (confirmación y backup opcional) (covers R6, R7)
9. [ ] Indicador de estado, `importData` sube las 7 claves, logout limpia lo local (covers R10, R11, R12)
10. [ ] README y variables de entorno (`DATABASE_URL`, `REGISTRATION_CODE`), e2e y prueba manual PC↔móvil (covers R5, R6, R7)

## Spec feedback
- La spec dice «gana la última escritura según la marca del servidor». El diseño lo concreta con concurrencia optimista: gana la última escritura entre dispositivos al día; un dispositivo desfasado (p. ej. tras estar sin red) adopta el servidor. Es lo que exige R8 y se acepta como pérdida posible de ediciones sin red hasta la segunda entrega. `spec.md` no cambia.
- Se añade el código de invitación (`REGISTRATION_CODE`) en el registro: no está en la spec; conviene que Manuel confirme si la quiere incluida como requisito.
- Pregunta abierta de la spec sobre «usuarios recordados»: resuelta, se elimina la lista y se añade «Recordar sesión».
- Preguntas abiertas de proveedor, token y polling: resueltas (Neon, token opaco en `localStorage`, 15 s).
