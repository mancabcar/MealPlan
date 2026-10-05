# Raciones en el Plan: Review
_PR: [#127](https://github.com/mancabcar/MealPlan/pull/127) · Reviewed: 2026-10-05 · Verdict: ⚠️ approved with follow-ups_

## Summary
Los 9 requisitos (8 Must, 1 Should) están implementados y cubiertos por tests: 1268 unit y 495 e2e en verde, `lint`, `typecheck` y `next build` limpios, y CI del PR en verde. No hay nada construido fuera del spec ni cambios sin relación. Los hallazgos son menores y se dejan como follow-ups (veredicto confirmado por Manuel, 2026-10-05).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/lib/types.ts (servings), src/lib/plan/servings.ts:7, src/app/plan/page.tsx:77 | ✅ |
| R2 | ✅ Done | src/app/plan/page.tsx:96, :161 · src/components/ui/ServingsField.tsx | ✅ |
| R3 | ✅ Done | src/app/plan/page.tsx:249, :256 · src/components/plan/ServingsSheet.tsx | ✅ |
| R4 | ✅ Done | src/lib/planMacros.ts:36, :89 | ✅ |
| R5 | ✅ Done | src/lib/shopping/aggregate.ts:58 | ✅ |
| R6 | ✅ Done | src/lib/diary.ts:129 · src/app/page.tsx:276, :303, :314 | ✅ |
| R7 | ✅ Done | src/lib/planMacros.ts:36 (ausente = 1, sin migración) | ✅ |
| R8 (Should) | ✅ Done | botón "Raciones" en sobras y cocinada; aggregate.ts prioriza `cookedServings` | ✅ |
| R9 | ✅ Done | src/app/plan/page.tsx:86, src/lib/plan/batch.ts:151 | ✅ |

- **Tech design:** seguido. Única divergencia documentada: `commitAssign` conserva `servings` en la tarea 5 (tech.md la listaba en la 3). El commit 1 no incluye aún `servings?` en `DayPlanSlot` y su typecheck falla; solo es historia, la rama final es correcta.
- **Alcance:** sin extras ni non-goals construidos. Un test previo (`diary.test.ts`) se actualizó a `servings: 1` por el cambio de `PendingSlot` aprobado en el diseño.
- **Criterios ambiguos:** ninguno que el código haya tenido que interpretar.

## Blocking
Ninguno.

## Non-blocking
- Ningún Must queda sin test automático.

## Code review findings
Pass 1 (`code-review`, nivel high). Todos no bloqueantes, por decisión de Manuel:
1. **Etiqueta sin normalizar** (src/app/plan/page.tsx:249, :260, :263): `servingsLabel(slot)` lee `slot.servings` crudo, mientras macros y compra usan `slotServings`. Con un backup con `servings` 0 o negativo el Plan mostraría "× 0" pero contaría 1 → usar `slotServings` también para la etiqueta.
2. **Guardar con la franja desaparecida** (src/components/plan/ServingsSheet.tsx:41): `setSlotServings` lanza "La franja no existe" si la franja se borra (sincronización, receta borrada) con la hoja abierta; no hay aviso ni cierre → guarda y cierre limpio.
3. **Botones duplicados** (ServingsSheet.tsx:14 y BatchSheet.tsx:24): `primaryBtn`/`secondaryBtn` idénticos → exportar de un módulo común.
4. **Ternario largo** (src/lib/plan/batch.ts:151): spread condicional en una línea de más de 150 caracteres para conservar `servings` → derivar de la franja o usar un helper.
5. **`servingsLabel` evaluado dos veces** (src/app/page.tsx:314; plan/page.tsx:249–263) con un objeto temporal → `const label` por franja.
6. **Estado de raciones repetido en 3 sitios** (Diario, tarjeta del Plan, ServingsSheet; p. ej. plan/page.tsx:90) → un hook `useServingsInput`.
