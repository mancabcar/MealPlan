# Plan: copiar la semana anterior

_Status: in review · Updated: 2026-10-05 · Issue: [#53](https://github.com/mancabcar/MealPlan/issues/53) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#148](https://github.com/mancabcar/MealPlan/pull/148)_

## Problema
Planificar una semana parecida a la anterior exige volver a asignar franja a franja en el Plan.

## Apuesta
Un «Copiar semana anterior» en el Plan que trae las asignaciones de la semana anterior (lunes–domingo) a la semana que se está viendo, día por día. No sobrescribe franjas ya asignadas sin confirmación.

## Contexto
- El issue original decía que el Plan solo muestra la semana en curso. Ya no es así: [#78](../78-plan-navegar-semanas/brief.md) (shipped) permite navegar por semanas, así que la semana de origen es la anterior a la que se ve.
- [#60](https://github.com/mancabcar/MealPlan/issues/60) (cerrado) pedía lo mismo con los mismos criterios de aceptación.

## Decisiones
- Entrada en el pipeline: spec (se salta brainstorm y prototipo; el comportamiento está claro). Sin comentarios en el issue.
- Trabajo en el worktree `../Comidas-53`, rama `feature/53-copiar-semana-anterior`.

## Preguntas abiertas (resueltas en el spec)
- Conflictos: saltar, reemplazar, o preguntar por franja o todo a la vez.
- Cómo se copian sobras ([#17](../17-sobras-batch-cooking/spec.md)) y raciones ([#29](../29-raciones-plan/spec.md)).
- Semana de origen vacía.
- Si la acción está en cualquier semana o solo en la actual.

## Follow-ups
Ninguno todavía.
