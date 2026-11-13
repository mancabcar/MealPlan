# MealPlan, el producto: Technical design
_Status: Draft · Updated: 2026-11-13_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Tech design de plataforma para la visión del PRD (R10–R31): fija las decisiones que cruzan varios requisitos y deja el detalle de cada uno a su propia spec y tech design. Se mantiene la arquitectura actual (app estática + `server/` en Vercel + Neon) y se le añaden email, consentimientos, uso de IA, suscripciones y métricas; las apps nativas envuelven el export estático con Capacitor, los pagos van por RevenueCat y la traducción es una capa propia. Esfuerzo total de la visión: **L** (varios meses a tiempo parcial); cada feature se estima en su tech design.

## Context
- **App:** Next 16 con `output: "export"` ([next.config.ts](../../../next.config.ts)), sitio estático. `localStorage` es la copia principal; [src/lib/sync.ts](../../../src/lib/sync.ts) sincroniza por clave (`USER_DATA_KEYS` en [src/lib/userData.ts](../../../src/lib/userData.ts)).
- **Servidor:** proyecto Next aparte en [server/](../../../server/), desplegado en Vercel, con Neon Postgres ([server/db/schema.sql](../../../server/db/schema.sql)): `users` (solo usuario + scrypt, sin email), `sessions` (hash del token), `user_data` (un JSON por clave y usuario, con versión), `login_attempts`.
- **Registro cerrado** con `REGISTRATION_CODE` ([register/route.ts](../../../server/app/api/auth/register/route.ts)).
- **IA:** `/api/recipes` (generar) y `/api/recipes/import` **no exigen sesión**; solo el import y el ticket tienen límite por IP en memoria ([server/lib/rateLimit.ts](../../../server/lib/rateLimit.ts)), no compartido entre instancias. `/api/pantry/receipt` sí autentica.
- **«Rellenar semana»** es una búsqueda local sin IA ([src/lib/plan/fillWeek.ts](../../../src/lib/plan/fillWeek.ts)).
- **Textos** en español escritos en los componentes; semillas en [src/data/](../../../src/data/) (`recipes.json`, `foods.json`, `seasonal.json`), solo en español. Las entradas de alimento del Diario copian el nombre en `customName` y guardan `foodId` ([types.ts:37](../../../src/lib/types.ts:37)).

## Approaches considered
Una decisión por eje; el resto del servidor se queda en `server/` + Neon (Supabase descartado: migrar auth y sync para obtener lo que ya da añadir email).

### Apps nativas (R22)
- **A. Capacitor sobre el export estático (chosen).** Empaqueta `out/` en proyectos iOS/Android con el mismo código; plugins nativos para cámara y notificaciones. **Pros:** una sola base de código, paridad gratis. **Cons:** riesgo de rechazo por la guideline 4.2 de Apple. **Effort** M.
- B. React Native / Expo: segunda UI que mantener en paridad; contradice el non-goal. L+.
- C. TWA + envoltorio PWA (PWABuilder): rápido, pero casi seguro rechazo en iOS por 4.2. S.

### Pagos (R15 + R22)
- **A. RevenueCat (chosen):** IAP en iOS y Android + Stripe en la web; webhook a nuestro servidor, que guarda `entitlements` y es la única fuente de verdad del paywall. **Cons:** tercero; gratis hasta ~2,5 k$/mes de ingresos, luego un %. **Effort** M.
- B. Propio (StoreKit + Play Billing + Stripe verificados en el servidor): tres flujos de recibos y renovaciones. L.
- C. Solo Stripe en la web: incumple la 3.1.3(b) de Apple (lo comprado fuera también debe poder comprarse con IAP). Descartado.

### Traducción y unidades (R20, R21)
- **A. Capa propia (chosen):** `t()` con diccionarios `es`/`en`, semillas con campos `{ es, en }`, `units.ts` que convierte solo al mostrar e introducir. Sin dependencias, compatible con el export estático. **Effort** M.
- B. `next-intl` sin routing: una dependencia más y compatibilidad con Next 16 por verificar.
- C. `i18next`: más pesado de lo que la app necesita.

