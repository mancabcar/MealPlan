# Recetas: favoritos y selector por franja: Technical design
_Status: Draft · Updated: 2026-10-01_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Un componente `RecipePicker` compartido sustituye al `<select>` de recetas del Plan y de «Añadir comida» del Diario. Filtra por franja con una función pura, muestra ★ Favoritas arriba y guarda los favoritos como lista de ids en una clave nueva del usuario, incluida en la copia de seguridad. Esfuerzo M, en 7 tareas.

## Context
- Stack: Next 16.2.9 (App Router, export estático), React 19, vitest y playwright (24 specs e2e en `tests/e2e/`). `AGENTS.md` avisa de que esta versión de Next difiere de lo habitual: antes de escribir código hay que leer lo que toque en `node_modules/next/dist/docs/` (componentes cliente).
- Datos del usuario: claves `mp_<id>_<clave>` declaradas en `USER_DATA_KEYS` ([`src/lib/userData.ts:9`](../../../src/lib/userData.ts)); `LOAD_OPTIONS` es la única fuente de migraciones (carga y copia de seguridad).
- Copia de seguridad: [`src/lib/backup.ts`](../../../src/lib/backup.ts) (`buildBackup`, `parseBackup`, `SECTION_SHAPE`, `writeUserData`). `parseBackup` solo recorre `USER_DATA_KEYS`, así que una clave desconocida se ignora y una ausente queda vacía.
- Estado: `AppProvider` en [`src/lib/store.tsx`](../../../src/lib/store.tsx) con `usePersisted` por clave e `importData` que recarga todo.
- Selectores actuales: `<select>` en [`src/app/plan/page.tsx:104`](../../../src/app/plan/page.tsx) y en [`src/app/page.tsx:371`](../../../src/app/page.tsx) (modo Receta de «Añadir comida»). Ambos usan `allergenWarning`.
- Recetas: 107 en el catálogo ([`src/data/recipes.json`](../../../src/data/recipes.json)), todas con al menos un tag de franja (`desayuno`, `comida`, `cena`, `snack`). Hoy no hay correspondencia entre las franjas del Plan (`MealType`, [`src/lib/types.ts:96`](../../../src/lib/types.ts)) y esos tags.

