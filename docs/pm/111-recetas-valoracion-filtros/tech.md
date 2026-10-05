# Recetas: valoración, filtros y orden: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md) · [tech de #20](../20-recetas-filtros/tech.md)_

## Summary
Una clave nueva `ratings` (`{ [recipeId]: 1–5 }`) guarda la valoración por usuario, igual que `favorites`, y viaja en la copia de seguridad y la sincronización. La lógica de filtros y orden vive en un módulo puro nuevo, `recipeFilters.ts`, y la UI se reparte en `RatingStars`, `RatingBadge` y un panel `RecipeFilters` en la página Recetas. Esfuerzo M, en 4 tareas.

## Context
- Stack: Next 16.2.9 (App Router, export estático), React 19, vitest y playwright. `AGENTS.md` avisa de que esta versión de Next difiere de lo habitual; el trabajo es de componentes cliente y lógica pura, y dev-code debe leer antes lo que toque en `node_modules/next/dist/docs/`.
- Datos del usuario: claves `mp_<id>_<clave>` en `USER_DATA_KEYS` ([`src/lib/userData.ts:10`](../../../src/lib/userData.ts)); `LOAD_OPTIONS` es la única fuente de migraciones, compartida con la copia de seguridad.
- Copia de seguridad: [`src/lib/backup.ts`](../../../src/lib/backup.ts) (`SECTION_SHAPE`, `parseBackup`, `writeUserData`) recorre `USER_DATA_KEYS`.
- Sincronización: [`src/lib/sync.ts`](../../../src/lib/sync.ts), [`src/lib/auth.tsx`](../../../src/lib/auth.tsx) y [`src/lib/syncMigration.ts`](../../../src/lib/syncMigration.ts) recorren `USER_DATA_KEYS` (`hasUserData` tiene su propia lista). El servidor repite las claves en `SYNC_KEYS` ([`server/lib/sync.ts:4`](../../../server/lib/sync.ts)), con un test que comprueba que son nueve; una clave desconocida para el servidor devuelve 400.
- Estado: `AppProvider` en [`src/lib/store.tsx`](../../../src/lib/store.tsx), con `usePersisted` por clave y `toggleFavorite` como modelo.
- Página Recetas: [`src/app/recetas/page.tsx`](../../../src/app/recetas/page.tsx) (486 líneas) calcula `results` con ítem enfocado → «Usa lo que tengo» → búsqueda, y oculta el bloque de destacadas con `filtersActive`. `searchRecipes` y `sortByName` están en [`src/lib/recipeSearch.ts`](../../../src/lib/recipeSearch.ts); `allergenWarning`/`recipeViolations` en [`src/lib/allergens.ts`](../../../src/lib/allergens.ts).
- Catálogo (107 recetas): tiempo ≤15/30/45 min deja 41/81/100; proteína ≥20/30/40 g deja 89/68/21; kcal ≤400 deja 48 y ≤600 deja 104.