### Métricas (R23)
- **A. Calculadas en el servidor desde los datos sincronizados (chosen):** cron diario de Vercel lee `user_data` de quien consintió la analítica y escribe agregados en `metrics_daily`. Sin instrumentar el cliente ni terceros. **Effort** S–M.
- B. Tabla de eventos desde el cliente: más detalle (embudos), pero instrumentar cada pantalla. M.
- C. PostHog UE: otro encargado del tratamiento con datos de una app de salud. S.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Esquema | `server/db/schema.sql`, `server/lib/db.ts` | Columnas y tablas nuevas (ver Data model) |
| Auth IA | `server/app/api/recipes/route.ts`, `.../recipes/import/route.ts` | Exigir sesión (tarea 0) |
| Cuentas | `server/app/api/auth/*`, `src/lib/auth.tsx` | Email, recuperación, borrado, registro abierto |
| Consentimiento | `src/lib/sync.ts`, nueva pantalla | No subir `profile` ni `measurements` sin consentimiento `health` |
| Uso de IA y paywall | `server/lib/` (nuevo `entitlements.ts`, `aiUsage.ts`) | Comprobar suscripción y límite antes de llamar a Claude |
| Pagos | `server/app/api/billing/webhook` (nuevo) | Webhook de RevenueCat → `entitlements` |
| i18n | `src/i18n/` (nuevo), `src/data/*.json`, componentes | `t()`, semillas `{ es, en }`, nombre por `foodId` |
| Unidades | `src/lib/units.ts` (nuevo) | Conversión al mostrar e introducir |
| Métricas | `server/app/api/cron/metrics` (nuevo), `vercel.json` | Cron diario |
| Nativo | `capacitor.config.ts`, `ios/`, `android/` (nuevos) | Envoltorio del export |

### Data model
Todo aditivo; `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` como hoy.
- `users.email text UNIQUE NULL` (normalizado): obligatorio en el registro nuevo, opcional en cuentas existentes.
- `password_resets(token_hash text PK, user_id → users ON DELETE CASCADE, expires_at bigint)`: enlace de un solo uso, 1 h.
- `consents(user_id → users ON DELETE CASCADE, kind text ('health'|'analytics'), policy_version text, granted_at timestamptz, PK(user_id, kind))`. Si cambia la versión de la política, se vuelve a pedir.
- `ai_usage(user_id → users ON DELETE CASCADE, feature text, used_at timestamptz)`; índice `(user_id, used_at)`.
- `entitlements(user_id PK → users ON DELETE CASCADE, plan text, status text, expires_at timestamptz, source text, updated_at)`, escrita solo por el webhook.
- `metrics_daily(day date, metric text, value numeric, users integer, PK(day, metric))`: solo agregados, sin `user_id`.
- Cliente: `profile.language` (`es`|`en`) y `profile.units` (`metric`|`imperial`); antes del registro, preferencia en `localStorage`. R19 añade a la Despensa un histórico de ítems quitados con `outcome` (`consumed`|`wasted`) y fecha, en una clave sincronizada (forma exacta en su tech design).

### APIs / interfaces
- `POST /api/auth/register` sin `invite`, con `email`; `POST /api/auth/forgot`, `POST /api/auth/reset`; `DELETE /api/auth/account`.
- `GET/PUT /api/consents`.
- Rutas de IA: `requireAiAccess(userId)` comprueba `entitlements` (activo o en prueba) y el uso del mes UTC en `ai_usage` **antes** de llamar a Claude; responde 402 (sin pago) o 429 con `resetsAt` (límite). Se registra el uso solo si la llamada a Claude se hizo.
- `POST /api/billing/webhook` (firma de RevenueCat).
- `GET /api/me` devuelve plan, uso del mes y consentimientos para pintar el paywall.

### UI
- Registro: email + aceptación de la política (enlace accesible antes de registrarse y desde Perfil).
- Pantalla de consentimiento para usuarios existentes; aviso para añadir email.
- Paywall al pulsar una función de IA sin plan (qué incluye + prueba de 7 días); aviso de límite con la fecha de vuelta.
- Perfil: idioma, unidades, borrar cuenta, consentimiento de analítica.

