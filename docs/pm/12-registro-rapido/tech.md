# Registro rápido: Recientes: Technical design
_Status: Approved · Updated: 2026-09-27_
_Related: [spec](spec.md) · [brief](brief.md) · [issue #12](https://github.com/mancabcar/MealPlan/issues/12) · sin prototipo_

## Summary
Recientes se **calcula cada vez que se pinta** a partir de `entries` y `recipes` con una función pura `recentMeals()` en `src/lib/diary.ts`, igual que `pendingSlots`: no hay datos nuevos, ni migración, ni cambios en el store o la copia de seguridad. Un componente nuevo, `src/components/diario/RecentMeals.tsx`, pinta la lista de botones en «Añadir comida», y un toque añade una copia de la reciente (`repeatEntry()`) con id, fecha y franja nuevos. Esfuerzo: **S**.

## Context
- Stack: Next 16.2.9 App Router, React 19.2.4, Tailwind v4 con tokens. El Diario (`src/app/page.tsx`) es una página cliente; nada de esta feature toca APIs de Next.
- **Entradas**: `MealEntry` (`src/lib/types.ts`) guarda los macros ya calculados, `recipeId` o `customName`, y `servings` solo si ≠ 1. `entries` vive en `AppProvider` (`src/lib/store.tsx`). `addEntry` añade al final del array, así que **el orden del array es el orden de registro** (R3). Importar una copia (`importData`) conserva ese orden.
- **Formulario «Añadir comida»** (`page.tsx`, ~281–410): selector de franja (`mealType`, solo `profile.meals`), pestañas Receta/Personalizada, `submitAdd` y `setShowAdd(false)` para cerrar. La fecha es el `date` del Diario.
- **Reutilizable**: `servingsLabel()` (`src/lib/diary.ts`) da «× 0,5» o null; `singleClick()` (`page.tsx`) ignora el segundo clic de un doble toque y ya lo usan «Hecho», «Registrar todo el día» y la ✕; las filas del Diario redondean kcal con `Math.round`. `PeriodSummary` (`src/components/diario/`) es el precedente de componente del Diario.
- **Tests**: Vitest (`tests/unit`, `diary.test.ts` ya prueba `pendingSlots` y `recipeEntry`) y Playwright (`tests/e2e`, `signIn` fija el reloj en 2026-09-22 y siembra datos; fixtures del Diario en `tests/fixtures/diario.ts`). `tests/e2e/accessibility.spec.ts` pasa axe sobre el Diario en varios estados.

## Approaches considered
### A. Derivado de `entries` al pintar (chosen)
`recentMeals()` recorre las entradas de la última a la primera, agrupa por clave de duplicado y ordena por franja. · **Pros** R7 sale gratis (borrar una entrada o perder su receta la quita); sin dato nuevo, sin migración ni cambios en la copia de seguridad; mismo patrón que `pendingSlots`. · **Cons** recorre todas las entradas en cada render del formulario (irrelevante con un único usuario: miles de entradas son microsegundos). · **Effort** S

### B. Historial de recientes guardado aparte
Una clave `recents` en localStorage que se actualiza al registrar. · **Cons** contradice R7, obliga a tocar el store, `userData`/`backup` y a mantenerla sincronizada con los borrados. · **Effort** M. Descartado.

El usuario eligió A (coincide con la recomendación).

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica pura | `src/lib/diary.ts` | `RECENT_LIMIT = 5`, `RecentMeal`, `recentMeals()`, `repeatEntry()` (+ clave y normalización de nombre como helpers privados). |
| Componente | `src/components/diario/RecentMeals.tsx` **(nuevo)** | Título «Recientes» y lista de botones de fila completa; no pinta nada con la lista vacía. |
| Diario | `src/app/page.tsx` | Calcula `recentMeals(...)` con la franja elegida y pinta `<RecentMeals>` entre el selector de franja y las pestañas; `onPick` → `addEntry(repeatEntry(...))` y cierra el formulario; `singleClick` en el botón «Añadir comida». |
| Unit | `tests/unit/diary.test.ts` | Tests de `recentMeals` y `repeatEntry`. |
| E2E | `tests/e2e/registro-rapido.spec.ts` **(nuevo)**, `tests/e2e/accessibility.spec.ts`, `tests/fixtures/diario.ts` | Un test por criterio de aceptación de UI; caso axe con Recientes visibles; fixtures de entradas. |

Sin cambios: `types.ts`, `store.tsx`, `migrate.ts`, `userData.ts`, `backup.ts`, Plan.

### Data model
Ninguno. Recientes no se guarda.

### APIs / interfaces
```ts
// src/lib/diary.ts
export const RECENT_LIMIT = 5;

export interface RecentMeal {
  /** Clave de duplicado (R2). También sirve de React key. */
  key: string;
  /** Nombre a mostrar: el de la receta o el customName de la entrada más reciente del grupo. */
  name: string;
  /** La entrada más reciente del grupo (de cualquier franja): la que se copia. */
  entry: MealEntry;
}

/** Recientes (R2, R3, R7): hasta `limit` comidas distintas, primero las de `mealType`. */
export function recentMeals({
  entries, recipes, mealType, limit = RECENT_LIMIT,
}: { entries: MealEntry[]; recipes: Recipe[]; mealType: MealType; limit?: number }): RecentMeal[];

/** Copia de una entrada con id, fecha y franja nuevos (R4). Conserva macros, recipeId, customName y servings. */
export function repeatEntry(entry: MealEntry, date: string, mealType: MealType, id = crypto.randomUUID()): MealEntry;
```

**Clave de duplicado (R2)**
- Entrada con `recipeId`: `r|<recipeId>|<servings ?? 1>`. Si la receta no está en `recipes`, la entrada se ignora (R7).
- Entrada sin `recipeId`: `c|<nombre normalizado>|<calories>|<protein>|<carbs>|<fat>`, con el nombre normalizado como `customName.trim().replace(/\s+/g, " ").toLowerCase()`. Los macros se comparan como números exactos.

**Algoritmo (R3)**
1. Recorrer `entries` desde el final. Para cada clave, la primera entrada encontrada es la más reciente del grupo: fija `entry` y `name`.
2. Grupo de la franja: recorrer desde el final solo las entradas con `mealType` igual al elegido, en orden de primera aparición de cada clave. Así una comida cuenta como «de esa franja» si alguna de sus entradas se registró en ella, y se ordena por la última de esas entradas (decisión del usuario).
3. Resto: las claves no incluidas en el paso 2, en el orden del paso 1.
4. Concatenar y cortar a `limit`.

`repeatEntry` hace `{ ...entry, id, date, mealType }`. Los macros **se copian de la reciente, no se recalculan** desde la receta (decisión del usuario: literal a R4, y la kcal mostrada es la que se añade).

### UI
Sin prototipo. Dentro de la tarjeta «Añadir comida», entre el `<select>` de franja y las pestañas Receta/Personalizada, visible en los dos modos:

```
Añadir comida
[ Desayuno            ▾ ]
Recientes
┌───────────────────────────┐
│ Avena con fruta   350 kcal│
│ Yogur con nueces  210 kcal│
│ Lentejas × 0,5    260 kcal│
└───────────────────────────┘
[ Receta ][ Personalizada ]
```

- `RecentMeals({ recents, onPick })`: si `recents` está vacío devuelve `null` (R6). Si no, un `<h4>` «Recientes» (texto pequeño en `--color-text-muted`) y un `<ul>` con un `<button>` a todo el ancho por fila: a la izquierda el nombre y, si `servingsLabel(entry)` no es null, « × 0,5» en `--color-text-muted`; a la derecha `{Math.round(entry.calories)} kcal` (R5). El nombre accesible del botón es el texto de la fila. Estilo de fila como las del Diario, con borde `--color-border` y esquinas redondeadas.
- `page.tsx`: `const recents = recentMeals({ entries, recipes, mealType })`. `onPick = singleClick(() => { addEntry(repeatEntry(r.entry, date, mealType)); setShowAdd(false); })`. No toca `recipeId`, raciones ni la personalizada a medio rellenar (caso límite del spec); al volver a abrir, `openAdd` ya resetea raciones como hoy.
- Botón «Añadir comida»: `onClick={singleClick(openAdd)}`, para que el segundo clic de un doble toque en una reciente, que cae ahí al cerrarse el formulario, no lo vuelva a abrir (decisión del usuario).

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `<RecentMeals>` entre el selector de franja y las pestañas, fuera del condicional de modo; `RECENT_LIMIT = 5`. |
| R2 | Clave `r|recipeId|servings` o `c|nombre normalizado|macros`; `name` de la entrada más reciente del grupo. |
| R3 | Recorrido desde el final del array (orden de registro); grupo de la franja primero y relleno con el resto; se recalcula en cada render al cambiar `mealType`. |
| R4 | `repeatEntry` (id nuevo, `date` y `mealType` del formulario, macros y raciones copiados) + `setShowAdd(false)`; `singleClick` en la fila y en «Añadir comida». |
| R5 | Nombre + `servingsLabel` + `Math.round(calories)` kcal. |
| R6 | `RecentMeals` devuelve `null` con la lista vacía. |
| R7 | Derivado de `entries` en cada render; entradas con `recipeId` sin receta ignoradas. |
| Caso: «Hecho» / «Registrar todo el día» | Son entradas normales del array: cuentan. |
| Caso: fechas futuras e importadas | El orden es el del array, no la fecha. |
| Caso: franja inactiva | La reciente se añade a la franja elegida (solo `profile.meals`). |

## Risks & mitigations
- **#13 (base de alimentos)** añadirá entradas de alimento por gramos. Si no llevan `recipeId`, caerían en la clave de personalizada (nombre + macros), que agrupa bien la misma cantidad del mismo alimento. Cuando se diseñe #13 hay que revisar la clave.
- **Coma flotante en la clave**: los macros de una entrada con raciones son exactos (múltiplos de 0,25 de enteros, ver `docs/pm/raciones/tech.md`), así que la comparación exacta es fiable. Las personalizadas se teclean como números.
- **Rendimiento**: dos recorridos lineales de `entries` por render del formulario abierto; irrelevante a escala de un usuario.

## Testing strategy
- **Unit** (`tests/unit/diary.test.ts`): `recentMeals`: duplicados por receta+raciones y por nombre normalizado+macros (R2); nombre de la más reciente; orden por registro, grupo de la franja con el caso «Avena en Cena», relleno y límite 5 (R3); lista vacía (R6); recetas inexistentes ignoradas (R7). `repeatEntry`: id/fecha/franja nuevos, conserva macros, `servings` y `customName`.
- **E2E** (`tests/e2e/registro-rapido.spec.ts`): posición entre selector y pestañas y visibilidad en Personalizada (R1); 5 filas; orden al cambiar de franja (R3); un toque añade en fecha y franja elegidas con id nuevo, cierra el formulario (R4); doble toque añade una y no reabre el formulario; «Lentejas × 0,5» y kcal redondeadas (R5); sin historial no hay sección (R6); borrar con la ✕ la quita (R7).
- **Accesibilidad** (`tests/e2e/accessibility.spec.ts`): caso axe «Diario con Recientes» con el formulario abierto.
- Los tests se escriben dentro de cada tarea de dev-code (no con dev-test antes).

## Tasks
1. [x] `recentMeals` + `repeatEntry` en `src/lib/diary.ts` con sus tests unitarios (covers R2, R3, R6, R7)
2. [x] `RecentMeals.tsx` en «Añadir comida» + `singleClick` en «Añadir comida» + `tests/e2e/registro-rapido.spec.ts` (covers R1, R4, R5, R6, R7)
3. [ ] Caso axe con Recientes en `tests/e2e/accessibility.spec.ts` (covers R1)

## Spec feedback
- R3 precisado con el usuario (2026-09-27): una comida es «de esa franja» si alguna de sus entradas se registró en ella, y se ordena por la última de esas entradas. Actualizado en `spec.md` (R3 y un criterio de aceptación nuevo).
