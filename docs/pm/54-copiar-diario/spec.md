# Diario: copiar un día completo a otra fecha: Spec
_Status: Draft · Owner: Manuel Cabrera · Updated: 2026-10-06_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/3BuMmijuwQtipCjmJ74b4v)_

## TL;DR
Hay días casi calcados y hoy repetirlos exige añadir cada entrada una a una desde «Recientes». Añadimos «Copiar día a…» en el Diario: duplica todas las entradas del día en otra fecha con ids nuevos y, si el destino ya tiene entradas, avisa y las suma sin pisar nada. Habrá funcionado si copiar un día cuesta 3 toques o menos.

## Problem
Quien registra el Diario a menudo come casi lo mismo varios días. Hoy solo puede añadir cada entrada desde «Recientes», cambiando fecha y franja cada vez. Issue [#54](https://github.com/mancabcar/MealPlan/issues/54) (el [#59](https://github.com/mancabcar/MealPlan/issues/59) era un duplicado, ya cerrado).

## Goals
- Copiar un día completo del Diario a otra fecha en 3 toques o menos.
- No perder ni pisar nada: la copia solo añade.

## Non-goals
- Copiar el agua del día (va aparte de las entradas).
- Repetir una entrada suelta (follow-up; «Recientes» ya cubre parte).
- Editar al copiar: cambiar raciones, cantidades o franja durante la copia.
- Deshacer la copia (follow-up). Las entradas copiadas se quitan con la ✕ de cada fila.
- Copiar varios días o una semana del Diario.
- Día tipo o plantillas; rellenar el Diario desde el Plan.

## Users & key scenarios
Usuario del Diario de comidas (móvil).
1. **Día calcado:** ayer desayunó, comió y cenó lo de siempre y hoy será igual: abre el día de ayer y lo copia a hoy.
2. **Preparar un día futuro:** copia un día a mañana o a dentro de 7 días.
3. **Destino ya empezado:** hoy ya registró el desayuno; al copiar ayer a hoy se le avisa y suma el resto.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El Diario tiene un botón de icono (`aria-label` «Copiar día a otra fecha») en la cabecera, junto a la fecha, que abre una hoja para elegir la fecha de destino | Must |
| R2 | Copiar duplica todas las entradas del día que se ve con ids nuevos, en la misma franja y con macros, fibra, raciones, gramos y unidades intactos | Must |
| R3 | Si el día de destino ya tiene entradas, un aviso las lista y ofrece sumar las copiadas o cancelar; nunca pisa ni borra nada | Must |
| R4 | Tras copiar, el Diario muestra el día de destino con el aviso «Copiadas N entradas» | Must |
| R5 | Si el día de origen no tiene entradas, el botón está desactivado | Must |
| R6 | El destino puede ser cualquier fecha, pasada o futura, salvo el propio día de origen | Must |
| R7 | La hoja ofrece atajos Hoy, Mañana y En 7 días (contados desde hoy; no se ofrece el que coincide con el día de origen) y un selector de otra fecha | Should |
| R8 | Las entradas copiadas llevan la marca «Copiada» mientras dura el aviso | Could |

## User flows
1. **Copia sin conflicto** (artboards `1 · Diario con entradas`, `2 · Elegir fecha de destino`, `4 · Copiado`): el usuario ve un día con entradas → toca el icono de copiar → elige un atajo o una fecha → toca «Copiar» → el Diario salta al día de destino con «Copiadas N entradas».
2. **Copia con conflicto** (artboard `3 · Aviso: el destino ya tiene entradas`): igual hasta «Copiar»; como el destino ya tiene entradas, aparece el aviso con las existentes → «Sumar las N entradas» → mismo final que el flujo 1. «Cancelar» cierra hoja y aviso sin copiar nada.
3. **Día sin entradas** (artboard `5 · Día sin entradas`): el icono sale desactivado.

## Acceptance criteria
**R1**
- Given el Diario en cualquier día, when se mira la cabecera, then hay un botón con icono de copiar y `aria-label` «Copiar día a otra fecha» junto al selector de fecha, con zona táctil de al menos 44 px.
- Given el botón, when se toca, then se abre la hoja de destino con el día de origen indicado («Copiar el lun 5 oct a…», número de entradas y kcal).

**R2**
- Given un día con N entradas (de receta con raciones, de alimento con gramos o unidades, personalizadas, con o sin fibra), when se copia a otra fecha, then el destino recibe N entradas nuevas con id distinto del original y de cualquier otra entrada, misma `mealType` y mismos `calories`, `protein`, `carbs`, `fat`, `fiber`, `servings`, `grams`, `units`, `recipeId`, `customName` y `foodId` que su original.
- Given el día de origen, when se copia, then sus entradas no cambian.
- Given que se copia a un día con entradas, then conservan el orden de registro del origen y quedan después de las que ya había.

**R3**
- Given un destino con M ≥ 1 entradas, when se toca «Copiar», then aparece un aviso «El <fecha> ya tiene M entradas» con la lista de esas entradas (nombre, franja, kcal) y no se ha copiado nada todavía.
- Given el aviso, when se toca «Sumar las N entradas», then el destino queda con M + N entradas y las M originales intactas.
- Given el aviso, when se toca «Cancelar», then se cierran la hoja y el aviso, el Diario sigue en el día de origen y no se crea ninguna entrada.
- Given un destino sin entradas, when se toca «Copiar», then no aparece aviso y se copia directamente.

**R4**
- Given una copia terminada, then el Diario muestra la fecha de destino y el aviso «Copiadas N entradas», con el mismo componente de aviso que «Añadir comida» (se cierra solo a los 10 s), sin acción «Deshacer».
- Given el destino con franjas del Plan pendientes, when la copia trae entradas de esa franja, then esa franja deja de aparecer como pendiente (misma regla que al registrar a mano).

**R5**
- Given un día sin entradas, then el botón está desactivado (no oculto) y no abre la hoja.
- Given un día con al menos una entrada, then está activo.

**R6**
- Given la hoja, when se elige una fecha futura o pasada distinta del origen, then «Copiar» está activo.
- Given la hoja, when la fecha es la del origen, está vacía o no es válida, then «Copiar» está desactivado.

**R7**
- Given hoy = mar 6 oct y origen = lun 5 oct, then la hoja ofrece Hoy (mar 6 oct), Mañana (mié 7 oct) y En 7 días (lun 12 oct).
- Given que el origen es el mismo día que uno de los atajos, then ese atajo no se muestra.
- Given un atajo o una fecha elegidos, when se toca «Copiar», then el botón indica el destino («Copiar a hoy»).
- Given un atajo, when se toca, then la copia usa esa fecha.
- Copiar un día con un atajo cuesta 3 toques: icono, atajo, «Copiar» (4 con el aviso de conflicto).

**R8**
- Given una copia terminada, then las entradas nuevas del destino llevan la marca «Copiada» mientras dura el aviso y la pierden al cerrarse.

## Edge cases
- Entradas en una franja que el perfil no muestra: se copian igualmente (el Diario ya muestra todas las franjas del historial).
- Entradas sin dato de fibra: la copia tampoco lo tiene (no se inventa 0).
- Destino con entradas idénticas a las copiadas: se suman igualmente; no se deduplica (el aviso de R3 ya lo advierte).
- Doble toque en «Copiar» o «Sumar»: se copia una sola vez.
- Entrada de una receta que ya no existe: se copia con su `recipeId`, como el resto del historial.
- El agua del día no se copia.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Toques para copiar un día a hoy o mañana | N entradas × 3-4 toques desde «Recientes» | ≤ 3 | A mano, sin telemetría |

## Risks & dependencies
- Sin Deshacer en v1: una copia equivocada se corrige quitando entradas una a una con la ✕. Mitigación: el aviso de conflicto y el aviso «Copiadas N entradas». Deshacer queda como follow-up.
- Las copias son entradas normales: sincronizan y se exportan con el resto de datos ([#22](../22-sincronizacion-dispositivos/brief.md), [backup](../backup-datos/brief.md)); no hay claves nuevas.
- Reutiliza el aviso `Toast` y `repeatEntry` de «Recientes» ([#12](../12-registro-rapido/brief.md)).

## Open questions
- Ninguna.
