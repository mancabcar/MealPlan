# Raciones al registrar recetas (media ración, 1,5…)

_Status: shipped (2026-09-24, [PR #30](https://github.com/mancabcar/MealPlan/pull/30) mergeado) · review: ✅ aprobar, no bloqueantes 2 y 3 arreglados ([review](review.md)) · Updated: 2026-09-24 · Origen: [issue #7](https://github.com/mancabcar/MealPlan/issues/7) (cerrado) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

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
- Código: rama `feature/raciones`, 2026-09-24 (dev-code), una tarea de tech.md por commit: tipo `MealEntry.servings` y lógica pura en `diary.ts` (5902354), etiqueta "× n" y kcal redondeadas en la lista (8c9867a), campo "Raciones" con validación y reset (323fb67), botones − / + (b70370e) y vista previa "= N kcal" (f66d38b); la tarea 6 (e2e) ya venía de los tests. Sin desviaciones de tech.md ni tests cambiados. Unit 390/390, e2e 131/131, typecheck, lint y build en verde; comprobado en la app en móvil (error, − / +, vista previa, "Guiso × 0,5" y total del día). PR [#30](https://github.com/mancabcar/MealPlan/pull/30).
- Review: [review.md](review.md), 2026-09-24 (dev-review): ✅ aprobar. 9/9 requisitos hechos y con test (7 Must), sin bloqueantes; 3 no bloqueantes menores (sin aviso si no hay receta elegida, comentario desfasado en `parseServings`, kcal sin redondear en la fila de pendiente) y 2 notas de la revisión de código. Unit 390/390, e2e 131/131, typecheck y lint en verde. Los no bloqueantes 2 y 3 se arreglaron antes del merge (8e5fda7); el 1 (sin aviso si no hay receta elegida) queda como estaba.
- Merge: PR #30 mergeado el 2026-09-24 (57f7ac0); issue #7 cerrado.

## Decisiones (Manuel, 2026-09-23)
- Brainstorm y prototipo saltados: de acuerdo.
- Raciones en el Plan: **fuera**, en el [issue #29](https://github.com/mancabcar/MealPlan/issues/29) (afecta al total del día y a la lista de la compra).
- `Recipe.servings`: **fuera** por ahora; todas las recetas son para 1 persona.
- "× 1" no se muestra; la etiqueta solo aparece con raciones distintas de 1.
- Spec aprobada (Musts R1–R7).

## Qué vigilar
- Registrar raciones parciales sin pasar a "Personalizada": si sigues creando entradas personalizadas con el nombre de una receta, el campo no se está usando o no se ve.
- Entradas antiguas (sin `servings`): deben seguir mostrando los mismos kcal y sin etiqueta "×".
- Pendiente: raciones en el Plan y en la lista de la compra, en el [issue #29](https://github.com/mancabcar/MealPlan/issues/29).
