# Sobras y batch cooking: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-09-29_
_Related: [brief](brief.md) · [issue #17](https://github.com/mancabcar/MealPlan/issues/17)_

## TL;DR
Cocinar un guiso para varias comidas obliga hoy a asignarlo varias veces en el Plan, y la lista de la compra lo cuenta multiplicado. Añadimos "Cocinar N raciones" al asignar una receta: eliges en qué franjas vacías se come el resto, quedan marcadas como *sobras* enlazadas a la cocinada, y la lista cuenta los ingredientes una sola vez, escalados a N. Sabremos que funciona cuando un batch de N raciones se planifica con una sola asignación y la lista muestra las cantidades de N raciones una vez.

## Problema
Si Manuel cocina un guiso el domingo para tres comidas, tiene que asignarlo tres veces en el Plan y la lista de la compra suma sus ingredientes tres veces. La alternativa actual es asignarlo una vez y acordarse de las otras comidas, con lo que el Plan y sus macros quedan incompletos. `collectSources` (`src/lib/shopping/aggregate.ts`) recorre cada franja y suma los ingredientes de la receta sin escalar; `DayPlanSlot` (`src/lib/types.ts`) es solo `{ mealType, recipeId }`, sin raciones ni enlaces.

## Objetivos
- Planificar un batch con una sola asignación: la receta cocinada más las franjas donde se comen las sobras.
- Que la lista de la compra cuente la receta una vez, escalada a las raciones cocinadas.
- Que el Plan deje claro qué franja es la cocinada y cuáles son sobras enlazadas a ella.
- Que no cambie nada para el Plan existente ni para quien no use batch cooking.

## Fuera de alcance
- **Multiplicador libre por franja** ("comer 0,5 o 1,5 raciones" en el Plan): es [#29](https://github.com/mancabcar/MealPlan/issues/29). Aquí cada franja es 1 ración; #29 podrá apoyarse en el campo de raciones que se añade. _(Decidido, 2026-09-29.)_
- Cambiar la receta de una sobra, o que las sobras tengan otra receta distinta de la cocinada.
- Congelar sobras, caducidad o seguimiento de qué queda en la nevera.
- Ajustar la lista de la compra según la semana en que cae cada sobra: la lista cuenta las N raciones en la semana de la franja cocinada, aunque alguna sobra caiga en otra semana.
- Seleccionar franjas ya ocupadas para sobras (no se sobrescribe nada).
- Sobras en otra semana: el Plan solo muestra la semana actual, así que no se ofrecen días de otras semanas. _(Decidido en el tech design, 2026-09-29.)_

## Usuarios y escenarios clave
Manuel, único usuario, planificando su semana.
1. **Guiso del domingo:** asigna un guiso a la comida del domingo, elige "Cocinar 3 raciones" y marca la comida del lunes y la cena del martes. El Plan muestra las tres franjas y la lista cuenta los ingredientes una vez ×3.
2. **Batch más grande que las sobras elegidas:** cocina 6 raciones y solo asigna 3 franjas de sobras; el resto se queda sin asignar (la lista sigue contando 6).
3. **Anular el batch:** borra la franja original del guiso y elige qué hacer con las sobras.
4. **Ajuste:** una sobra ya no hace falta y la borra; o decide añadir otra franja de sobras.

## Requisitos
| ID | Requisito | Prioridad |
|---|---|---|
| R1 | Al asignar una receta a una franja, el usuario puede indicar "Cocinar N raciones" (N entero de 2 a 8; por defecto no hay batch) y elegir franjas de sobras entre las vacías desde la comida de la cocinada hasta el domingo de la semana actual (nunca antes de la cocinada). Puede elegir entre 0 y N−1. | Must |
| R2 | Cada franja de sobras es 1 ración de la misma receta, guarda el enlace a la franja cocinada y se muestra con la etiqueta "Sobras · de <día>"; la cocinada se muestra con "Cocinar ×N". | Must |
| R3 | La lista de la compra cuenta los ingredientes de la receta una vez, multiplicados por N (raciones cocinadas), y las franjas de sobras no suman nada. | Must |
| R4 | Al borrar la franja cocinada, si tiene sobras enlazadas se pregunta: "Borrar todo", "Dejarlas como comidas normales" o "Cancelar". "Dejarlas normales" convierte cada sobra en una franja ordinaria de la receta (1 ración, suma a la lista como cualquier franja). Sin sobras enlazadas se borra sin preguntar, como hoy. | Must |
| R5 | Borrar una franja de sobras la quita del Plan y no cambia N; la lista sigue contando N raciones. | Must |
| R6 | En el total de macros del día del Plan y en "Hecho" del Diario, cada franja (cocinada o sobra) vale 1 ración de la receta. | Must |
| R7 | En el selector de sobras, las franjas que ya tienen receta no se pueden elegir. | Must |
| R8 | Desde la franja cocinada se puede cambiar N y añadir o quitar franjas de sobras. N no puede bajar de 1 + las sobras enlazadas. | Should |
| R9 | Intentar cambiar la receta de una franja cocinada con sobras enlazadas dispara el mismo aviso que borrarla (R4). | Should |
| R10 | Los planes guardados sin los campos nuevos se tratan como franjas normales de 1 ración, sin acción del usuario. | Must |

## Flujos
**Escenario 1: guiso del domingo**
1. Plan → domingo, franja "Comida" → elige la receta.
2. Aparece "Cocinar N raciones"; pone 3.
3. Aparece el selector de franjas de sobras (las ocupadas deshabilitadas); marca lunes "Comida" y martes "Cena".
4. Confirma: el domingo muestra la receta con "Cocinar ×3"; el lunes y el martes muestran la receta con "Sobras · de domingo".
5. La lista de la compra muestra los ingredientes una vez, con las cantidades ×3.

**Escenario 3: borrar la origen**
1. Pulsa borrar en la franja del domingo.
2. Aparece el aviso con las tres opciones (R4).
3. "Dejarlas como comidas normales": el domingo desaparece; el lunes y el martes quedan como franjas normales de la receta y la lista pasa a sumar 1 ración por cada una.

## Criterios de aceptación
**R1 / R2**
- Dada una receta sin batch, cuando se asigna con "Cocinar 3 raciones" y se eligen 2 franjas vacías, entonces existen 3 franjas de esa receta: 1 cocinada con "Cocinar ×3" y 2 sobras con "Sobras · de <día>", enlazadas a la cocinada.
- Cuando N=3, se pueden elegir 0, 1 o 2 franjas de sobras, pero no 3.
- N acepta solo enteros de 2 a 8; 1, 9, 2,5 y vacío se rechazan con mensaje junto al campo.
- Sin usar "Cocinar N raciones", asignar una receta funciona exactamente como hoy.

**R3**
- Dada una receta con 200 g de arroz y 1 cebolla, cocinada ×3 con 2 sobras, entonces la lista muestra 600 g de arroz y 3 cebollas, una sola vez.
- Dada la misma receta asignada a 3 franjas normales (sin batch), la lista muestra lo mismo que hoy (sin cambios de comportamiento).
- Quitar una franja de sobras no cambia las cantidades de la lista.

**R4**
- Dada una cocinada con 2 sobras, cuando se pulsa borrar, entonces se muestran las 3 opciones y no se borra nada hasta elegir.
- "Borrar todo" elimina la cocinada y sus 2 sobras. "Cancelar" no cambia nada.
- "Dejarlas normales" elimina la cocinada y deja 2 franjas ordinarias de la receta; la lista cuenta 2 raciones sin escalar.
- Borrar una cocinada sin sobras enlazadas no muestra aviso.

**R5**
- Dada una cocinada ×3 con 2 sobras, cuando se borra 1 sobra, entonces queda 1 sobra, la cocinada sigue ×3 y la lista sigue contando 3 raciones.

**R6**
- Dada una receta de 600 kcal cocinada ×3 con 2 sobras, entonces cada una de las 3 franjas suma 600 kcal al total de su día en el Plan.
- "Hecho" en una franja de sobras registra 1 ración de la receta (600 kcal) en el Diario.

**R7**
- Las franjas con receta aparecen deshabilitadas en el selector y no se pueden marcar.

**R8**
- Con una cocinada ×4 y 1 sobra, cambiar N a 2 se acepta; cambiarlo a 1 se rechaza. Con 2 sobras, N mínimo es 3.
- Se puede marcar una nueva franja vacía como sobra desde la cocinada, mientras el total de franjas no supere N.

**R9**
- Dada una cocinada con sobras, cuando se intenta cambiar su receta, entonces aparece el aviso de R4 antes de cualquier cambio.

**R10**
- Con un plan guardado antes del cambio, el Plan y la lista muestran lo mismo que antes y sin etiquetas.

## Casos límite
- Receta borrada del catálogo tras planificar el batch: la franja se ignora en la lista, como hoy; las sobras enlazadas se muestran como cualquier franja con receta desconocida (sin cambios respecto a hoy).
- Comida desactivada en el perfil (`meals`): las franjas de esa comida no cuentan en la lista, como hoy. Si la cocinada está en una comida desactivada, el batch no suma a la lista.
- N mayor que 1 + sobras: las raciones sin asignar se cuentan igual en la lista (se cocinó para N).
- Una sobra sin su cocinada (p. ej. una copia de seguridad editada a mano) se trata como franja normal y suma su ración a la lista.

## Riesgos y dependencias
- Cambia la forma de `DayPlanSlot`, que vive en localStorage. La compatibilidad (R10) depende de que ausencia de campos = franja normal, sin reescribir los datos.
- Dependencias hechas: #5 (lista de la compra) y #7 (raciones en el Diario), ambas mergeadas.
- Solapa con [#29](https://github.com/mancabcar/MealPlan/issues/29): se decidió que #17 añade el mínimo (raciones cocinadas) y que #29 va después sobre el mismo campo. Conviene revisar #29 al terminar para evitar dos campos distintos.
- Las cantidades de la lista dependen del parseo de ingredientes (`src/lib/shopping/parse.ts`): las recetas se generan "para 1 persona", así que ×N es una multiplicación simple.
- El "Registrar todo el día" del Diario debe seguir funcionando con franjas de sobras (R6).

## Preguntas abiertas
- [x] ¿Existe hoy una acción de "limpiar el día o la semana" en el Plan? No: solo se borra por franja (comprobado en el tech design, 2026-09-29).
- [ ] ¿Debe #29 quedar reescrito para apoyarse en el campo de este issue? (Manuel, tras el merge)
