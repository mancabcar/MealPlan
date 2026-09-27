# Registro rápido: recientes y personalizadas guardadas: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-09-27_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/67Fp8tdVv3BE9gSe15hkC8) · Issue: [#12](https://github.com/mancabcar/MealPlan/issues/12)_

## TL;DR
Lo que como se repite mucho, pero «Añadir comida» me hace empezar de cero cada vez: buscar en un desplegable de ~94 recetas o re-teclear los macros de una personalizada. Añadimos a «Añadir comida» dos secciones, **Recientes** (las 3 últimas entradas distintas) y **Guardados** (personalizadas guardadas con una casilla al crearlas), donde un toque registra directamente. Sabremos que funciona si sube el porcentaje de días con el Diario completo.

## Problem
El usuario registra la mitad de sus comidas desde el Plan («Hecho» / «Registrar todo el día») y la otra mitad a mano, en «Añadir comida» del Diario (`src/app/page.tsx`). Ahí una receta se busca en un `<select>` con todo el recetario, y una personalizada obliga a teclear nombre, kcal, proteínas, carbohidratos y grasas cada vez. No se guarda nada para reutilizar. Lo que más tiempo le quita es re-teclear personalizadas: productos envasados, alimentos sueltos y platos caseros sin receta. Hoy la única alternativa es volver a escribirlo todo.

## Goals
- G1: lo habitual se registra en 1–2 toques desde «Añadir comida», sin abrir el desplegable largo.
- G2: una personalizada guardada no hay que volver a teclearla.

