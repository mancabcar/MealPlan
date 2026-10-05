# Copiar la semana anterior en el Plan: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Un módulo puro `src/lib/plan/copyWeek.ts` calcula qué se copia y qué entra en conflicto, y aplica la copia en modo `conservar` o `reemplazar`, reutilizando `deleteOrigin` de `batch.ts`. El Plan solo añade un botón bajo `WeekNav`, una hoja de conflictos y un `Toast` con Deshacer. Sin modelo de datos nuevo, migración ni flag. Esfuerzo S–M.

## Context
- `weekPlan` es un único `WeekPlan` (`Record<fecha, DayPlanSlot[]>`) para todas las semanas, guardado con `setWeekPlan` (`src/lib/store.tsx`, que también acepta actualizador funcional, p. ej. línea 188) y sincronizado como un blob.
- La semana vista sale de `useWeekParam()` (`monday`, `dates`, `today`) en `src/app/plan/page.tsx`; el reset al cambiar de semana está en el bloque `shownWeek !== monday` (cierra `editing` y `modal`).
- Tandas: `src/lib/plan/batch.ts` (`batchOf`, `deleteOrigin(plan, id, "all"|"keep")`, `removeLeftover`); las sobras solo caben en la semana de su cocinada.
- Reutilizables: `Toast` con acción (`src/components/ui/Toast.tsx`, patrón en `src/app/page.tsx` ~509), `Sheet` y las clases de botón de `BatchSheet.tsx`, `addDays`/`weekDates` en `src/lib/week.ts`.
- Pruebas: vitest en `tests/unit` (modelo: `plan-batch.test.ts`), Playwright en `tests/e2e` (modelo: `plan-semanas.spec.ts`).

## Approaches considered
### A. Módulo puro + UI en el Plan (chosen)
Funciones plan→plan como `batch.ts`; probables sin render. **Pros** testeable, sin cambios de datos, coherente con #17. **Cons** un fichero nuevo. **Effort** S–M.
### B. Lógica dentro de `plan/page.tsx`
Descartada: la página ya tiene ~280 líneas y la lógica de tandas no se podría probar sin navegador.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica | `src/lib/plan/copyWeek.ts` (nuevo) | `planCopy`, `applyCopy` |
| Plan | `src/app/plan/page.tsx` | botón, estado de la hoja y del aviso, reset al cambiar de semana |
| Hoja | `src/components/plan/CopyWeekSheet.tsx` (nuevo) | Conservar / Reemplazar / Cancelar, sobre `Sheet` |
| Tests | `tests/unit/plan-copy-week.test.ts`, `tests/e2e/copiar-semana.spec.ts` (nuevos) | R1–R5 |

### Data model
Ninguno. Los `batchId` nuevos son `crypto.randomUUID()` (como `createBatch`).

### APIs / interfaces
```ts
// copyWeek.ts: `monday` = lunes de la semana destino; origen = addDays(monday, -7)
planCopy(plan, monday, recipeIds: Set<string>): {
  slots: CopySlot[];     // de origen, ya con fecha destino; sin recetas borradas ni idénticas
  conflicts: number;     // franjas de destino ocupadas que se pisarían
  sourceEmpty: boolean;  // R4: la semana origen no tiene ninguna franja
}
applyCopy(plan, monday, recipeIds, mode: "keep" | "replace"): { plan: WeekPlan; copied: number }
```
- «Idéntica» = misma `recipeId` y raciones, sin `batchId` en ninguna de las dos: ni conflicto ni copiada.
- `keep`: se rellenan solo vacías; una tanda con algún miembro en conflicto se omite entera.
- `replace`: por cada franja de destino pisada, si es una cocinada → `deleteOrigin(…, "keep")` (sus sobras pasan a franjas normales); si es una sobra → se sustituye (`removeLeftover` equivalente). Luego se escribe lo copiado.
- Tandas: se copian los miembros de origen con `batchId` nuevo; cocinada sin sobras o sobras sin cocinada (miembros fuera de la semana de origen, caso casi imposible) pasan a franja normal, sin `cookedServings`/`leftover`.
- Copia: raciones tal cual (`servings`, `cookedServings`).

