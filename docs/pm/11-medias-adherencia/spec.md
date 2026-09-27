# Medias y adherencia en el Diario: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-09-26_
_Related: [brief](brief.md) · [issue #11](https://github.com/mancabcar/MealPlan/issues/11)_

## TL;DR
El Diario enseña si un día concreto cumple el plan y una gráfica de calorías de 7 días, pero no la tendencia: ni medias de macros ni cuántos días se ha cumplido. Añadimos un resumen con la media de kcal, proteínas, carbohidratos y grasas y la adherencia («5 de 6 días dentro del objetivo») de los últimos 7 o 30 días completos, contando solo los días con registros. Habrá funcionado si se puede responder a «¿cómo voy esta semana/este mes?» sin sumar a mano día por día.

## Problem
El usuario sigue un plan de la nutricionista (mantenimiento, 2000 kcal, proteína en rango) y registra lo que come en el Diario. Hoy puede ver cada día por separado (anillo de kcal y `MacroBar`) y las kcal de la semana en `WeekBarChart`. Para saber cómo va en conjunto tiene que ir día por día y hacer cuentas. En la revisión con la nutricionista lo que importa es la media y la regularidad, no un día suelto.

## Goals
- Ver de un vistazo la media de kcal y de cada macro en el periodo.
- Ver cuántos días del periodo se cumplió el plan, con el mismo criterio de «cumplido» que ya usa el Plan (#10).
- Poder cambiar entre 7 y 30 días.

## Non-goals
- **Tolerancia editable.** Se usa el ±10 % fijo del Plan (`PLAN_TOLERANCE_PCT`). Hacerla configurable en Perfil, compartida por Plan y Diario, queda como follow-up (decidido en chat el 2026-09-26).
- Una gráfica de 30 días. `WeekBarChart` sigue mostrando 7 días; el selector solo cambia medias y adherencia.
- Adherencia por carbohidratos o grasas. Un día cumple por kcal y proteína, como pide el issue. Carbohidratos y grasas se muestran en las medias, pero no deciden la adherencia.
- Histórico de objetivos. Todos los días se juzgan con los objetivos actuales del perfil, aunque el plan de la nutricionista cambiara en medio del periodo (agosto → septiembre).
- Periodos personalizados (fechas desde/hasta), comparativas entre periodos, rachas o notificaciones.
- Marcar en la gráfica qué días cumplieron (podría salir casi gratis: ver Open questions).

## Users & key scenarios
Usuario único de la app, que sigue un plan nutricional prescrito y registra a diario.

1. **Revisión semanal.** El domingo abre el Diario y quiere saber cómo ha ido la semana: media de kcal y proteína y cuántos días cumplió.
2. **Antes de la consulta.** Cambia a 30 días para llevar a la nutricionista la media mensual y la adherencia.
3. **Días sin apuntar.** Un par de días no registró nada. No quiere que cuenten como 0 kcal en la media ni como días incumplidos.
4. **Mirar una semana pasada.** Elige una fecha anterior en el selector de fecha del Diario y ve el resumen de los 7 días que acaban en esa fecha.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El Diario muestra un resumen con la media de kcal, proteínas, carbohidratos y grasas del periodo. | Must |
| R2 | Las medias se calculan solo sobre los días del periodo con al menos un registro. Los días sin registros no cuentan ni en el numerador ni en el denominador. | Must |
| R3 | El resumen muestra la adherencia como «X de N días dentro del objetivo», donde N es el número de días con registros del periodo. | Must |
| R4 | Un día cumple si sus kcal están dentro de la tolerancia de `calorieGoal` y su proteína está «dentro» del objetivo: dentro de `proteinRange` si el perfil tiene rango y, si no, dentro de la tolerancia de `proteinGoal`. Es el mismo criterio que el Plan (`macroStatus`, ±10 %, valor redondeado). | Must |
| R5 | Un selector permite elegir 7 o 30 días. Por defecto, 7. Al cambiarlo se recalculan medias y adherencia. | Must |
| R6 | El periodo son los N días completos que terminan en la fecha seleccionada en el Diario. Si la fecha seleccionada es hoy o posterior, el periodo termina ayer: el día en curso nunca cuenta. | Must |
| R7 | Si el periodo no tiene ningún día con registros, el resumen lo dice («Sin registros en estos 7 días») en lugar de mostrar medias a 0 o «0 de 0». | Must |
| R8 | El resumen indica qué periodo cubre, con las fechas de inicio y fin (p. ej. «19–25 sep»). | Should |
| R9 | Cada media se muestra junto a su objetivo (kcal y proteína con su rango si lo hay) y con el mismo estado «dentro / por debajo / por encima» que el Plan. | Should |
| R10 | El selector 7/30 y el resumen son accesibles: el selector es un grupo de opciones con la opción activa anunciada y el texto de la adherencia se lee completo con lector de pantalla. | Should |
| R11 | La opción elegida (7 o 30) se recuerda al volver al Diario. | Could |

## User flows
**Revisión semanal (escenarios 1 y 3)**
1. El usuario abre el Diario (hoy, 26 sep).
2. Bajo la tarjeta «Calorías esta semana» ve la tarjeta de resumen con «7 días · 19–25 sep».
3. Lee las medias (p. ej. «1.960 kcal», «142 g proteína»…) junto a sus objetivos, y la adherencia «4 de 5 días dentro del objetivo»: dos días no tenían registros.

**Antes de la consulta (escenario 2)**
1. En la tarjeta de resumen pulsa «30 días».
2. El resumen pasa a «30 días · 27 ago–25 sep» y medias y adherencia se recalculan sobre esos días.

**Semana pasada (escenario 4)**
1. Cambia la fecha del Diario al 14 sep.
2. El resumen muestra los 7 días del 8 al 14 sep, ambos incluidos, porque el 14 es un día completo.

## Acceptance criteria
**R1 / R2**
- Given 7 días en el periodo con registros de 1800, 2000 y 2200 kcal en 3 días y ninguno en los otros 4, when se abre el Diario, then la media de kcal es 2000 (no 857).
- Given un día con dos registros (1200 y 800 kcal), then ese día aporta 2000 kcal a la media, no dos valores.
- Given entradas con raciones (p. ej. × 0,5), then la media usa los macros ya escalados que guarda la entrada.
- Given medias con decimales, then se muestran redondeadas a entero.

**R3 / R4**
- Given perfil con `calorieGoal` 2000 y `proteinRange` 130–160 y un día con 2150 kcal y 135 g, then el día cumple.
- Given el mismo perfil y un día con 2150 kcal y 125 g, then el día no cumple (proteína por debajo del rango aunque esté a menos del 10 % del mínimo).
- Given perfil sin `proteinRange`, `proteinGoal` 140 y un día con 2000 kcal y 128 g, then el día cumple (128 ≥ 126, el −10 %).
- Given un día con 2201 kcal y proteína en rango, then el día no cumple (por encima de 2200).
- Given los límites exactos (1800 y 2200 kcal; 130 y 160 g), then el día cumple.
- Given 6 días con registros, 5 de los cuales cumplen, then se lee «5 de 6 días dentro del objetivo».
- Given un día que cumple en el Plan con los mismos totales, then también cumple en el Diario (mismo criterio).

**R5**
- Given el resumen en 7 días, when se pulsa «30 días», then medias, adherencia y rango de fechas se recalculan con los 30 días.
- Given 30 días seleccionados, when se vuelve a «7 días», then se vuelve a los valores de 7 días.
- Given se abre el Diario por primera vez, then está seleccionado «7 días».

**R6**
- Given hoy es 26 sep con registros hoy, when la fecha del Diario es hoy, then el periodo de 7 días es 19–25 sep y lo registrado hoy no afecta a medias ni adherencia.
- Given la fecha del Diario es 14 sep (pasada), then el periodo de 7 días es 8–14 sep, ambos incluidos.
- Given la fecha del Diario es posterior a hoy, then el periodo termina ayer, como con hoy.

**R7**
- Given ningún registro en el periodo, then el resumen muestra «Sin registros en estos 7 días» (o «30 días») y no muestra medias ni adherencia.
- Given registros solo hoy, then con la fecha de hoy el resumen está vacío (hoy no cuenta).

**R8**
- Given el periodo 19–25 sep, then el resumen muestra ese rango de fechas.

## Edge cases
- **Día con registros que suman 0 kcal** (p. ej. una entrada personalizada con macros a 0): cuenta como día con registros y no cumple. Se registró, así que no se ignora.
- **Macro ausente o no numérico** en una entrada restaurada de un backup: suma 0, no `NaN`, como hace `dayPlanSummary`.
- **Periodo que cruza un cambio de mes o de hora** (DST): los días se cuentan por fecha local (`YYYY-MM-DD`), como la gráfica, así que siempre hay exactamente 7 o 30 fechas.
- **Objetivo 0 o perfil sin objetivo de proteína**: se comporta como en el Plan (`macroStatus`). No se añade lógica nueva.
- **Comidas registradas con fecha futura**: nunca entran, porque el periodo termina como tarde ayer.
- **Menos de 7 días de historial** (usuario nuevo): N es el número de días con registros, p. ej. «2 de 3 días».

## Success metrics
App personal sin analítica, así que se valida con uso:

| Metric | Baseline | Target | How measured |
|---|---|---|---|
| La media semanal que da la app coincide con la cuenta a mano de una semana real | — | Coincide al redondear | Comprobación manual con los registros de una semana |
| Se usa en la revisión con la nutricionista | No existe | Se usa en la próxima consulta | Uso propio |

## Risks & dependencies
- **Criterio compartido con el Plan.** Si el Diario reimplementa la tolerancia, el Plan y el Diario pueden discrepar en un día límite. Depende de reutilizar `macroStatus` (`src/lib/planMacros.ts`).
- **Rendimiento.** 30 días × todas las entradas se recalculan en cada render. Con el volumen de una persona es trivial, pero conviene agrupar las entradas por fecha una sola vez.
- **Rango de proteína en `MacroBar`.** Hoy `MacroBar` solo usa `macroStatus` cuando hay rango. No afecta a este spec, pero es el follow-up de #10 sobre unificar el criterio en el Diario.

## Open questions
- [ ] ¿Se marcan en `WeekBarChart` los días que cumplieron? Sale casi gratis con el mismo cálculo por día y es el hermano del R8 (Could) de #10. Propuesta: fuera de este spec, como follow-up. (usuario)
- [ ] Ubicación exacta de la tarjeta: debajo de «Calorías esta semana» o fusionada con ella. Propuesta: tarjeta propia debajo, para no mezclar «semana hasta la fecha elegida» (gráfica, incluye hoy) con «días completos» (resumen). (tech design)