## Approaches considered
### A. Clave `ratings` + módulo puro `recipeFilters.ts` (chosen)
Valoraciones como `Record<string, 1|2|3|4|5>` en `mp_<id>_ratings`; filtros y orden como funciones puras que `page.tsx` invoca. **Pros:** separa los datos del usuario del catálogo (#42), repite el patrón de `favorites`, es fácil de testear. **Cons:** toca userData, backup, store, syncMigration y el servidor. **Effort** M.
### B. Campo `rating` en cada `Recipe`
Sin clave nueva. **Cons:** mezcla datos del usuario con el catálogo que #42 quiere separar. Descartada.
### C. `ratings` dentro de la clave `favorites`
Evita tocar el servidor. **Cons:** mezcla dos conceptos y cambia un formato ya sincronizado. Descartada.

Elegida A por el usuario, que coincide con la recomendación de Claude.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Datos | `src/lib/userData.ts` | `ratings` en `USER_DATA_KEYS`, `UserData`, `EMPTY_USER_DATA` y `LOAD_OPTIONS`, con `sanitizeRatings` |
| Copia | `src/lib/backup.ts` | `SECTION_SHAPE.ratings` (objeto id → 1–5), `parseBackup`/`writeUserData` incluyen la clave; textos con el número de secciones |
| Estado | `src/lib/store.tsx` | `ratings`, `setRating(id, n)` (misma nota la quita), poda de ids desconocidos, recarga en `importData` |
| Sync cliente | `src/lib/syncMigration.ts` | `hasUserData` incluye `ratings` |
| Sync servidor | `server/lib/sync.ts`, `server/tests/unit/sync-routes.test.ts` | `SYNC_KEYS` pasa a diez claves |
| Lógica | `src/lib/recipeFilters.ts` (nuevo) | `filterRecipes`, `sortRecipes`, constantes de tramos |
| UI | `src/components/recetas/RatingStars.tsx`, `RatingBadge.tsx`, `RecipeFilters.tsx` (nuevos) | Puntuar, mostrar y panel de filtros |
| Recetas | `src/app/recetas/page.tsx`, `src/components/recetas/RecipeCard.tsx` | Estado de filtros y orden, integración con el pipeline actual, nota en tarjeta y detalle |
| Tests | `tests/unit/`, `tests/e2e/`, `tests/fixtures/` | Ver Testing strategy |

### Data model
`ratings: Record<string, number>` con ids de receta y valores enteros de 1 a 5, en la clave `mp_<id>_ratings`. `sanitizeRatings` descarta lo que no sea objeto, ids vacíos y valores fuera de 1–5 o no enteros; los ids de recetas que ya no existen se limpian al guardar (store), como en `favorites`. Sin migración: la clave ausente es `{}`. `BACKUP_SCHEMA_VERSION` sigue en 1: una copia antigua sin `ratings` queda vacía y una app antigua ignora la clave nueva. Filtros y orden son estado de página, no se persisten.

### APIs / interfaces
- `AppState`: `ratings: Record<string, number>` y `setRating(id: string, n: number): void` (si `n` es la nota actual, la quita).
- Tramos (constantes exportadas): `TIME_STEPS = [15, 30, 45]`, `KCAL_STEPS = [300, 400, 500]`, `PROTEIN_STEPS = [20, 30, 40]`.
- `RecipeFilterState = { maxTime: number | null; maxKcal: number | null; minProtein: number | null; hideAllergens: boolean }` y `type SortKey = "name" | "protein" | "kcal" | "time" | "rating"`.
- `filterRecipes(recipes, state, allergies)`: aplica tiempo (`prepTimeMinutes` ≤), kcal (≤), proteína (≥) y, si `hideAllergens`, quita las recetas con `recipeViolations` no vacío; el valor ausente cuenta como 0.
- `sortRecipes(recipes, key, ratings)`: `name` A–Z; `protein` descendente; `kcal` y `time` ascendentes; `rating` descendente con las sin nota al final; empate siempre por nombre (`localeCompare` «es»).
- `countActiveFilters(state): number` para el botón «Filtros (N)».
- Pipeline de `page.tsx`: ítem enfocado → «Usa lo que tengo» (su ranking manda y el orden elegido no se aplica) → filtros → favoritas/temporada → búsqueda → orden.

### UI
- `RatingStars` (detalle): 5 botones de ≥44 px con `aria-label` «Valorar <receta> con N estrellas» y `aria-pressed` en la nota actual; icono de estrella distinto del de favorita (por ejemplo `Star` en acento de valoración frente a `Heart`/estrella de favorita según la convención actual: dev-code lo verifica en `FavoriteStar.tsx`).
- `RatingBadge` (tarjeta y detalle): «4★» con texto accesible «Valoración 4 de 5»; no renderiza nada sin nota.
- `RecipeFilters`: botón «Filtros (N)» (`aria-expanded`) que abre un panel con tres grupos de chips (tiempo, kcal, proteína; uno activo por grupo, `aria-pressed`), el interruptor «Ocultar mis alérgenos» (solo si el perfil tiene alergias), el `<select>` «Ordenar por» y «Quitar filtros» (limpia solo los cuatro filtros, no búsqueda ni orden). Los chips actuales «Usa lo que tengo», «Solo favoritas» y «De temporada» se quedan fuera del panel.
- `filtersActive` en `page.tsx` pasa a incluir filtros nuevos y orden distinto de A–Z. El estado vacío existente añade el caso «Ningún resultado con los filtros: Tiempo ≤30 min · …» con botón «Quitar filtros».

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `RatingStars` en el detalle y `setRating` (la misma nota la quita) |
| R2 | Clave `ratings` por usuario en `USER_DATA_KEYS`, `SYNC_KEYS`, backup y `hasUserData`; `sanitizeRatings` y poda de ids huérfanos |
| R3 | `filterRecipes` con los tramos, combinado en el pipeline con búsqueda y filtros existentes |
| R4 | `hideAllergens` con `recipeViolations`; interruptor solo con alergias en el perfil |
| R5 | `sortRecipes` y `<select>` «Ordenar por»; «Usa lo que tengo» manda sobre el orden |
| R6 | `RatingBadge` en `RecipeCard` y en el detalle |
| R7 | `RecipeFilters` con contador, «Quitar filtros» y estado vacío; `filtersActive` ampliado |

## Risks & mitigations
- **Cliente desplegado antes que el servidor:** el servidor responde 400 a la clave `ratings` y, por [#122](https://github.com/mancabcar/MealPlan/issues/122), un 400 detiene la subida de las demás claves. Mitigación adoptada: desplegar primero el servidor y anotarlo en el PR; #122 sigue como seguimiento.
- **Conflicto con #42** en `userData.ts`, `store.tsx` y `syncMigration.ts`. Mitigación adoptada: avanzar en paralelo y rebasar sobre `main` cuando #42 se fusione; los cambios son de una línea por fichero.
- **Lista de claves repetida en el servidor:** olvidar una de las dos listas rompe la sincronización. Mitigación: un test fija diez claves en el servidor y comprueba que coinciden con `USER_DATA_KEYS`.
- **Tramos poco útiles en recetas propias o de IA:** aceptado; se calibraron con el catálogo (kcal ≤300/400/500) y se pueden ajustar sin tocar la lógica.
- **Valoraciones huérfanas** (receta borrada): se ignoran y se limpian al guardar. Aceptado.

## Testing strategy
- **Unitarios (vitest):** `sanitizeRatings`; backup (copia nueva, antigua sin `ratings`, sección malformada); `filterRecipes` y `sortRecipes` (combinaciones, empates por nombre, sin nota al final, valor ausente como 0, alérgenos); store `setRating` (cambiar, quitar, aislamiento por usuario, poda); clave `ratings` en `USER_DATA_KEYS` y `SYNC_KEYS` (diez, coincidentes); reparto de recetas del catálogo por tramo.
- **e2e (playwright):** valorar y recargar; dos usuarios sin mezclarse; exportar e importar con notas; flujo ≤3 toques (≤30 min y ≥30 g); alérgenos con y sin interruptor y sin alergias; orden por valoración y por proteína; «Usa lo que tengo» con orden elegido; vacío con «Quitar filtros»; destacadas ocultas; axe en el panel.
- Cada criterio de aceptación del spec se cubre con al menos uno de estos tests. Los tests se escriben antes del código con dev-test.

## Tasks
1. [ ] Datos de `ratings`: `userData.ts`, `backup.ts`, `store.tsx`, `syncMigration.ts` y `SYNC_KEYS` del servidor, con sus tests unitarios (covers R2)
2. [ ] `src/lib/recipeFilters.ts` con tramos, alérgenos y orden, con tests unitarios (covers R3, R4, R5)
3. [ ] `RatingStars` y `RatingBadge` en el detalle y la tarjeta (covers R1, R6)
4. [ ] Panel `RecipeFilters` con contador, orden y estado vacío, integrado en `page.tsx` (covers R3, R4, R5, R7)

## Spec feedback
- R3: los tramos de kcal pasan de ≤400/600/800 a ≤300/400/500, porque ≤600 y ≤800 dejaban 104 y 107 de 107 recetas. Decidido por el usuario el 2026-10-05; `spec.md` actualizado.
- Pendiente (no bloquea el diseño): decidir con #42 cuál se fusiona primero antes de codificar (se acordó avanzar en paralelo y rebasar).

## UI test contract
Los tests de dev-test (`tests/e2e/valoracion-filtros.spec.ts`) fijan estos nombres accesibles; dev-code los implementa tal cual:
- Detalle: cinco botones «Valorar <receta> con N estrellas» (N = 1…5), de ≥44 px, con `aria-pressed` en la nota actual; tocar la actual la quita.
- Nota visible en tarjeta y detalle: texto «Valoración N de 5» dentro de la tarjeta (su botón); sin nota no se renderiza nada.
- Botón «Filtros» (o «Filtros (N)» con N filtros activos de tiempo, kcal, proteína y alérgenos) con `aria-expanded`; el panel está cerrado por defecto y los chips no existen en el DOM mientras está cerrado.
- Chips (`button` con `aria-pressed`, uno activo por tipo): «≤15 min», «≤30 min», «≤45 min», «≤300 kcal», «≤400 kcal», «≤500 kcal», «≥20 g», «≥30 g», «≥40 g».
- Interruptor `role="switch"` «Ocultar mis alérgenos» con `aria-checked`; solo existe si el perfil tiene alergias.
- Select con etiqueta «Ordenar por» y opciones, por este orden, «A–Z», «Proteína», «Calorías», «Tiempo», «Valoración»; por defecto «A–Z». Está dentro del panel.
- Botón «Quitar filtros» (dentro del panel y en el estado vacío). Con algún filtro de los cuatro activo y cero resultados, el mensaje es «Ninguna receta coincide con los filtros» (gana sobre el «Sin resultados para …» de la búsqueda); sin esos filtros, los mensajes actuales no cambian.
- «Quitar filtros» limpia solo tiempo, kcal, proteína y alérgenos; no toca la búsqueda ni el orden.
- El bloque «Destacadas este mes» (región) se oculta con cualquier filtro, orden distinto de A–Z, búsqueda o «Solo favoritas»/«De temporada»/«Usa lo que tengo».
- Filtros y orden son estado de la página: al salir de Recetas y volver están restablecidos.

## Test coverage
Tests actualizados por el cambio de nueve a diez claves (mecánico, acordado con el usuario): `tests/unit/backup.test.ts`, `backup-water.test.ts`, `sync-engine.test.ts`, `sync-migration.test.ts`, `server/tests/unit/sync-routes.test.ts`, y los fixtures `tests/fixtures/backup.ts` (`ratings` en `ACCOUNT_A_DATA`) y `fakeSyncBackend.ts`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/store-ratings.test.tsx › «R1: setRating» | unit | 🔴 failing (not built) |
| R1 | tests/e2e/valoracion-filtros.spec.ts › «R1: puntuar en el detalle» (2) | e2e | 🔴 failing (not built) |
| R2 | tests/unit/ratings.test.ts › sanitizeRatings, clave `ratings`, SYNC_KEYS del servidor y copia de seguridad | unit | 🔴 failing (not built) |
| R2 | tests/unit/store-ratings.test.tsx › «R2: persistencia por usuario» e «importData» | unit | 🔴 failing (not built) |
| R2 | tests/unit/backup.test.ts, backup-water, sync-engine, sync-migration y server/tests/unit/sync-routes.test.ts (diez claves) | unit | 🔴 failing (not built; backup y servidor) |
| R2 | tests/e2e/valoracion-filtros.spec.ts › «R2: persistencia, aislamiento y copia de seguridad» (5) | e2e | 🔴 failing (not built) |
| R3 | tests/unit/recipe-filters.test.ts › «R3: tramos» y «R3: filterRecipes» | unit | 🔴 failing (not built) |
| R3 | tests/e2e/valoracion-filtros.spec.ts › «R3: filtros…» (4, incluye ≤3 toques) | e2e | 🔴 failing (not built) |
| R4 | tests/unit/recipe-filters.test.ts › «R4: ocultar alérgenos» | unit | 🔴 failing (not built) |
| R4 | tests/e2e/valoracion-filtros.spec.ts › «R4: ocultar mis alérgenos» (2) | e2e | 🔴 failing (not built) |
| R5 | tests/unit/recipe-filters.test.ts › «R5: sortRecipes» | unit | 🔴 failing (not built) |
| R5 | tests/e2e/valoracion-filtros.spec.ts › «R5: orden» (5, incluye «Usa lo que tengo») | e2e | 🔴 failing (not built) |
| R6 | tests/e2e/valoracion-filtros.spec.ts › «R6: la nota se ve…» (2) | e2e | 🔴 failing (not built) |
| R7 | tests/unit/recipe-filters.test.ts › «R7: countActiveFilters» | unit | 🔴 failing (not built) |
| R7 | tests/e2e/valoracion-filtros.spec.ts › «R7: panel de filtros, vacío y reinicio» (4) y axe | e2e | 🔴 failing (not built) |
