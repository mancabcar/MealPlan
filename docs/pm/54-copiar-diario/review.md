# Diario: copiar un día completo a otra fecha: Review
_PR: [#153](https://github.com/mancabcar/MealPlan/pull/153) · Reviewed: 2026-10-07 · Verdict: ⚠️ approved with follow-ups_

## Summary
Los ocho requisitos están hechos y probados (6 Must, 1 Should, 1 Could), sin tests saltados ni aflojados y con la suite entera en verde. El code-review a nivel `high` dejó 5 hallazgos, todos no bloqueantes por decisión del usuario, que quedan como follow-ups. Los tres cambios no previstos en el spec (selector exacto en `agua.spec.ts`, `singleClick` a `ui/`, `entryName` a `diary.ts`) están aceptados.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 (Must) botón de cabecera | ✅ Done | src/app/page.tsx:250 | ✅ e2e + componente |
| R2 (Must) copia exacta con ids nuevos | ✅ Done | src/lib/diary.ts:205 · src/lib/store.tsx:195 | ✅ unit + store + e2e |
| R3 (Must) aviso de conflicto | ✅ Done | src/components/diario/CopyDaySheet.tsx:55 · :116 | ✅ componente + e2e |
| R4 (Must) salto al destino + «Copiadas N entradas» | ✅ Done | src/app/page.tsx:231 · :563 | ✅ e2e (incluye cierre a los 10 s) |
| R5 (Must) botón desactivado sin entradas | ✅ Done | src/app/page.tsx:251 | ✅ e2e |
| R6 (Must) destino pasado o futuro, no el origen | ✅ Done | src/lib/diary.ts:210 · CopyDaySheet.tsx:115 | ✅ unit + componente + e2e |
| R7 (Should) atajos y selector | ✅ Done | src/lib/diary.ts:223 · CopyDaySheet.tsx:92 | ✅ unit + componente + e2e |
| R8 (Could) marca «Copiada» | ✅ Done | src/app/page.tsx:377 | ✅ e2e |

Edge cases del spec: franja que el perfil no muestra, fibra sin dato, destino con duplicados, doble toque, receta que ya no existe y agua sin copiar, todos cubiertos. Pendiente de test, sin poder provocarse desde la UI: «0 entradas al confirmar» (cubierto en unit por `copyDay → []`).

Verificado en la revisión: `npm run lint`, `typecheck`, `build`, `check:briefs`; 1543 tests unit y 579 e2e en verde (5 saltados que ya lo estaban).

## Blocking
Ninguno.

## Non-blocking
1. **Lista del conflicto sin tope:** src/components/diario/CopyDaySheet.tsx:62. En un destino con muchas entradas, «Sumar» y «Cancelar» quedan bajo el pliegue de la hoja (85vh). → limitar la altura de la lista con scroll propio (`max-h-56 overflow-y-auto`) y test con un destino de 12 entradas.
2. **Chip «Copiada» pegado al texto:** src/app/page.tsx:377. Solo hay margen visual; el texto sale como «0,5Copiada» en lectores de pantalla. → añadir `{" "}` antes del chip.
3. **Exclusión de avisos sin test:** src/app/page.tsx:231 y :455. Que el aviso de copia anule el de «Añadir comida» y al revés no lo cubre ningún test. → test e2e que añada un alimento tras copiar (o al revés) y compruebe un solo `role="status"`.
4. **Limpieza del aviso atada al input:** src/app/page.tsx:264. «Cambiar de día cierra el aviso» está en el `onChange` del input, no en `date`. → derivar la visibilidad de `copied.date === date`, o limpiar con un efecto sobre `date`.
5. **Duplicados menores:** CopyDaySheet.tsx:15 (clases de botón, ya repetidas en `CopyWeekSheet`, `ServingsSheet` y `BatchSheet`, con otra forma aquí), el singular/plural en dos sitios (`entradas()` y page.tsx:238) y `origin` refiltrado cuando la página ya tiene `dayEntries`.

## Code review findings
Los cinco anteriores son todo lo que dejó el code-review (nivel `high`); ninguno adicional.

## History
- 2026-10-07 pass 1: ⚠️ approved with follow-ups. Todos los Must cumplidos y probados; 5 hallazgos no bloqueantes (decididos así por el usuario) quedan como follow-ups. El usuario decidió no arreglar el 1 y el 2 en esta rama.
