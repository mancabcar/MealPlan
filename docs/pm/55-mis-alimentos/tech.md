# Favoritos en «Añadir comida»: Technical design
_Status: Draft · Updated: 2026-10-10_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Una clave de datos nueva, `mealFavorites`, guarda las personalizadas y los alimentos favoritos. Las recetas favoritas siguen en `favorites` (#20). Un módulo puro (`src/lib/mealFavorites.ts`) concentra la lógica: guardar desde una entrada, registrar, ordenar por frecuencia, ocultar en Recientes y quitar duplicados. «Añadir comida» gana una sección `FavoriteMeals` y una fila compartida con ☆, y el formulario de Personalizada sale de `page.tsx` para reutilizarse al editar. Esfuerzo: **M**, 8 tareas.

## Context
- «Añadir comida» vive entero en `src/app/page.tsx` (587 líneas): selector de franja, `RecentMeals`, pestañas, `FoodPicker`, `RecipePicker` y el formulario de Personalizada en línea.
- Recientes se deriva de `entries` en cada render (`recentMeals` y `recentKey`, en `src/lib/diary.ts`); no se guarda nada.
- Recetas favoritas: `favorites: string[]` en el store (`toggleFavorite`; `removeRecipe` las limpia) y `groupRecipes` (`src/lib/recipeSlots.ts`) las filtra por franja.
- Persistencia: cada clave de `USER_DATA_KEYS` (`src/lib/userData.ts`) tiene `LOAD_OPTIONS` y `usePersisted` en `src/lib/store.tsx`. Se sincroniza un bloque por clave: la última escritura gana y un 409 adopta la versión del servidor (`src/lib/sync.ts`). La copia de seguridad (`src/lib/backup.ts`) recorre la misma lista y valida con `SECTION_SHAPE`. El servidor acepta solo las claves de `SYNC_KEYS` (`server/lib/sync.ts`); con cualquier otra responde 400.
- Alimentos (#13): `foodEntry(food, date, mealType, {grams, units})` calcula los macros desde `per100`; la entrada guarda `foodId`, `grams` y `units`, pero no `per100`.
- `Toast` (`src/components/ui/Toast.tsx`) se cierra solo a los 10 s.

## Approaches considered
### A. Una clave nueva `mealFavorites` (chosen)
Una lista con dos tipos (`custom` | `food`); las recetas siguen en `favorites`. Pasamos de 9 a 10 claves. **Pros:** es el mínimo que cumple R6 y no toca el contrato de #20. **Cons:** hay que tocar los tests que cuentan 9 claves. **Effort:** M. Elegida por el usuario (también la recomendación).
### B. Dos claves (`customFavorites`, `foodFavorites`)
Cada una se valida de forma más sencilla, pero hay el doble de código repetido en store, sync y copia sin ventaja real.
### C. Ampliar `favorites` con objetos
Descartada: `sanitizeFavorites` e `isStringList` tiran lo que no es string, así que un dispositivo con la versión anterior borraría las personalizadas y volvería a subir la lista vacía.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica pura | `src/lib/mealFavorites.ts` (nuevo) | Tipos, `sanitizeMealFavorites`, `favoriteFromEntry`, `favoriteEntry`, `upsertCustom`, `rankFavorites`, `hiddenInRecents`, `customNameKey` |
| Recientes | `src/lib/diary.ts` | `recentMeals` acepta `exclude?: (e: MealEntry) => boolean` (R7); `recentKey` no cambia |
| Datos | `src/lib/userData.ts` | `mealFavorites` en `USER_DATA_KEYS`, `UserData`, `EMPTY_USER_DATA` y `LOAD_OPTIONS` |
| Sync servidor | `server/lib/sync.ts` | `"mealFavorites"` en `SYNC_KEYS` (10) |
| Copia | `src/lib/backup.ts` | `SECTION_SHAPE.mealFavorites` (array de objetos con `id` y `kind`) y `upgrade("mealFavorites")` en `parseBackup` |
| Store | `src/lib/store.tsx` | `usePersisted` y recarga de la clave, en `importData` y `reloaders`; acciones `saveMealFavorite`, `removeMealFavorite` y `setMealFavorites` (para Deshacer) |
| Migración sync | `src/lib/syncMigration.ts` | `mealFavorites` en `hasUserData` |
| Aviso | `src/components/ui/Toast.tsx` | `durationMs: number \| null`; con `null` no se cierra solo |
| Fila | `src/components/diario/MealRow.tsx` (nuevo) | Fila de toque completo + botón ☆/★ aparte a la derecha (opcional) + lápiz en modo Editar |
| Recientes | `src/components/diario/RecentMeals.tsx` | Usa `MealRow` y recibe `onStar`; sin ☆ en filas de receta con `servings ≠ 1` |
| Favoritos | `src/components/diario/FavoriteMeals.tsx` (nuevo) | Sección: pista (R10), 5 filas + «Ver todos (N)» (R9), «Editar» con lápices, ★ para quitar |
| Personalizada | `src/components/diario/CustomMealForm.tsx` (nuevo) | Formulario extraído de `page.tsx`: modo `add` (con la casilla «Guardar en favoritos») y modo `edit` («Guardar cambios», «Quitar de favoritos») |
| Cantidad | `src/components/diario/FoodQuantityForm.tsx` (nuevo) | Gramos o unidades de un alimento favorito (R12), con la validación de `FoodPicker` |
| Página | `src/app/page.tsx` | Conecta todo; estado `favNotice` y reseteos |

### Data model
```ts
// src/lib/mealFavorites.ts
export type MealFavorite =
  | { id: string; kind: "custom"; name: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number }
  | { id: string; kind: "food"; foodId: string; name: string; grams: number; units?: number; per100: Per100 };
```
- Clave `mp_<userId>_mealFavorites` con `MealFavorite[]`. La sincronización y la copia la recogen al estar en `USER_DATA_KEYS`.
- `sanitizeMealFavorites(raw)` es la función `upgrade` de `LOAD_OPTIONS`. Descarta los elementos mal formados: sin id, con `kind` desconocido, con números no finitos, `grams ≤ 0` o un `per100` incompleto. No guarda copia `*_v1_backup`. Una copia o un dispositivo sin la clave dejan la lista vacía (R6).
- Un alimento favorito guardado desde Recientes calcula `per100 = macro × 100 / grams` de la entrada (también la fibra, si existe). Si la entrada no tiene `grams > 0`, la fila no lleva ☆.
- Identidad para quitar duplicados, ocultar en Recientes y contar frecuencia:
  - personalizada: `customNameKey(name)`, el nombre recortado, con los espacios colapsados y en minúsculas;
  - alimento: `foodId` + `units` o `grams` (como `recentKey`);
  - receta: `recipeId`.

### APIs / interfaces
- `favoriteFromEntry(entry): MealFavorite | null`: una personalizada o un alimento; `null` para recetas o datos raros.
- `favoriteEntry(fav, date, mealType): MealEntry`: una personalizada copia nombre, macros y fibra; un alimento usa `foodEntry({foodId, name, per100}, …, {grams, units})`.
- `upsertCustom(list, fav): MealFavorite[]`: si ya hay una personalizada con el mismo `customNameKey`, actualiza sus datos y conserva su `id` (R2); si no, añade la nueva.
- `rankFavorites({ items, recipeIds, recipes, entries, mealType })`: devuelve `RankedFavorite[]` (`{ key, name, fav | recipe }`). Las recetas que no existen o que no son de la franja (filtro de `groupRecipes`/`slotTagsOf`) no aparecen. Orden:
  1. número de entradas que coinciden en la franja, de más a menos;
  2. a igualdad, la última entrada en la franja, la más reciente primero;
  3. sin entradas en la franja: la última entrada en cualquier franja;
  4. nunca registrados: el último guardado primero.
  
  Una sola pasada por `entries`.
- `hiddenInRecents(items, recipeIds): (e: MealEntry) => boolean` oculta en Recientes (R7):
  - personalizadas por nombre, sean cuales sean los macros;
  - alimentos por alimento y cantidad;
  - recetas solo con `servings` 1.
- Store: `saveMealFavorite(fav)` (upsert por `id`, o por nombre si es una personalizada), `removeMealFavorite(id)` y `setMealFavorites(list)`. Recetas: `toggleFavorite`, sin cambios.

### UI
Orden dentro de «Añadir comida»: franja → `FavoriteMeals` → `RecentMeals` → pestañas (artboards 1–6).
- **Registrar (R1):** un toque en una fila de Favoritos añade la entrada (`favoriteEntry`, o `recipeEntry` con 1 ración) y cierra «Añadir comida», con `singleClick` y sin fecha no hace nada, como Recientes.
- **☆ en Recientes (R2, R11):**
  - personalizada o alimento: `saveMealFavorite(favoriteFromEntry(e))`;
  - receta × 1: `toggleFavorite`.
  
  Sale el aviso «Guardado en Favoritos · Deshacer».
- **Casilla (R3):** está en `CustomMealForm`, justo encima de Añadir. Si el formulario es válido, se registra y se hace `upsertCustom`; el aviso del Diario dice «Añadido a <franja> · guardado en Favoritos» (el Toast `added` actual, sin Deshacer de favorito).
- **«Editar» (R4, R5, R12):** se abre junto al título y despliega la lista completa con lápiz en personalizadas y alimentos.
  - El lápiz de una personalizada abre `CustomMealForm` en modo `edit` dentro de la sección. Si el nombre ya es de otra favorita: «Ya tienes un favorito con ese nombre».
  - El lápiz de un alimento abre `FoodQuantityForm`.
  - Las recetas solo llevan ★.
- **Avisos `favNotice`:** `Toast` con `durationMs={null}`, pintado solo con `showAdd`. Guarda la instantánea anterior (`mealFavorites` y `favorites`); Deshacer la restaura con `setMealFavorites` y `toggleFavorite`. Solo hay un aviso a la vez: `favNotice` anula `added` y `copied`, y al revés.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `FavoriteMeals` entre la franja y Recientes, fuera del condicional de pestaña; `favoriteEntry` / `recipeEntry(…, 1)` |
| R2 | ☆ en `MealRow`; `favoriteFromEntry` + `upsertCustom`; recetas con `toggleFavorite` (la misma lista de #20) |
| R3 | Casilla en `CustomMealForm`, que se resetea tras cada registro y al abrir |
| R4 | `CustomMealForm` en modo `edit` + `saveMealFavorite`; no toca `entries` |
| R5 | ★ y «Quitar de favoritos» → `removeMealFavorite` / `toggleFavorite` + aviso con Deshacer por instantánea |
| R6 | La clave en `USER_DATA_KEYS`, `SYNC_KEYS`, `SECTION_SHAPE` y `hasUserData` |
| R7 | `recentMeals({ exclude: hiddenInRecents(...) })`; el `slice(limit)` va después del filtro |
| R8 | `rankFavorites` |
| R9 | `FavoriteMeals`: 5 + «Ver todos (N)», con N contado tras el filtro de franja |
| R10 | Pista si `rankFavorites` devuelve 0 |
| R11 | `favNotice` sin temporizador; Deshacer restaura la instantánea |
| R12 | `FoodQuantityForm` (Could, incluido) |
| R13 | Fuera de esta entrega (follow-up) |

## Risks & mitigations
- **Orden de despliegue (aceptado):** el servidor responde 400 a una clave que no conoce. **El servidor se despliega antes que el cliente estático**, y se apunta en el PR. Si se invierte el orden, la clave queda «sin sincronizar» en local, sin perder datos, hasta que el servidor se actualice.
- **Dispositivo con la versión anterior:** no conoce la clave. Ni la lee ni la sube, así que no la pisa.
- **Edición concurrente:** el bloque entero gana por la última escritura, igual que el resto de claves (aceptado por el spec).
- **`page.tsx` grande:** extraer `CustomMealForm` cambia el formulario actual. Los tests existentes de Personalizada deben seguir pasando sin cambios.
- **Tests que cuentan 9 claves** (`tests/unit/backup*.test.ts`, `sync-engine.test.ts`, `server/tests/unit/sync-routes.test.ts`) pasan a 10.

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| «Ver todos» desplegado | Se pliega al cambiar de franja y al cerrar | `key={mealType}` en la lista de `FavoriteMeals` |
| Modo «Editar» y formulario de edición abierto | Siguen al cambiar de franja; se resetean al cerrar | Estado en `FavoriteMeals`, que se desmonta con `showAdd` |
| Casilla «Guardar en favoritos» | Desmarcada al abrir y tras cada registro | Reset en `openAdd` y en `submitAdd` |
| `favNotice` | Se va al cerrar «Añadir comida» con el cambio hecho; lo anula otro aviso | `setFavNotice(null)` al cerrar o cancelar; un solo aviso |
| Fecha borrada (`""`) | Tocar un favorito no añade nada | La misma guarda que Recientes |
| Sin favoritos | Pista (R10) | — |
| Receta favorita borrada o de otra franja | No aparece; no cuenta en N | Filtro en `rankFavorites` |
| Fila de receta × 0,5 en Recientes | Sin ☆; sigue visible aunque la receta sea favorita | `MealRow` sin `onStar` |
| Entrada de alimento sin `grams > 0` | Sin ☆ | `favoriteFromEntry` → `null` |
| Personalizada con el mismo nombre (otro uso de mayúsculas o espacios) | Actualiza la existente (R2); en la edición, error de nombre (R4) | `customNameKey` |
| Deshacer tras una actualización por nombre | Vuelve a los macros anteriores | Instantánea |
| Datos importados o editados a mano con `NaN`, sin id o con `kind` raro | Se descarta ese elemento | `sanitizeMealFavorites` |
| Copia antigua sin `mealFavorites` | Se importa; la lista queda vacía | `upgrade(undefined)` → `[]` |
| Fibra ausente en el favorito | Entrada sin `fiber` («sin dato») | `favoriteEntry` no añade el campo |
| Alimento OFF sin conexión | Se registra desde `per100` guardado | Sin red |

## Testing strategy
- **Unit (Vitest):**
  - `tests/unit/mealFavorites.test.ts`: sanitize, `favoriteFromEntry` (per100 y fibra), `favoriteEntry` (= `foodEntry`), `upsertCustom`, `rankFavorites` (criterios de R8 y desempates), `hiddenInRecents` (criterios de R7) y `recentMeals` con `exclude` (sigue saliendo hasta 5).
  - Backup: 10 claves, ida y vuelta, copia antigua sin la clave, sección mal formada.
  - Sync: 10 claves, cliente y servidor.
- **Componentes (Testing Library):** `FavoriteMeals` (R1, R5, R9, R10, Editar y lápices), `RecentMeals` con ☆ (R2, R11, sin ☆ en × 0,5), `CustomMealForm` (R3, errores de R4) y `FoodQuantityForm` (R12).
- **e2e (Playwright):** ☆ en Recientes → registrar desde Favoritos en otra franja → editar los macros → la entrada antigua sigue igual.

## Tasks
1. [x] `src/lib/mealFavorites.ts` + `recentMeals({ exclude })` con sus tests unitarios (R2, R7, R8)
2. [ ] Clave `mealFavorites` en userData, server/sync, backup, store y syncMigration; los tests de 9 claves pasan a 10 (R6)
3. [ ] `Toast` con `durationMs: null`
4. [ ] `MealRow` + ☆ en `RecentMeals`; ocultar en Recientes, `favNotice` y Deshacer (R2, R7, R11)
5. [ ] `FavoriteMeals`: registrar, orden, tope, «Ver todos» y pista (R1, R8, R9, R10)
6. [ ] Extraer `CustomMealForm` de `page.tsx` sin cambiar su comportamiento; casilla «Guardar en favoritos» (R3)
7. [ ] Modo «Editar»: editar personalizada (R4), quitar con Deshacer (R5), `FoodQuantityForm` (R12)
8. [ ] e2e del flujo completo; nota de despliegue «servidor primero» en el PR

## Spec feedback
Decidido con el usuario el 2026-10-10. No cambia `spec.md`; aclara cómo se lee:
- **Recetas con raciones ≠ 1:** su fila de Recientes no lleva ☆, porque el favorito de receta siempre registra 1 ración (R1). El prototipo decía «para una receta, sus raciones»; manda el spec.
- **R7 con personalizadas:** se ocultan todas las filas con el mismo nombre, sean cuales sean los macros, con el mismo criterio que R2 y R8.
- **R11 y R5:** el aviso no se cierra solo; se va al cerrar «Añadir comida». El prototipo decía «unos segundos»; manda el spec.
- **R8, desempates:** detrás van los que no se han registrado en la franja, por su último registro en cualquier franja; al final, los que nunca se han registrado, por orden de guardado (el último primero).
- **Could:** R12 entra; R13 pasa a follow-up.
- Ninguna pregunta abierta bloquea el código.

## Test coverage
Escritos el 2026-10-10, antes del código. Contratos (firmas, props y nombres accesibles) acordados con Manuel; están en la cabecera de cada test. 🔴 = falla porque la funcionalidad aún no existe.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/mealFavorites.test.ts › «favoriteEntry (R1)»; tests/unit/FavoriteMeals.test.tsx › «R1»; tests/e2e/favoritos-anadir.spec.ts › «R1: …» (2) | unit, component, e2e | 🔴 failing (not built) |
| R2 | mealFavorites.test.ts › «favoriteFromEntry», «upsertCustom»; RecentMeals-star.test.tsx; store-mealFavorites.test.tsx › «R2»; e2e › «R2/R11», «R2: ☆ en una receta…», «R2: un alimento…» | unit, component, e2e | 🔴 failing (not built) |
| R3 | CustomMealForm.test.tsx › «R3»; e2e › «R3: registra, guarda…» | component, e2e | 🔴 failing (not built) |
| R4 | CustomMealForm.test.tsx › «R4»; FavoriteMeals.test.tsx › «R4»; store-mealFavorites.test.tsx › «R4»; e2e › «R4: corregir la grasa…» | component, e2e | 🔴 failing (not built) |
| R5 | FavoriteMeals.test.tsx › «R5»; store-mealFavorites.test.tsx › «R5»; e2e › «R5: …» (2) | component, e2e | 🔴 failing (not built) |
| R6 | tests/unit/backup-mealFavorites.test.ts; backup.test.ts, backup-water.test.ts, sync-engine.test.ts, sync-migration.test.ts, server/tests/unit/sync-routes.test.ts (de 9 a 10 claves) | unit | 🔴 failing (not built) |
| R7 | mealFavorites.test.ts › «R7»; e2e › «R2: ☆ en una receta…» (× 0,5 sigue) | unit, e2e | 🔴 failing (not built) |
| R8 | mealFavorites.test.ts › «R8» (criterios del spec + desempates del tech) | unit | 🔴 failing (not built) |
| R9 | FavoriteMeals.test.tsx › «R9»; e2e › «Ver todos se pliega…» | component, e2e | 🔴 failing (not built) |
| R10 | FavoriteMeals.test.tsx › «R10»; e2e › «R10» | component, e2e | 🔴 failing (not built) |
| R11 | tests/unit/Toast-sticky.test.tsx; e2e › «R2/R11» | component, e2e | 🔴 failing (not built) |
| R12 | tests/unit/FoodQuantityForm.test.tsx; FavoriteMeals.test.tsx › «R12» | component | 🔴 failing (not built) |
| State | e2e › «State & edge cases: cambiar de franja» (2); e2e › «R3» (casilla al reabrir); e2e › «R5: al cerrar…» (aviso) | e2e | 🔴 failing (not built) |
| Edges | mealFavorites.test.ts › sanitize, receta de otra franja o borrada, alimento sin gramos, fibra ausente, Avena 40/60 g | unit | 🔴 failing (not built) |
