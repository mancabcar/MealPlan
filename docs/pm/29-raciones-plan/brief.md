# Raciones en el Plan (multiplicador por franja)

_Status: shipped (2026-10-05) · Updated: 2026-10-05 · Issue: [#29](https://github.com/mancabcar/MealPlan/issues/29) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#127](https://github.com/mancabcar/MealPlan/pull/127) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

> Brainstorm omitido: el issue #29 ya trae problema, propuesta y contexto, y los specs de #7, #10 y #17 delimitan el terreno. Se entra en spec (decisión del usuario, 2026-10-05). Resumen del issue confirmado por el usuario.

## Problema
El Plan asigna siempre una ración completa por franja (`DayPlanSlot = { mealType, recipeId }`). Si planificas media ración o una y media, el total de kcal/macros del día y las cantidades de la lista de la compra no lo reflejan. #7 añadió raciones al Diario y dejó el Plan fuera.

## Apuesta
- `servings?: number` opcional en `DayPlanSlot` (ausente = 1), mismo rango que el Diario (0,25–4, pasos de 0,25).
- El total del día en el Plan multiplica por las raciones (vía `slotMacros` de #10, único punto de escalado).
- La lista de la compra (`src/lib/shopping/aggregate.ts`) escala las cantidades.
- "Hecho" en un pendiente del Diario registra las raciones planificadas.

## A decidir en el spec
- Relación con `cookedServings` de #17 (raciones que se cocinan vs raciones que se comen); la pregunta abierta de #17 sobre reescribir #29.
- Qué UI elige las raciones en el Plan.

## Follow-ups
- Resuelto (2026-10-05): la pregunta abierta de #17 («¿reescribir #29 sobre `cookedServings`?») se cierra con campos separados: `servings` (se come) y `cookedServings` (se cocina). Ver [tech.md](tech.md).
- Fuera de este issue (non-goals del spec): redondeo de unidades contables en la compra; sugerir raciones a cocinar; raciones por defecto en el perfil. Sin issue creado.
- Review (2026-10-05): hallazgos de comportamiento (etiqueta sin normalizar, Guardar con la franja desaparecida) → [#128](https://github.com/mancabcar/MealPlan/issues/128). Limpieza (botones duplicados de `BatchSheet`, ternario de `batch.ts:151`, `servingsLabel` repetido, hook `useServingsInput`) solo en [review.md](review.md).

## Qué vigilar
Métrica cualitativa del [spec](spec.md): planificar 0,5 o 1,5 raciones y que el total del día, la lista de la compra y el "Hecho" del Diario cuadren sin recurrir a una entrada "Personalizada". Seguimiento de casos límite en [#128](https://github.com/mancabcar/MealPlan/issues/128).
