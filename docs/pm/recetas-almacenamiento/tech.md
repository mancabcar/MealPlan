# Separar el catálogo de recetas de las del usuario: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
El catálogo se importa del JSON del bundle como constante (`src/lib/catalog.ts`) y deja de copiarse a `localStorage`. `usePersisted("recipes")` guarda solo las recetas del usuario: la carga migra quitando las de id del catálogo y las retiradas. `AppProvider` expone `recipes = [...CATALOG, ...userRecipes]`, así que las páginas no cambian. Esfuerzo: S–M (unas 5 tareas pequeñas; el grueso es reescribir tests que asumían el catálogo guardado).

## Context
- `src/lib/userData.ts`: `withSeedRecipes` es el `upgrade` de `LOAD_OPTIONS.recipes`. Quita `RETIRED_RECIPE_IDS` y añade las recetas del JSON cuyo id falta. La carga (`load` en `store.tsx`) reescribe `localStorage` si el resultado difiere de lo guardado.
- `src/lib/store.tsx`: `usePersisted(k("recipes"), LOAD_OPTIONS.recipes, dirty("recipes"))` y las acciones `addRecipes`, `saveRecipe` y `removeRecipe` (esta última lee `recipes` para buscar la receta y limpia entradas, plan y favoritos).
- `src/lib/backup.ts`: `buildBackup` lee las claves tal cual de `localStorage`; `parseBackup` aplica `LOAD_OPTIONS[k].upgrade` (R7 de backup-datos), así que una copia pasa por la misma migración que la carga.
- `src/lib/syncMigration.ts`: `hasUserData` usa `withSeedRecipes([])` para saber qué ids son de ejemplo.
- `src/lib/migrate.ts`: `RETIRED_RECIPE_IDS` (3 ids) y `migrateEntries` / `migrateWeekPlan`, que reescriben `recipeId` al id que se queda.
- Los consumidores (`src/app/plan/page.tsx`, `src/lib/diary.ts`, `src/lib/planMacros.ts`, `src/lib/shopping/aggregate.ts`) buscan la receta por id y ya saltan una ausente; el hueco del Plan se muestra como "Añadir".
- Ids: catálogo `recipe_*`, IA `ai_<sufijo>_<i>` (`server/app/api/recipes/route.ts:65`), propias `custom_<uuid>` (`src/components/recetas/RecipeForm.tsx`). No colisionan entre sí.
- Next 16 no entra en juego: es lógica de `src/lib` y el store cliente, sin APIs del framework.

## Approaches considered
### A. Derivar en AppProvider (chosen)
`catalog.ts` exporta `CATALOG`; el almacén guarda solo lo del usuario; `AppProvider` calcula `recipes` con `useMemo`. **Pros:** las páginas no cambian; `saveRecipe` / `removeRecipe` / `addRecipes` siguen operando sobre una sola lista (la guardada); el sync y el backup ven solo recetas del usuario. **Cons:** la migración de `LOAD_OPTIONS.recipes` cambia de significado y obliga a reescribir los tests que asumían el catálogo guardado. **Effort** S–M.
### B. Dos listas en el contexto
Exponer `catalogRecipes` y `userRecipes` y que cada página decida. **Pros:** más explícito para #18 y #20. **Cons:** toca todas las páginas que leen `recipes`. **Effort** M.
### C. Filtrar al escribir, guardar la lista mezclada
Descartada: rompe con las relecturas del sync y duplica lógica.

Elegida A por el usuario: la recomendación de Claude coincidía.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Catálogo | `src/lib/catalog.ts` (nuevo) | `CATALOG: Recipe[]` (el JSON tipado) y `CATALOG_IDS: ReadonlySet<string>`. Única importación de `src/data/recipes.json` en la app. |
| Migración | `src/lib/userData.ts` | `withSeedRecipes` se sustituye por `userRecipes(raw)`: descarta las de `RETIRED_RECIPE_IDS` y las de `CATALOG_IDS`, conserva el resto. `LOAD_OPTIONS.recipes.upgrade = userRecipes`. Idempotente. |
| Store | `src/lib/store.tsx` | `usePersisted` guarda `userRecipes`; el contexto expone `recipes = useMemo(() => [...CATALOG, ...userRecipes], [userRecipes])`. Las acciones operan sobre `userRecipes`; `removeRecipe` busca en la lista mezclada, como hoy. |
| Sync | `src/lib/syncMigration.ts` | `hasUserData` usa `CATALOG_IDS` en vez de `withSeedRecipes([])`. |
| Backup | `src/lib/backup.ts` | Sin cambios de formato (`BACKUP_SCHEMA_VERSION` sigue en 1). `buildBackup` exporta ya solo lo guardado; `parseBackup` aplica `userRecipes` vía `LOAD_OPTIONS`. Solo se actualiza algún comentario. |
| Tests | `tests/unit/backup.test.ts`, `migrate.test.ts`, `sync-migration.test.ts`, `store-recipes.test.tsx`, `tests/fixtures/backup.ts` | Dejan de asumir el catálogo guardado. |
| Tests nuevos | `tests/unit/catalog-ids.test.ts`, `tests/e2e/recetas-catalogo.spec.ts` | Ver Testing strategy. |
| Docs | `docs/pm/recetas-almacenamiento/spec.md`, `brief.md` | R7 relajado, ids de IA resueltos. |