## Approaches considered
### A. `RecipePicker` compartido + clave `favorites` (chosen)
Un componente en `src/components/recetas/` usado por Plan y Diario; una función pura filtra y agrupa; favoritos como `string[]` de ids en `mp_<id>_favorites`. **Pros:** un único selector, datos de usuario separados del catálogo (#42), encaja con el patrón de `usePersisted` y la copia de seguridad. **Cons:** toca store, backup y dos pantallas, y obliga a migrar specs e2e. **Effort** M.
### B. Campo `favorite` dentro de cada `Recipe`
Sin clave nueva ni cambios de backup. **Pros:** menos ficheros. **Cons:** mezcla datos del usuario con el catálogo sembrado que #42 quiere separar, y `withSeedRecipes` complica el orden de sobrescritura. **Effort** M.
### C. Dos listas distintas, una por pantalla
**Cons:** duplica la lógica de filtrado y agrupación. Descartada.

Elegida A por el usuario, que coincide con la recomendación de Claude.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Datos | `src/lib/userData.ts` | Añade `favorites` a `USER_DATA_KEYS`, `UserData`, `EMPTY_USER_DATA` y `LOAD_OPTIONS` (con `sanitizeFavorites`) |
| Copia | `src/lib/backup.ts` | `SECTION_SHAPE.favorites` (lista de strings), `parseBackup`/`writeUserData` incluyen la clave; textos «siete» pasan a «ocho» |
| Estado | `src/lib/store.tsx` | `favorites`, `toggleFavorite(id)`, y recarga en `importData` |
| Franjas | `src/lib/recipeSlots.ts` (nuevo) | `slotTag(mealType)` y `groupRecipes({...})` puros |
| UI | `src/components/recetas/RecipePicker.tsx` (nuevo) | Lista táctil con buscador, secciones y estrella |
| Plan | `src/app/plan/page.tsx` | Sustituye el `<select>` de la Card de edición por `RecipePicker`, con «Quitar» y receta asignada resaltada |
| Diario | `src/app/page.tsx` | Sustituye el `<select>` del modo Receta por `RecipePicker` |
| Recetas | `src/app/recetas/page.tsx` | Estrella en tarjeta y detalle, chip «Solo favoritas» |
| Tests | `tests/unit/`, `tests/e2e/helpers.ts`, specs afectados | Ver Testing strategy |

### Data model
`favorites: string[]` (ids de receta, sin duplicados) en la clave `mp_<id>_favorites`. `sanitizeFavorites` descarta lo que no sea string, quita duplicados e ignora ids de recetas que ya no existen (se limpian al guardar). Sin migración de datos existentes: la clave ausente es `[]`. `BACKUP_SCHEMA_VERSION` sigue en 1: una copia antigua sin `favorites` queda vacía y una app antigua ignora la clave nueva.

### APIs / interfaces
- `slotTag(mealType: MealType): "desayuno" | "comida" | "cena" | "snack"`: Desayuno→desayuno, Comida→comida, Cena→cena, Media mañana, Merienda y Pre-entreno→snack.
- `slotLabel(recipe): "Desayuno" | "Comida" | "Cena" | "Snack" | null`: etiqueta de franja de una receta en «Otras franjas» (sin franja: `null`).
- `groupRecipes({ recipes, favorites, mealType, query, showAll }) → { favorites, slot, others }`: A–Z dentro de cada sección; con `showAll` falso, ★ solo trae favoritas de la franja; con `showAll`, ★ trae todas las favoritas; las recetas favoritas no se repiten en su sección de franja; si la franja tiene menos de 5 recetas se completa con otras.
- `AppState`: `favorites: string[]` y `toggleFavorite(id: string): void`.
- `RecipePicker` props: `mealType`, `value` (id asignado o ""), `onPick(id)` y `onClear` (solo Plan).

### UI
Lista inline dentro de la Card actual, con altura máxima y scroll (decisión del usuario). Mapea al prototipo: «1 · Plan: elegir Cena» (★ Favoritas + franja + «Ver todas las recetas»), «2 · Plan: Ver todas» (con «← Solo cenas» y etiqueta de franja en «Otras franjas») y «3 · Plan: Merienda sin favoritas» (pista en ★). Cada fila es un botón de ≥44 px; la estrella es un botón aparte con `aria-label` («Marcar como favorita» / «Quitar de favoritas») y no cierra el selector. Se mantiene `allergenWarning` en la fila.

## UI test contract
Los tests de dev-test (`tests/e2e/favoritos-franja.spec.ts` y los helpers de `tests/e2e/helpers.ts`) fijan estos nombres accesibles; dev-code los implementa tal cual:
- Contenedor del selector: `role="group"` con `aria-label="Elegir receta"`. Buscador: `searchbox` «Buscar».
- Secciones: listas (`ul`) con nombre «★ Favoritas», el nombre de la franja («Cena», «Merienda»…) y «Otras franjas». Cada fila es un `li` con un botón cuyo nombre accesible empieza por el de la receta, y el aviso de alérgenos y la etiqueta de franja dentro del `li`.
- Receta ya asignada: `aria-current="true"` en su botón. En el Plan, botón «Quitar».
- Estrella: botón aparte con `aria-label` «Marcar <receta> como favorita» / «Quitar <receta> de favoritas»; no cierra el selector. Filas y estrellas de ≥44 px de alto.
- Botones «Ver todas las recetas» y «← Solo …» (vuelta a la franja); el texto del buscador se mantiene al alternar.
- Pista en ★ vacía: «Aún no tienes favoritas para esta franja…».
- Recetas: la misma estrella en tarjeta y detalle (fuera del botón de la tarjeta), botón «Solo favoritas» con `aria-pressed` y estado vacío «Aún no tienes recetas favoritas…».
- Búsqueda sin mayúsculas ni tildes (`normalize` de `src/lib/text.ts`). Franja por tag sin distinguir mayúsculas (la IA guarda «Cena»). Una receta sin franja solo sale en «Otras franjas», sin etiqueta.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `groupRecipes` filtra por `slotTag`; `RecipePicker` con buscador, usado en Plan y Diario; receta asignada resaltada y «Quitar» |
| R2 | Sección ★ en `RecipePicker`; `toggleFavorite` sin cerrar; A–Z y pista en ★ vacía |
| R3 | Estado `showAll` del picker; «Otras franjas» con etiqueta de franja |
| R4 | Clave `favorites` por usuario (`userKey`), `USER_DATA_KEYS`, backup e importación, `sanitizeFavorites` |
| R5 | Estrella en tarjeta y detalle de `src/app/recetas/page.tsx` y chip «Solo favoritas» combinado con la búsqueda |

## Risks & mitigations
- **Specs e2e que usan el `<select>` de recetas** (~21 usos de `selectOption`/`combobox` en 7 specs: macros-plan, raciones, sobras, diario-desde-plan, registro-rapido, shopping-list, accessibility). Mitigación: helper `pickRecipe(page, id)` en `tests/e2e/helpers.ts` y migración de los specs en la misma tarea que cambia cada pantalla.
- **Clave nueva en la copia de seguridad.** Mitigación: tests unitarios con copia nueva, copia antigua sin la clave y ruptura de formato; textos «siete» actualizados. Aceptado: una copia antigua deja los favoritos vacíos y una app antigua ignora la clave nueva (sin subir `BACKUP_SCHEMA_VERSION`).
- **Favoritas huérfanas** (receta borrada o retirada del catálogo): se ignoran al mostrar y se limpian al guardar. Aceptado.
- **Dependencia de los tags de franja del catálogo.** Mitigación: un test unitario comprueba que toda receta del catálogo tiene al menos un tag de franja.

## Testing strategy
- **Unitarios (vitest):** `sanitizeFavorites`; `slotTag`; `groupRecipes` (franja, ★ sin duplicados, A–Z, buscador combinado, menos de 5, `showAll`); backup (ida y vuelta, copia antigua, sección mal formada); catálogo con tag de franja.
- **e2e (playwright):** nuevo `favoritos-franja.spec.ts` con el flujo de ≤2 toques (Plan), selector en el Diario, marcar sin cerrar, «Ver todas», persistencia tras recargar, aislamiento entre dos usuarios, exportar e importar la copia con favoritas, R5 en Recetas y axe. Los specs existentes se migran con `pickRecipe`.
- Cada criterio de aceptación del spec se cubre con al menos uno de estos tests; el «≤2 toques» se verifica contando clics en el e2e.

## Tasks
1. [x] Capa de datos de favoritos: `favorites` en `userData.ts`, `backup.ts` y `store.tsx`, con `sanitizeFavorites` y tests unitarios (covers R4)
2. [x] `src/lib/recipeSlots.ts` (`slotTag`, `groupRecipes`) con tests unitarios (covers R1, R2, R3)
3. [x] Componente `RecipePicker` (lista, buscador, ★, «Ver todas», aviso de alérgenos) (covers R1, R2, R3)
4. [x] Integrar en el Plan, helper `pickRecipe` y migrar los specs del Plan (covers R1, R2, R3)
5. [x] Integrar en «Añadir comida» del Diario y migrar sus specs (covers R1)
6. [ ] Estrella y «Solo favoritas» en la página Recetas (covers R5)
7. [ ] Spec e2e `favoritos-franja.spec.ts` y comprobación de accesibilidad (covers R1–R5)

## Test coverage
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/recipe-slots.test.ts › "R1: slotTag…", "R1: groupRecipes filtra por la franja elegida" | unit | 🔴 failing (not built) |
| R1 | tests/e2e/favoritos-franja.spec.ts › "R1: el selector del Plan se filtra por la franja elegida" (2 toques, franja, snack, buscador, alérgenos, asignada y Quitar, Diario) | e2e | 🔴 failing (not built) |
| R2 | tests/unit/recipe-slots.test.ts › "R2: groupRecipes y la sección ★ Favoritas" | unit | 🔴 failing (not built) |
| R2 | tests/e2e/favoritos-franja.spec.ts › "R2: ★ Favoritas y la estrella de cada fila" | e2e | 🔴 failing (not built) |
| R3 | tests/unit/recipe-slots.test.ts › "R3: …" y "Edge: franja con menos de 5…" | unit | 🔴 failing (not built) |
| R3 | tests/e2e/favoritos-franja.spec.ts › "R3: «Ver todas»" | e2e | 🔴 failing (not built) |
| R4 | tests/unit/favorites.test.ts (sanitizeFavorites, claves y copia de seguridad) | unit | 🔴 failing (not built) |
| R4 | tests/unit/store-favorites.test.tsx (toggleFavorite, persistencia, importData) | unit | 🔴 failing (not built) |
| R4 | tests/e2e/favoritos-franja.spec.ts › "R4: …" (recargar, otra cuenta, exportar, importar, copia antigua) | e2e | 🔴 failing (not built) |
| R5 | tests/e2e/favoritos-franja.spec.ts › "R5: estrella y «Solo favoritas»…" | e2e | 🔴 failing (not built) |
| R1–R3 | tests/e2e/favoritos-franja.spec.ts › "Accesibilidad del selector" (axe, ≥44 px) | e2e | 🔴 failing (not built) |
| Riesgo | tests/unit/recipe-slots.test.ts › "el catálogo siempre tiene tag de franja" | unit | 🟢 passing |

Los 7 specs e2e existentes que usan el `<select>` de recetas (macros-plan, raciones, sobras, diario-desde-plan, registro-rapido, shopping-list, accessibility) los migra dev-code con el helper `pickRecipe` en las tareas 4 y 5. `tests/unit/store.test.tsx` y `tests/unit/backup.test.ts` necesitarán `favorites` en sus datos de ejemplo (tarea 1).

## Spec feedback
- Sin cambios al spec. El spec se puede construir tal cual (el usuario mantiene R1 en Plan y Diario).
- Resuelta la pregunta abierta del spec sobre dónde se guardan los favoritos: lista de ids en la clave `favorites`.
- Sigue abierta la del spec sobre qué queda de #58 y #84 tras la v1 (se decide al cerrarla).
