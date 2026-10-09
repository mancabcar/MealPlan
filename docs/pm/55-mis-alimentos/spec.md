# Favoritos en «Añadir comida»: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-10-09_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/4YYejg1TynbXR8TESnokGX) · Issue [#55](https://github.com/mancabcar/MealPlan/issues/55) (absorbe [#58](https://github.com/mancabcar/MealPlan/issues/58))_

## TL;DR
Las comidas personalizadas habituales solo duran mientras están entre los 5 Recientes, y no se pueden corregir: cuando se caen, hay que volver a teclearlas, y un error se repite. Añadimos una sección «Favoritos» en «Añadir comida» que se llena marcando ☆: personalizadas (editables), alimentos con su cantidad y recetas favoritas de #20, ordenados por lo que más registras en la franja. Funciona si, tras dos semanas de uso, no has vuelto a teclear ninguna personalizada que ya tenías guardada.

## Problem
El único usuario de la app registra a diario comidas personalizadas (pestaña Personalizada: nombre, kcal, macros, fibra opcional). Hoy solo existen como entradas sueltas del Diario: Recientes las deduce del historial, pero enseña solo 5 (`recentMeals`, `src/lib/diary.ts`). Cuando una se cae de ahí, se vuelve a teclear entera; si tenía un macro mal, no hay un «molde» que corregir, y las variantes casi iguales se acumulan. Las recetas ya tienen favoritos (#20), pero en «Añadir comida» no hay un sitio fijo para lo habitual (#58).

## Goals
- Registrar una personalizada habitual con uno o dos toques, aunque ya no esté en Recientes.
- Corregir una personalizada guardada una sola vez para que los registros siguientes salgan bien.
- Tener en «Añadir comida» un único sitio para lo habitual: personalizadas, alimentos y recetas (absorbe #58).

## Non-goals
- Cambiar las entradas ya registradas en el Diario al editar un favorito: las medias y la adherencia de días pasados no se tocan.
- Ordenar Recientes por frecuencia en la franja (va en [#158](https://github.com/mancabcar/MealPlan/issues/158)).
- Autocompletar desde el historial al escribir en Personalizada o en el buscador.
- Fusionar personalizadas duplicadas o casi iguales.
- Una pantalla de gestión aparte («Mis alimentos»): todo vive en «Añadir comida».
- Reordenar Favoritos a mano, carpetas o etiquetas.
- Editar recetas desde Favoritos: se siguen editando en Recetas (#18).

## Users & key scenarios
Un único usuario que registra a diario en el móvil (PWA) y a veces en otro dispositivo.
1. **Cena habitual que ya no sale en Recientes:** abre «Añadir comida», elige Cena y toca «Crema de calabacín» en Favoritos.
2. **Guardar una comida nueva:** registra una personalizada con la casilla «Guardar en favoritos» marcada, o toca ☆ en una fila de Recientes.
3. **Corregir un error:** pulsa «Editar» en Favoritos, toca el lápiz de «Tostada con aceite», corrige la grasa y guarda. Lo registrado antes queda igual.
4. **Limpiar:** quita de Favoritos una variante que ya no usa con la ★ rellena.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | «Añadir comida» muestra una sección «Favoritos» entre el selector de franja y Recientes, visible en las tres pestañas. Un toque en una fila registra esa comida en la franja elegida y cierra «Añadir comida», igual que Recientes. | Must |
| R2 | Cada fila de Recientes tiene un botón ☆ que guarda la comida en Favoritos al momento, sin diálogo. Una personalizada se guarda con nombre, macros y fibra; un alimento, con su alimento de origen y su cantidad (gramos o unidades); una receta queda marcada como favorita en la misma lista de #20. | Must |
| R3 | La pestaña Personalizada tiene una casilla «Guardar en favoritos» justo encima de Añadir. Empieza desmarcada en cada registro. Al añadir con ella marcada, la comida se registra y se guarda como favorita. | Must |
| R4 | El usuario puede editar el nombre, los macros y la fibra de una personalizada favorita. El cambio vale para los registros siguientes y no toca las entradas ya registradas. | Must |
| R5 | La ★ rellena de una fila de Favoritos la quita de Favoritos, sin confirmar, con un aviso «Quitado de Favoritos · Deshacer». | Must |
| R6 | Los favoritos se sincronizan entre dispositivos y entran en la copia de seguridad, como el resto de datos. | Must |
| R7 | Lo que ya es favorito no aparece en Recientes; su hueco lo ocupa la siguiente reciente. | Should |
| R8 | Favoritos se ordena por frecuencia en la franja elegida: primero lo que más veces se ha registrado en esa franja; a igualdad, lo registrado más recientemente. | Should |
| R9 | Favoritos muestra como mucho 5 filas; si hay más, un «Ver todos (N)» despliega la lista completa en el sitio. | Should |
| R10 | Sin favoritos, en el sitio de la sección aparece una pista de una línea: «Toca ☆ en lo que repites para tenerlo aquí». | Should |
| R11 | Al marcar ☆ en Recientes, la fila sube a Favoritos y aparece el aviso «Guardado en Favoritos · Deshacer». | Should |
| R12 | El usuario puede cambiar la cantidad guardada de un alimento favorito. | Could |
| R13 | ☆ también en los resultados del buscador de alimentos y en el selector de recetas. | Could |

## User flows
**Registrar un favorito** (artboards 5 · Favoritos con pocos, 6 · Favoritos con muchos)
1. Abre «Añadir comida» y elige la franja.
2. Favoritos aparece ordenado por frecuencia en esa franja (R8), con un máximo de 5 filas (R9).
3. Toca una fila: se registra y se cierra «Añadir comida» (R1).

**Guardar desde Recientes** (artboards 1 · Favoritos vacío, 2 · ☆ en una fila de Recientes, 4 · Confirmación)
1. Con Favoritos vacío ve la pista (R10).
2. Toca ☆ en una fila de Recientes (R2).
3. La fila sube a Favoritos, desaparece de Recientes (R7) y sale «Guardado en Favoritos · Deshacer» (R11).

**Guardar al registrar una personalizada** (artboard 3 · ☆ en Personalizada)
1. En Personalizada rellena nombre y macros, y marca «Guardar en favoritos» (R3).
2. Pulsa Añadir: se registra, se guarda como favorita y «Añadir comida» se cierra. El aviso del Diario dice «Añadido a Cena · guardado en Favoritos».

**Editar o quitar** (fuera del prototipo)
1. Pulsa «Editar» junto al título «Favoritos»: se abre la lista completa. Las personalizadas y los alimentos llevan lápiz; las recetas, solo la ★.
2. El lápiz de una personalizada abre el formulario de Personalizada relleno, con «Guardar cambios» y «Quitar de favoritos» (R4, R5). El de un alimento permite cambiar la cantidad (R12).
3. Guarda y vuelve a Favoritos con los datos nuevos.

## Acceptance criteria
**R1**
- Given hay al menos un favorito, when abro «Añadir comida» en cualquiera de las tres pestañas, then veo «Favoritos» entre el selector de franja y Recientes.
- Given la franja es Cena, when toco un favorito, then se añade una entrada a Cena del día abierto, con los datos del favorito, y «Añadir comida» se cierra.
- Given un favorito de receta, when lo toco, then se registra con 1 ración.
- Given un favorito de alimento «Avena 40 g», when lo toco, then se registra 40 g de avena con sus macros calculados como en el buscador de alimentos.
- Given no hay fecha elegida, when toco un favorito, then no se añade nada (igual que Recientes).

**R2**
- Given una personalizada «Tortilla francesa» de 190 kcal en Recientes, when toco su ☆, then «Tortilla francesa» aparece en Favoritos con sus kcal, macros y fibra, sin que se abra ningún diálogo.
- Given un alimento «Yogur griego 125 g» en Recientes, when toco su ☆, then el favorito guarda ese alimento y 125 g.
- Given una receta «Pollo al curry» en Recientes, when toco su ☆, then la receta queda favorita también en Recetas y en el selector del Plan.
- Given ya existe una personalizada favorita con el mismo nombre (sin distinguir mayúsculas ni espacios extra), when guardo otra con ese nombre, then se actualizan los macros de la existente y no aparece una segunda.

**R3**
- Given estoy en Personalizada, when la abro, then la casilla «Guardar en favoritos» está desmarcada.
- Given la casilla está marcada y el formulario es válido, when pulso Añadir, then se registra la entrada, se guarda (o actualiza, por R2) la favorita y el aviso del Diario dice «Añadido a <franja> · guardado en Favoritos».
- Given la casilla está marcada y el formulario no es válido, when pulso Añadir, then no se registra ni se guarda nada, con los mismos errores que hoy.

**R4**
- Given una personalizada favorita «Tostada con aceite» con 11 g de grasa y dos entradas en el Diario, when la edito a 9 g de grasa y guardo, then el favorito tiene 9 g y las dos entradas del Diario siguen con 11 g.
- Given edito una personalizada y le pongo el nombre de otra favorita, when pulso «Guardar cambios», then aparece «Ya tienes un favorito con ese nombre» y no se guarda nada.
- Given edito una personalizada y dejo un dato no válido (nombre vacío, número no válido), when pulso «Guardar cambios», then no se guarda, con los mismos errores que el formulario de Personalizada.
- Given estoy en «Editar», then las filas de personalizadas y de alimentos tienen lápiz y las de recetas no.

**R5**
- Given un favorito en la lista, when toco su ★ rellena, then desaparece de Favoritos y aparece «Quitado de Favoritos · Deshacer».
- Given acabo de quitarlo, when toco Deshacer, then vuelve con los mismos datos y en la misma posición.
- Given el aviso está visible, when cierro «Añadir comida», then el aviso desaparece y el cambio queda hecho.
- Given edito una personalizada favorita, when pulso «Quitar de favoritos», then se quita con el mismo aviso y Deshacer.
- Given quito una receta favorita desde aquí, then deja de ser favorita también en Recetas (#20).

**R6**
- Given guardo un favorito en un dispositivo, when abro la app en otro con la sincronización activa, then el favorito aparece allí.
- Given exporto una copia de seguridad, when la importo en una instalación limpia, then los favoritos vuelven con sus datos.
- Given una copia de seguridad antigua sin favoritos de personalizadas ni de alimentos, when la importo, then se importa sin error y esas listas quedan vacías.

**R7**
- Given «Tortilla francesa» es favorita, when abro «Añadir comida», then no aparece en Recientes y Recientes sigue mostrando hasta 5 filas.
- Given «Pollo al curry» es favorita y la registré × 0,5, then «Pollo al curry × 0,5» sigue en Recientes y solo se oculta la entrada × 1.
- Given «Avena 40 g» es favorita y registré «Avena 60 g», then «Avena 60 g» sigue en Recientes.

**R8**
- Given en Desayuno registré «Café con leche» 10 veces y «Avena 40 g» 3 veces, when elijo Desayuno, then «Café con leche» va antes que «Avena 40 g».
- Given dos favoritos con la misma frecuencia en la franja, then va primero el registrado más recientemente.
- Given un favorito nunca registrado en la franja elegida, then va detrás de los que sí lo están.
- Cuenta toda entrada del historial que coincida, también las anteriores a marcarlo: personalizada por nombre (sin distinguir mayúsculas ni espacios extra), alimento por alimento de origen y cantidad, receta por receta.

**R9**
- Given hay 12 favoritos, then se ven 5 y un «Ver todos (12)».
- Given toco «Ver todos (12)», then se despliegan los 12 en el sitio, sin cambiar de pantalla.
- Given hay 5 o menos, then no aparece «Ver todos».

**R10**
- Given no hay ningún favorito, then en el sitio de Favoritos aparece la pista «Toca ☆ en lo que repites para tenerlo aquí».
- Given guardo el primer favorito, then la pista desaparece.

**R11**
- Given toco ☆ en una fila de Recientes, then la fila pasa a Favoritos y aparece «Guardado en Favoritos · Deshacer», que se queda hasta que cierro «Añadir comida».
- Given toco Deshacer, then el favorito se quita y la fila vuelve a Recientes.

## Edge cases
- **Receta favorita que no vale para la franja elegida:** no aparece en Favoritos en esa franja (mismo filtro que el selector de recetas de #20).
- **Receta borrada (una propia de #18):** su favorito desaparece de Favoritos.
- **Alimento sin conexión:** un favorito de alimento se puede registrar offline, sin volver a consultar Open Food Facts: guarda los valores nutricionales al marcarlo, y no se actualiza si cambian en Open Food Facts.
- **Mismo alimento con otra cantidad:** es otro favorito («Avena 40 g» y «Avena 60 g» conviven).
- **Edición concurrente en dos dispositivos:** se aplica la regla de sincronización que ya usa la app para el resto de datos.
- **Sin límite de favoritos:** el tope de 5 es solo de visualización (R9).
- **Con 5 favoritos y 5 recientes, las pestañas quedan bajo el pliegue del móvil:** aceptado, se hace scroll (decidido en el spec, artboard 6).

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Personalizadas ya guardadas que se vuelven a teclear | TBD (hoy, cada vez que una se cae de Recientes) | 0 en las dos primeras semanas de uso | Comprobación del usuario a las 2 semanas; sin instrumentación |

## Risks & dependencies
- **Riesgo de la apuesta:** si no se marca la ☆, Favoritos se queda vacío y el problema sigue. La pista (R10) lo mitiga; si no basta, el siguiente paso es autocompletar desde el historial (Follow-ups del brief).
- **Depende de #20** (lista de recetas favoritas compartida) y de **#13** (alimentos y su cálculo por cantidad).
- **Depende de la sincronización (#22) y de la copia de seguridad:** los datos nuevos tienen que entrar en ambas (R6).

## Open questions
- Ninguna que bloquee el desarrollo.