### UI
- Fila bajo `WeekNav`: botón secundario a ancho completo («Copiar semana anterior», mín. 44 px). Desactivado con `sourceEmpty`, con texto de ayuda «La semana anterior no tiene nada que copiar» (`aria-describedby`).
- Al pulsar: `planCopy`; si `conflicts > 0` → `CopyWeekSheet` («N franjas ya tienen receta»); si no → `applyCopy` directo.
- Tras copiar: `Toast` «Copiadas N franjas · Deshacer». Si `copied === 0`: «No hay nada nuevo que copiar», sin acción y sin escribir.
- Deshacer: antes de escribir se guardan los 7 días del destino (`{[fecha]: slots|undefined}`); Deshacer solo restaura esos 7 días con un `setWeekPlan` funcional, sin tocar otras semanas.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `applyCopy` mapea origen `addDays(-7)` → destino, mismo día y comida, con raciones; botón en cualquier semana |
| R2 | `planCopy.conflicts` + `CopyWeekSheet` con las tres opciones; Cancelar no escribe |
| R3 | Copia de tandas con `batchId` nuevo; degradación a franja normal; `deleteOrigin "keep"` al pisar cocinadas |
| R4 | `sourceEmpty` desactiva el botón |
| R5 | `Toast` con Deshacer que restaura los 7 días guardados |

## Risks & mitigations
- El plan se sincroniza como un blob con último escritor ganador. Aceptado, como hoy. Deshacer tras una edición concurrente de esos 7 días desde otro dispositivo la pisa.
- Copiar escribe muchas franjas de una vez: una sola llamada a `setWeekPlan` (un solo guardado y una sola sincronización).
- La lista de la compra de la semana destino se recalcula sola desde el plan; su estado (marcados) no se copia (non-goal).

## State & edge cases
| State or value | Reset / expected behavior | Mechanism |
|---|---|---|
| Hoja de conflictos abierta al cambiar de semana | se cierra | variante nueva en el tipo `Modal`; ya se pone `modal` a `null` en el bloque `shownWeek !== monday` |
| `Toast` con Deshacer al cambiar de semana | desaparece | estado `copied` a `null` en el mismo bloque; `key` por `monday` |
| Tarjeta `editing` abierta al pulsar copiar | se cierra | `setEditing(null)` al pulsar |
| Segundo toque seguido en «Copiar» | no cuenta dos veces | las idénticas no cuentan: sale «No hay nada nuevo que copiar» |
| Semana origen sin franjas | botón desactivado | `sourceEmpty` |
| Receta de origen borrada | se omite; cuenta solo lo copiado | filtro por `recipeIds` |
| Origen con solo recetas borradas | botón activo; aviso «No hay nada nuevo que copiar» | `copied === 0` |
| Comida que el usuario ya no hace | se copia igualmente; el Plan no la muestra | no se filtra por `profile.meals` |
| Cruce de mes/año | correcto | `addDays` por fecha local |
| `servings` ausente/1 | se conserva tal cual; con 1 no se guarda | se copia el campo sin transformar |
| Cocinada pisada con sobras en destino | sus sobras quedan como franjas normales | `deleteOrigin "keep"` |
| Sobra suelta pisada | se sustituye; las raciones cocinadas no cambian | reemplazo de franja |

## Testing strategy
- **Unit** (`plan-copy-week.test.ts`): copia día a día con raciones (R1); conflictos y los modos `keep`/`replace` (R2); tandas enteras con `batchId` nuevo y degradación (R3); `sourceEmpty` (R4); idénticas; receta borrada; pisar cocinada y sobra; cruce de año.
- **E2E** (`copiar-semana.spec.ts`): botón y copia; hoja con las tres opciones; botón desactivado con su texto; Toast con N y Deshacer (R5); «No hay nada nuevo»; cierre de hoja/aviso al cambiar de semana. Sembrar el plan por `localStorage` como hace `plan-semanas.spec.ts`.