### Data model
- `Recipe` no cambia.
- `mp_<userId>_recipes` pasa de «catálogo + IA + propias» a «IA + propias». La migración es la propia carga (idempotente): la clave se reescribe en el primer inicio de la nueva versión, sin copia `*_v1_backup` (como hoy, `recipes.backup` es falso).
- El servidor (#22) conserva las 107 hasta que el usuario guarde una receta; no se marca la clave como pendiente tras migrar (decisión del usuario).
- Precedencia por id: fuera de alcance. Si un día se edita in situ, una receta del usuario con id del catálogo será una decisión nueva.

### APIs / interfaces
- `catalog.ts`: `CATALOG`, `CATALOG_IDS`.
- `userData.ts`: `userRecipes(raw: unknown): Recipe[]` (sustituye a `withSeedRecipes`).
- `useApp().recipes`: misma firma que hoy (catálogo + usuario).

### UI
Ninguna pantalla cambia. El hueco huérfano del Plan sigue mostrando "Añadir".

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `CATALOG` se importa del JSON en cada carga; `recipes` se deriva en `AppProvider`. |
| R2 | `LOAD_OPTIONS.recipes.upgrade = userRecipes` descarta el catálogo; `addRecipes` / `saveRecipe` solo escriben en el almacén del usuario. |
| R3 | `userRecipes` filtra por `CATALOG_IDS` y `RETIRED_RECIPE_IDS`, aunque el contenido difiera; idempotente. |
| R4 | `buildBackup` exporta lo guardado, que ya es solo del usuario. |
| R5 | `parseBackup` pasa cada copia por `LOAD_OPTIONS` (R7 de backup-datos): una copia antigua pierde el catálogo y no duplica. |
| R6 | `recipes` mezclado igual que antes; `migrateEntries` / `migrateWeekPlan` y favoritos no cambian. |
| R7 (relajado) | Ya se cumple: los consumidores saltan la receta ausente y el Plan muestra "Añadir"; se fija con un test. |

## Risks & mitigations
- **Un id del catálogo que se borra del JSON deja huecos huérfanos.** Mitigación (aceptada): regla de contenido (retirar con alias en `RETIRED_RECIPE_IDS`) más `tests/unit/catalog-ids.test.ts` con la lista congelada de ids: falla si falta uno que no esté en `RETIRED_RECIPE_IDS`.
- **Dispositivo con la app antigua en sincronización.** Aceptado: resiembra y sube el catálogo; la app nueva lo vuelve a quitar al cargar (idempotente). Sin `markDirty` tras migrar.
- **Tests existentes que fijan el catálogo guardado** (`backup.test.ts:157`, `:168`, `:298`, `:332`; `sync-migration.test.ts`). Mitigación: tarea 2.
- **Copia nueva importada en la app antigua.** Funciona: la siembra antigua completa el catálogo; por eso `schemaVersion` no sube.
- Irreversible: no hay nada irreversible; el catálogo se puede volver a sembrar con el código anterior.

## Testing strategy
- **Unit (`userRecipes`)**: catálogo + 2 IA + 1 propia → quedan 3 (R3); segunda carga no cambia nada; receta con id del catálogo y contenido distinto → se quita; retiradas se quitan; `null` / lista vacía → `[]`.
- **Unit (store)**: `recipes` = catálogo + usuario; `addRecipes`, `saveRecipe` y `removeRecipe` no escriben el catálogo en `localStorage`; un catálogo distinto (se simula con otro `CATALOG` en el test) se refleja sin migrar (R1).
- **Unit (backup)**: exportar → solo usuario (R4); importar copia antigua con catálogo → sin duplicados y con las del usuario (R5); importar copia nueva.
- **Unit (sync-migration)**: `hasUserData` ignora el catálogo y detecta una receta del usuario.
- **Unit (`catalog-ids`)**: lista congelada de ids.
- **E2E (`recetas-catalogo.spec.ts`, modelo `retired-recipes.spec.ts`)**: cuenta con catálogo guardado + IA + propia migra; plan, diario, favoritos y compra quedan igual (R3, R6); un hueco del plan con id huérfano se muestra como "Añadir" (R7).

## Tasks
1. [ ] `catalog.ts`, `userRecipes` como migración del almacén y `AppProvider` que deriva `recipes`; tests unitarios de `userRecipes` y del store (covers R1, R2, R3, R6).
2. [ ] `hasUserData` con `CATALOG_IDS`; reescribir tests y fixtures de backup y sync que asumían el catálogo guardado (covers R4, R5).
3. [ ] `tests/unit/catalog-ids.test.ts` con la lista congelada de ids.
4. [ ] E2E de migración de una cuenta real y del hueco huérfano (covers R3, R6, R7).
5. [ ] Actualizar `spec.md` (R7 relajado, ids de IA resueltos) y el brief.

Sin flag: el cambio es interno y la migración es idempotente.

## Spec feedback
- **R7 relajado** (decisión del usuario): se quita la etiqueta "Receta no disponible"; basta con el comportamiento actual (el hueco muestra "Añadir") fijado con un test. Pendiente de editar `spec.md` en la tarea 5.
- **Ids de IA repetidos**: resuelto, no es un riesgo: el servidor genera `ai_<sufijo>_<i>`. Pendiente de quitar de las preguntas abiertas de `spec.md` y de corregir el edge case.
- **`schemaVersion`**: se queda en 1 (decisión del usuario).
- **Dispositivo antiguo en sincronización**: basta la idempotencia, sin `markDirty` (decisión del usuario).
