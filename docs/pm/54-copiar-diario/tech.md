# Diario: copiar un día completo a otra fecha: Technical design
_Status: Draft · Updated: 2026-10-06_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Helpers puros en `src/lib/diary.ts` (`copyDay`, `copyTargets`, `canCopyTo`), una escritura nueva en el store (`addEntries`) y una hoja nueva `CopyDaySheet` sobre `ui/Sheet`, con dos pasos (elegir y conflicto). `page.tsx` solo cablea botón, estado y aviso. Esfuerzo S–M, 6 tareas, sin cambios de datos.

## Context
- `src/app/page.tsx` (534 líneas): el Diario. `date` es `useState`; `dayEntries = entries.filter(e => e.date === date)`. Ya hay un `Toast` con «Deshacer» (estado `added`) para «Añadir comida».
- `src/lib/diary.ts`: helpers puros. `repeatEntry(entry, date, mealType, id)` devuelve `{...entry, id, date, mealType}`: ya conserva macros, fibra, raciones, gramos, unidades y `foodId`.
- `src/lib/store.tsx`: `addEntry` hace una escritura por entrada; hay precedente de lote en `addPantryItems`.
- `src/components/ui/Sheet.tsx`: modal con foco atrapado y Escape. Modelo de uso: `components/plan/ServingsSheet.tsx`.
- `src/lib/week.ts`: `addDays`, `dayName`. Tests: `tests/unit` (vitest + RTL) y `tests/e2e` (Playwright + axe).
- Todo es cliente (`"use client"`); no se toca ninguna API de Next.

## Approaches considered
### A. Helper puro + `addEntries` + `CopyDaySheet` (chosen)
La lógica en `diary.ts` (testeable sin React), el lote en una sola escritura y la UI en un componente. **Pros:** `page.tsx` apenas crece; tests unitarios fáciles. **Cons:** toca el store. **Effort:** S–M.
### B. Bucle de `addEntry` en `page.tsx`
Sin tocar el store. Descartada: N escrituras y más lógica en una página ya grande.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica | `src/lib/diary.ts` | `copyDay`, `copyTargets`, `canCopyTo`, `formatDayShort`, `entryName` |
| Store | `src/lib/store.tsx` | `addEntries(es)` en `AppState` y en el valor del provider |
| UI | `src/components/diario/CopyDaySheet.tsx` (nuevo) | Hoja con pasos `pick` y `conflict` |
| Página | `src/app/page.tsx` | Botón de icono, estado `copyOpen`/`copied`, `Toast`, marca «Copiada», usa `entryName` |
| Tests | `tests/unit/diary-copy.test.ts`, `tests/unit/CopyDaySheet.test.tsx`, `tests/e2e/diario-copiar-dia.spec.ts` | Nuevos |

### Data model
Ninguno: `MealEntry` no cambia, sin migración y sin claves nuevas de sync ni backup.

### APIs / interfaces
- `copyDay(entries, from, to, newId = () => crypto.randomUUID()): MealEntry[]`: solo las entradas nuevas, en el orden de registro del origen, con `repeatEntry(e, to, e.mealType, newId())`.
- `copyTargets(origin, today): { label: string; date: string }[]`: Hoy, Mañana, En 7 días desde hoy (con `addDays`), sin el que coincide con `origin`.
- `canCopyTo(origin, target): boolean`: `false` si `target` está vacío, no es `YYYY-MM-DD` válido o es `origin`.
- `formatDayShort("2026-10-05")` → «lun 5 oct» (con `dayName` y un array de meses; sin `Intl`, como `formatServings`).
- `entryName(e, recipes)`: `e.customName ?? receta?.name ?? "Receta"`, extraído de `page.tsx`.
- `addEntries(es: MealEntry[])`: `setEntries(prev => [...prev, ...es])`.
- `CopyDaySheet({ from, today, entries, recipes, onCopy(to), onClose })`.