## Non-goals
- Favoritos con estrella y buscador único sobre recetas y guardados ([#20](https://github.com/mancabcar/MealPlan/issues/20)).
- Pantalla «Mis alimentos», editar un guardado y recientes ordenados por franja ([#55](https://github.com/mancabcar/MealPlan/issues/55)).
- Copiar una entrada o un día del Diario a otra fecha ([#54](https://github.com/mancabcar/MealPlan/issues/54)) y copiar la semana en el Plan ([#53](https://github.com/mancabcar/MealPlan/issues/53)).
- Escalar por cantidad o gramos ([#13](https://github.com/mancabcar/MealPlan/issues/13)). Un guardado se registra siempre con sus macros fijos.
- Sincronización entre dispositivos ([#22](https://github.com/mancabcar/MealPlan/issues/22)). Todo vive en localStorage por usuario.
- Guardar después de crear: desde una entrada del Diario, desde Recientes o desde el Plan. Solo se guarda al crear una personalizada.
- Guardar recetas: ya están en el recetario.
- Cambios en «Hecho» y «Registrar todo el día».
- Diseñar para comidas fuera de casa, que casi no se repiten.

## Users & key scenarios
Usuario único de la app, que registra a diario desde el móvil.
1. **Repetir lo de ayer:** abre «Añadir comida», elige la franja y toca su yogur de siempre en Recientes. Queda registrado y el panel sigue abierto para añadir otra cosa.
2. **Guardar un envasado nuevo:** crea la personalizada «Barrita proteica», marca «Guardar para reutilizar» y pulsa «Añadir». Queda registrada y guardada.
3. **Registrar un guardado poco frecuente:** algo que no come desde hace semanas no está en Recientes ni entre los 3 más usados; lo elige en «Otros guardados…».
4. **Corregir un guardado:** crea otra vez una personalizada con el mismo nombre y los macros correctos, con la casilla marcada. Sustituye al anterior.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | En «Añadir comida», una sección **Recientes** muestra las 3 últimas entradas distintas del Diario (recetas y personalizadas), con nombre, raciones y kcal. | Must |
| R2 | Un toque en cualquier parte de una fila de Recientes o de Guardados la registra en la franja elegida y en la fecha del Diario. «Añadir comida» sigue abierto. | Must |
| R3 | El formulario de Personalizada tiene una casilla «Guardar para reutilizar», desmarcada por defecto. Con la casilla marcada, «Añadir» registra la comida y además guarda su nombre y sus macros (no la franja). | Must |
| R4 | Una sección **Guardados** muestra los 3 guardados más usados, con nombre y kcal. El resto se elige en un desplegable «Otros guardados…», y elegir uno lo registra como un toque en una fila. | Must |
| R5 | La ✕ de una fila de Guardados borra ese guardado. | Must |
| R6 | Tras registrar desde Recientes o Guardados, un aviso «Añadido a <franja> · Deshacer» se ve ~4 s. Tras borrar un guardado, el aviso es «Guardado eliminado · Deshacer». | Should |
| R7 | Los guardados entran en la copia de seguridad JSON (exportar e importar). | Must |

## User flows
Pantalla de referencia del prototipo: `1A · Listas sobre las pestañas` y `2 · Personalizada con «Guardar»`. Orden de «Añadir comida», de arriba abajo: franja → Recientes → Guardados → pestañas Receta/Personalizada → formulario → Añadir/Cancelar.

**Registrar desde Recientes o Guardados** (escenarios 1 y 3)
1. En el Diario, con la fecha elegida, pulsa «Añadir comida».
2. Elige la franja.
3. Toca una fila de Recientes o de Guardados, o elige una opción en «Otros guardados…».
4. Se crea la entrada en esa franja y fecha. Sale el aviso (R6) y el panel sigue abierto con la misma franja.

**Crear y guardar una personalizada** (escenarios 2 y 4)
1. En «Añadir comida», pestaña Personalizada: rellena nombre y macros.
2. Marca «Guardar para reutilizar» (`2 · Personalizada con «Guardar»`).
3. Pulsa «Añadir»: se registra la entrada y se guarda. El formulario se cierra como hoy.

**Borrar un guardado**
1. En Guardados, pulsa la ✕ de una fila. El guardado desaparece al momento y sale el aviso (R6).

## Acceptance criteria
**R1 · Recientes**
- Dado un Diario con entradas, cuando se abre «Añadir comida», entonces Recientes muestra las 3 últimas entradas distintas por **orden de registro**, de cualquier fecha, y la más reciente arriba.
- Las entradas creadas con «Hecho» y «Registrar todo el día» cuentan igual que las del formulario.
- «Distinto» significa, en una receta, la misma receta con las mismas raciones y, en una personalizada, el mismo nombre con los mismos cuatro macros. La misma receta con 1 y con 0,5 raciones son dos recientes. Una personalizada con el mismo nombre y otros macros también.
- Cada fila muestra el nombre, las raciones (`× 0,5`, solo si son ≠ 1) y las kcal redondeadas.
- Una fila de receta cuyos alérgenos coinciden con el perfil muestra la misma insignia de alérgenos que la fila pendiente del Diario.
- Una entrada de receta cuya receta ya no existe no aparece en Recientes y deja su hueco a la siguiente entrada distinta.
- Un mismo alimento puede salir a la vez en Recientes y en Guardados.
- Si no hay ninguna entrada, la sección Recientes no se muestra.

**R2 · Un toque registra**
- Cuando se toca una fila de receta en Recientes, se crea una entrada de esa receta con las mismas raciones y los macros **actuales** de la receta × raciones, igual que «Hecho» y el formulario.
- Cuando se toca una fila personalizada en Recientes, se crea una entrada personalizada con el mismo nombre y los mismos cuatro macros.
- Cuando se toca un guardado (fila o desplegable), se crea una entrada personalizada con su nombre y sus macros guardados.
- La entrada va a la franja elegida en el selector y a la fecha elegida en el Diario, aunque no sea hoy.
- Tras el toque, «Añadir comida» sigue abierto con la misma franja, y la nueva entrada pasa a encabezar Recientes.
- Si el registro fue un error, la entrada se borra con la ✕ de siempre en el Diario.

**R3 · Guardar para reutilizar**
- La casilla sale solo en la pestaña Personalizada y está desmarcada cada vez que se abre el formulario.
- Con la casilla marcada y un nombre no vacío, «Añadir» registra la entrada y guarda nombre y macros. La franja no se guarda.
- Con la casilla desmarcada, «Añadir» funciona como hoy y no guarda nada.
- Se pueden guardar macros a 0 o vacíos (vacío = 0). Solo el nombre es obligatorio, como hoy.
- Si ya existe un guardado con ese nombre (sin distinguir mayúsculas ni espacios al inicio o al final), se sustituyen sus macros y su nombre por los nuevos, y no se crea un segundo guardado.
- Los guardados son por usuario y persisten al recargar la app.

**R4 · Guardados**
- La sección muestra los 3 guardados más usados. El uso de un guardado es el número de entradas personalizadas del Diario, de cualquier fecha, cuyo nombre coincide con el suyo sin distinguir mayúsculas ni espacios al inicio o al final.
- A igualdad de uso, se ordenan alfabéticamente por nombre.
- Con más de 3 guardados, debajo de las filas aparece un desplegable «Otros guardados…» con los demás, en orden alfabético. Elegir uno lo registra (R2), y el desplegable vuelve a su texto inicial.
- Con 3 guardados o menos, el desplegable no se muestra.
- Sin guardados, la sección Guardados no se muestra.

**R5 · Borrar un guardado**
- Cuando se pulsa la ✕ de una fila de Guardados, el guardado se borra al momento, sin diálogo de confirmación.
- Borrar un guardado no cambia ninguna entrada del Diario.
- El guardado siguiente en uso ocupa el hueco, si lo hay. Si no queda ninguno, la sección desaparece.
- Pulsar la ✕ no registra la comida.

**R6 · Aviso con Deshacer**
- Tras registrar desde Recientes o Guardados, sale «Añadido a <franja> · Deshacer» durante ~4 s. «Deshacer» borra esa entrada.
- Tras borrar un guardado, sale «Guardado eliminado · Deshacer» durante ~4 s. «Deshacer» lo recupera con el mismo nombre y los mismos macros.
- Pasado el tiempo, el aviso desaparece sin hacer nada.

**R7 · Backup**
- Exportar incluye los guardados del usuario.
- Importar una copia con guardados los sustituye por los de la copia, como el resto de datos.
- Importar una copia antigua, sin guardados, deja la lista de guardados vacía.
- Una sección de guardados con un formato inválido se rechaza con el mismo tipo de mensaje que las demás secciones.

## Edge cases
- **Toque doble rápido** en una fila: registra una sola vez (como `singleClick` en «Hecho»).
- **Receta editada** después de registrarla: al repetirla desde Recientes sale con los macros nuevos.
- **Receta borrada:** sus entradas antiguas no aparecen en Recientes, aunque siguen en el Diario.
- **Guardado con el mismo nombre que una receta:** son cosas distintas, y cada uno sale con su propio nombre.
- **Registrar desde un guardado** crea una personalizada con su nombre, así que suma uso a ese guardado y aparece en Recientes.
- **Borrar un guardado sin deshacer:** sus entradas siguen en el Diario y en Recientes. Para recuperarlo, se vuelve a crear con la casilla marcada.
- **Franja que no está en el perfil:** no puede ocurrir, porque el selector solo ofrece las franjas del perfil.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| % de días con el Diario completo (todas las comidas del perfil con al menos una entrada) | TBD: las 2 semanas anteriores al merge | ≥ +20 pp en las 2 semanas siguientes al merge | Calculado sobre las entradas del Diario (localStorage o backup JSON) |

## Risks & dependencies
- **El 3 + 3 no cabe sin empujar el formulario** por debajo del pliegue (844 px) con franjas y pestañas encima. Es la pregunta que el prototipo quería responder, y se valida en uso real.
- **Lo habitual poco frecuente** sale de Recientes. Lo mitigan Guardados y «Otros guardados…».
- **La lista de guardados crece** hasta que el desplegable se hace largo. Si ocurre, adelanta el buscador ([#20](https://github.com/mancabcar/MealPlan/issues/20)).
- **Recientes depende del orden de inserción** de las entradas, porque la app no guarda la hora de registro. Importar una copia puede alterar ese orden.
- **Formato de la copia:** añadir los guardados toca el formato del backup (`docs/pm/backup-datos`). Las copias antiguas tienen que seguir importándose.

## Open questions
- Ninguna bloquea la construcción. Las dos preguntas abiertas del brief (qué es «distinto» en Recientes y qué pasa con un nombre duplicado) quedan resueltas en R1 y R3.