## Spec coverage
| Req | How it's met |
|---|---|
| R10 | Quitar `REGISTRATION_CODE`; mantener el límite por IP del registro |
| R11 | Email + `password_resets` + Resend (F2) |
| R12 | Borrado de `users` en cascada + baja en RevenueCat y Stripe (E3) |
| R13 | `consents` + sync sin claves de salud hasta consentir (F3) |
| R14 | `ai_usage` + `requireAiAccess` (E1) |
| R15 | RevenueCat + `entitlements`; «Rellenar semana» gratis (F1) |
| R16–R18 | Issues existentes (#112, #101, #99, #94, #93, #96, #110); notificaciones nativas con Capacitor |
| R19 | Histórico de ítems quitados con `outcome` |
| R20 | Capa `t()`, semillas `{ es, en }`, nombre por `foodId` (F4) |
| R21 | `units.ts`, solo visualización e introducción (E2) |
| R22 | Capacitor sobre `out/` |
| R23 | Cron diario → `metrics_daily`, solo con consentimiento `analytics` |
| R24–R31 | Sin decisión de plataforma; cada uno en su spec |

## Risks & mitigations
- **RGPD y datos de salud:** asesoría legal antes de R10; redactar la política de privacidad es una tarea. Riesgo aceptado: queda fuera del código.
- **Apple 4.2 y revisión de apps de salud:** spike de Capacitor y envío temprano a TestFlight antes de invertir en R22.
- **Comisión de las tiendas:** pregunta abierta del PRD sobre importes.
- **Límite por IP en memoria no global:** el límite real pasa a `ai_usage` en Neon; el de IP queda como primer filtro.
- **Backups de Neon (PITR, 7 días):** retienen datos borrados; la política lo dice (E3).
- **Cron en el plan gratis de Vercel:** una ejecución diaria permitida; suficiente.
- **Datos personales nuevos (email):** se guarda normalizado, nunca en URLs ni logs.

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| Usuario existente sin email | Entra; ve aviso para añadirlo; sin email no hay recuperación | `users.email` NULL |
| Usuario existente sin consentimiento `health` | La app funciona en local; `profile` y `measurements` no se suben hasta aceptar | Filtro de claves en `sync.ts` |
| Cambio de idioma | Nombres de recetas y alimentos semilla cambian al momento, también en el Diario; OFF y datos propios no | Nombre resuelto por `recipeId` / `foodId`, `customName` de respaldo |
| `foodId` local que ya no existe | Se muestra `customName` | Fallback |
| Cambio de unidades | Ningún valor guardado cambia; macros iguales | Conversión solo en vista |
| Valor imperial introducido (p. ej. 3,5 oz) | Se guarda en gramos sin redondear (99,22 g); se redondea solo al mostrar (oz a 1 decimal) | `units.ts` |
| Cuenta borrada con sesión en otro dispositivo | Siguiente sync → 401 → login; la copia local queda en ese dispositivo | Cascada de `sessions` |
| Límite de IA alcanzado | No se llama a Claude; nada a medias; se muestra el día 1 del mes siguiente (UTC) | Comprobación previa en `requireAiAccess` |
| Suscripción que caduca | La IA se corta en la siguiente llamada | Entitlement comprobado en cada llamada, sin caché en cliente |
| Cambio de versión de la política | Se vuelve a pedir el consentimiento | `consents.policy_version` |
| Ítems quitados antes de R19 | No cuentan en la métrica de desperdicio | Solo cuenta el histórico nuevo |
| Usuario sin consentimiento `analytics` | Excluido del cron aunque tenga `health` | Filtro en la consulta del cron |

## Testing strategy
Cada feature trae sus tests desde su spec (dev-test). A nivel de plataforma: unitarios en `server/` para `requireAiAccess` (sin plan, prueba, límite, mes nuevo), el webhook (firma, estados) y el filtro de claves del sync; unitarios de `units.ts` (ida y vuelta sin deriva) y de la resolución de nombres por idioma; e2e de registro → consentimiento → onboarding y de paywall; test de que el cron ignora a quien no consintió la analítica.

## Tasks
Cada paso es una feature con su spec, tech design y PR, en el orden del PRD.
0. [ ] Fix: exigir sesión en `/api/recipes` y `/api/recipes/import` (issue aparte, ya)
1. [ ] Cuentas: email y recuperación de contraseña (covers R11, F2)
2. [ ] Consentimientos y política de privacidad (covers R13, F3)
3. [ ] Borrar la cuenta (covers R12)
4. [ ] Uso de IA: `ai_usage` y límite mensual (covers R14)
5. [ ] Fiabilidad de sync y PWA (covers R16, R17)
6. [ ] Registro abierto (covers R10)
7. [ ] Pagos: RevenueCat + Stripe web + paywall; «Rellenar semana» gratis (covers R15, F1)
8. [ ] «Tirado» (covers R19), luego métricas en el servidor (covers R23)
9. [ ] i18n y unidades, con nombres por `foodId` (covers R20, R21, F4)
10. [ ] Spike de Capacitor y TestFlight; luego apps en las tiendas (covers R22) y avisos (covers R18)

## Spec feedback
Decidido por el usuario el 2026-11-13 (pendiente de llevar a `spec.md` si lo pide):
- **F1.** «Rellenar semana» no usa IA ni tiene coste por uso: pasa a gratis. Sale de la lista de R15 y desaparece el caso límite de R14 sobre dejar la semana a medias.
- **F2.** R11 necesita un canal: las cuentas añaden email (obligatorio en las nuevas, opcional en las existentes), con Resend.
- **F3.** R13: el consentimiento de datos de salud es obligatorio para tener cuenta; los usuarios existentes lo dan al abrir y, hasta entonces, `profile` y `measurements` no se suben.
- **F4.** R20: el nombre de los alimentos semilla en el Diario se resuelve por `foodId`; los productos de Open Food Facts mantienen su nombre original.

Preguntas abiertas (siguen bloqueando las tareas 4 y 7, no el resto):
- [ ] Usos de IA al mes del plan de pago (R14).
- [ ] Importes de R15 en las tiendas, con la comisión de Apple y Google.
