# Crear y editar recetas propias: Spec
_Status: Draft · Owner: Manuel Cabrera · Updated: 2026-09-29_
_Related: [brief](brief.md)_

## TL;DR
Solo hay 40 recetas semilla y las de IA; no se pueden añadir recetas propias ni corregir macros o ingredientes. Construimos un formulario para crear recetas, editar y borrar las propias (y las de IA) y "Duplicar y editar" en las semilla. Se sabrá que funciona cuando se cumplan los criterios de aceptación de abajo; no hay métricas formales (app de uso propio).

## Problema
La única forma de tener una receta con tus propios ingredientes o macros es esperar a que la IA la genere, y las semilla no se pueden corregir. Quien sigue un plan nutricional con macros concretos no puede reflejarlo.

## Goals
- Crear recetas propias con nombre, ingredientes, pasos, tiempo, macros por ración y tags.
- Editar y borrar recetas propias y de IA; duplicar semillas para editarlas.
- Que las recetas propias funcionen igual que cualquier otra en Recetas, Diario, Plan, lista de la compra y aviso de alérgenos.

## Non-goals
- Fotos de receta.
- Importar una receta desde texto o URL.
- Calcular macros desde los ingredientes o la base de alimentos.
- Ocultar o borrar semillas (siguen siendo de solo lectura).
- Compartir o exportar recetas sueltas.
- Un campo de "raciones" que escale ingredientes o macros: los macros son por ración, como en las semilla.
- Cambiar dónde se guardan las recetas (localStorage actual; ver [#42](https://github.com/mancabcar/MealPlan/issues/42)).

## Users & key scenarios
Usuario único de la app que sigue un plan de macros.
- Añade la receta de su madre con sus macros y la planifica para el jueves.
- Duplica una semilla para ajustar los gramos de un ingrediente y corregir sus macros.
- Corrige los macros de una receta de IA que le salieron mal.
- Borra una receta que ya no cocina, aunque está en el Plan de esta semana.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El usuario puede crear una receta propia con nombre, ingredientes, pasos, tiempo de preparación, macros por ración (kcal, proteínas, carbos, grasas) y tags. | Must |
| R2 | El usuario puede editar cualquier receta propia o de IA. | Must |
| R3 | El usuario puede borrar una receta propia o de IA; si está en el Plan, se avisa antes indicando las franjas afectadas, y al confirmar esas franjas se vacían. | Must |
| R4 | En las recetas semilla (solo lectura) hay "Duplicar y editar": crea una copia propia editable. | Must |
| R5 | Una receta propia aparece en Recetas (con búsqueda), en el selector del Diario y en el del Plan, y cuenta en la lista de la compra y los macros del Plan. | Must |
| R6 | Editar una receta no cambia las entradas ya registradas en el Diario (guardan sus propios macros). | Must |
| R7 | El aviso de alérgenos funciona en las recetas propias y editadas según sus ingredientes. | Must |
| R8 | Al borrar una receta con entradas en el Diario, esas entradas se conservan con el nombre y los macros de la receta. | Must |
| R9 | Los tags se escriben libremente o se eligen entre sugeridos (los ya usados). Las recetas propias muestran un distintivo "Propia". | Should |
| R10 | Al rellenar los macros P/C/G se sugiere kcal = 4·P + 4·C + 9·G, que el usuario puede aceptar o cambiar. | Should |

## User flows
1. **Crear.** Recetas → "Nueva receta" → rellenar formulario → Guardar → la receta aparece en la lista y en su detalle.
2. **Duplicar y editar semilla.** Detalle de semilla → "Duplicar y editar" → formulario precargado (nombre con "(copia)") → Guardar → nueva receta propia; la semilla no cambia.
3. **Editar.** Detalle de receta propia o IA → "Editar" → cambiar campos → Guardar.
4. **Borrar.** Detalle → "Borrar" → si está en el Plan, aviso con las franjas afectadas → confirmar → receta borrada y franjas vacías.

## Acceptance criteria
**R1**
- Given el formulario, when se guarda con nombre, ≥1 ingrediente y kcal, then se crea la receta; pasos, tiempo, P/C/G y tags son opcionales (P/C/G y tiempo valen 0 si están vacíos).
- Given que falta nombre, ingredientes o kcal, when se intenta guardar, then no se guarda y se indica qué falta.
- Ingredientes y pasos se escriben uno por línea.
**R2**
- Given una receta propia o de IA, when se edita y guarda, then el detalle, la lista y el Plan muestran los nuevos valores.
- Las semilla no tienen "Editar" ni "Borrar".
**R3**
- Given una receta que no está en el Plan, when se borra, then se pide confirmación simple y desaparece.
- Given una receta en el Plan (esta semana), when se pulsa Borrar, then aparece un aviso con las franjas afectadas antes de borrar; cancelar no cambia nada; confirmar borra la receta y vacía esas franjas (incluidas las sobras enlazadas de #17).
**R4**
- Given una semilla, when se pulsa "Duplicar y editar", then se abre el formulario con todos sus datos y al guardar existe una receta propia nueva y la semilla sigue intacta.
**R5**
- Given una receta propia guardada, then aparece en Recetas, en el selector del Diario y en el del Plan; al planificarla, sus macros suman en el Plan y sus ingredientes en la lista de la compra.
**R6**
- Given una entrada del Diario registrada con macros X, when se editan los macros de su receta, then la entrada sigue mostrando X.
**R7**
- Given un perfil con alergia a lactosa, when una receta propia tiene "queso" en los ingredientes, then muestra el aviso de alérgenos, y al editar los ingredientes el aviso se recalcula.
**R8**
- Given entradas del Diario de una receta, when se borra la receta, then las entradas siguen en el Diario con nombre y macros de esa receta y no se muestran como "Receta".

## Edge cases
- Nombres duplicados: se permiten.
- Macros negativos o no numéricos: se rechazan; se aceptan decimales.
- Borrar una receta que está en el Plan de otra semana, si el Plan la tiene: se trata igual que la de esta semana.
- La copia de una semilla se puede volver a duplicar.
- Recetas en un backup importado: siguen funcionando; las sin distintivo se consideran de IA o semilla según su origen.

## Risks & dependencies
- La siembra (`withSeedRecipes`) reinyecta semillas por id: las recetas propias necesitan ids que no choquen con las semilla.
- Vaciar franjas del Plan con sobras enlazadas depende del modelo de #17 (mergeado).
- Guardar en localStorage sigue el diseño actual; #42 puede migrarlo después.

## Open questions
- [ ] ¿Un distintivo "Propia" también en el selector de Diario/Plan o solo en Recetas? (usuario, en tech design)
