# Macros por día en el Plan semanal: Spec
_Status: Approved · Owner: Manuel Cabrera Carmona · Updated: 2026-09-26_
_Related: [brief](brief.md) · Issue: [#10](https://github.com/mancabcar/MealPlan/issues/10)_

## TL;DR
El Plan semanal solo dice cuántas kcal suma el día. No dice si ese día cumple la proteína, los hidratos y las grasas del plan de la nutricionista, y eso solo se descubre en el Diario, cuando ya se ha comido. Vamos a mostrar, en la tarjeta del día del Plan, los cuatro valores planificados y si cada uno está dentro, por debajo o por encima del objetivo del perfil. Funcionará si planificar un día que cumple deja de exigir ir al Diario o hacer cuentas a mano.

## Problem
El usuario planifica la semana en `/plan` asignando una receta a cada comida. La tarjeta del día muestra solo el total de kcal (`dayKcal` en `src/app/plan/page.tsx`). El plan vigente (septiembre 2026, `docs/referencia/plan-alimentacion-septiembre-2026.md`) fija 2000 kcal, proteína 130–160 g, hidratos 230 g y grasas 69 g. Hoy, para saber si un día planificado cumple, hay que sumar a mano los macros de cada receta o registrarlo en el Diario y mirar las barras de `MacroBar` (`src/app/page.tsx`), es decir, después de comer.

## Goals
- Ver de un vistazo, antes de comer, si un día planificado cumple los cuatro objetivos.
- Usar el mismo criterio de "cumplido" que el Diario para la proteína con rango, sin dos verdades distintas.
- Dejar el cálculo listo para que las raciones en el Plan (#29) se sumen sin rehacerlo.

## Non-goals
- **Raciones en el Plan.** `DayPlanSlot` no tiene `servings`, y añadirlo es el issue #29. Mientras tanto cada franja cuenta como 1 ración.
- Resúmenes o medias semanales, gráficas de la semana.
- Sugerir cambios de receta para cuadrar un día ("cambia la cena por X").
- Cambiar el Diario o `MacroBar`, salvo extraer la lógica compartida de "cumplido" si la ingeniería lo ve útil.
- Editar los objetivos desde el Plan (se editan en Perfil).
- Marcar el estado en el selector de días (`DaySelector`). Queda como Could (R8).

## Users & key scenarios
Usuario único: la persona que sigue el plan de su nutricionista y planifica la semana con antelación.

1. **Cuadrar un día.** El domingo planifica el lunes: asigna desayuno, comida y cena, y ve que la proteína se queda en 110 g, por debajo de 130–160. Cambia la cena por una receta más proteica y el indicador pasa a "dentro".
2. **Revisar la semana.** Recorre los días con el selector y comprueba cuáles cumplen y cuáles se pasan de grasas.
3. **Día a medias.** Solo ha planificado la comida del miércoles. Ve que todo está por debajo, pero también que faltan comidas por asignar, así que no lo toma como un día mal planificado.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | La tarjeta del día seleccionado en el Plan muestra kcal, proteínas, hidratos y grasas planificados: la suma de los macros de las recetas asignadas a las comidas que el usuario hace (`profile.meals`). | Must |
| R2 | Cada uno de los cuatro valores se muestra junto a su objetivo del perfil (`calorieGoal`, `proteinGoal` o `proteinRange`, `carbsGoal`, `fatGoal`). | Must |
| R3 | Cada valor tiene un estado: **dentro**, **por debajo** o **por encima** del objetivo. Si la proteína tiene rango, está dentro cuando `min ≤ valor ≤ max`, por debajo cuando es menor que `min` y por encima cuando supera `max`, igual que `MacroBar`. | Must |
| R4 | Para los objetivos sin rango (kcal, hidratos, grasas y proteína sin `proteinRange`), "dentro" significa estar a ±10 % del objetivo, redondeando el valor a entero antes de comparar. Por debajo o por encima fuera de esa banda. _(Tolerancia confirmada, 2026-09-26.)_ | Must |
| R5 | El estado se distingue sin depender solo del color: icono y texto o nombre accesible ("Dentro", "Por debajo", "Por encima"), en la línea del icono Check de `MacroBar`. | Must |
| R6 | El resumen se recalcula al momento cuando se asigna, cambia o quita una receta, y cuando se cambia de día. | Must |
| R7 | Si el día tiene comidas sin asignar, el resumen lo indica ("2 de 4 comidas planificadas") para que un día incompleto no parezca un día mal planificado. | Should |
| R8 | El selector de días marca qué días de la semana cumplen los cuatro objetivos. | Could |
| R9 | El cálculo por franja pasa por un único punto (receta × raciones, hoy siempre 1), de modo que #29 solo tenga que aportar el multiplicador. | Should |

## User flows
**Cuadrar un día (escenario 1)**
1. El usuario abre Plan y elige el lunes en el selector.
2. Asigna recetas a sus comidas. Tras cada asignación, el resumen de la tarjeta del día se actualiza.
3. Ve "Proteínas 110 / 130–160 · Por debajo".
4. Toca la cena, elige otra receta y el resumen pasa a "Proteínas 142 / 130–160 · Dentro".

**Día a medias (escenario 3)**
1. Elige el miércoles, que solo tiene la comida asignada.
2. Ve los cuatro valores por debajo y el aviso "1 de 4 comidas planificadas".

## Acceptance criteria
**R1**
- Dado un día con desayuno (P 30), comida (P 50) y cena (P 40) asignados, cuando el usuario lo selecciona, la tarjeta muestra proteínas 120. Lo mismo vale para kcal, hidratos y grasas, cada uno con su suma.
- Dado un día con una receta asignada a una comida que el usuario ha desmarcado en su perfil, esa receta no suma, como ya ocurre con las kcal.
- Dada una franja cuya receta ya no existe (borrada), no suma y no rompe la página.
- Dado un día sin ninguna receta asignada, no se muestra el resumen de macros (hoy tampoco se muestran las kcal).

**R2**
- Dado un perfil con `proteinRange` 130–160, la proteína se muestra como "N / 130–160". Sin rango, como "N / proteinGoal".
- Kcal, hidratos y grasas se muestran como "N / objetivo", con N redondeado a entero.

**R3**
- Con rango 130–160: 129 → Por debajo, 130 → Dentro, 160 → Dentro, 161 → Por encima.

**R4**
- Con objetivo de 2000 kcal: 1799 → Por debajo, 1800 → Dentro, 2200 → Dentro, 2201 → Por encima.
- Con objetivo de hidratos de 230 g: 206 → Por debajo, 207 → Dentro (límite 207, redondeado), 253 → Dentro, 254 → Por encima.
- Con un objetivo igual a 0, cualquier valor mayor que 0 está Por encima y 0 está Dentro.

**R5**
- Cada estado tiene un icono distinto con nombre accesible y, además, se distingue sin color (texto visible o `aria-label`). Un lector de pantalla anuncia, por ejemplo, "Grasas 80 de 69, por encima".

**R6**
- Cuando el usuario cambia la receta de una franja o la deja "Sin asignar", el resumen refleja el cambio sin recargar la página.
- Cuando el usuario cambia de día en el selector, el resumen corresponde al día nuevo.

**R7**
- Con 4 comidas en `profile.meals` y 2 asignadas, se muestra "2 de 4 comidas planificadas". Con todas asignadas, el aviso no aparece.

## Edge cases
- **Sin perfil** (`profile` null, el Plan ya lo admite): se muestran los totales sin objetivo ni estado.
- **Decimales:** los macros de receta pueden no ser enteros. Se suman sin redondear y se redondea solo al mostrar y al comparar (R4).
- **Cambio de plan de la nutricionista:** los objetivos salen del perfil en cada render, así que al editar el perfil el Plan refleja los nuevos al momento.
- **Cruce de medianoche con la pestaña abierta:** el día seleccionado ya cae a hoy (código existente). El resumen sigue al día efectivo.

## Success metrics
Es una app personal sin analítica, así que la métrica es cualitativa. Durante las dos semanas siguientes al lanzamiento, el usuario planifica la semana sin tener que ir al Diario ni sumar macros a mano para saber si un día cumple. Baseline: hoy es imposible sin eso.

## Risks & dependencies
- **#29 (raciones en el Plan):** si llega después, debe reutilizar el cálculo de R9. Si llegara antes, este spec tendría que multiplicar por las raciones de cada franja.
- **Densidad en móvil:** cuatro barras y cuatro estados en la tarjeta del día compiten con la lista de comidas. La tech design debe decidir si el resumen es compacto (chips) o reutiliza las barras de `MacroBar`.
- **Dos criterios de "cumplido":** el Diario solo marca Check para la proteína con rango. Si el Plan marca "dentro" también para kcal, hidratos y grasas con ±10 %, habrá un criterio que el Diario no tiene. Es aceptable (el Diario no es alcance), pero conviene anotarlo como follow-up.

## Open questions
- [x] **Tolerancia para objetivos sin rango:** ±10 % para kcal, hidratos, grasas y proteína sin rango. _(Decidido por Manuel, 2026-09-26.)_
- [ ] ¿Se queda el resumen en la tarjeta del día o va en una tarjeta propia encima de la lista de comidas? Decisión de diseño que puede tomar la tech design. (Manuel / tech design)