### UI
- Artboard 1: icono `Copy` (lucide) de 44 px junto al input de fecha, `aria-label` «Copiar día a otra fecha», `disabled` si `dayEntries.length === 0`.
- Artboard 2 (paso `pick`): título «Copiar el <día> a…», recuento y kcal, atajos como botones (el elegido resaltado), campo de otra fecha, «Copiar a <destino>» (desactivado según `canCopyTo`) y «Cancelar».
- Artboard 3 (paso `conflict`): mismo `Sheet` con el título «El <fecha> ya tiene M entradas», la lista (`entryName`, franja, kcal), «Sumar las N entradas» y «Cancelar» (cierra todo).
- Artboard 4: `Toast` sin acción «Copiadas N entradas» (10 s); las entradas de `copied.ids` llevan `Chip` «Copiada».
- Artboard 5: el botón desactivado.
- Reutiliza `Sheet`, `Toast`, `Chip`, `singleClick` (a mover al módulo común si la hoja lo necesita), `inputCls`.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Botón de cabecera + `CopyDaySheet` |
| R2 | `copyDay` con `repeatEntry`; `addEntries` en una escritura |
| R3 | Paso `conflict` de la hoja si el destino tiene entradas; solo `addEntries`, nunca borra |
| R4 | `setDate(to)` + `copied` → `Toast` «Copiadas N entradas» |
| R5 | `disabled` si no hay `dayEntries` |
| R6 | `canCopyTo` (≠ origen, fecha válida) |
| R7 | `copyTargets` + campo de fecha |
| R8 | Marca por `copied.ids`, mientras dura el aviso |

## Risks & mitigations
- `page.tsx` crece: la lógica va a `diary.ts` y la UI a la hoja; solo se añaden botón, dos estados y el aviso.
- Sin Deshacer (aceptado en el spec): el aviso y el de conflicto reducen los errores.
- Otras ramas abiertas pueden tocar `page.tsx`: conflictos de merge acotados; se resuelven al actualizar la rama.

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| Hoja y destino elegido | Al reabrir vuelve a «elegir», sin destino previo | `{copyOpen && <CopyDaySheet/>}` (se desmonta) |
| `copied` al cambiar de fecha | Se cierra aviso y marcas | `setCopied(null)` en el `onChange` del input de fecha (tras `setDate(to)` de la copia, no antes) |
| `copied` vs `added` | Solo un aviso a la vez | Cada uno hace `set…(null)` del otro |
| Entradas del origen cambian con la hoja abierta (sync) | Se usan las vivas, no una copia | La hoja recibe `entries`; `copyDay` se calcula al confirmar |
| 0 entradas al confirmar | No crea nada; cierra la hoja | `copyDay` → `[]`; el handler sale sin aviso |
| Doble toque en Copiar o Sumar | Una sola copia | `singleClick` + cerrar la hoja a la vez |
| Entrada marcada «Copiada» que se borra | Sin efecto | `copied.ids` solo se consulta |
| Fecha vacía, inválida o igual al origen | «Copiar» desactivado | `canCopyTo` |
| Atajos al cruzar mes o año | Correctos | `addDays` |
| Entrada con calorías `NaN` (backup editado) | Se copia tal cual | `repeatEntry` no recalcula |

## Testing strategy
- **Unit** (`diary-copy.test.ts`): `copyDay` (ids nuevos y únicos, campos intactos con receta × raciones, alimento con gramos y unidades, fibra ausente, orden, origen sin cambios, `[]` si no hay), `copyTargets` (desde hoy, sin el origen, fin de mes y de año), `canCopyTo`, `formatDayShort`, `entryName`.
- **Componente** (`CopyDaySheet.test.tsx`): pasos `pick` y `conflict`, «Copiar» desactivado, «Cancelar» cierra sin llamar a `onCopy`, `Escape`.
- **E2E** (`diario-copiar-dia.spec.ts`): copia sin conflicto (≤ 3 toques), con conflicto (sumar y cancelar), día vacío con botón desactivado, destino futuro, aviso se cierra al cambiar de día; axe sobre la hoja.

## Tasks
1. [ ] `diary.ts`: `copyDay`, `copyTargets`, `canCopyTo`, `formatDayShort`, `entryName` + unit tests (covers R2, R6, R7)
2. [ ] Store: `addEntries` (covers R2)
3. [ ] `CopyDaySheet` con los dos pasos + test de componente (covers R1, R3, R5, R6, R7)
4. [ ] `page.tsx`: botón, estado, `Toast`, marca «Copiada», usa `entryName` (covers R1, R4, R5, R8)
5. [ ] e2e `diario-copiar-dia.spec.ts` (covers R1–R8)
6. [ ] Lint, tipos, build y pasada de a11y

## Spec feedback
- Sin cambios en el spec.
- Decisión nueva (técnica): el aviso se cierra al cambiar de fecha; el spec solo dice que dura 10 s. Si el usuario quiere reflejarlo en R4, se anota allí.
