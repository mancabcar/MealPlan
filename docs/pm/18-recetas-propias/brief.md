# Crear y editar recetas propias
_Status: tech design · Updated: 2026-09-29 · Issue: [#18](https://github.com/mancabcar/MealPlan/issues/18) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
Solo existen las 40 recetas semilla y las generadas por IA. No se pueden añadir recetas propias ni corregir las existentes (p. ej. ajustar macros o ingredientes).

## Apuesta
Formulario "Nueva receta" (nombre, ingredientes, pasos, tiempo, raciones, macros por ración, tags); editar y borrar las propias; en las semilla, "Duplicar y editar".

## Criterios del issue
- Una receta creada aparece en Recetas, Diario y Plan.
- Editar sus macros no cambia las entradas ya registradas en el Diario (guardan sus propios macros).
- Borrar una receta usada en el Plan avisa antes.
- El aviso de alérgenos funciona también en las recetas propias.

## Decisiones (chat, 2026-09-29)
- Entrada en el pipeline: spec (sin brainstorm ni prototype). Brief confirmado por el usuario.
- Almacenamiento: independiente de [#42](https://github.com/mancabcar/MealPlan/issues/42); se guarda en localStorage con el store actual.
- Trabajo en worktree propio: rama `feature/18-recetas-propias`.
- Comentarios en el issue: aprobados (al empezar y al abrir el PR).

## Huecos para la spec
- `withSeedRecipes` reinyecta las semilla si faltan: condiciona borrar/editar semillas.
- Cómo se marcan las recetas propias frente a semilla e IA.
- Raciones de la receta y macros por ración.
- Qué pasa con el Plan y la lista de la compra al editar una receta.

## Follow-ups
- Migración del almacenamiento de recetas: depende de #42.
