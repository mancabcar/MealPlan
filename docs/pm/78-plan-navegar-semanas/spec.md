# Plan: navegar por semanas: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-10-04_
_Related: [brief](brief.md) · [issue #78](https://github.com/mancabcar/MealPlan/issues/78)_

## TL;DR
El Plan y la lista de la compra solo muestran la semana lunes–domingo actual, así que no se puede mirar atrás ni planificar con antelación. Vamos a permitir moverse a la semana anterior y a la siguiente en el Plan, con su lista de la compra y su estado (comprado, «ya lo tengo», deshacer) guardado por semana. El éxito es que se cumplan los criterios de aceptación y pasen los tests e2e; no hay métricas de uso.

## Problem
El Plan calcula la semana con `weekDates(todayStr())` y la compra usa la misma semana fija. El usuario no puede revisar lo que comió, preparar la semana que viene ni, en el futuro, dejar sobras en otra semana. El estado de la compra solo se guarda para la semana actual.

## Goals
- Moverse entre semanas en el Plan (anterior, siguiente, volver a la actual).
- La lista de la compra sigue la semana que se está viendo.
- Editar el plan en cualquier semana.
- Guardar el estado de la compra por semana.

## Non-goals
- Sobras que crucen de semana: siguen limitadas a la semana de la tanda (issue aparte).
- Límite de navegación o semanas en solo lectura: no hay límite ni bloqueo.
- Selector de fecha/calendario.
- Calcular la Despensa «como estaba» en una semana pasada: se usa la Despensa actual.
- Copiar la semana anterior ([#60](https://github.com/mancabcar/MealPlan/issues/60), [#53](https://github.com/mancabcar/MealPlan/issues/53)).
- Métricas de uso.

## Users & key scenarios
Usuario único de la app (planifica y registra su alimentación).
1. Mira la semana pasada para ver qué había planificado.
2. El sábado planifica la semana siguiente y prepara su lista de la compra.
3. Marca como comprado en la lista de la semana siguiente y vuelve a la actual sin perder nada.
4. Se pierde en semanas lejanas y pulsa «Hoy» para volver.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El usuario puede ir a la semana anterior y a la siguiente en el Plan, y volver a la semana actual con un botón «Hoy». | Must |
| R2 | La lista de la compra muestra la semana que se estaba viendo en el Plan, y volver a Plan conserva esa semana. | Must |
| R3 | El estado de la compra (comprado, «ya lo tengo», deshacer el último movimiento a la Despensa) se guarda por semana; los datos existentes se migran sin pérdida y siguen funcionando en backup y sincronización. | Must |
| R4 | El usuario puede asignar, cambiar y borrar recetas en cualquier semana. | Must |
| R5 | El detalle «Se usa en» y los nombres de día de la compra corresponden a la semana vista. | Must |
| R6 | La cabecera indica el rango de fechas de la semana vista y marca claramente si no es la actual. | Should |
| R7 | El usuario puede cambiar de semana deslizando en móvil. | Could |

## User flows
1. Plan → pulsa ‹ → ve la semana anterior (selector de días y comidas de esa semana) → pulsa «Hoy» → vuelve a la actual.
2. Plan → pulsa › → asigna recetas → toca «Lista de la compra» → ve la compra de esa semana → vuelve a Plan y sigue en esa semana.
3. Compra de la semana siguiente → marca artículos como comprados → vuelve a la semana actual y su estado no cambia.

La semana vista va en la URL (`?semana=<lunes AAAA-MM-DD>`); sin parámetro, es la semana actual. Al cambiar de semana se selecciona el lunes, o hoy si es la actual.

## Acceptance criteria
**R1**
- Given el Plan en la semana actual, when pulso ›, then veo la semana siguiente (7 días lunes–domingo) y aparece «Hoy».
- Given una semana distinta de la actual, when pulso «Hoy», then vuelvo a la actual con el día de hoy seleccionado.
- Given la semana actual, then «Hoy» no aparece (o está desactivado).
- Given cualquier semana, when pulso ‹ o › repetidamente, then se puede avanzar o retroceder sin límite.
**R2**
- Given que veo la semana W en el Plan, when abro la lista de la compra, then muestra W y su URL lleva `semana=W`.
- Given la compra de W, when vuelvo al Plan, then sigue en W.
- Given una URL sin `semana` o con valor no válido, then se muestra la semana actual.
**R3**
- Given que marco comprado un artículo en W1, when cambio a W2 y vuelvo, then sigue marcado en W1 y W2 no se ve afectada.
- Given datos guardados antes del cambio (semana actual y la anterior en `usage`), when se carga la app, then el estado de esa semana se conserva.
- Given un backup exportado tras el cambio, when se importa, then el estado por semana se restaura; y un backup anterior también se importa sin error.
- Given dos dispositivos sincronizados, then el estado por semana se sincroniza como el resto de datos.
- Given «Mover a la Despensa» en W, when pulso «Deshacer», then se deshace el último movimiento de esa semana.
**R4**
- Given una semana pasada, futura o actual, when asigno, cambio o borro una receta, then se guarda y se refleja en esa semana.
**R5**
- Given la compra de W, when abro «Se usa en» de un artículo, then cada fuente muestra su día correcto de W.
**R6**
- Given una semana distinta de la actual, then la cabecera muestra el rango de fechas y una indicación de que no es la actual (p. ej. «Semana pasada» / «Semana siguiente» / rango).

## Edge cases
- Semana vacía: franjas vacías en el Plan; la compra muestra «Nada que comprar todavía».
- Cruce de medianoche del domingo en la semana actual: «Hoy» y la semana actual se recalculan; si se ve otra semana, no cambia.
- Una semana de la URL no es un lunes: se normaliza a su lunes.
- Semana pasada: «ya los tienes» y caducidad se calculan con la Despensa y la fecha de hoy.
- Las tandas con sobras de #17 se siguen gestionando dentro de su semana.

## Success metrics
Sin métricas de uso: el éxito son los criterios de aceptación y los tests e2e/unitarios.

## Risks & dependencies
- R3 cambia el modelo de datos del estado de compra (`current`/`usage` por semana): afecta a migración, backup (`src/lib/backup.ts`) y sincronización (#22). Es el riesgo principal.
- Depende de la estructura actual de `useShoppingList` y `forWeek` (decisión de diseño en la tech design).

## Open questions
- [ ] Cuántas semanas antiguas conserva el estado de la compra (¿todas?; decidir en la tech design con el tamaño de datos). (Owner: @mancabcar)
- [ ] Texto exacto de la indicación de semana (R6) y comportamiento del gesto de deslizar (R7). (diseño)
