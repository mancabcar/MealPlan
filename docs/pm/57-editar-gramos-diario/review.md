# Diario: editar la cantidad de una entrada ya registrada: Review
_PR: [#173](https://github.com/mancabcar/MealPlan/pull/173) · Reviewed: 2026-10-19 · Verdict: 🔁 changes requested_

## Summary
La PR cumple la spec: los 8 requisitos están hechos (5/5 Must y 3/3 Should) y todos tienen tests unitarios y e2e en verde. Hay un bloqueante de accesibilidad: el nombre accesible de la fila editable oculta la cantidad, las kcal, la fibra y «Copiada» a los lectores de pantalla. Además, el usuario ha decidido arreglar en esta PR que el aviso «Cantidad cambiada · Deshacer» sobreviva al cambio de día. Esta revisión no es independiente: el código lo escribió Claude en la misma sesión. La pasada 1 se hizo con `code-review` a esfuerzo high.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/components/diario/DiaryEntryRow.tsx:69 (botón de fila), src/app/page.tsx (`editingId`) | ✅ unit + e2e |
| R2 | ✅ Done | src/lib/diary.ts (`entryQuantity`), src/components/diario/FoodQuantityForm.tsx | ✅ unit + e2e |
| R3 | ✅ Done | src/lib/diary.ts (`rescaleEntry`), src/lib/store.tsx:228 (`replaceEntry`) | ✅ unit + e2e |
| R4 | ✅ Done | src/app/page.tsx (`openAdd`, «Copiar día», fecha, `onRemove`) | ✅ unit + e2e |
| R5 | ✅ Done | src/lib/diary.ts (`entryQuantity` → null) | ✅ unit + e2e |
| R6 | ✅ Done | DiaryEntryRow.tsx (`preview`), FoodQuantityForm.tsx (`preview`) | ✅ unit + e2e |
| R7 | ✅ Done | src/app/page.tsx (Toast `edited`), src/lib/diary.ts (`undoEdit`) | ✅ unit + e2e |
| R8 | ✅ Done | DiaryEntryRow.tsx (`ServingsEditor`) | ✅ unit + e2e |

Verificado en local: lint, tipos, build, 1792 tests unitarios y 638 e2e. También a mano en la app: arroz 150 → 100 g con Deshacer, y el Guiso a 0,5 raciones en 375 px. Respecto a `tech.md`, el editor de raciones es un `ServingsEditor` privado y las tareas 5 y 6 van en un solo commit; ambas diferencias se aceptan. No hay cambios fuera de alcance.

## Blocking
1. **El nombre accesible oculta la información de la fila:** src/components/diario/DiaryEntryRow.tsx:74. `aria-label="Cambiar cantidad de <nombre>"` sustituye todo el contenido del botón, así que un lector de pantalla ya no anuncia «150 g», «195 kcal», la fibra ni «Copiada». Antes de la PR sí se anunciaban, y en las personalizadas, que no son editables, se siguen anunciando. → Mantener el nombre elegido y enlazar el resumen con `aria-describedby`, o sacar el resumen del nombre de otra forma equivalente. Hay que añadir un test unitario que compruebe la descripción accesible.
2. **El aviso «Cantidad cambiada · Deshacer» sobrevive al cambio de día:** src/app/page.tsx:316. Al cambiar la fecha, Deshacer revierte una entrada de otro día sin que se vea nada en pantalla. → Decisión del usuario: cerrar el aviso al cambiar de día, como «Copiadas» (`setEdited(null)` en el `onChange` de la fecha), más un e2e.

## Non-blocking
- Tocar la fila con el editor abierto no lo pliega, aunque anuncia `aria-expanded=true` (DiaryEntryRow.tsx:73).
- Una entrada antigua en gramos con un valor no entero (p. ej. 112,5 g con `units` no válido) abre el editor en error, porque `parseGrams` solo acepta enteros (DiaryEntryRow.tsx:97).
- Sin test automático (previsto en `tech.md`): una entrada que desaparece por sync con el editor abierto, y los toques accidentales al desplazar en un móvil real.

## Code review findings
- **Altitude:** la regla de «un aviso a la vez» se mantiene con `setX(null)` repartidos en 6 sitios de page.tsx. Un único estado `notice` (unión discriminada) haría imposible el solapamiento.
- **Reuse:** `ServingsEditor` duplica los botones «Guardar cambios» y «Cancelar» de `FoodQuantityForm` y se comporta distinto (no desactiva el botón con un valor inválido).
- **Efficiency:** `replaceEntry` con una id que no existe devuelve igualmente un array nuevo y reescribe y sincroniza `entries` (store.tsx:228).

## History
- 2026-10-19 pass 1: 🔁 changes requested. Spec completa (8/8); 2 bloqueantes (accesibilidad de la fila y aviso que sobrevive al cambio de día) y 5 no bloqueantes que van a los Follow-ups del brief.
