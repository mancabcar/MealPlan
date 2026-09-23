# Raciones al registrar recetas: Spec
_Status: Approved · Owner: Manuel · Updated: 2026-09-23_
_Related: [brief](brief.md) · [issue #7](https://github.com/mancabcar/MealPlan/issues/7)_

## TL;DR
Hoy, registrar una receta en el Diario suma siempre una ración completa, aunque te hayas comido media o una y media. Añadimos un campo "Raciones" (0,25–4, por defecto 1) al registrar una receta. La entrada guarda ese multiplicador, suma los macros escalados y lo muestra en la lista ("× 0,5"). Sabremos que funciona cuando se puedan registrar raciones parciales sin tener que pasar a "Personalizada" y calcular los macros a mano.

## Problema
Cuando sigue su plan, Manuel a menudo come más o menos de una ración: media ración de cena, o repite. Hoy `submitAdd` (`src/app/page.tsx`) y el botón "Hecho" de los pendientes usan `recipeEntry` (`src/lib/diary.ts`), que copia el 100 % de los macros de la receta. La única alternativa es registrar la comida como "Personalizada" y calcular los macros a mano. Así se pierde el vínculo con la receta (`recipeId`), y con él el aviso de alérgenos y el estado del plan.

## Objetivos
- Registrar una fracción o un múltiplo de una receta con el cálculo correcto de kcal y macros.
- Que se vea en el Diario cuánto se registró de cada receta.
- Que no cambie nada para las entradas existentes ni para quien no toque el campo.

## Fuera de alcance
- **Raciones en el Plan** (`DayPlanSlot`): el Plan sigue asignando una receta por franja, sin multiplicador. Llevarlo al Plan obliga a tocar el total de kcal del día y las cantidades de la lista de la compra (`src/lib/shopping/aggregate.ts`), y eso merece su propio issue. _(Decidido, 2026-09-23.)_
- **`Recipe.servings`, recetas que rinden varias raciones**: hoy todas las recetas se generan "para 1 persona" (`src/lib/recipePrompt.ts`) y no existe un formulario manual de recetas. El campo no tendría ningún consumidor. _(Decidido, 2026-09-23.)_
- Editar las raciones de una entrada ya registrada. Hoy no se puede editar ninguna entrada: se borra con la ✕ y se vuelve a añadir.
- Raciones en las entradas "Personalizada": ahí los macros ya se escriben a mano.

## Usuarios y escenarios clave
Manuel, el único usuario, registrando lo que ha comido en el Diario.
1. **Media ración:** cena la mitad de una receta de 600 kcal y registra 0,5 → suma 300 kcal.
2. **Repetir:** come ración y media de la comida → registra 1,5.
3. **Lo de siempre:** registra una receta sin tocar el campo → 1 ración, igual que hoy.
4. **Pendiente del plan:** marca "Hecho" en una franja planificada → 1 ración, como hoy.

## Requisitos
| ID | Requisito | Prioridad |
|---|---|---|
| R1 | Al añadir una receta al Diario (modo "Receta"), el usuario puede indicar las raciones: entre 0,25 y 4, en pasos de 0,25. Por defecto 1. | Must |
| R2 | Los kcal, proteínas, carbohidratos y grasas de la entrada son los de la receta multiplicados por las raciones, y así cuentan en todos los totales (anillo, barras de macros, gráfica semanal). | Must |
| R3 | La entrada guarda el multiplicador de raciones. | Must |
| R4 | En la lista del Diario, una entrada con raciones distintas de 1 muestra el multiplicador junto al nombre, con coma decimal ("× 0,5", "× 1,5"). Con 1 ración no muestra nada. | Must |
| R5 | Las entradas ya guardadas sin multiplicador se tratan como 1 ración: mismos macros y sin etiqueta. No hace falta ninguna acción del usuario. | Must |
| R6 | El campo acepta coma y punto decimal ("0,5" y "0.5"). Si el valor está fuera de rango, no va en pasos de 0,25 o no es un número, la receta no se añade y se muestra un mensaje junto al campo. | Must |
| R7 | "Hecho" en un pendiente del plan registra 1 ración. "Registrar todo el día" también. | Must |
| R8 | El campo se puede ajustar con un toque (botones − / + de 0,25), sin tener que teclear. | Should |
| R9 | La vista previa del formulario muestra las kcal resultantes con las raciones elegidas (p. ej. "300 kcal") antes de pulsar "Añadir". | Could |

## Flujo
**Añadir media ración (escenarios 1–3)**
1. Diario → "Añadir comida" → modo "Receta".
2. Elige la receta en el desplegable.
3. Aparece "Raciones" con valor 1. Lo cambia a 0,5 (con − o tecleando "0,5").
4. "Añadir" → la entrada aparece en su franja como "<Receta> × 0,5" con la mitad de las kcal, y los totales se actualizan.
5. Al volver a abrir el formulario, "Raciones" vuelve a 1.

## Criterios de aceptación
**R1 / R2**
- Dada una receta de 600 kcal, 40 g de proteína, 60 g de carbohidratos y 20 g de grasa, cuando se registra con 0,5 raciones, entonces la entrada tiene 300 kcal, 20 g de proteína, 30 g de carbohidratos y 10 g de grasa, y el total del día sube 300 kcal.
- Dada la misma receta, cuando se registra con 1,5 raciones, entonces suma 900 kcal, 60 / 90 / 30 g.
- Cuando se abre el formulario de añadir, "Raciones" vale 1. Registrar sin tocarlo produce una entrada con los macros exactos de la receta.
- Los valores escalados no enteros se muestran redondeados, igual que los totales de hoy. El redondeo no acumula error en el total del día.

**R3 / R4**
- Tras registrar 0,5 raciones, la entrada guardada tiene el multiplicador 0,5, y la lista del Diario muestra "× 0,5" junto al nombre de la receta.
- Tras registrar 1 ración, la lista muestra solo el nombre de la receta, igual que hoy.
- Tras recargar la página, la etiqueta y los macros se conservan.

**R5**
- Dado un almacenamiento con entradas de receta creadas antes de este cambio (sin multiplicador), cuando se abre el Diario, entonces sus kcal y macros no cambian y no se muestra ninguna etiqueta "×".

**R6**
- "0,75" y "0.75" se aceptan y dan el mismo resultado.
- "0", "0,1", "4,25", "5", "abc" y el campo vacío no añaden la entrada y muestran un mensaje ("Entre 0,25 y 4, en pasos de 0,25").
- 0,25 y 4 (los extremos) se aceptan.

**R7**
- "Hecho" en un pendiente de una receta de 600 kcal crea una entrada de 600 kcal sin etiqueta "×".

**R8**
- Con el valor en 1, pulsar − lo deja en 0,75. Con 0,25, − está deshabilitado. Con 4, + está deshabilitado.

## Casos límite
- La receta se borra después de registrarla: la entrada conserva sus macros ya escalados, como hoy, porque la entrada no se recalcula a partir de la receta.
- Se cambia de receta en el desplegable tras fijar las raciones: se mantiene el valor de raciones elegido.
- Se cambia al modo "Personalizada": el campo "Raciones" no se muestra y no afecta a la entrada.
- Si la receta cambia de macros después de registrarla, la entrada no cambia (igual que hoy).

## Riesgos y dependencias
- Cambia la forma de `MealEntry`, que vive en localStorage. La compatibilidad hacia atrás (R5) depende de que "sin multiplicador = 1" sin reescribir los datos guardados. Ya existe `lib/migrate.ts` si hiciera falta.
- `recipeEntry` lo comparten el formulario y los pendientes. Cambiarlo afecta a ambos (R7 lo fija).

## Preguntas abiertas
Ninguna. Resueltas por Manuel el 2026-09-23:
- [x] Raciones en el Plan: fuera de alcance, en un issue aparte.
- [x] `Recipe.servings`: fuera de alcance por ahora.
- [x] "× 1": no se muestra (R4).
