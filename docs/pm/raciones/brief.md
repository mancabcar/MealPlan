# Raciones al registrar recetas (media ración, 1,5…)

_Status: tests · Updated: 2026-09-23 · Origen: [issue #7](https://github.com/mancabcar/MealPlan/issues/7) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
Registrar una receta en el Diario suma siempre el 100 % de sus macros (`src/app/page.tsx`, `submitAdd` → `recipeEntry`). No se puede registrar media ración ni una ración y media, y las recetas no indican para cuántas personas son.

## Apuesta
Un campo "Raciones" (0,25–4, paso 0,25; por defecto 1) al añadir una receta al Diario, y opcionalmente en el Plan. La entrada guarda el multiplicador y escala los macros. `Recipe.servings` opcional para recetas que rinden varias raciones (los macros guardados son por ración).

## Criterios de aceptación (del issue)
- Registrar 0,5 raciones de una receta de 600 kcal suma 300 kcal y la mitad de cada macro.
- La entrada guarda el multiplicador y la lista del Diario lo muestra ("× 0,5").
- Las entradas existentes (sin multiplicador) se interpretan como 1.

## Contexto técnico
- `MealEntry` y `Recipe` en `src/lib/types.ts`; ninguno tiene hoy campo de raciones.
- Las entradas de receta se crean con `recipeEntry` (`src/lib/diary.ts`), que usan tanto `submitAdd` como el botón "Hecho" de los pendientes del plan.
- `parseDecimal` (`src/lib/nutrition.ts`) ya acepta coma decimal.
- Hay tests unitarios y e2e en `tests/`.

## Pasos del pipeline
- Brainstorm: saltado. El issue ya trae problema, propuesta y criterios.
- Prototipo: saltado (propuesta). Es un campo más en el formulario de añadir del Diario y una etiqueta en la lista, sin pantallas ni flujos nuevos.
- Spec: [spec.md](spec.md), aprobada el 2026-09-23 (Musts R1–R7).
- Tech design: [tech.md](tech.md), aprobado el 2026-09-23 con los valores por defecto propuestos, R9 incluido (macros escalados en la entrada + `servings` solo si ≠ 1; esfuerzo S, 6 tareas).
- Tests: escritos antes del código el 2026-09-23 (dev-test): `tests/unit/diary.test.ts` (46 nuevos + las 4 llamadas a `recipeEntry` adaptadas a `{ id }`), `tests/e2e/raciones.spec.ts` (33), el caso "Diario con formulario de raciones y error" en `accessibility.spec.ts` y una aserción "sin `servings`" en `diario-desde-plan.spec.ts` › R2. Fallan porque la funcionalidad aún no existe (45 unit + 1 unit adaptado, 30 e2e + 1 axe); 1 unit y 3 e2e (R5, R7) son guardias de regresión que ya pasan. Cobertura en [tech.md › Test coverage](tech.md#test-coverage). Siguiente: código (dev-code).

## Decisiones (Manuel, 2026-09-23)
- Brainstorm y prototipo saltados: de acuerdo.
- Raciones en el Plan: **fuera**, en el [issue #29](https://github.com/mancabcar/MealPlan/issues/29) (afecta al total del día y a la lista de la compra).
- `Recipe.servings`: **fuera** por ahora; todas las recetas son para 1 persona.
- "× 1" no se muestra; la etiqueta solo aparece con raciones distintas de 1.
- Spec aprobada (Musts R1–R7).
