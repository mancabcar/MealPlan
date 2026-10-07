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

## Test coverage
Escritos antes del código; fallan hasta que exista cada pieza. Fixtures en `tests/fixtures/copiar-dia.ts`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/e2e/diario-copiar-dia.spec.ts` › «R1: está junto al input de fecha…» y «al tocarlo se abre la hoja…» | e2e | 🔴 failing (not built) |
| R1 | `tests/unit/CopyDaySheet.test.tsx` › «R1: la hoja de destino» (título, resumen, singular, entradas vivas, Escape, Cancelar) | component | 🔴 failing (not built) |
| R2 | `tests/unit/diary-copy.test.ts` › «R2: copyDay…» (16 casos: ids, campos, orden, `NaN`, receta huérfana) | unit | 🔴 failing (not built) |
| R2 | `tests/unit/store-entries.test.tsx` › «R2: addEntries…» (una sola escritura) | unit | 🔴 failing (not built) |
| R2 | `tests/e2e/diario-copiar-dia.spec.ts` › «R2 · R4 · R7: copiar un día sin conflicto» (3 toques, texto de raciones y unidades, ids, agua, franja del perfil) | e2e | 🔴 failing (not built) |
| R3 | `tests/unit/CopyDaySheet.test.tsx` › «R3: aviso cuando el destino ya tiene entradas» | component | 🔴 failing (not built) |
| R3 | `tests/e2e/diario-copiar-dia.spec.ts` › «R3: el destino ya tiene entradas» (avisar, cancelar, sumar, reabrir) | e2e | 🔴 failing (not built) |
| R4 | `tests/e2e/diario-copiar-dia.spec.ts` › «R4 · R8: aviso…» (singular, sin Deshacer, 10 s, pendientes del Plan) | e2e | 🔴 failing (not built) |
| R5 | `tests/e2e/diario-copiar-dia.spec.ts` › «R5: día sin entradas» | e2e | 🔴 failing (not built) |
| R6 | `tests/unit/diary-copy.test.ts` › «R6: canCopyTo» | unit | 🔴 failing (not built) |
| R6 | `tests/unit/CopyDaySheet.test.tsx` › «R6: cuándo se puede copiar» | component | 🔴 failing (not built) |
| R6 | `tests/e2e/diario-copiar-dia.spec.ts` › «R6 · R7: destino futuro, pasado y atajos» | e2e | 🔴 failing (not built) |
| R7 | `tests/unit/diary-copy.test.ts` › «R7: copyTargets» y «R7: formatDayShort» | unit | 🔴 failing (not built) |
| R7 | `tests/unit/CopyDaySheet.test.tsx` › «R7: atajos y botón principal» | component | 🔴 failing (not built) |
| R8 | `tests/e2e/diario-copiar-dia.spec.ts` › «R8: las 5 entradas nuevas llevan la marca «Copiada»…» | e2e | 🔴 failing (not built) |
| State | Hoja que se reinicia al reabrir; `copied` se cierra al cambiar de fecha; doble toque | e2e + component | 🔴 failing (not built) |
| A11y | axe WCAG A/AA sobre la hoja, pasos «elegir» y «conflicto» | e2e | 🔴 failing (not built) |
| — | «0 entradas al confirmar» (cubierto en unidad por `copyDay → []`) y «aviso de copia vs aviso de Añadir comida» | — | ⚪ sin test (no se puede provocar desde la UI) |

Totales: 36 tests unit (32 de `diary-copy` y 4 de `store-entries`), 28 de componente y 27 e2e (91). Los 27 e2e fallan hoy por el mismo motivo: no existe el botón «Copiar día a otra fecha».

## Tasks
1. [ ] `diary.ts`: `copyDay`, `copyTargets`, `canCopyTo`, `formatDayShort`, `entryName` + unit tests (covers R2, R6, R7)
2. [ ] Store: `addEntries` (covers R2)
3. [ ] `CopyDaySheet` con los dos pasos + test de componente (covers R1, R3, R5, R6, R7)
4. [ ] `page.tsx`: botón, estado, `Toast`, marca «Copiada», usa `entryName` (covers R1, R4, R5, R8)
5. [ ] e2e `diario-copiar-dia.spec.ts` (covers R1–R8)
6. [ ] Lint, tipos, build y pasada de a11y

## Spec feedback
- Sin cambios en el spec. Decisiones tomadas al escribir los tests (confirmadas por el usuario) que fijan lo que el spec dejaba abierto:
  - **Sin destino preseleccionado:** la hoja abre sin nada elegido y «Copiar» desactivado (el prototipo dibujó «Hoy» marcado solo como ejemplo); coherente con los 3 toques icono, atajo, Copiar.
  - **Botón principal:** «Copiar» (sin destino), «Copiar a hoy», «Copiar a mañana» y, para cualquier otra fecha (incluido «En 7 días»), «Copiar al lun 29 sep».
  - **Singular y plural:** «ya tiene 1 entrada» / «2 entradas», «Sumar la entrada» / «Sumar las 5 entradas», «Copiada 1 entrada» / «Copiadas 5 entradas», «1 entrada · 300 kcal».
  - **Fechas cortas:** «lun 5 oct»; días `lun mar mié jue vie sáb dom` y meses `ene feb mar abr may jun jul ago sep oct nov dic`.
  - **Atajos:** botones con `aria-pressed`; el campo «Otra fecha» refleja el destino elegido.
  - **Accesibilidad:** axe con WCAG A y AA sobre la hoja abierta, en ambos pasos.
  - **Cierre a los 10 s:** test e2e con espera real (~11 s).
  - Contrato del componente documentado en la cabecera de `tests/unit/CopyDaySheet.test.tsx`; dev-code debe cumplirlo o pactar el cambio.
- Decisión nueva (técnica): el aviso se cierra al cambiar de fecha; el spec solo dice que dura 10 s. Si el usuario quiere reflejarlo en R4, se anota allí.
