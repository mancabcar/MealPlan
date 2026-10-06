# Copiar la semana anterior en el Plan: Spec
_Status: Draft · Owner: Manuel Cabrera Carmona · Updated: 2026-10-05_
_Related: [brief](brief.md)_

## TL;DR
Planificar una semana parecida a la anterior obliga a asignar cada franja a mano. Añadimos «Copiar semana anterior» al Plan: trae a la semana vista las recetas (y raciones) de la semana anterior, avisando antes de sobrescribir y permitiendo deshacer. No se recogen métricas de uso; se comprueba a mano tras el despliegue.

## Problema
Quien repite una semana parecida a la anterior tiene que volver a asignar receta franja a franja en el Plan. Hasta ahora no había forma de reutilizar lo ya planificado. Desde [#78](../78-plan-navegar-semanas/brief.md) el Plan navega por semanas, así que la semana de origen puede definirse como la inmediatamente anterior a la que se ve.

## Goals
- Rellenar una semana desde la anterior con una sola acción.
- No perder asignaciones existentes por accidente.

## Non-goals
- Elegir como origen una semana distinta de la anterior.
- Copiar un solo día o un subconjunto de franjas.
- Guardar plantillas de semana.
- Copiar el estado de la lista de la compra (elementos marcados).
- Métricas de uso.

## Users & key scenarios
Usuario del Plan que repite hábitos semanales.
1. Abre una semana en blanco y copia la anterior para partir de ahí.
2. Ya ha asignado algunos días de la semana nueva y copia el resto sin pisar lo hecho.
3. Copia y se arrepiente: deshace.
4. Su semana anterior tenía una tanda con sobras: llega entera a la nueva.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | «Copiar semana anterior» en el Plan copia cada franja de la semana anterior a la vista en el mismo día de la semana y la misma comida, con su receta y sus raciones. Disponible en cualquier semana vista. | Must |
| R2 | Si alguna franja de la semana vista ya tiene receta y la copia la escribiría encima, se muestra un único aviso con cuántas son y tres opciones: conservarlas (solo se rellenan las vacías), reemplazarlas o cancelar. Cancelar no cambia nada. | Must |
| R3 | Las tandas con sobras ([#17](../17-sobras-batch-cooking/spec.md)) se copian enteras desplazadas una semana, con un `batchId` nuevo. Solo se copian franjas del lunes–domingo de origen; los miembros de una tanda fuera de esa semana no se copian. Una cocinada que se queda sin sobras, o unas sobras sin su cocinada, pasan a ser franja normal. | Must |
| R4 | El botón está desactivado, con un texto que lo explica, cuando la semana anterior no tiene nada asignado. | Must |
| R5 | Tras copiar, un mensaje indica cuántas franjas se han copiado y ofrece «Deshacer» durante unos segundos, que restaura el plan previo. | Should |

## User flows
1. El usuario abre el Plan en la semana X y pulsa «Copiar semana anterior».
2. Sin conflictos: se copia y aparece «Copiadas N franjas» con «Deshacer».
3. Con conflictos: aparece el aviso «N franjas ya tienen receta» con Conservar / Reemplazar / Cancelar; tras elegir, se copia (salvo Cancelar) y aparece el mensaje de R5.
4. Con la semana anterior vacía, el botón aparece desactivado con su explicación.

## Acceptance criteria
**R1**
- Given una semana anterior con franjas asignadas y la semana vista vacía, when pulso «Copiar semana anterior», then cada franja aparece en el mismo día de la semana y comida con su receta y raciones.
- Given que veo una semana pasada o futura, when pulso el botón, then se copia la semana inmediatamente anterior a la vista.
**R2**
- Given franjas ocupadas en destino que la copia pisaría, when pulso el botón, then aparece el aviso con el número exacto y no se modifica nada hasta elegir.
- Given el aviso, when elijo Conservar, then las franjas ocupadas quedan intactas y se rellenan las vacías.
- Given el aviso, when elijo Reemplazar, then las franjas en conflicto toman la receta y raciones de origen.
- Given el aviso, when elijo Cancelar, then el plan queda exactamente igual.
- Given que no hay conflictos, then no aparece el aviso.
**R3**
- Given una tanda (cocinada + sobras) dentro de la semana de origen, when copio, then el destino tiene cocinada y sobras en los mismos días relativos, unidas por un `batchId` distinto del de origen.
- Given una cocinada cuyas sobras caen fuera de la semana de origen, when copio, then se copia como franja normal.
- Given unas sobras cuya cocinada cae fuera de la semana de origen, when copio, then se copian como franja normal.
**R4**
- Given una semana anterior sin ninguna franja, then el botón está desactivado y su texto lo explica.
**R5**
- Given que acabo de copiar, then veo «Copiadas N franjas» con «Deshacer», y al pulsarlo el plan vuelve a su estado previo a la copia.

## Edge cases
- Una franja de origen cuya receta ya no existe se omite.
- Una comida que el usuario ya no hace se copia igualmente; el Plan solo muestra las comidas que el usuario hace.
- Con «Conservar», si una franja de una tanda entra en conflicto se omite la tanda entera.
- Con «Reemplazar», si la franja pisada es la cocinada de una tanda existente, sus sobras quedan como franjas normales de la receta; si es una sobra suelta, se sustituye y la tanda pierde esa sobra (las raciones cocinadas no cambian), como al quitarla a mano.
- Las sobras solo se pueden colocar dentro de la semana de su cocinada, así que una tanda normalmente cabe entera en su semana; la regla de tandas partidas de R3 es una salvaguarda.
- El conteo del aviso y del mensaje de R5 cuenta franjas realmente copiadas o en conflicto, no las de origen.

## Success metrics
Sin métricas de uso (como en #78). Comprobación manual tras el despliegue de R1–R5 y de que la lista de la compra de la semana destino cuenta bien las tandas copiadas.

## Risks & dependencies
- Depende de la navegación por semanas ([#78](../78-plan-navegar-semanas/brief.md)) y del modelo de tandas ([#17](../17-sobras-batch-cooking/spec.md)) y raciones ([#29](../29-raciones-plan/spec.md)).
- El plan se sincroniza entre dispositivos; la copia escribe muchas franjas de una vez y debe respetar ese flujo.

## Open questions
Ninguna.
