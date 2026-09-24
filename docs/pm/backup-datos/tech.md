# Copia de seguridad de mis datos: Technical design
_Status: Draft · Updated: 2026-09-24_
_Related: [spec](spec.md) · [brief](brief.md) · [issue #8](https://github.com/mancabcar/MealPlan/issues/8) · sin prototipo_

## Summary
Un módulo puro nuevo, `src/lib/backup.ts`, construye la copia (`buildBackup`), la valida y migra entera en memoria (`parseBackup`) y la escribe en las seis claves del usuario con vuelta atrás si falla una escritura (`writeUserData`). Las claves y las migraciones de carga salen de `store.tsx` a un registro compartido (`src/lib/userData.ts`) que usan tanto el store como la importación, así que una copia pasa **exactamente** por las mismas migraciones que los datos guardados (R7) y las futuras migraciones no se pueden olvidar. `AppProvider` gana `importData(data)`, que escribe y vuelve a leer las seis claves en el estado de React sin recargar (R6); Perfil gana una sección "Tus datos" con "Exportar mis datos", "Importar datos", la confirmación y los mensajes. Esfuerzo: **M** (un día, un día y medio con tests).

## Context
- Stack: Next 16.2.9 App Router, React 19.2.4, Tailwind v4 con tokens. Todo es cliente (`"use client"`), sin rutas ni server code nuevos: nada depende de APIs de Next.
- **Store** (`src/lib/store.tsx`): `AppProvider({ userId })` lee seis claves con `usePersisted(key, fallback, { upgrade, backup })` **una sola vez al montar** (`useState` perezoso). `load()` aplica `upgrade`, y si el resultado cambia lo reescribe (y guarda `<clave>_v1_backup` la primera vez si `backup: true`). Las upgrades son:
  - `profile` → `migrateProfile` (`src/lib/migrate.ts`: `null`/no objeto → `null`; `schemaVersion === 2` → tal cual; **cualquier otra cosa** se trata como v1), con backup.
  - `recipes` → `withSeedRecipes` (privada en `store.tsx`: añade las de `src/data/recipes.json` cuyo id falte).
  - `entries` → `migrateEntries` ("Snack"→"Merienda"; hace `e.mealType`, así que un elemento `null` lanza), con backup.
  - `pantry` → sin upgrade (`raw ?? []`).
  - `weekplan` → `migrateWeekPlan`, con backup.
  - `shopping` → `loadShoppingState` (`src/lib/shopping/state.ts`: tolera cualquier cosa y completa con `EMPTY`).
- El setter de `usePersisted` escribe en `localStorage` en cada llamada y guarda el último valor en un `ref` (`latest`) para encadenar escrituras.
- **Montaje**: `AppShell` (`src/components/AppShell.tsx`) monta `<AppProvider key={user.id}>` solo con sesión; `UserShell` enseña `Onboarding` si `profile` es `null`.
- **Claves**: `userKey(userId, key)` = `mp_<userId>_<key>` (`src/lib/auth.tsx`). Credenciales en `mp_users` (id, username, salt, hash), `mp_session`, `mp_remembered`: nunca se leen desde el store.
- **Perfil** (`src/app/perfil/page.tsx`): secciones con `Section`/`Card`, y al final "Cerrar sesión" y "Borrar perfil" (este último con `window.confirm`). Mensajes: `role="alert"` para errores (patrón de `Field`), `role="status"` para avisos (tarjeta "¿Recalculamos?"). Hay `Sheet` (`src/components/ui/Sheet.tsx`) y `Toast` (`src/components/ui/Toast.tsx`) si hicieran falta.
- **Fecha local**: `todayStr()` en `src/lib/types.ts` (AAAA-MM-DD local).
- **Tests**: Vitest (`tests/unit`, entorno node; `// @vitest-environment jsdom` para componentes, como `tests/unit/store.test.tsx`, que monta `AppProvider userId="u"`), Playwright (`tests/e2e`, `signIn` de `helpers.ts` siembra `mp_users`/`mp_session` para `e2e-user`/"lucia", fija el reloj en `2026-09-22T10:00` y siembra `mp_e2e-user_<clave>`; `readStored` lee lo guardado). Fixtures en `tests/fixtures/{profiles,diario,shopping}.ts`. Ningún e2e usa aún descargas, selector de ficheros ni `window.confirm`.

## Approaches considered

### A. Validar y migrar todo en memoria, escribir con vuelta atrás y releer el store (recomendado)
`parseBackup` hace `JSON.parse`, comprueba la cabecera y la forma de cada sección, y aplica las upgrades del registro compartido; si algo falla devuelve un error y no se ha tocado nada (R8). Tras la confirmación, `importData` llama a `writeUserData` (foto de las seis claves → escribe las seis → si una `setItem` lanza, restaura la foto y relanza) y luego vuelve a leer las seis claves en el estado con el mismo `load` del montaje.
- **Pros:** el "todo o nada" vive en funciones puras con `Storage` inyectable, fáciles de probar (incluido el fallo de cuota a mitad). R7 sale del mismo código que la carga. Perfil sigue montado, así que el mensaje "Datos importados" se ve sin trucos y no se pierde la navegación.
- **Cons:** `usePersisted` necesita una forma de "releer" (poco código). Hay que mover `withSeedRecipes` y las opciones de carga fuera de `store.tsx`.
- **Effort:** M.

### B. Escribir y remontar `AppProvider` cambiando su `key`
Igual validación y escritura, pero en vez de releer, `AppShell` pasa `key={`${user.id}:${generación}`}` y la importación incrementa la generación (vía contexto o evento).
- **Pros:** no toca `usePersisted`; el montaje ya sabe leer y migrar.
- **Cons:** remonta **todo** el árbol, incluida la página de Perfil: se pierde su estado local, así que el mensaje de éxito tiene que sobrevivir por otro canal (sessionStorage, query param o un contexto por encima del store). Hace falta un contexto nuevo por encima de `AppProvider` solo para esto. Más acoplamiento entre `AppShell` y Perfil para ahorrar unas pocas líneas.
- **Effort:** S/M.

### C. Escribir y `window.location.reload()`
- **Cons:** incumple R6 ("sin tener que recargar") y el mensaje de éxito también necesitaría sobrevivir a la recarga. Descartado.

### D. Usar los setters actuales del store uno a uno
- **Cons:** cada setter escribe su clave; si falla la cuarta, las tres primeras ya están escritas y en pantalla. Rompe R8 salvo que se reescriba la escritura igualmente. Descartado.

**Recomendación: A.** Mantiene el "todo o nada" en una sola función pura probada y deja Perfil montado; B sería el plan de respaldo si "releer" en `usePersisted` diera problemas.

## Design

### Components & files
| Area | File(s) | Change |
|---|---|---|
| Registro de datos del usuario | `src/lib/userData.ts` **(nuevo)** | `USER_DATA_KEYS`, tipo `UserData`, `EMPTY_USER_DATA`, `LOAD_OPTIONS` (upgrade + backup por clave) y `withSeedRecipes` (movida desde `store.tsx`). |
| Store | `src/lib/store.tsx` | Usa `LOAD_OPTIONS`; `usePersisted` devuelve también `reload()`; nuevo `importData(data: UserData)` en `AppState`. |
| Copia | `src/lib/backup.ts` **(nuevo)** | `BACKUP_APP_ID`, `BACKUP_SCHEMA_VERSION`, `backupFileName`, `buildBackup`, `parseBackup`, `writeUserData`, `formatExportDate`. Puro, `Storage` inyectado. |
| Perfil | `src/app/perfil/page.tsx` (+ opcional `src/components/perfil/DataSection.tsx`) | Sección "Tus datos": texto R11, "Exportar mis datos", "Importar datos" (input `file` oculto), confirmación, error y éxito. Entre `PreferencesSection` y "Cerrar sesión". |
| Unit | `tests/unit/backup.test.ts` **(nuevo)**, `tests/unit/store.test.tsx` | Construcción, validación, migración, rollback con un `Storage` falso; `importData` refresca estado y storage. |
| E2E | `tests/e2e/backup-datos.spec.ts` **(nuevo)**, `tests/fixtures/backup.ts` **(nuevo)**, `tests/e2e/accessibility.spec.ts` | Descarga, importación con file chooser y diálogo, dos contextos de navegador; caso axe de Perfil con error visible. |

Sin cambios: `auth.tsx`, `migrate.ts`, `shopping/state.ts`, el resto de páginas.

### Data model
**Fichero de copia** (nuevo, no se guarda en `localStorage`):
```ts
interface BackupFile {
  app: "mealplan";            // identificador de la app (R3)
  schemaVersion: 1;           // versión del FORMATO de copia, no del perfil (R3)
  exportedAt: string;         // ISO 8601 (new Date().toISOString())
  data: {
    profile?: unknown;        // tal como está guardado (R2); ausente = vacío
    recipes?: unknown;
    entries?: unknown;
    pantry?: unknown;
    weekplan?: unknown;
    shopping?: unknown;
  };
}
```
- Los nombres de `data` son los mismos sufijos de clave que en `localStorage`, así la correspondencia es directa.
- **Nada de cuenta** (R4): ni `userId`, ni `username`, ni `salt`/`hash`, ni sesión. `buildBackup` solo lee las seis claves `mp_<userId>_<key>`; ninguna de ellas contiene credenciales.
- `exportedAt` en ISO (UTC); se muestra en la confirmación en fecha local `dd/mm/aaaa` con `formatExportDate` (formato fijo, sin depender de `Intl`, igual que `formatServings`).
- **Sin migración de `localStorage`.** Las claves por usuario no cambian.

**Registro compartido** (`src/lib/userData.ts`):
```ts
export const USER_DATA_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping"] as const;
export type UserDataKey = (typeof USER_DATA_KEYS)[number];
export interface UserData {
  profile: UserProfile | null; recipes: Recipe[]; entries: MealEntry[];
  pantry: PantryItem[]; weekplan: WeekPlan; shopping: ShoppingState;
}
export const EMPTY_USER_DATA: UserData;
/** Mismas opciones que usa AppProvider al cargar: única fuente de las migraciones (R7). */
export const LOAD_OPTIONS: { [K in UserDataKey]: { fallback: UserData[K]; upgrade: (raw: unknown) => UserData[K]; backup?: boolean } };
export function withSeedRecipes(raw: unknown): Recipe[];
```
Para `pantry`, `upgrade = (raw) => (raw as PantryItem[] | null) ?? []` (hoy no hay upgrade; el resultado es el mismo).

### APIs / interfaces
```ts
// src/lib/backup.ts
export const BACKUP_APP_ID = "mealplan";
export const BACKUP_SCHEMA_VERSION = 1;

/** "mealplan-backup-2026-09-24.json" con la fecha local (todayStr) (R1). */
export function backupFileName(today: string = todayStr()): string;

/** Lee las seis claves del usuario tal cual (JSON.parse de lo guardado). Omite las ausentes. (R2–R4) */
export function buildBackup(storage: Storage, userId: string, now: Date = new Date()): BackupFile;

export type ParseResult =
  | { ok: true; data: UserData; exportedAt: string }
  | { ok: false; error: string };

/** Todo o nada (R8): JSON → cabecera → forma de cada sección → upgrades de LOAD_OPTIONS. Nunca toca storage. */
export function parseBackup(text: string): ParseResult;

/** Escribe las seis claves. Si una escritura lanza (cuota), restaura los valores anteriores y relanza. */
export function writeUserData(storage: Storage, userId: string, data: UserData): void;

/** "2026-09-24T08:00:00.000Z" → "24/09/2026" (fecha local). */
export function formatExportDate(iso: string): string;
```

**Validación de `parseBackup`** (cada fallo devuelve un mensaje en castellano que explica el motivo, AC R8):
1. `JSON.parse` falla → "El fichero no es un JSON válido."
2. No es objeto o `app !== "mealplan"` → "Este fichero no es una copia de MealPlan."
3. `schemaVersion` no es entero ≥ 1 → no es copia; `> BACKUP_SCHEMA_VERSION` → "Esta copia es de una versión más nueva de la app." (caso límite del spec).
4. `data` no es objeto → no es copia.
5. Por sección **presente** (ausente = vacío, caso límite):
   - `profile`: `null` u objeto; si trae `schemaVersion`, debe ser 2 (sin él = v1, se migra). Evita que un perfil de una versión futura se "migre" como v1 en silencio.
   - `recipes`, `pantry`: array de objetos con `id` string.
   - `entries`: array de objetos con `id`, `date` y `mealType` string y macros numéricos (lo que suman el Diario y la gráfica).
   - `weekplan`: objeto cuyos valores son arrays de objetos con `mealType` y `recipeId` string.
   - `shopping`: objeto (el resto lo normaliza `loadShoppingState`).
   Mensaje: "La sección «entries» no tiene el formato esperado." Es una comprobación de **forma mínima para que la app no se rompa**, no un esquema completo (ver Spec feedback 3).
6. Se aplica `LOAD_OPTIONS[k].upgrade` a cada sección dentro de un `try` (si lanzara, error genérico de formato). El resultado es `UserData` ya migrado y sembrado.

**`writeUserData`**: foto `prev[k] = storage.getItem(key)` de las seis; escribe `JSON.stringify(data[k])` en orden; si una `setItem` lanza, recorre las ya escritas en orden inverso restaurando `prev` (`setItem` o `removeItem` si era `null`) y relanza. Restaurar libera o reutiliza espacio que ya existía, así que no debería fallar por cuota. Solo toca `mp_<userId>_{profile,recipes,entries,pantry,weekplan,shopping}`: ni credenciales, ni `*_v1_backup`, ni otras cuentas.

**Store**:
```ts
// usePersisted devuelve [value, set, reload]; reload() = load(key, fallback, options) → latest.current y setValue.
interface AppState {
  // ...
  /** Sustituye los seis datos del usuario (ya validados con parseBackup). Lanza si falla la escritura (nada cambia). */
  importData: (data: UserData) => void;
}
```
`importData(data)`: `writeUserData(localStorage, userId, data)` y, si no lanza, `reload()` de las seis. Como `data` ya viene migrado y sembrado, el `load` de `reload` no reescribe nada ni crea `*_v1_backup`. Las seis `setValue` en el mismo evento se agrupan en un solo render (React 19).

### UI
Sin prototipo (brief: "dos botones en Perfil y una confirmación").

- **Sección "Tus datos"** (`Card as="section"` con `h2` y `aria-labelledby`, como `Section` pero sin "Editar"), entre "Alergias y dieta" y "Cerrar sesión":
  - Texto R11 en `--color-text-muted`: "Tus datos solo se guardan en este navegador. Exporta una copia de vez en cuando para no perderlos."
  - Botón "Exportar mis datos" (icono Lucide `Download`) y botón "Importar datos" (icono `Upload`), estilo `cancelBtn`/borde como los botones secundarios de Perfil.
- **Exportar (R1)**: `buildBackup(localStorage, user.id)` → `Blob` `application/json` (con `JSON.stringify(backup, null, 2)`, legible) → `URL.createObjectURL` → `<a download={backupFileName()}>` temporal → `click()` → `revokeObjectURL`. Sin mensaje: la descarga es la respuesta del navegador.
- **Importar (R5, R6, R8, R9)**: `<input type="file" accept=".json,application/json" hidden>` que abre el botón "Importar datos" (`ref.click()`); `aria-label="Fichero de copia"` para tests. En `onChange`: `await file.text()` → `parseBackup`.
  - Error → texto `role="alert"` en `--color-expired` dentro de la sección; **no hay confirmación** (AC R8).
  - OK → `window.confirm("¿Sustituir todos tus datos por la copia del 24/09/2026? Lo que tengas ahora se perderá.")`, igual que "Borrar perfil" en la misma página (ver Spec feedback 2). Cancelar → nada (R9).
  - Aceptar → `importData(data)` en `try`; si lanza → "No se han podido guardar los datos (¿falta espacio?). No se ha cambiado nada." (`role="alert"`); si no → "Datos importados" `role="status"`.
  - Siempre `input.value = ""` al terminar, para poder elegir el mismo fichero otra vez.
  - Al empezar una importación se borra el mensaje anterior.
- **Estado local de Perfil tras importar**: las secciones guardan borradores si estaban en edición, y la tarjeta "¿Recalculamos?" guarda cifras viejas. Se envuelven las secciones en un `key={importCount}` que se incrementa al importar (y se hace `setRecalc(null)`), así cualquier edición a medias se descarta y muestran el perfil importado.
- **Perfil importado `null`** (caso límite): tras `importData`, `UserShell` enseña el onboarding y Perfil se desmonta; el onboarding es el aviso (no se ve "Datos importados").

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `backupFileName(todayStr())` + descarga con `Blob`/`<a download>`. |
| R2 | `buildBackup` copia las seis claves tal cual (`shopping` incluido, decisión 2026-09-24). |
| R3 | `app: "mealplan"`, `schemaVersion: 1`, `exportedAt` ISO. |
| R4 | Solo se leen `mp_<userId>_<seis claves>`; ni `mp_users`, ni `mp_session`, ni `mp_remembered`, y el `userId` no se escribe en el fichero. |
| R5 | Input `file` `.json`; `confirm` con la fecha de `exportedAt` antes de escribir nada. |
| R6 | `importData` escribe y relee el estado del store; mensaje "Datos importados". Recargar lee lo escrito. |
| R7 | `parseBackup` aplica `LOAD_OPTIONS` (las mismas upgrades que `AppProvider`): perfil v1→v2, "Snack"→"Merienda", `loadShoppingState`, siembra. |
| R8 | Validación completa y migración en memoria antes de escribir; `writeUserData` restaura si falla una escritura; errores con motivo. |
| R9 | Cancelar el `confirm` sale antes de `importData`. |
| R10 | Exportar → importar da los mismos seis valores (ya migrados al cargar, las upgrades son idempotentes); probado con dos contextos de navegador. |
| R11 | Texto fijo en la sección "Tus datos". |
| Caso: secciones ausentes | Se tratan como `undefined` → `upgrade` da el vacío (y la siembra de recetas). |
| Caso: `schemaVersion` mayor | Rechazo con mensaje propio. |
| Caso: otras cuentas | Solo se escriben claves con el `userId` de la sesión. |
| Caso: fichero grande / cuota | `writeUserData` restaura y la UI muestra el error. |

## Risks & mitigations
- **Rollback incompleto si falla la restauración.** Muy improbable (se restauran valores que ya cabían); si pasara, el error se propaga y los datos quedan como el navegador los deje. Mitigación: restaurar en orden inverso y probar el caso de fallo en la N-ésima escritura con un `Storage` falso.
- **Desincronizar carga e importación en el futuro.** Mitigado moviendo las upgrades a `LOAD_OPTIONS`, que usan ambos; un test comprueba que `AppProvider` e `parseBackup` producen lo mismo para el mismo dato viejo.
- **Validación demasiado floja o demasiado estricta.** Forma mínima por sección (lo que las pantallas leen); campos extra se conservan tal cual. Una copia exportada por la propia app siempre la pasa (test de ida y vuelta).
- **`migrateProfile` trata cualquier objeto sin `schemaVersion: 2` como v1.** La validación rechaza `schemaVersion` de perfil distinto de 2 para no convertir un perfil futuro en uno de valores por defecto.
- **Estado local obsoleto en Perfil** tras importar: `key={importCount}` y `setRecalc(null)`.
- **Privacidad**: el fichero contiene datos de salud (peso, objetivos, diario) en claro; el cifrado está fuera de alcance. El texto R11 no lo menciona; no bloquea.
- **Rama**: la rama actual es `feature/raciones` (sin fusionar). dev-code debe partir de `main` (o de `main` tras fusionar Raciones). Si Raciones entra antes, las entradas con `servings` viajan sin tratamiento especial (la validación no mira campos extra).

## Testing strategy
- **Unit** `tests/unit/backup.test.ts` (entorno node, con un `Storage` en memoria; uno que lance en la N-ésima `setItem` para la cuota):
  - `backupFileName("2026-09-24")` → `mealplan-backup-2026-09-24.json` (R1).
  - `buildBackup`: con las seis claves sembradas para `u` y otras para `v`, más `mp_users`/`mp_session`/`mp_remembered`: contiene los seis datos tal cual, `app`, `schemaVersion: 1`, `exportedAt`; el JSON no contiene el hash, la sal, `"u"` como id, ni el username, ni nada de `v`; claves ausentes se omiten (R2–R4).
  - `parseBackup`: ida y vuelta de `buildBackup` → `ok`; no-JSON, JSON sin `app`, `app` distinto, `schemaVersion` 2 y `"1"`, `data` ausente, `entries` no array, entrada `null`, `weekplan` con valor no array, perfil con `schemaVersion: 3` → `ok: false` con mensaje específico (R8); sección ausente → vacía y recetas sembradas; perfil v1 `["Vegetariano", "Sin gluten"]` → v2 `diet: "vegetarian"` + alergia `gluten`; "Snack" → "Merienda" en entradas y plan (R7); recetas de ejemplo no se duplican.
  - `writeUserData`: escribe las seis y nada más (otras claves intactas); si falla la 4.ª, las seis claves vuelven byte a byte a su valor anterior (también las que no existían) y lanza (R8).
  - `formatExportDate`.
- **Unit** `tests/unit/store.test.tsx` (jsdom): `importData` cambia `profile`, `entries`… en el contexto y en `localStorage` sin remontar; con un `Storage` que falla, el estado y lo guardado no cambian. Y "misma migración": un perfil v1 cargado por `AppProvider` y el mismo perfil pasado por `parseBackup` dan el mismo objeto (R7).
- **E2E** `tests/e2e/backup-datos.spec.ts` (fixture `tests/fixtures/backup.ts`: perfil "Lucía", recetas con una de IA, entradas de hoy, despensa, plan de la semana, `shopping` con algo marcado):
  - R1–R4: `const d = page.waitForEvent("download")` + clic en "Exportar mis datos" → `suggestedFilename()` `mealplan-backup-2026-09-22.json` (reloj fijo de `signIn`); leer `await d.path()` y comprobar las seis secciones, cabecera, y ausencia de `"lucia"`, `e2e-user`, salt y hash (el nombre del perfil debe ser distinto del username en la fixture, ver Spec feedback 1).
  - R5/R6/R10: exportar en el contexto A; abrir un segundo contexto con `browser.newContext()` (otro `localStorage`) y una cuenta B con un perfil mínimo distinto (hace falta perfil para llegar a Perfil) → Perfil → `page.once("dialog", d => { expect(d.message()).toContain("22/09/2026"); d.accept(); })` → `waitForEvent("filechooser")` tras el clic en "Importar datos" y `setFiles(path)` (o `getByLabel("Fichero de copia").setInputFiles(path)`) → "Datos importados"; recorrer Diario, Plan, Despensa, Recetas, Lista de la compra y Perfil comprobando lo mismo que en A, sin `reload`; después `reload()` y siguen ahí.
  - R9: `dialog.dismiss()` → `readStored` de las seis claves igual que antes.
  - R7: fichero a mano con perfil v1 y `mealType: "Snack"` → Perfil muestra dieta vegetariana y alergia al gluten; Diario muestra la entrada en "Merienda".
  - R8: `setInputFiles` con buffers (`{ name, mimeType, buffer }`) de no-JSON, sin `app`, `schemaVersion: 99`, `entries: {}` → mensaje de error visible, **ningún** evento `dialog` (el test falla si salta), y `localStorage` de `mp_e2e-user_*` byte a byte igual (comparar con `page.evaluate`).
  - R11: el texto está en la sección.
  - Caso `profile: null` → tras importar aparece el onboarding.
- **Accesibilidad**: caso "Perfil con error de importación" en `accessibility.spec.ts`.

## Test coverage
Comandos: `npm test` (unit), `npm run test:e2e` (e2e), `npm run typecheck`. Fixtures: `tests/fixtures/backup.ts` (cuenta A "Lucía" / usuario "lucia" con credenciales llamativas, receta de IA, diario de hoy 545 kcal con una entrada × 0,5, despensa, plan; cuenta B "Manuel" con datos distintos; otra cuenta del mismo navegador; perfil v1 y entrada "Snack"; `backupFile`/`backupText` para ficheros hechos a mano; hoy = 2026-09-22). Estado tras dev-test (2026-09-24): 🔴 = falla porque la funcionalidad no existe. Unit: `tests/unit/backup.test.ts` (53) no carga porque no existen `@/lib/backup` ni `@/lib/userData`; en `store.test.tsx` los 8 nuevos fallan con `importData is not a function` (el de R7 importa `@/lib/backup` de forma dinámica para no tumbar los 3 tests previos, que siguen en verde). E2E: los 22 de `backup-datos.spec.ts` y el caso axe fallan porque Perfil no tiene la región "Tus datos". `tsc` da 15 errores, todos en `tests/unit/backup.test.ts` y `store.test.tsx` (módulos que faltan, `importData` en `AppState` y `any` en cascada), que desaparecen con las tareas 1–5. El resto sigue en verde: unit 387/387, e2e 131/131, lint limpio. Estos tests definen "hecho" para dev-code y usan exactamente los nombres de "APIs / interfaces", incluidos los mensajes de error de `parseBackup`.

| Req | Test | Layer | Status |
|---|---|---|---|
| (base R7) | `tests/unit/backup.test.ts` › "userData: registro compartido" › `USER_DATA_KEYS` en orden, `EMPTY_USER_DATA`, `LOAD_OPTIONS` = las migraciones del store (perfil, Snack, plan, compra, siembra, despensa), vacío por clave, `backup` en perfil/diario/plan, `withSeedRecipes` idempotente | unit | 🔴 failing (not built) |
| R1 | `backup.test.ts` › "R1: nombre del fichero" › `backupFileName("2026-09-24")`; por defecto, fecha local de hoy | unit | 🔴 failing (not built) |
| R1 | `tests/e2e/backup-datos.spec.ts` › "R1–R4" › "R1: descarga mealplan-backup-<fecha de hoy>.json" (`suggestedFilename`) | e2e | 🔴 failing (not built) |
| R2 | `backup.test.ts` › "R2" › los seis datos tal cual; claves ausentes omitidas; no escribe en storage | unit | 🔴 failing (not built) |
| R2 | `backup-datos.spec.ts` › "R2: contiene los seis datos…" (igual a lo guardado) y "R2: incluye el estado de la lista de la compra" (Brócoli marcado) | e2e | 🔴 failing (not built) |
| R3 | `backup.test.ts` › "R3" › `BACKUP_APP_ID`, `BACKUP_SCHEMA_VERSION`, `app` / `schemaVersion: 1` / `exportedAt` ISO | unit | 🔴 failing (not built) |
| R3 | `backup-datos.spec.ts` › "R3: identificador de la app, schemaVersion 1 y fecha de exportación" (reloj fijo) | e2e | 🔴 failing (not built) |
| R4 | `backup.test.ts` › "R4" › sin hash, sal, id, username ("lucia" ≠ "Lucía"), recordados, otra cuenta ni `*_v1_backup`; cabecera solo con 4 claves | unit | 🔴 failing (not built) |
| R4 | `backup-datos.spec.ts` › "R4: sin hash, sal, id de cuenta ni nombre de usuario", "R4: sin usuarios recordados ni datos de otra cuenta", "R4: exportar no cambia nada guardado" | e2e | 🔴 failing (not built) |
| R5 | `backup-datos.spec.ts` › cuenta A → B: un único `confirm` con "22/09/2026" y "todos tus datos"; "R5: el selector solo pide ficheros .json" (`accept`, no múltiple) | e2e | 🔴 failing (not built) |
| R5 | `backup.test.ts` › "formatExportDate" › ISO → dd/mm/aaaa, fecha local | unit | 🔴 failing (not built) |
| R6 | `tests/unit/store.test.tsx` › "R6: importData…" › contexto con los seis datos, guardados en localStorage, sin remontar, escrituras posteriores encadenadas, sin `*_v1_backup`, perfil null | unit | 🔴 failing (not built) |
| R6, R10 | `backup-datos.spec.ts` › "de la cuenta A a una cuenta B en otro navegador, sin recargar, y sigue tras recargar": "Datos importados" (`role="status"`), seis claves de B = las de A, Perfil, Diario (545 / 1750, "× 0,5"), Plan, Lista de la compra ("1 de N comprados"), Recetas (IA), Despensa; nada de B; sin recarga (marca en `window`); tras `reload()`, igual | e2e | 🔴 failing (not built) |
| R10 | `backup.test.ts` › "R10" › `buildBackup` → `parseBackup` devuelve lo guardado; campos extra (`servings`) se conservan | unit | 🔴 failing (not built) |
| R10 | `backup-datos.spec.ts` › "en el mismo navegador: exportar e importar la propia copia no cambia nada" (byte a byte) y "se puede importar el mismo fichero dos veces seguidas" | e2e | 🔴 failing (not built) |
| R7 | `backup.test.ts` › "R7" › perfil v1 `["Vegetariano", "Sin gluten"]` → v2 vegetariana + gluten (= `migrateProfile`); Snack → Merienda en diario y plan; `loadShoppingState`; cada sección = `LOAD_OPTIONS[k].upgrade` | unit | 🔴 failing (not built) |
| R7 | `store.test.tsx` › "R7: la carga del store y parseBackup migran igual" (perfil, diario, recetas) | unit | 🔴 failing (not built) |
| R7 | `backup-datos.spec.ts` › "R7" › Perfil muestra "Gluten" y "Vegetariana", Diario "Manzana" en Merienda, plan en Merienda, sin `profile_v1_backup` (Spec feedback 5); recetas de ejemplo re-sembradas sin duplicados | e2e | 🔴 failing (not built) |
| R8 | `backup.test.ts` › "R8: un fichero no válido…" › no JSON / cortado; no es copia (`[]`, `null`, sin `app`, otra app); `schemaVersion` no entero ≥ 1; versión más nueva (2, 99); sin `data`; perfil no objeto o con `schemaVersion: 3` (Spec feedback 4); `recipes` / `pantry` sin `id`; `entries` no lista, con `null`, sin `date` o con macros no numéricos; `weekplan` mal formado; `shopping` no objeto; una sección mala invalida todo. Mensajes literales de tech.md | unit | 🔴 failing (not built) |
| R8 | `backup.test.ts` › "R8: writeUserData escribe todo o nada" › seis claves con `JSON.stringify`; no toca credenciales, `*_v1_backup` ni otras cuentas; fallo en la 1.ª, 4.ª y 6.ª escritura → lanza y todo queda byte a byte igual (también las claves que no existían) | unit | 🔴 failing (not built) |
| R8 | `store.test.tsx` › "R8: si la escritura falla, importData lanza y nada cambia" (cuota en la 4.ª `setItem`) | unit | 🔴 failing (not built) |
| R8 | `backup-datos.spec.ts` › "R8" › no JSON, sin `app`, `schemaVersion: 99`, `entries: {}` → `role="alert"` con el motivo, ningún diálogo, sin "Datos importados", localStorage byte a byte igual; un error previo desaparece al importar bien | e2e | 🔴 failing (not built) |
| R8 | `tests/e2e/accessibility.spec.ts` › "Perfil con error de importación" (color-contrast de "Tus datos" y del error) | e2e | 🔴 failing (not built) |
| R9 | `backup-datos.spec.ts` › "R9: cancelar la confirmación no cambia nada" (confirm con "24/09/2026", `dismiss`, byte a byte igual, Perfil y Despensa de B) | e2e | 🔴 failing (not built) |
| R11 | `backup-datos.spec.ts` › "R11" › "solo se guardan en este navegador… Exporta una copia de vez en cuando" y los dos botones en la región "Tus datos" | e2e | 🔴 failing (not built) |
| Caso: secciones ausentes | `backup.test.ts` › "Casos límite" › copia vacía → todo vacío + recetas de ejemplo; sin `shopping` → `EMPTY` | unit | 🔴 failing (not built) |
| Caso: `profile: null` | `backup.test.ts` (válido) y `backup-datos.spec.ts` › "una copia con profile: null lleva al onboarding" | unit + e2e | 🔴 failing (not built) |
| Caso: otras cuentas | `backup.test.ts` › `writeUserData` no las toca; `backup-datos.spec.ts` › "importar no toca las otras cuentas del navegador ni las credenciales" | unit + e2e | 🔴 failing (not built) |
| Caso: cuota | `backup.test.ts` › fallo a mitad de `writeUserData`; `store.test.tsx` › R8. Sin e2e: no se puede llenar la cuota de forma fiable | unit | 🔴 failing (not built) |

Sin test automático: el texto del error de cuota en la UI ("No se han podido guardar los datos…") y que tras importar se descarten los borradores de Perfil a medio editar (`key={importCount}`). Quedan para la comprobación manual en dev-code.

## Tasks
1. [ ] **Registro compartido de datos del usuario**: crear `src/lib/userData.ts` (`USER_DATA_KEYS`, `UserData`, `EMPTY_USER_DATA`, `LOAD_OPTIONS`, `withSeedRecipes` movida) y hacer que `AppProvider` lo use. Sin cambios de comportamiento; los tests actuales siguen verdes. (base de R7)
2. [ ] **Exportación pura**: `src/lib/backup.ts` con `BACKUP_APP_ID`, `BACKUP_SCHEMA_VERSION`, `backupFileName`, `buildBackup` + tests unitarios. (R1–R4)
3. [ ] **Validación e importación en memoria**: `parseBackup` y `formatExportDate` + tests (formas inválidas, versión futura, secciones ausentes, migraciones). (R3, R7, R8)
4. [ ] **Escritura con vuelta atrás**: `writeUserData` + tests con `Storage` falso que falla a mitad. (R8)
5. [ ] **Store**: `reload` en `usePersisted` e `importData` en `AppState` + tests en `store.test.tsx`. (R6)
6. [ ] **Perfil › "Tus datos" y exportar**: sección con el texto R11 y el botón "Exportar mis datos". (R1, R2, R11)
7. [ ] **Perfil › importar**: input de fichero, errores, `confirm` con la fecha, `importData`, mensaje de éxito, reset de estado local. (R5, R6, R8, R9, R10)
8. [x] **E2E y accesibilidad**: `tests/e2e/backup-datos.spec.ts`, `tests/fixtures/backup.ts` y el caso axe. (todos; escritos antes del código por dev-test el 2026-09-24)

Cada tarea deja la app funcionando; 1–5 son invisibles, 6 ya da una copia útil y 7 entrega todos los Musts.

## Spec feedback
Nada bloqueante; el spec se puede construir tal cual. **Manuel aceptó las seis propuestas el 2026-09-24**: el test de R4 usa un nombre de perfil distinto del username y la confirmación se hace con `window.confirm`.
1. **AC R4 "no contiene el nombre de usuario"**: el perfil guarda un `name` que el usuario escribe y que podría coincidir con su nombre de usuario (p. ej. "manuel"). El requisito se cumple no leyendo nunca las claves de cuenta; el test comprueba que no aparece el username con una fixture donde el nombre del perfil ("Lucía") es distinto del username ("lucia"). **Confirmar** que eso es lo que se quiere decir.
2. **Confirmación con `window.confirm`**, como "Borrar perfil" en la misma pantalla: cero UI nueva y fácil de probar. La alternativa es una hoja `Sheet` con "Sustituir" / "Cancelar" (más coherente con el rediseño, ~medio día más). **Decidir**; por defecto, `confirm`.
3. **Validación de "forma esperada" (R8) mínima por sección** (arrays donde tocan, objetos con `id`, `date`, `mealType`, macros numéricos), no un esquema completo de cada campo. Una copia exportada por la app siempre la pasa; un fichero editado a mano con un campo interno raro podría entrar. Suficiente para un único usuario.
4. **Perfil con `schemaVersion` distinto de 2** (p. ej. 3) se rechaza como formato no válido, en lugar de migrarlo como v1 (que es lo que haría `migrateProfile` al cargar).
5. **Importar un v1 no crea `profile_v1_backup`**: el propio fichero es la copia. Las copias `*_v1_backup` que ya existan en el navegador no se tocan (el spec las deja fuera).
6. **Importar un fichero con `profile: null`** lleva al onboarding sin mostrar "Datos importados" (Perfil deja de existir en ese momento). Coherente con el caso límite del spec.
