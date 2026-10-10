# Integridad de datos: Handoff para dev-bugfix
_Actualizado: 2026-10-09 · Base: `main` @ `616538f` (tras mergear #157)_
_Issues: [#100](https://github.com/mancabcar/MealPlan/issues/100) · [#122](https://github.com/mancabcar/MealPlan/issues/122) · [#123](https://github.com/mancabcar/MealPlan/issues/123) · [#81](https://github.com/mancabcar/MealPlan/issues/81) · [#116](https://github.com/mancabcar/MealPlan/issues/116)_

## Objetivo
Cerrar los bugs abiertos que pueden **pisar, bloquear o corromper datos del usuario**. Todos salieron de reviews y quedaron como no bloqueantes, pero ahora hay sincronización con el servidor y copias de seguridad, así que los datos «raros» ya no son solo un caso teórico.

## Plan: 3 PRs, en este orden
| PR | Issues | Riesgo que cierra | Tamaño |
|---|---|---|---|
| **A** | #100 | Pérdida real de datos al volver a entrar en un dispositivo ya sincronizado | S |
| **B** | #122 | Una clave rechazada bloquea para siempre la subida de las demás | S |
| **C** | #123 + #81 + #116 | Datos externos sin validar (backup o sync) que rompen pantallas o dan NaN | M |

A y B tocan la sincronización (`src/lib/auth.tsx`, `src/lib/sync.ts`) y C toca las migraciones de carga (`src/lib/userData.ts` y compañía). No se pisan, así que se pueden hacer en worktrees paralelos (`Comidas-100`, `Comidas-122`, `Comidas-integridad`) con ramas `fix/100-…`, `fix/122-…` y `fix/integridad-carga`.

Skill recomendada: **dev-bugfix** por issue o por PR (reproducir → test de regresión → fix → review → PR). No hace falta spec ni tech design: son fixes acotados.

---

## PR A: #100, adoptar una cuenta local pisa datos sincronizados

**Dónde:** `src/lib/auth.tsx` › `finishSignIn` (~L156).

```ts
if (localAccountId) adoptLocalData(localStorage, localAccountId, serverUser.id);   // 1º copia lo local
const knownDevice = localStorage.getItem(userKey(serverUser.id, "syncmeta")) !== null; // 2º mira si ya sincronizó
const plan = knownDevice ? "download" : planFirstSync(...);
```

**Causa:** `adoptLocalData` (`src/lib/syncMigration.ts:68`) copia todas las `USER_DATA_KEYS` de la cuenta local sobre `mp_<serverId>_*` **antes** de saber si el dispositivo ya conocía la cuenta. Si ya la conocía (sesión caducada), el plan es `"download"`: los datos viejos sobrescriben los sincronizados, **no** se marcan como `pending` y el siguiente pull solo trae lo que haya cambiado en el servidor. Las versiones de `syncmeta` siguen apuntando a lo bueno, pero en local queda lo viejo.

**Fix propuesto (decide el usuario):**
1. Calcular `knownDevice` primero y, si es `true`, **no adoptar** (ignorar `localAccountId`). Es la opción mínima.
2. Además, no ofrecer el selector de cuenta local en la pantalla de entrada cuando el usuario ya tiene `syncmeta` en ese dispositivo. Mejor UX, pero el usuario no se sabe hasta el login, así que probablemente no sea viable antes de conocer `serverUser.id`.

**Tests:**
- Unit o e2e (`tests/e2e/sync.spec.ts`, con `tests/fixtures/fakeSyncBackend.ts` y `tests/e2e/syncHelpers.ts`): dispositivo con `syncmeta` y datos sincronizados, más una cuenta local distinta. Al hacer login eligiendo la cuenta local, los datos sincronizados no cambian.
- Regresión: el primer login en un dispositivo nuevo **sí** adopta (R6/R7 de `docs/pm/22-sincronizacion-dispositivos`).

**Preguntas para el usuario:**
- Con el dispositivo conocido y una cuenta local elegida, ¿se ignora en silencio o se avisa («este dispositivo ya está sincronizado; tus datos locales no se han copiado»)?
- ¿Se borra la cuenta local adoptada o se deja como está? Hoy no se toca.

---

## PR B: #122, un 400 de una clave detiene toda la subida

**Dónde:** `src/lib/sync.ts` › `pushPending` (~L96-130).

**Causa:** el bucle recorre `meta.pending` en orden. Con 401 o un error de red para (correcto). Con 409 adopta el valor remoto. Con 2xx confirma. **Con cualquier otro código** (`else { failed = true; return false; }`) también para, y como el orden no cambia, la misma clave vuelve a fallar primero en cada ciclo: las de detrás nunca se suben y la píldora se queda en «Sin sincronizar».

El servidor (`server/app/api/sync/[key]/route.ts`) devuelve 400 en dos casos:
- `L23` `Clave desconocida`: es lo que pasa si un cliente nuevo (con una clave nueva en `USER_DATA_KEYS`) habla con un servidor que aún no la tiene en `SYNC_KEYS` (`server/lib/sync.ts:4`). Ya pasó con `water` y vuelve a ser posible con cada clave nueva (`ratings` en #111).
- `L27` `Falta el valor o baseVersion`.

**Fix propuesto:** distinguir el error **permanente** de esa clave (4xx salvo 401/409) del **transitorio** (5xx o red):
- 4xx permanente: sacar la clave de `pending`, registrarla (p. ej. `console.warn` o un `rejected: UserDataKey[]` en el estado), y **seguir** con las demás.
- 5xx: comportamiento actual (parar y reintentar más tarde).

**Decisiones para el usuario:**
- Si se saca de `pending`, ese cambio local no llega nunca al servidor salvo que se vuelva a editar. ¿Vale así, o mejor mantenerla en `pending` pero **al final de la cola** (se reintenta sin bloquear)? Lo segundo es más seguro ante un despliegue desfasado del servidor: cuando el servidor se actualice, se subirá sola.
- ¿Debe la píldora mostrar algo distinto de «Sincronizado» cuando hay claves rechazadas?

**Tests:** unit sobre el motor de sync con `fetch` falso: `pending = [water, entries]`, `water` → 400, `entries` → 200. Después del ciclo, `entries` está subida y el estado es coherente con la decisión anterior. Otro test: el 500 sigue parando.

> Relacionado pero **fuera de alcance**: [#99](https://github.com/mancabcar/MealPlan/issues/99) (timeout del polling) y [#101](https://github.com/mancabcar/MealPlan/issues/101) (dos pestañas). Tocan el mismo archivo; mejor no mezclarlos aquí.

---

## PR C: validar los datos externos al cargar (#123 + #81 + #116)

**Pieza clave:** `LOAD_OPTIONS` en `src/lib/userData.ts` (~L77) es la **única fuente** de las migraciones. La usan:
- `src/lib/store.tsx` (`usePersisted`) en cada lectura de localStorage, también tras un pull de sync.
- `src/lib/backup.ts:141` al importar una copia (todo o nada).

Validar ahí cubre backup, sync y localStorage editado a mano de una vez. El patrón ya existe: `sanitizeFavorites`, `sanitizeRatings`, `sanitizeWater` (`src/lib/water.ts:63`) y `sanitizeMeasurements`.

### #123: fibra y objetivo de fibra
- `Recipe.fiber` con `null` o texto: `src/app/recetas/page.tsx:324` comprueba solo `=== undefined` y llama a `formatFiber` (`src/lib/fiber.ts:69`), que lanza. Lo mismo en `src/components/diario/FoodPicker.tsx:256` y `src/app/page.tsx:380`.
- `UserProfile.fiberGoal` con 0 o texto: `fiberGoal()` (`src/lib/fiber.ts:15`) devuelve `profile.fiberGoal ?? 38` tal cual, y el Diario muestra «x / 0».
- `waterGoalMl` y `glassMl` **ya** recurren al valor por defecto (`src/lib/water.ts:13-20`). Sirven de modelo.

**Fix:**
- `fiberGoal()`: si no es un entero finito entre 10 y 100 → `FIBER_GOAL_DEFAULT`. Mismo estilo que `waterGoalMl`.
- Recetas: en `userRecipes` (`userData.ts:55`) quitar `fiber` si no es un número finito ≥ 0. Defensa extra opcional: que `formatFiber` no lance.
- Entradas del Diario con `fiber` (`entryFiber`): revisar si hace falta lo mismo en `migrateEntries`.

### #81: sobras huérfanas y `cookedServings`
- **Sobra huérfana** (`leftover: true` con un `batchId` cuya cocinada no existe): `batchOf` (`src/lib/plan/batch.ts`) devuelve `null` y la franja se pinta como normal, pero «Cocinar para varias comidas» llama a `createBatch`, que lanza `"La franja ya forma parte de una tanda"` porque el slot tiene `batchId`.
- **`cookedServings`** sin validar: `collectSources` (`src/lib/shopping/aggregate.ts:58`) usa `slot.cookedServings ?? slotServings(slot)` como factor. Con 0, negativos o texto, la lista de la compra da cantidades absurdas o NaN.

**Fix:** en la migración de `weekplan` (`LOAD_OPTIONS.weekplan` → `migrateWeekPlan`, `src/lib/migrate.ts:104`):
- `cookedServings` que no sea un entero entre `MIN_COOKED_SERVINGS` y `MAX_COOKED_SERVINGS` (`batch.ts`) → quitar `cookedServings` y `batchId` (deja de ser cocinada; sus sobras quedan huérfanas y caen en la regla siguiente).
- Sobra cuyo `batchId` no tiene cocinada en el plan → quitar `leftover` y `batchId` (pasa a franja normal con su receta).
- Ojo: `migrateWeekPlan` es genérico (`<T extends { mealType; recipeId? }>`) y también lo usa `migrateEntries`. Mejor una función `sanitizeWeekPlan` aparte encadenada en `LOAD_OPTIONS.weekplan`.
- Revisar que `copyWeek.ts` (que ya valida tandas incompletas en L53) sigue cuadrando.

### #116: claves de `weeks` y poda al mover a la Despensa
- `loadShoppingState` (`src/lib/shopping/state.ts:121`) acepta cualquier clave en `weeks`. Hay que descartar las que no sean un lunes `YYYY-MM-DD` válido (`mondayOf(k) === k`) y también `lastMove.week` si no lo es.
- `moveToPantry` en `src/lib/shopping/useShoppingList.ts:47` llama a `setShopping(prev => moveToPantry(...))` **sin** pasar por `update()`, que es quien aplica `pruneBought` + `pruneWeeks` (L30-32). Una marca caducada puede quedarse en `bought`. Fix: envolver con `pruneWeeks(updateWeek(..., w => pruneBought(w, signatures)), today)` o reutilizar `update`. Cuidado: `moveToPantry` actúa sobre el estado entero (fija `lastMove` en la raíz), no sobre una semana.

**Tests de C:**
- Unit por función (`tests/unit`): `fiberGoal`, `userRecipes`/sanitizer de recetas, `sanitizeWeekPlan` (huérfana, `cookedServings` 0/-1/"3"/2.5), `loadShoppingState` (clave `"foo"`, `"2026-10-08"` que no es lunes, `lastMove.week` inválido), `moveToPantry` + poda.
- Un e2e de importar una copia «rara» (`tests/e2e/backup-datos.spec.ts`, fixture en `tests/fixtures/backup.ts`) que abra Recetas, Diario, Plan y Compra sin errores en consola. Es el test que pide #123.

**Preguntas para el usuario:**
- ¿Un PR con los tres issues o tres PRs pequeños? Lo recomendado es uno: misma pieza, mismo patrón, un único e2e.
- Si la copia trae datos inválidos, ¿se arreglan en silencio (como hoy con agua y valoraciones) o se avisa al importar?

---

## Verificación al cerrar cada PR
`npm run lint` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run build` · `npm run check:briefs`. Para A y B, también los tests de `server/` si se toca algo de allí (en principio no).

## Fuera de alcance
#99, #101, #112 (sync offline), #140 (seguridad del importador, que es el paso 3 del plan) y #128 (raciones, cosmético).
