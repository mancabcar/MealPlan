# Registro rápido: Recientes: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-09-27_
_Related: [brief](brief.md) · [issue #12](https://github.com/mancabcar/MealPlan/issues/12)_

## TL;DR
Registrar lo de siempre exige buscarlo en un desplegable largo o volver a teclear sus macros. Añadimos a «Añadir comida» una sección «Recientes» con las 5 últimas comidas registradas, sin duplicados y con las de la franja elegida primero, que se añaden con un toque. Habrá funcionado si lo habitual se registra en 1–2 toques: abrir el formulario y tocar la reciente.

## Problem
Hoy, en el Diario, «Añadir comida» (`src/app/page.tsx`) obliga a elegir una receta en un desplegable con todo el recetario, ajustar las raciones y pulsar «Añadir». Una comida personalizada hay que volver a escribirla entera (nombre, kcal, P, C y G), porque no se guarda en ningún sitio aparte de sus entradas del Diario. Repetir el desayuno de todos los días cuesta lo mismo que registrar algo nuevo.

## Goals
- Registrar una comida ya registrada antes en 1–2 toques (abrir el formulario y tocar la reciente).

## Non-goals
- Favoritos (→ [#58](https://github.com/mancabcar/MealPlan/issues/58)).
- Copiar una comida o un día del Diario a otra fecha (→ [#59](https://github.com/mancabcar/MealPlan/issues/59)); copiar varios días o rangos.
- Copiar la semana anterior en Plan (→ [#60](https://github.com/mancabcar/MealPlan/issues/60)); navegar a otras semanas en Plan.
- Editar entradas ya registradas (macros o raciones).
- Favoritos o recientes en la pantalla Recetas.
- Quitar una comida de Recientes sin borrar sus entradas.

## Users & key scenarios
Usuario único de la app, que sigue un plan nutricional y registra a diario.
- Desayuna casi siempre lo mismo: abre «Añadir comida» con «Desayuno» elegido y toca su desayuno de siempre, arriba del todo.
- Repite una comida personalizada («Yogur con nueces», con sus macros) sin volver a teclearla.
- Ayer tomó media ración de una receta: la reciente es «× 0,5» y se registra igual.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | «Añadir comida» muestra una sección «Recientes» entre el selector de franja y las pestañas Receta/Personalizada, visible en los dos modos, con hasta 5 filas. | Must |
| R2 | Recientes no repite comidas. Dos entradas de receta son la misma si tienen la misma receta y las mismas raciones. Dos personalizadas son la misma si tienen el mismo nombre (sin distinguir mayúsculas ni espacios al principio, al final o repetidos) y los mismos kcal, P, C y G. Se muestra el nombre de la vez más reciente. | Must |
| R3 | Recientes se ordena por el momento en que se registró cada entrada, no por su fecha. Primero van las de la franja elegida y, si no llegan a 5, se completan con las de otras franjas en el mismo orden. La lista se recalcula al cambiar de franja. | Must |
| R4 | Un toque en una reciente crea una entrada nueva (id nuevo) en la fecha del Diario y la franja elegidas, con los mismos macros y raciones que la reciente, y cierra el formulario. | Must |
| R5 | Cada fila muestra el nombre, «× raciones» si no es 1 (como en la lista del Diario) y las kcal redondeadas. | Must |
| R6 | Si no hay ninguna comida que mostrar, la sección no aparece y el formulario queda como hoy. | Should |
| R7 | Recientes sale siempre de las entradas que existen: al borrar una entrada deja de contar, y las entradas de recetas que ya no existen no aparecen. | Should |

## User flows
**Registrar lo habitual**
1. En el Diario, con la fecha elegida, pulsa «Añadir comida».
2. Elige la franja (p. ej., «Desayuno»). Recientes muestra primero lo registrado en Desayuno.
3. Toca una fila. Se añade la entrada y el formulario se cierra; la entrada aparece en la tarjeta de esa franja.

## Acceptance criteria
**R1**
- Given hay entradas registradas, when abro «Añadir comida», then veo «Recientes» debajo del selector de franja y encima de las pestañas Receta/Personalizada.
- Given hay más de 5 comidas distintas registradas, when abro «Añadir comida», then Recientes muestra exactamente 5 filas.
- Given el modo «Personalizada» está activo, when miro el formulario, then Recientes sigue visible.

**R2**
- Given registré «Avena» × 1 dos veces, when abro el formulario, then «Avena» aparece una sola vez.
- Given registré «Avena» × 1 y «Avena» × 0,5, when abro el formulario, then aparecen dos filas: «Avena» y «Avena × 0,5».
- Given registré las personalizadas «yogur» y «Yogur  » con los mismos macros, when abro el formulario, then aparece una sola fila, con el nombre de la más reciente.
- Given registré la personalizada «Yogur» con 120 kcal y otra «Yogur» con 150 kcal, when abro el formulario, then aparecen dos filas.

**R3**
- Given registré A (Desayuno), luego B (Cena), luego C (Desayuno), when abro el formulario con «Desayuno» elegido, then el orden es C, A, B.
- Given con esas entradas cambio la franja a «Cena», then el orden pasa a ser B, C, A.
- Given hoy registré una entrada con fecha de ayer después de las de hoy, when abro el formulario, then esa entrada va primero dentro de su grupo.
- Given la franja elegida tiene 6 comidas distintas, when abro el formulario, then las 5 filas son de esa franja.

**R4**
- Given la fecha del Diario es D y la franja elegida es F, when toco una reciente, then aparece una entrada nueva en D y F con los mismos macros y raciones que la reciente, y el formulario se cierra.
- Given toco una reciente, then la entrada nueva tiene un id distinto de todas las existentes.
- Given hago doble toque en una reciente, then se añade una sola entrada.

**R5**
- Given una reciente de receta con 0,5 raciones y 187,5 kcal, then la fila muestra «<nombre> × 0,5» y «188 kcal».
- Given una reciente con 1 ración, then no muestra «× 1».

**R6**
- Given no hay ninguna entrada registrada, when abro «Añadir comida», then no hay sección Recientes.

**R7**
- Given la única entrada de «Avena» se borra con la ✕, when abro el formulario, then «Avena» ya no está en Recientes.
- Given hay una entrada cuya receta no existe en el recetario, when abro el formulario, then no aparece en Recientes.

## Edge cases
- Las entradas registradas con «Hecho» o «Registrar todo el día» (Diario desde el plan) cuentan como cualquier otra entrada.
- Las entradas de cualquier fecha cuentan, también las de días futuros y las importadas desde una copia de seguridad (en el orden en que vienen).
- Añadir una reciente en una fecha y franja donde ya está esa misma comida la registra otra vez: no se impide.
- Una reciente de una franja que el usuario ya no tiene activa (quitada en el perfil) se puede añadir a la franja elegida.
- Añadir desde Recientes no cambia la receta, las raciones ni la personalizada que hubiera a medio rellenar en el formulario, que se cierra.

## Risks & dependencies
- #13 (base de alimentos) añadirá una pestaña a «Añadir comida» y entradas de alimento por gramos. Cuando llegue, habrá que decidir cuándo dos de esas entradas son «la misma» en Recientes.
- #58 (Favoritos) irá entre Recientes y las pestañas, según el orden acordado en el brief de #13.

## Open questions
Ninguna.
