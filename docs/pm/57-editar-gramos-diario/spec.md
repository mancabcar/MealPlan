# Diario: editar la cantidad de una entrada ya registrada: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-10-19_
_Related: [brief](brief.md) · Issue [#57](https://github.com/mancabcar/MealPlan/issues/57)_

## TL;DR
Si me equivoco de cantidad al registrar un alimento, hoy la única salida es borrar la entrada y volver a registrarla. Tocando la fila en el Diario podré cambiar sus gramos (o unidades) ahí mismo, y sus macros y fibra se recalcularán; con el mismo gesto, las raciones de una receta. Funciona si corregir una cantidad deja de requerir borrar y volver a registrar.

## Problem
Una entrada de alimento (#13) guarda nombre, gramos (o unidades) y los macros calculados. Ninguna entrada del Diario se edita: solo se borra con la ✕. Corregir un «150 g» que eran «100 g» obliga a borrar, volver a buscar el alimento, teclear la cantidad y elegir la franja otra vez. Lo mismo con una receta registrada a la ración equivocada.

## Goals
- Corregir la cantidad de una entrada de alimento sin borrarla, en la propia fila.
- Que macros, fibra y totales del día reflejen la cantidad nueva.
- Que el cambio se pueda deshacer sin riesgo de pisar otro cambio posterior.

## Non-goals
- Editar personalizadas (nombre, macros o fibra).
- Cambiar la fecha, la franja o el nombre de cualquier entrada.
- Pasar una entrada de gramos a unidades o al revés.
- Cambiar el alimento de origen de una entrada (p. ej. «Avena» por «Avena integral»).
- Editar varias entradas a la vez.
- Deshacer en cadena varios cambios de cantidad.

## Users & key scenarios
Usuario único que registra lo que come en el Diario.
1. Registra «Avena 150 g» en Desayuno y en realidad eran 100 g: toca la fila, cambia a 100 y guarda.
2. Registró «2 ud» de huevo y fueron 3: toca la fila, cambia a 3 ud.
3. Marcó «Hecho» una receta a 1 ración y se comió media: toca la fila y baja a 0,5.
4. Se equivoca al corregir: pulsa Deshacer en el aviso.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Tocar la fila de una entrada de alimento en el Diario abre, dentro de la propia fila, un editor de su cantidad con «Guardar cambios» y «Cancelar». La ✕ sigue aparte y sigue borrando. | Must |
| R2 | La cantidad se edita en el mismo modo con que se registró: gramos (1–2000, enteros) o unidades (0,5–10 en pasos de 0,5), con la misma validación y los mismos mensajes de error que al registrar; con un valor no válido no se puede guardar. | Must |
| R3 | Al guardar, la entrada pasa a tener la cantidad nueva y sus kcal, proteína, hidratos, grasa y fibra se recalculan en proporción a la cantidad; los totales del día y todo lo que lee las entradas (medias, adherencia, Recientes, Favoritos) usan los valores nuevos. La entrada conserva su fecha, franja, nombre y alimento de origen. | Must |
| R4 | Solo hay una fila en edición a la vez: «Cancelar», tocar otra fila editable o abrir «Añadir comida» cierra el editor sin guardar. | Must |
| R5 | Las personalizadas y las entradas sin una cantidad válida no son editables: tocar su fila no hace nada. | Must |
| R6 | Mientras se edita, junto al campo se ve la cantidad y las kcal resultantes («100 g → 150 kcal»); los totales del día no cambian hasta guardar. | Should |
| R7 | Al guardar un cambio aparece el aviso «Cantidad cambiada · Deshacer»; Deshacer devuelve la entrada a su cantidad, macros y fibra anteriores. | Should |
| R8 | Tocar la fila de una entrada de receta abre el mismo editor para sus raciones, con − / + en pasos de 0,25 (0,25–4) y la misma validación y error que al registrar; al guardar, macros y fibra se recalculan en proporción. | Should |

## User flows
**Corregir gramos (escenario 1)**
1. En el Diario, toca la fila «Avena 150 g · 225 kcal».
2. La fila se expande con el campo «Gramos» relleno con 150, «Guardar cambios» y «Cancelar».
3. Escribe 100; junto al campo ve «100 g → 150 kcal».
4. Pulsa «Guardar cambios»: la fila se cierra y muestra «Avena 100 g · 150 kcal»; los totales del día bajan; aparece «Cantidad cambiada · Deshacer».

**Corregir raciones (escenario 3)**
1. Toca la fila de la receta (sin etiqueta, 1 ración).
2. El editor muestra «Raciones» con 1 y botones − / +.
3. Pulsa − dos veces (0,5) y guarda: la fila muestra «× 0,5» y las kcal a la mitad.

## Acceptance criteria
**R1**
- Given una entrada de alimento en el Diario, when toco su fila (fuera de la ✕), then la fila muestra el editor con la cantidad actual, «Guardar cambios» y «Cancelar».
- Given el editor abierto, when pulso la ✕ de esa fila, then la entrada se borra como hoy.

**R2**
- Given una entrada registrada en gramos, when abro el editor, then el campo es «Gramos» con su valor y la unidad «g».
- Given una entrada registrada en unidades (p. ej. «2 ud · 120 g»), when abro el editor, then el campo es «Unidades» con 2, y al guardar 3 los gramos pasan a 180 (peso de 1 ud = gramos / unidades).
- Given escribo 0, 2001, «12,5» en gramos o 0,3 en unidades, then se muestra el error de siempre («Entre 1 y 2000 g, sin decimales» / «Entre 0,5 y 10 ud, en pasos de 0,5») y «Guardar cambios» está desactivado.

**R3**
- Given «Avena 150 g» con 225 kcal y 15 g de fibra, when guardo 100 g, then la entrada tiene 150 kcal, 10 g de fibra y proteína, hidratos y grasa × 100/150, sin redondear; la lista muestra «100 g».
- Given guardo, then los totales del día y la gráfica semanal reflejan el valor nuevo sin recargar.
- Given guardo, then fecha, franja, nombre y alimento de origen no cambian, y la entrada mantiene su identidad (no aparece como borrada y añadida).
- Given una entrada sin dato de fibra, when guardo otra cantidad, then sigue sin dato de fibra (no pasa a 0).
- Given guardo el mismo valor que tenía, then la entrada no cambia y no aparece aviso.

**R4**
- Given el editor abierto en una fila con un valor sin guardar, when pulso «Cancelar», toco otra fila editable o abro «Añadir comida», then el editor se cierra, la entrada conserva su cantidad anterior y, si toqué otra fila, se abre su editor.

**R5**
- Given una personalizada o una entrada sin cantidad válida (sin gramos, gramos no numéricos o ≤ 0), when toco su fila, then no se abre nada y la fila no se anuncia como botón.

**R6**
- Given el editor con un valor válido, then junto al campo se ve «<cantidad> → <kcal redondeadas> kcal»; con un valor no válido no se muestra.

**R7**
- Given acabo de guardar 100 g sobre 150 g, when pulso Deshacer, then la entrada vuelve a 150 g con sus macros y fibra anteriores.
- Given el aviso visible, when vuelvo a editar y guardar esa entrada, o la borro, then el aviso anterior se cierra (Deshacer nunca pisa un cambio más nuevo).

**R8**
- Given una entrada de receta registrada a 1 ración, when toco su fila, then el editor muestra «Raciones» con 1 y − / +.
- Given guardo 0,5, then macros y fibra son la mitad y la fila muestra «× 0,5»; given guardo 1 desde 0,5, then la fila deja de mostrar etiqueta, igual que una receta registrada a 1 ración.
- Given escribo 0,3 o 5, then se muestra «Entre 0,25 y 4, en pasos de 0,25» y no se puede guardar.

## Edge cases
- **Cualquier día:** se puede editar una entrada de cualquier fecha, no solo de hoy.
- **Entrada copiada** (chip «Copiada» de #54): se edita como cualquier otra; editar la copia no toca la entrada de origen.
- **Recientes y Favoritos:** una entrada editada cuenta con su cantidad nueva (p. ej. para el favorito «Avena 100 g» y no para «Avena 150 g»).
- **Unidades con gramos no enteros** (p. ej. 1,5 ud × 75 g = 112,5 g): válido, como al registrar.
- **Sincronización (#22):** la entrada editada se sincroniza como un cambio de esa entrada.
- **Doble toque:** un segundo toque rápido sobre la fila no cierra ni reabre el editor (mismo criterio `singleClick` que el resto del Diario).

## Risks & dependencies
- Depende de #13 (entradas con `grams`/`units`) y de las raciones (docs/pm/raciones). El recálculo en proporción no necesita los valores por 100 g, que la entrada no guarda.
- El aviso con Deshacer debe evitar el defecto de #168 (Deshacer restaura una instantánea vieja): se cierra en cuanto la entrada cambia.
- Tocar la fila entera es un objetivo grande: hay que comprobar que no se abre al desplazar la lista en móvil.

## Open questions
_(ninguna que bloquee)_
