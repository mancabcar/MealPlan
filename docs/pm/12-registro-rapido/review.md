# Registro rápido: Recientes: Review
_PR: [#61](https://github.com/mancabcar/MealPlan/pull/61) · Reviewed: 2026-09-27 · Verdict: ⚠️ approved with follow-ups_

## Summary
Los 7 requisitos (5/5 Must) están implementados y probados. El alcance se limita a Recientes y sigue el tech design, salvo dos detalles internos documentados en el PR. La revisión de código (pasada 1, esfuerzo `high`) encontró 6 hallazgos, ninguno bloqueante. Por decisión del usuario, tres (fecha vacía, coste de cálculo y test de R7) se arreglaron en esta misma rama y el resto queda anotado.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/app/page.tsx` (`<RecentMeals>` entre el selector de franja y las pestañas), `RECENT_LIMIT` en `src/lib/diary.ts` | ✅ e2e (posición, Personalizada, 5 filas) + axe |
| R2 | ✅ Done | `recentKey` en `src/lib/diary.ts` | ✅ unit |
| R3 | ✅ Done | `recentMeals` en `src/lib/diary.ts` | ✅ unit (incl. «Avena en Cena») + e2e (cambio de franja) |
| R4 | ✅ Done | `repeatEntry` + `onPick` en `src/app/page.tsx`; `singleClick` en la fila y en «Añadir comida» | ✅ unit + e2e (fecha/franja, id nuevo, doble toque) |
| R5 | ✅ Done | `src/components/diario/RecentMeals.tsx` | ✅ e2e («× 0,5», redondeo) |
| R6 | ✅ Done | `RecentMeals` devuelve `null` con la lista vacía | ✅ unit + e2e |
| R7 | ✅ Done | derivado de `entries`; recetas inexistentes ignoradas | ✅ unit + e2e (borrar, receta inexistente) |

Casos límite de la spec: todos cubiertos. Non-goals: nada construido fuera de alcance; el PR solo toca archivos de la feature.

Diferencias con `tech.md` (aceptadas, anotadas en el PR): `onPick` recibe también el evento para aplicar `singleClick`; la `<ul>` lleva `aria-labelledby` al título «Recientes».

## Blocking
Ninguno.

## Non-blocking
- **Arreglado en la rama.** Con el campo de fecha vacío, tocar una reciente (y también «Añadir») guardaba una entrada con `date: ""` que no sale en ningún día. Ahora `submitAdd` y `onPick` no añaden nada sin fecha (`src/app/page.tsx`). Test e2e nuevo en «Review de #12: fecha borrada».
- **Arreglado en la rama.** `recentMeals` buscaba cada receta con `recipes.find` (O(entradas × recetas)) y se calculaba en cada render del Diario. Ahora usa un `Map` por id y solo se calcula con el formulario abierto.
- **Arreglado en la rama.** El test unitario de R7 no podía fallar. Ahora comprueba que la lista cambia al quitar una entrada.
- **Anotado.** `recentKey` usa `e.servings ?? 1` sin comprobar el tipo: un `servings` de texto en datos importados («0.5») se junta con el numérico. La app no genera esos datos.
- **Anotado.** Una entrada sin `recipeId` ni `customName` saldría como una fila sin nombre (la lista del Diario pone «Receta»). La app no genera esas entradas.
- **Anotado, refactor opcional.** `singleClick` vive en `page.tsx`; moverlo a un módulo compartido simplificaría la firma de `onPick`.

## Code review findings
Todos los hallazgos de la pasada 1 están arriba, en Non-blocking.
