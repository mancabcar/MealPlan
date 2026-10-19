# Diario: editar la cantidad de una entrada ya registrada: Technical design
_Status: Draft · Updated: 2026-10-19_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Una función pura `rescaleEntry` recalcula en proporción los macros y la fibra de una entrada con su cantidad nueva, y el store gana `replaceEntry`. La fila del Diario sale de `page.tsx` a un `DiaryEntryRow` que, al tocarse, abre dentro de ella el `FoodQuantityForm` de #55 (generalizado) para alimentos o `ServingsField` para recetas, con un aviso «Cantidad cambiada · Deshacer». Esfuerzo: **S–M** (8 commits pequeños, sin migración ni cambios de servidor).

## Context
- Diario: `src/app/page.tsx` (658 líneas). Cada entrada se pinta inline en el `items.map` con la ✕ (`removeEntry`, envuelto en `singleClick`); la etiqueta sale de `servingsLabel(e) ?? quantityLabel(e)`.
- Entrada: `MealEntry` en `src/lib/types.ts` — alimentos con `grams`, `units?` y `foodId` (#13); recetas con `recipeId` y `servings?` (ausente = 1); `fiber?` ausente = sin dato. Los macros se guardan ya escalados y sin redondear.
- Escalado: `scaleMacros` (`src/lib/foods.ts`) y `slotMacros` (`src/lib/planMacros.ts`) son lineales. Las entradas `off:` no guardan valores por 100 g.
- Fibra de recetas antiguas sin `fiber`: `entryFiber` (`src/lib/fiber.ts`) la calcula al leer como `receta.fiber × servings`, así que al cambiar `servings` sale bien sola.
- Store: `src/lib/store.tsx` tiene `addEntry`, `addEntries` y `removeEntry`, pero nada para actualizar.
- Sync: `src/lib/sync.ts` sube la clave `entries` entera con versión; editar una entrada no necesita nada nuevo.
- Reutilizables: `FoodQuantityForm` (`src/components/diario/FoodQuantityForm.tsx`, #55 R12), `ServingsField` (`src/components/ui/ServingsField.tsx`), `Toast` con `action`, `singleClick`.

## Approaches considered
### A. Recalcular en proporción + `replaceEntry` + `DiaryEntryRow` (chosen)
Hay una única función pura para alimentos y recetas, y se reutilizan los editores que ya existen. **Pros:** funciona igual con alimentos locales, de OFF y recetas, respeta lo que se registró y se prueba en unidad. **Cons:** hay que tocar `FoodQuantityForm`, que también usa Favoritos. **Effort:** S–M. Decisión del usuario, que coincide con la recomendación.
### B. Recalcular desde el origen
Esta opción recalcula con `foods.json` o con la receta actual. Se descarta porque OFF no tiene origen al que volver (habría que mantener dos caminos) y porque cambiaría los macros de entradas cuya receta se editó después.
### C. Borrar y volver a añadir
Se descarta porque la spec (R3) pide que la entrada conserve su identidad y porque complicaría Deshacer y el chip «Copiada».

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica | `src/lib/diary.ts` | `entryQuantity(entry)`, `rescaleEntry(entry, quantity)` y `undoEdit` (ver APIs) |
| Store | `src/lib/store.tsx` | `replaceEntry(entry: MealEntry)`: sustituye la entrada con la misma `id`; si no existe, no hace nada |
| Editor alimento | `src/components/diario/FoodQuantityForm.tsx` | Prop `quantity: { grams: number; units?: number }` en vez de `favorite: FoodFavorite`; prop opcional `preview?: (q) => ReactNode` (R6). Favoritos le pasa `{ grams, units }` del favorito |
| Fila | `src/components/diario/DiaryEntryRow.tsx` (nuevo) | Nombre, etiqueta, fibra, chip «Copiada», kcal y ✕ (lo que hoy está inline). Con `editing` pinta el editor |
| Página | `src/app/page.tsx` | Usa `DiaryEntryRow`; estado `editingId` y aviso `edited`; resets |
| Tests | `tests/unit/diary-rescale.test.ts`, `tests/unit/DiaryEntryRow.test.tsx`, `tests/unit/FoodQuantityForm.test.tsx`, `tests/e2e/diario-editar-cantidad.spec.ts` | Ver Testing strategy |

### Data model
No hay cambios en `MealEntry` ni migración. Una entrada editada es la misma entrada con otros `grams`/`units`/`servings` y macros.

### APIs / interfaces
```ts
// lib/diary.ts
type EntryQuantity =
  | { kind: "grams"; grams: number }
  | { kind: "units"; units: number; grams: number }   // peso de 1 ud = grams / units
  | { kind: "servings"; servings: number };

/** Cantidad editable de la entrada, o null si no es editable (R5). */
export function entryQuantity(entry: MealEntry): EntryQuantity | null;

/**
 * Entrada con la cantidad nueva: kcal, protein, carbs, fat y fiber (solo si existe) × nueva / vieja, sin redondear.
 * Alimento: fija grams (y units si se registró en ud). Receta: servings, o lo quita si la nueva es 1.
 * Conserva id, date, mealType, customName, recipeId y foodId.
 */
export function rescaleEntry(entry: MealEntry, next: { grams: number; units?: number } | { servings: number }): MealEntry;

/** Deshacer (R7): before si la entrada actual con esa id es igual campo a campo a after; si no, null. Añadido en dev-test (2026-10-19). */
export function undoEdit(entries: MealEntry[], edit: { before: MealEntry; after: MealEntry }): MealEntry | null;
```
Reglas de `entryQuantity`:
- Personalizada (sin `recipeId` ni `grams` válidos) → `null`.
- Alimento → `grams` finito > 0. Si `units` es finito > 0 → `units`; si no → `grams` (caso borde 3).
- Receta → `servings` ausente = 1. Si está presente pero no es finito o es ≤ 0 → `null` (caso borde 1).

### UI
- Una fila editable es un `<button>` a todo lo ancho (nombre, etiqueta y kcal) con `singleClick`. La ✕ queda fuera de él, como hermano y nunca anidada, igual que `MealRow`. Una fila no editable se queda como texto, sin rol de botón (R5).
- Con `editing`, bajo la línea de la entrada se pinta `FoodQuantityForm` (g o ud) o `ServingsField` con «Guardar cambios» y «Cancelar» (R8). El preview es `«<cantidad> → <kcal> kcal»` y solo aparece con un valor válido (R6).
- Guardar con el mismo valor cierra el editor sin `replaceEntry` y sin aviso.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `DiaryEntryRow` con botón de fila y `editingId` en `page.tsx`; la ✕ sigue llamando a `removeEntry` |
| R2 | `entryQuantity` elige el modo; `FoodQuantityForm` valida con `parseGrams`/`parseUnits` y sus errores |
| R3 | `rescaleEntry` + `replaceEntry`; los totales, la gráfica, las medias, Recientes y Favoritos se derivan de `entries` en cada render |
| R4 | Un solo `editingId`; Cancelar, otra fila o `openAdd` lo cambian o limpian |
| R5 | `entryQuantity(entry) === null` → la fila no es botón |
| R6 | Prop `preview` de `FoodQuantityForm` y `ServingsField`, con kcal de `rescaleEntry(entry, q).calories` redondeadas |
| R7 | Aviso `edited` con Deshacer (ver Risks y State) |
| R8 | `ServingsField` en `DiaryEntryRow` para `kind: "servings"`; `rescaleEntry` quita `servings` con 1 |

## Risks & mitigations
- **Deshacer pisa un cambio más nuevo (#168).** Hay doble red (decisión del usuario): (1) el aviso se cierra al volver a guardar esa entrada (lo sustituye el aviso nuevo) o al borrarla; (2) Deshacer guarda `{ before, after }` y solo hace `replaceEntry(before)` si `undoEdit` lo devuelve (la entrada actual con esa id es igual campo a campo a `after`). Si no lo es, no hace nada y cierra el aviso. Así también se cubre un cambio que llega por sync.
- **Generalizar `FoodQuantityForm` rompe Favoritos.** `FoodQuantityForm.test.tsx` y `favoritos-*.spec.ts` deben seguir en verde en la tarea 3.
- **Toques accidentales al desplazar en móvil.** Un `<button>` nativo no se dispara al hacer scroll, y `singleClick` ignora el doble toque. Se comprueba a mano en el viewport móvil del e2e.
- **Error de coma flotante al encadenar ediciones (150→100→150).** Se acepta: los macros se guardan sin redondear y se redondean al mostrar, así que la deriva no se ve.

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| `editingId` al cambiar de día | Se cierra sin guardar | `setEditingId(null)` en el `onChange` de la fecha |
| `editingId` al abrir «Añadir comida» o «Copiar día» | Se cierra sin guardar | `openAdd` y el botón de copiar lo limpian |
| `editingId` al tocar otra fila editable | Se abre la nueva y se descarta la anterior | `setEditingId(e.id)` |
| `editingId` de una entrada borrada o que desaparece por sync | Se cierra | La ✕ lo limpia; si la id no está en `dayEntries`, no se pinta ningún editor |
| Texto del editor | Se reinicia con cada entrada | `key={entry.id}` en el editor |
| Aviso `edited` | Uno a la vez y 10 s: lo cierran `added`, `copied`, `favNotice` y al revés; también al guardar o borrar esa entrada | Mismo patrón que `changeFavorites` |
| Personalizada | No editable | `entryQuantity` → null |
| Alimento con `grams` NaN, 0 o ausente | No editable | `entryQuantity` → null |
| Alimento con `units` inválido y `grams` válido | Se edita en gramos y no guarda `units` | `entryQuantity` → `kind: "grams"` |
| Receta sin `servings` | Editable desde 1 | `entryQuantity` → `servings: 1` |
| Receta con `servings` no numérico o ≤ 0 | No editable | `entryQuantity` → null |
| Macros NaN o ausentes (backup) | Se escalan tal cual: siguen sin dato, no pasan a 0 | `rescaleEntry` solo multiplica |
| `fiber` ausente | Sigue ausente; en recetas `entryFiber` la deriva con los `servings` nuevos | `rescaleEntry` no la crea |
| Mismo valor | Sin cambio ni aviso | Comparación en `DiaryEntryRow` antes de `onSave` |
| Unidades con gramos no enteros (1,5 × 75 = 112,5) | Válido | Igual que al registrar |
| Entrada copiada | Se edita sola y conserva el chip «Copiada» | `replaceEntry` mantiene la id |

## Testing strategy
- **Unit `diary-rescale.test.ts`:** `entryQuantity` en cada fila de la tabla anterior; `rescaleEntry` con g, ud (pasar 2→3 ud da 180 g desde 120 g), servings (0,5, vuelta a 1 sin campo), fibra presente o ausente, macros NaN, y conservación de id, fecha, franja, nombre y foodId.
- **Unit `FoodQuantityForm.test.tsx`:** adaptar a la prop `quantity` y añadir el preview.
- **Unit `DiaryEntryRow.test.tsx`:** fila editable como botón y no editable sin él; la ✕ fuera del botón; guardar con el mismo valor no llama a `onSave`; error y botón desactivado con valores inválidos.
- **e2e `diario-editar-cantidad.spec.ts`:** los escenarios 1–4 de la spec (g, ud, raciones, Deshacer); los totales del día cambian; Deshacer tras volver a editar no restaura nada; Cancelar y abrir otra fila descartan; con el viewport móvil.

## Tasks
1. [ ] `entryQuantity`, `rescaleEntry` y `undoEdit` en `lib/diary.ts` con sus tests unitarios (R2, R3, R5, R8).
2. [ ] `replaceEntry` en el store (R3).
3. [ ] Generalizar `FoodQuantityForm` (`quantity` + `preview`); Favoritos sin cambio de conducta (R2, R6).
4. [ ] Extraer `DiaryEntryRow` de `page.tsx` sin cambiar la conducta (los e2e del Diario siguen en verde).
5. [ ] Editar alimentos: fila botón, `editingId`, editor, preview y resets (R1–R6).
6. [ ] Raciones de receta con `ServingsField` (R8).
7. [ ] Aviso «Cantidad cambiada · Deshacer» con doble red y un aviso a la vez (R7).
8. [ ] e2e `diario-editar-cantidad.spec.ts`.

## Test coverage
Contratos de UI fijados en dev-test: fila `<button>` «Cambiar cantidad de <nombre>»; vista previa «<etiqueta de la fila> → N kcal» («100 g → 130 kcal», «3 ud · 180 g → 252 kcal», «× 0,5 → 300 kcal»); aviso «Cantidad cambiada» con «Deshacer»; props de `DiaryEntryRow` en la cabecera de su test. Datos: `tests/fixtures/editar-cantidad.ts`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/DiaryEntryRow.test.tsx › "R1: …" (4) · tests/e2e/diario-editar-cantidad.spec.ts › "R1: tocar la fila abre el editor…" | unit + e2e | 🔴 failing (not built) |
| R2 | tests/unit/diary-rescale.test.ts › entryQuantity "R2: …" · DiaryEntryRow "R2: …" · FoodQuantityForm "R12: …" (prop `quantity`) · e2e "R2: un valor no válido…", "R2: de 2 a 3 huevos…" | unit + e2e | 🔴 failing (not built) |
| R3 | diary-rescale › rescaleEntry "R3: …" · store-entries › "R3 (#57): replaceEntry…" (3) · DiaryEntryRow "R3: guardar 100 g…" · e2e "R3: al guardar 100 g…", "R3: se guarda la misma entrada…" | unit + e2e | 🔴 failing (not built) |
| R4 | DiaryEntryRow "R4: «Cancelar»…" · e2e "R4: …" (4) y "State: …" (2) | unit + e2e | 🔴 failing (not built) |
| R5 | diary-rescale "R5: …" (5) · DiaryEntryRow "R5: …" (2) · e2e "R5: el yogur no tiene botón…" | unit + e2e | 🟢 e2e pasa ya (no hay botón hoy); unit 🔴 failing (not built) |
| R6 | FoodQuantityForm "R6 (#57): …" (3) · DiaryEntryRow "R6: …", "R2/R6: …" · e2e "R6: mientras se escribe…" | unit + e2e | 🔴 failing (not built) |
| R7 | diary-rescale › undoEdit "R7: …" (4) · e2e "R7: …" (4) | unit + e2e | 🔴 failing (not built) |
| R8 | diary-rescale "R8: …" · DiaryEntryRow "R8: …" (4) · e2e "R8: …" (2) | unit + e2e | 🔴 failing (not built) |
| Edge (State & edge cases) | diary-rescale "Edge: …" (units NaN, kcal ausentes, fibra ausente) · DiaryEntryRow "Edge: …" (doble toque, Copiada, mismo valor) · e2e "Edge: guardar el mismo valor…", "Edge: en 375 px…" | unit + e2e | 🔴 failing (not built) |
| Pendiente | Entrada que desaparece por sync con el editor abierto; toques accidentales al desplazar en móvil | review / manual | ⏸ sin test automático |

## Spec feedback
No hay cambios en la spec. Lo que se decidió aquí la concreta sin contradecirla:
- R7: además de cerrar el aviso, Deshacer comprueba que la entrada no haya cambiado (decisión del usuario).
- R5: también son no editables las recetas con `servings` no numérico. Un alimento con `units` inválido se edita en gramos.
