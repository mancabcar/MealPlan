# Macros por día en el Plan semanal: Review
_PR: [#38](https://github.com/mancabcar/MealPlan/pull/38) · Reviewed: 2026-09-26 · Verdict: ⚠️ approved with follow-ups_

## Summary
El PR cumple todos los requisitos Must y Should del spec (R1–R7, R9) y sigue el tech design (enfoque A): un módulo puro `planMacros.ts` y una rejilla 2 × 2 dentro de la tarjeta del día. Cada criterio de aceptación tiene un test automatizado, y el CI está en verde (unit 484/484, e2e sobre el build de producción, Vercel). Solo queda un defecto real y fácil de corregir: un total NaN, por ejemplo de una receta importada sin macros, se marca como «Dentro». No es bloqueante porque solo se llega con un backup editado a mano.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 (Must) | ✅ Done | src/lib/planMacros.ts:41 · src/app/plan/page.tsx:48, :100 | ✅ unit + e2e (comida desmarcada, receta borrada, día vacío, franja duplicada) |
| R2 (Must) | ✅ Done | src/components/plan/DayMacroSummary.tsx:22 (`targetFor`), :68 | ✅ e2e (con y sin rango) |
| R3 (Must) | ✅ Done | src/lib/planMacros.ts:71 · src/app/page.tsx:52 (`MacroBar`) | ✅ unit (129/130/160/161, redondeo) + e2e del Diario |
| R4 (Must) | ✅ Done | src/lib/planMacros.ts:78 | ✅ unit (límites 1799/1800/2200/2201, 206/207/253/254, objetivo 0) |
| R5 (Must) | ✅ Done | src/components/plan/DayMacroSummary.tsx:16, :71 | ✅ e2e `toMatchAriaSnapshot` + axe de contraste |
| R6 (Must) | ✅ Done | derivado en render, src/app/plan/page.tsx:48 | ✅ e2e (cambiar cena, «Sin asignar», cambiar de día) |
| R7 (Should) | ✅ Done | src/components/plan/DayMacroSummary.tsx:76 | ✅ unit + e2e |
| R8 (Could) | ➖ Fuera de alcance | — (anotado en tech.md y PR) | — |
| R9 (Should) | ✅ Done | src/lib/planMacros.ts:20 | ✅ unit (× 0,5, × 2) |

Edge cases del spec: sin perfil ✅ (test de componente), decimales ✅ (se suman sin redondear), objetivos leídos del perfil en cada render ✅, cruce de medianoche ✅ (usa `effectiveSelectedDate`). No hay tests saltados, borrados ni relajados. Nada fuera de alcance: el cambio en `MacroBar` es la tarea 4 acordada (Spec feedback 1, opción a).

Divergencias del tech design: a `dayPlanSummary` se le pasan las `slots` ya filtradas por comida en lugar de `weekPlan[date] ?? []`. El resultado es el mismo, porque la función vuelve a filtrar por `meals`.

## Blocking
Ninguno.

## Non-blocking
1. **NaN se juzga «Dentro»**: src/lib/planMacros.ts:71. Todas las comparaciones con NaN son falsas, así que `macroStatus(NaN, …)` devuelve `within`. Al restaurar un backup, las recetas solo se validan por `id` (src/lib/backup.ts:92), y una receta sin `protein` pinta «NaN / 130–160 · Dentro». Además, `MacroBar` (antes `NaN >= min` → false) cambiaría de criterio en el mismo sentido, aunque en el Diario las entradas sí se validan como números. → Arreglo propuesto: en `macroStatus`, si `!Number.isFinite(value)` devolver `below`, o sumar `?? 0` en `slotMacros`. Añadir un test unitario de NaN.
2. **`PLAN_TOLERANCE` parece configurable pero no lo es**: src/lib/planMacros.ts:78. `Math.round(1 / PLAN_TOLERANCE)` solo reproduce tolerancias 1/n; con 0,15 la banda saldría de ±14,3 %. → Comparar directamente `10·v` con `9·g` y `11·g` (dejando la constante solo como documentación), o documentar la limitación.
3. **Escalado duplicado frente a R9**: `slotMacros` repite lo que hace `recipeEntry` (src/lib/diary.ts:17). → `recipeEntry` puede usar `...slotMacros(recipe, servings)` para que haya un único punto de escalado de verdad, útil para #29.

## Code review findings
- La regla «primera franja de cada comida» vive en tres sitios: `dayPlanSummary`, la lista de la tarjeta (`slots.find`) y `pendingSlots`. Si #29 la cambia, un helper compartido evitaría que diverjan.
- `status!` en la frase sr-only (DayMacroSummary.tsx:51) depende de que `target` y `status` compartan condición. Es más robusto condicionar con `status ?`.
- La comparación entera de R4 asume objetivos enteros. El perfil admite cualquier número finito, pero el onboarding guarda enteros, así que el riesgo es bajo.
- Faltan tests para macros no finitos (va con el punto 1 de Non-blocking).
