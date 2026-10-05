# Seguimiento de agua y fibra en el Diario: Spec
_Status: Draft · Owner: Manuel Cabrera Carmona · Updated: 2026-10-05_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/5qcuWMP2ueJJzGfvuYV21n) · Issue [#23](https://github.com/mancabcar/MealPlan/issues/23)_

## TL;DR
Hoy el Diario solo sigue kcal y 3 macros, así que no sé si bebo y como suficiente fibra. Vamos a añadir la fibra como dato opcional (recetas, alimentos, Open Food Facts, entradas) con su objetivo y total del día, y un contador de agua en vasos con objetivo. Se construye en dos entregas, fibra primero. Funcionará si llego al objetivo de agua 5 de cada 7 días y veo un total de fibra completo (no parcial) 5 de cada 7 días.

## Problem
Quiero seguir mi agua y mi fibra del día dentro del Diario, por curiosidad tipo Cronometer, y hoy no lo anoto en ningún sitio. `Recipe` y `MealEntry` solo guardan kcal, P, C y G; los alimentos locales (`foods.json`) y Open Food Facts solo aportan esos mismos campos; el recetario no tiene fibra.

## Goals
- Ver el total de fibra del día frente a un objetivo, como con kcal y macros, sin que un dato que falta dé una falsa sensación de poca fibra.
- Sumar y restar agua del día con un toque y ver el progreso hacia el objetivo.
- Que todo lo anterior funcione sin romper recetas, alimentos y entradas que no tengan fibra.

## Non-goals
- Azúcar y sodio (ni campos ni objetivos).
- Micronutrientes tipo Cronometer.
- Fibra en el Plan semanal (`DayMacroSummary`) y en la lista de la compra.
- Medias y adherencia de fibra y agua en el resumen por periodo (#11).
- Recordatorios de beber agua (push).
- Editar la fibra de una entrada ya registrada.
- Estimar la fibra con IA al importar una receta desde una URL (#19).
- Contador manual de «fibra del día».

## Users & key scenarios
Usuario único de la app, que registra su día en el Diario.
1. Registro una receta del catálogo y veo cuánta fibra aporta y cuánta llevo en el día frente a mi objetivo.
2. Registro un producto envasado con el escáner o la búsqueda de marcas; si Open Food Facts trae fibra, se suma.
3. Registro algo sin dato de fibra (p. ej. una comida «Personalizada» sin ese campo): el total del día se marca como parcial.
4. A lo largo del día toco un vaso de agua cada vez que bebo y veo cuánto me falta para el objetivo.
5. Cambio mi objetivo de fibra, el de agua o el tamaño del vaso en Perfil.

## Requirements
Entrega 1 (fibra)

| ID | Requirement | Priority |
|---|---|---|
| R1 | Las recetas y las entradas del Diario tienen un campo opcional de fibra (g). Sin él, todo sigue funcionando como hoy. | Must |
| R2 | El Diario muestra el total de fibra del día frente al objetivo, como cuarta barra en la tarjeta de macros. Si alguna entrada del día no tiene dato de fibra, el total lleva el chip «parcial». | Must |
| R3 | El objetivo diario de fibra se edita en Perfil. Por defecto 38 g, también en los perfiles que ya existen. | Must |
| R4 | El catálogo de recetas (`recipes.json`) trae fibra y la ficha de cada receta la muestra por ración, en la misma fila que kcal, P, C y G («—» si no hay dato). | Must |
| R5 | Los alimentos locales (`foods.json`) traen fibra y, al registrar un alimento por gramos o unidades, la fibra de la entrada es proporcional a la cantidad. | Must |
| R6 | Los alimentos de Open Food Facts (búsqueda de marcas y código de barras) traen la fibra cuando existe; si no, quedan «sin dato». | Must |
| R7 | Al registrar una receta con raciones distintas de 1, la fibra se multiplica igual que los macros. | Should |
| R8 | El formulario de receta propia (#18) y la pestaña «Personalizada» de «Añadir comida» tienen un campo opcional de fibra (g). Vacío = sin dato, no 0. | Should |
| R9 | Cada entrada muestra su fibra o «Fibra: sin dato», y bajo la barra de fibra, cuando el total es parcial, la línea «Faltan datos de fibra en N de M entradas». | Should |

Entrega 2 (agua)

| ID | Requirement | Priority |
|---|---|---|
| R10 | El Diario tiene una tarjeta de agua con vasos tocables y botones − / +, que suma o resta un vaso del día seleccionado y muestra el progreso hacia el objetivo. | Must |
| R11 | El objetivo de agua (por defecto 2 L, también en perfiles existentes) y el tamaño del vaso (200/250/330/500 ml, por defecto 250 ml) se editan en Perfil. | Must |
| R12 | Al llegar al objetivo, la tarjeta muestra «Objetivo cumplido» sin impedir seguir sumando vasos. | Should |
| R13 | La fibra (entradas, recetas, objetivo) y el agua (consumo por día, objetivo, tamaño de vaso) van incluidos en la copia de seguridad y en la sincronización entre dispositivos (#22). | Must |

## User flows
Prototipo: artboards `1 · Fibra completa, agua en curso`, `2 · Fibra parcial`, `3 · Sin datos de fibra, agua a cero`, `4 · Receta con fibra y sin dato`, `5 · Perfil: objetivos de fibra y agua`, `6 · Agua cumplida`.
1. **Fibra en el Diario.** Registro comidas → la barra de fibra (bajo Grasas, sin línea divisoria) suma la fibra de cada entrada → si alguna no tiene dato, aparece «parcial» junto al valor y la línea de aviso (`2`, `3`).
2. **Receta.** En la ficha de la receta la fibra va en la misma fila que kcal, P, C y G (`4`).
3. **Agua.** En el Diario, bajo macros+fibra, toco un vaso o «+» → el vaso se rellena y el texto pasa a «1,25 / 2 L» (`1`); con «−» quito uno; al llegar al objetivo, «Objetivo cumplido» (`6`).
4. **Perfil.** En «Objetivos diarios» edito fibra y agua (equivalencia en vasos visible) y, en «Tamaño del vaso», elijo 200/250/330/500 ml (`5`).

## Acceptance criteria
**R1**
- Given una receta, entrada o alimento sin fibra, when se muestra, se registra o se guarda, then funciona igual que antes y no se trata como 0.
- Given una copia o un perfil anteriores a esta entrega, when se cargan, then no hay errores y la fibra queda «sin dato».

**R2**
- Given un día con entradas que suman 28 g de fibra y todas tienen dato, when abro el Diario, then veo «28 / 38 g» y una barra al 74 % sin chip «parcial».
- Given un día con al menos una entrada sin dato de fibra, when abro el Diario, then el valor lleva el chip «parcial».
- Given un día con entradas y ninguna con dato, when abro el Diario, then veo «0 / 38 g» con el chip «parcial».
- Given un día sin ninguna entrada, when abro el Diario, then la barra de fibra está vacía y sin chip «parcial».
- Given un total mayor que el objetivo, when se muestra, then la barra no desborda y el valor real se ve.
- La fibra se muestra con 1 decimal (p. ej. «9,5 g»); en un total entero se omite el decimal (p. ej. «28 g»).

**R3**
- Given un perfil sin objetivo de fibra, when abro el Diario, then el objetivo es 38 g sin migración manual.
- Given que cambio el objetivo en Perfil, when guardo, then el Diario usa el nuevo valor.
- Valor admitido: entero de 10 a 100 g; fuera de rango no se guarda y se avisa.

**R4**
- Given una receta del catálogo con fibra, when abro su ficha, then veo la fibra por ración en la fila de macros.
- Given una receta sin fibra, when abro su ficha, then la celda de fibra muestra «—».
- Given que registro una receta del catálogo, when se crea la entrada, then guarda su fibra.

**R5**
- Given un alimento local con 2,5 g de fibra por 100 g, when registro 150 g, then la entrada guarda 3,8 g de fibra (redondeada a 1 decimal).
- Given un alimento sin dato de fibra, when lo registro, then la entrada queda «sin dato».

**R6**
- Given un producto de Open Food Facts con fibra por 100 g, when lo registro por gramos, then la entrada guarda la fibra proporcional.
- Given un producto sin ese dato, when lo registro, then la entrada queda «sin dato» y el registro no falla.

**R7**
- Given una receta de 12 g de fibra por ración, when la registro con 2 raciones, then la entrada guarda 24 g.

**R8**
- Given el formulario de receta propia o «Personalizada», when dejo la fibra vacía, then se guarda sin dato.
- Given el campo de fibra, when escribo un valor fuera de 0–200 g, then no se acepta.
- Given «Personalizada» con fibra 0 escrito explícitamente, when registro, then cuenta como dato (0 g), no como sin dato.

**R9**
- Given un día con 5 entradas y 3 sin dato, when abro el Diario, then bajo la barra veo «Faltan datos de fibra en 3 de 5 entradas» y esas 3 entradas muestran «Fibra: sin dato».
- Given un día con todos los datos, when abro el Diario, then no aparece la línea de aviso.

**R10**
- Given 0 vasos y vaso de 250 ml, when toco «+» una vez, then veo «1 de 8 vasos» y «0,25 / 2 L».
- Given 0 vasos, when toco «−», then sigue en 0.
- Given que cambio de fecha en el Diario, when toco «+», then el vaso se suma a la fecha seleccionada.
- Given el total diario en 6 L, when toco «+», then no sube más (tope 6 L/día).
- Given que recargo la app, when vuelvo al Diario, then el agua de ese día se conserva.
- El consumo se guarda en ml por día.

**R11**
- Given que cambio el tamaño del vaso a 330 ml, when abro un día ya registrado, then los ml bebidos no cambian y los vasos se recalculan al nuevo tamaño.
- Given un perfil sin objetivo de agua, when abro el Diario, then el objetivo es 2 L.
- Objetivo de agua admitido: de 0,5 a 6 L.

**R12**
- Given que alcanzo el objetivo, when miro la tarjeta, then pone «Objetivo cumplido» y «+» sigue funcionando hasta el tope.

**R13**
- Given una copia de seguridad exportada con fibra y agua, when la importo, then se restauran entradas, objetivos, tamaño del vaso y consumo de agua.
- Given dos dispositivos sincronizados, when registro fibra o agua en uno, then aparece en el otro.
- Given una copia anterior sin estos campos, when la importo, then funciona y los valores por defecto se aplican.

## Edge cases
- Entradas antiguas (anteriores a esta entrega) quedan «sin dato»: el total de los días pasados saldrá «parcial».
- Si el vaso es de 500 ml y el objetivo 2 L, hay 4 vasos; la fila de vasos usa el número que corresponda.
- Si el objetivo de agua no es múltiplo del vaso, los vasos del objetivo se redondean hacia arriba.
- Un valor de Open Food Facts ilegible o negativo se trata como sin dato.
- La cantidad de fibra de un alimento por 100 g mayor que 100 se descarta como sin dato.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Días con agua al objetivo en las primeras 2 semanas | 0 (no se sigue) | ≥ 5 de cada 7 días | Observación propia en el Diario |
| Días con total de fibra completo (sin chip «parcial») | 0 | ≥ 5 de cada 7 días | Observación propia en el Diario |

## Risks & dependencies
- El total de fibra es poco fiable si faltan datos: se mitiga con el chip «parcial» y el aviso (R2, R9).
- Los valores de fibra del catálogo y de los alimentos locales son aproximados (rellenados por Claude a partir de tablas y de los ingredientes) y se muestran como exactos, igual que los macros actuales.
- Afecta a la copia de seguridad y a la sincronización (#22): dependencia de las claves sincronizadas y de la migración de datos.
- Depende de #13 (alimentos locales y Open Food Facts) y #14 (código de barras), ya mergeados.
- El agua es una entrega independiente de la fibra y puede ir después.

## Open questions
- [ ] ¿Dónde se guarda el agua: clave nueva sincronizada o dentro de otra? (decide la tech design)
- [ ] ¿De dónde salen los valores de fibra del catálogo y de `foods.json` (BEDCA/USDA, cálculo por ingredientes)? (decide la tech design, ver cuánto trabajo es)