## Tasks
1. [x] `copyWeek.ts` puro + tests unitarios (R1–R4)
2. [ ] Botón bajo `WeekNav` y copia sin conflictos con `Toast` (R1, R4)
3. [ ] `CopyWeekSheet` y flujo de conflictos (R2)
4. [ ] Deshacer en el `Toast` y reset al cambiar de semana (R5)
5. [ ] Tests e2e y brief

## Spec feedback
- Hueco resuelto por el usuario: una franja idéntica en destino no es conflicto ni se cuenta como copiada (añadido aquí; `spec.md` no cambia salvo que el usuario lo pida).
- R5 se interpreta como restaurar solo los 7 días de la semana destino, no el plan entero.
- Sin preguntas abiertas.

## Test coverage
Unit: `tests/unit/plan-copy-week.test.ts` (contrato `planCopy`/`applyCopy`). E2E: `tests/e2e/copiar-semana.spec.ts`. Datos: `tests/fixtures/copiar-semana.ts`. Textos fijados con el usuario: botón «Copiar semana anterior»; diálogo «N franjas ya tienen receta» / «1 franja ya tiene receta» con «Conservar las que hay», «Reemplazarlas», «Cancelar»; ayuda «La semana anterior no tiene nada que copiar»; aviso «Copiadas N franjas» / «Copiada 1 franja» + «Deshacer»; «No hay nada nuevo que copiar».

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | plan-copy-week › "R1: copia receta y raciones día a día…", "…sin raciones sigue sin `servings`", "…no toca la semana origen ni otras semanas…", "…cualquier semana vista…", "…cruza el cambio de año", "…comidas que el usuario ya no hace", "planCopy cuenta…" | unit | 🔴 failing (not built) |
| R1 | copiar-semana › "R1: copia las 8 franjas…", "…conserva las raciones", "…funciona en cualquier semana vista" | e2e | 🔴 failing (not built) |
| R2 | plan-copy-week › conflictos (recuento, conservar, reemplazar, idéntica no es conflicto, otras raciones sí, copiar dos veces) | unit | 🔴 failing (not built) |
| R2 | copiar-semana › sin diálogo sin conflictos, diálogo con número exacto, singular, Conservar, Reemplazar, Cancelar | e2e | 🔴 failing (not built) |
| R3 | plan-copy-week › tanda entera con `batchId` nuevo, origen intacto, cocinada sin sobras, sobras sin cocinada, conservar omite la tanda, reemplazar cocinada, reemplazar sobra | unit | 🔴 failing (not built) |
| R3 | copiar-semana › tanda entera visible («Cocinar ×3», «Sobras · de Martes»), `batchId` distinto | e2e | 🔴 failing (not built) |
| R4 | plan-copy-week › `sourceEmpty` (vacío, días vacíos, otras semanas, con franjas) | unit | 🔴 failing (not built) |
| R4 | copiar-semana › botón desactivado con su texto; activo con origen | e2e | 🔴 failing (not built) |
| R5 | copiar-semana › Deshacer tras reemplazar, Deshacer en semana vacía, «No hay nada nuevo» sin Deshacer | e2e | 🔴 failing (not built) |
| R5 (alcance: solo los 7 días) | — | — | ⚪ sin test: no se puede provocar desde la UI sin cambiar de semana (el aviso se cierra); lo revisa dev-review en el código |
| Edge | Recetas borradas (unit y e2e); cierre de aviso y de diálogo al cambiar de semana; selector abierto se cierra al copiar; segundo toque sin conflicto | unit + e2e | 🔴 failing (not built) |
