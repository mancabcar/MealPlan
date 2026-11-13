# "Caduca en X días" en la tarjeta de receta: Review
_PR: [#187](https://github.com/mancabcar/MealPlan/pull/187) · Reviewed: 2026-11-04 · Verdict: ⚠️ approved with follow-ups_

## Summary
R9 (de la [spec de #16](../16-despensa-recetas/spec.md)) está hecho y cubierto por tests unitarios y e2e. Sin hallazgos bloqueantes. Los dos puntos de la code-review que Manuel eligió arreglar (color sin test, umbral duplicado) se corrigieron en `b4352ba`; los otros tres quedan anotados en el brief. Veredicto y clasificación confirmados por Manuel.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R9 | ✅ Done | src/components/recetas/RecipeCard.tsx:61, src/lib/types.ts (`expiresSoon`, `expiryLabel`) | ✅ unit (`tests/unit/pantry.test.ts`) + e2e (`tests/e2e/despensa-recetas.spec.ts`) |

Decisiones del brief comprobadas: solo con "Usa lo que tengo"; sustituye a "caduca pronto" en la tarjeta; hoy / mañana / en X días; naranja con 0–2 días, neutro con más; sin chip si ningún coincidente tiene fecha.

## Blocking
Ninguno.

## Non-blocking
- ✅ fixed in b4352ba: el color naranja/neutro no tenía test → test unitario de `expiresSoon` (0–2 sí, 3+ no, caducado no).
- ✅ fixed in b4352ba: el umbral de "pronto" estaba duplicado (`<= 2` en la tarjeta, `< 3` en `isExpiringSoon`) → `expiresSoon()` en `src/lib/types.ts`, usado por los dos; `expiryLabel` se mueve junto a `daysUntil` y desaparece el envoltorio `ExpiryChip`.
- Follow-up (brief): un número de días negativo se muestra como "caduca hoy" (solo con Recetas abierta pasada la medianoche sin re-render).

## Code review findings
Code-review `high`: 5 hallazgos, todos recogidos arriba (los de ubicación de `expiryLabel` y del envoltorio de un solo uso quedan resueltos con el arreglo del umbral).

## History
- 2026-11-04 pass 1: ⚠️ approved with follow-ups. 5 hallazgos no bloqueantes; 2 arreglados en b4352ba, 1 como follow-up en el brief, 2 resueltos con esos arreglos.
