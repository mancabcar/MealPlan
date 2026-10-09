# Plan: copiar la semana anterior

_Status: shipped (2026-10-06) · Updated: 2026-10-06 · Issue: [#53](https://github.com/mancabcar/MealPlan/issues/53) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#148](https://github.com/mancabcar/MealPlan/pull/148) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

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

## Qué vigilar tras el despliegue
Sin métricas de uso (spec). Comprobar a mano: (1) copiar una semana con una tanda de sobras y que la lista de la compra de la semana destino cuente bien; (2) «Deshacer» tras copiar; (3) que la copia se sincroniza entre dos dispositivos.

## Follow-ups
- Test de alcance de Deshacer: [#149](https://github.com/mancabcar/MealPlan/issues/149)
- Recuento de «Copiadas N franjas» con comidas ocultas: [#150](https://github.com/mancabcar/MealPlan/issues/150)
- Simplificar `planCopy` y el doble `build`: [#151](https://github.com/mancabcar/MealPlan/issues/151)
- Deshacer pisa ediciones hechas tras copiar en la misma semana (aceptado por ahora, ventana de 10 s).
