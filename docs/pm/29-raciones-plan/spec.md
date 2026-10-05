# Raciones en el Plan: Spec
_Status: Approved (Must confirmados, 2026-10-05) · Owner: @mancabcar · Updated: 2026-10-05_
_Related: [brief](brief.md) · [issue #29](https://github.com/mancabcar/MealPlan/issues/29) · [raciones (#7)](../raciones/spec.md) · [macros del Plan (#10)](../10-macros-plan/spec.md) · [sobras (#17)](../17-sobras-batch-cooking/spec.md)_

## TL;DR
El Plan asigna siempre una ración completa por franja, así que las kcal/macros del día, la lista de la compra y el "Hecho" del Diario no reflejan media ración o una y media. Añadimos un multiplicador `servings` por franja (0,25–4, por defecto 1), que se elige al asignar la receta y se edita desde la etiqueta de la franja. Sabremos que funciona cuando se puedan planificar raciones parciales y el día, la compra y el Diario cuadren sin pasar por "Personalizada".

## Problema
Manuel planifica a veces media ración o ración y media. `DayPlanSlot` solo guarda `recipeId`, de modo que el total del día (`dayPlanSummary`), `aggregate.ts` y el "Hecho" de los pendientes cuentan siempre 1 ración. #7 añadió raciones al Diario y dejó el Plan fuera por su impacto en la compra.

## Goals
- Planificar una fracción o múltiplo de una receta en una franja.
- Que macros del día, lista de la compra y "Hecho" usen esas raciones.
- Que el Plan y los datos existentes no cambien para quien no toque el campo.

## Non-goals
- Editar las raciones de entradas ya registradas en el Diario.
- Redondear unidades contables en la compra (0,5 huevo se muestra como 0,5).
- Sugerir cuántas raciones cocinar según las comidas planificadas.
- Raciones por defecto por receta o por comida en el perfil.
- Unificar `servings` y `cookedServings` (#17): son campos distintos. _(Decidido, 2026-10-05.)_

## Users & key scenarios
Manuel, único usuario, planificando la semana.
1. **Media cena:** asigna una receta a la cena con 0,5 raciones; el total del día baja en consecuencia y la compra cuenta la mitad de sus ingredientes.
2. **Ración y media:** pone 1,5 a una comida; todo escala ×1,5.
3. **Lo de siempre:** asigna sin tocar el campo → 1 ración, igual que hoy.
4. **Hecho:** marca "Hecho" en una franja de 0,5 → el Diario registra la entrada "× 0,5".
5. **Ajuste:** pulsa "Raciones" en una franja y la cambia a 0,75 sin reasignar.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | `DayPlanSlot` puede guardar `servings` (0,25–4, pasos de 0,25). Ausente = 1; con 1 no se guarda. | Must |
| R2 | Al asignar una receta a una franja, el usuario puede indicar "Raciones" (por defecto 1) con − / + de 0,25 o tecleando; acepta coma y punto. Un valor fuera de rango, fuera de pasos de 0,25 o no numérico no asigna la receta y muestra un mensaje junto al campo (mismo comportamiento que el Diario). | Must |
| R3 | La franja con raciones ≠ 1 muestra "× 0,5" (coma decimal) junto a la receta; con 1 no muestra nada. Un botón propio "Raciones: × 0,5" (o "Raciones: 1") en la fila de la franja, presente en toda franja con receta, abre una hoja para cambiarlas sin reasignar la receta. | Must |
| R4 | Los macros por franja y el total del día del Plan (kcal, P, C, G) multiplican por las raciones, a través de `slotMacros` (único punto de escalado). | Must |
| R5 | La lista de la compra escala por `servings` las cantidades de los ingredientes de las franjas normales (lineal, sin redondear). Las líneas sin cantidad ("al gusto") no cambian. Dos franjas de la misma receta suman sus cantidades escaladas. | Must |
| R6 | "Hecho" en un pendiente y "Registrar todo el día" registran en el Diario las raciones planificadas de cada franja (la entrada sale con `servings` y "× N", como en #7). La tarjeta del pendiente muestra "× N" antes de pulsar Hecho (con 1 no muestra nada). | Must |
| R7 | Las franjas ya guardadas sin `servings` se tratan como 1: mismos macros y compra, sin migración ni acción del usuario. | Must |
| R8 | Las franjas cocinada y sobras de un batch (#17) también aceptan raciones para macros del día y "Hecho". La compra de un batch no cambia: sigue contando `cookedServings` una vez. | Should |
| R9 | Cambiar la receta de una franja conserva sus raciones. "Dejar las sobras como comidas normales" conserva las raciones de cada sobra, que pasan a escalar la compra como cualquier franja normal. | Must |

## User flows
**Asignar con raciones (escenarios 1–3)**
1. Plan → franja vacía → asignar receta.
2. En la hoja de asignación aparece "Raciones" con 1; lo cambia a 0,5 (− o tecleando).
3. Confirma: la franja muestra la receta con "× 0,5"; el total del día y el resumen de macros se actualizan; la compra de la semana se recalcula.

**Editar raciones (escenario 5)**
1. Pulsa "Raciones: × 0,5" en la fila de la franja → se abre una hoja con el campo y el valor actual.
2. Cambia a 0,75 y guarda → todo se recalcula; la receta no cambia.

**Hecho (escenario 4)**
1. En el Diario, pendiente de una franja con 0,5 → "Hecho".
2. Aparece la entrada de esa comida con "× 0,5" y la mitad de los macros.

## Acceptance criteria
**R1 / R7**
- Dada una franja guardada antes de este cambio (sin `servings`), cuando se abre el Plan, entonces macros del día y compra son idénticos a los de antes.
- Cuando se asigna con 1 ración, la franja guardada no tiene `servings`.

**R2**
- Cuando se abre la hoja de asignación, "Raciones" vale 1.
- Con "0,5" o "0.5" se asigna con 0,5. Con "5", "0,3" o "abc" no se asigna y aparece el mensaje de error.

**R3**
- Dada una franja con 1,5 raciones, la lista del Plan muestra "× 1,5"; recargada la página se conserva.
- Cambiar 0,5 → 0,75 desde el botón "Raciones" no altera la receta ni el resto de franjas.

**R4**
- Dada una receta de 600 kcal / 40 P / 60 C / 20 G con 0,5 raciones, el total del día suma 300 kcal / 20 / 30 / 10; con 1,5, 900 / 60 / 90 / 30.
- El resumen "N de M comidas planificadas" no cambia con las raciones.

**R5**
- Dada una receta con "200 g de pollo" en 0,5 raciones, la compra muestra 100 g de pollo. Dos franjas de esa receta (0,5 y 1) suman 300 g.
- "Sal al gusto" aparece igual con cualquier número de raciones.
- Si cambian las raciones y con ellas la cantidad de un ítem, no queda marcado como comprado (regla de la firma de cantidad de #5).

**R6**
- Dado un pendiente de 0,5 raciones, su tarjeta muestra "× 0,5"; con 1 no muestra nada.
- Dada una franja de 0,5 raciones, "Hecho" crea una entrada con `servings` 0,5 y macros a la mitad; "Registrar todo el día" crea una entrada por franja con sus raciones.

**R8**
- Dada una sobra con 0,5 raciones, el total del día cuenta 0,5; la compra del batch sigue siendo la de `cookedServings`, aunque la cocinada tenga otras raciones.

**R9**
- Reasignar otra receta a una franja de 0,5 deja 0,5 en el campo y en la franja.
- "Dejar normales" en una sobra con 0,5: la franja queda con 0,5 y suma a la compra la mitad de los ingredientes.

## Edge cases
- Franja cuya receta fue borrada: sigue sin contar (como hoy), con cualquier `servings`.
- Dos franjas de la misma comida el mismo día: cada una conserva sus raciones; el resumen del día sigue usando la primera franja de cada comida (#10).
- Raciones fraccionarias en la compra: se muestran con el formato actual, sin redondeo (non-goal).
- Datos de copia de seguridad o importación sin `servings`: válidos (= 1).

## Success metrics
Cualitativa, sin números (decidido, 2026-10-05): éxito = Manuel planifica media o 1,5 raciones y el total del día, la compra y el Diario cuadran sin recurrir a una entrada "Personalizada".

## Risks & dependencies
- Tocar `slotMacros`/`dayPlanSummary` (#10), `aggregate.ts` (#5, #17) y `pendingSlots`/"Hecho" (#7): los tests existentes deben seguir en verde con `servings` ausente.
- La compra con fracciones puede dar cantidades poco prácticas (0,5 huevo); asumido.
- Solape con #17: la rama de batch en `aggregate.ts` debe seguir priorizando `cookedServings` sobre `servings`.

## Open questions
- [x] Dónde vive la edición: resuelto en el [tech design](tech.md) (hoja propia + botón "Raciones"). Sin preguntas abiertas.
