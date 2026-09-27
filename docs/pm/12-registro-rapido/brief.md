# Registro rápido: recientes y personalizadas guardadas
_Status: prototype · Updated: 2026-09-27 · Issue: [#12](https://github.com/mancabcar/MealPlan/issues/12) (@mancabcar) · Prototype: [canvas](https://claude.ai/artifact/67Fp8tdVv3BE9gSe15hkC8)_

## Follow-ups
- «Copiar semana anterior» en el Plan. Sale de este issue porque no toca el dolor principal y el Plan solo muestra la semana en curso, así que pide su propio diseño. (brainstorm) → [#53](https://github.com/mancabcar/MealPlan/issues/53)
- Copiar una entrada o un día completo del Diario a otra fecha (dirección D, del issue original). (brainstorm) → [#54](https://github.com/mancabcar/MealPlan/issues/54)
- Favoritos con estrella (recetas y guardados) y buscador único con autocompletado sobre recetas y guardados (dirección E). (brainstorm) → comentado en [#20](https://github.com/mancabcar/MealPlan/issues/20#issuecomment-5854883695)
- Pantalla «Mis alimentos» para editar guardados, y recientes ordenados por franja (dirección C). (brainstorm) → [#55](https://github.com/mancabcar/MealPlan/issues/55)

## Problem
Necesito que la app recuerde lo que como habitualmente, sea receta o personalizada, y me lo ofrezca primero al registrar, porque lo que como se repite mucho y hoy la app me hace empezar de cero cada vez.

Hoy, en «Añadir comida» (Diario, `src/app/page.tsx`), una receta se busca en un `<select>` con todo el recetario (~94 recetas), y una personalizada obliga a teclear nombre, kcal, proteínas, carbohidratos y grasas cada vez. No se guarda nada para reutilizarlo. El usuario registra la mitad de sus comidas desde el Plan («Hecho» / «Registrar todo el día») y la otra mitad a mano. Lo que más tiempo le hace perder es re-teclear personalizadas: productos envasados, alimentos sueltos, platos caseros sin receta y comidas fuera de casa.

## Success looks like
- Lo habitual se registra en 1–2 toques, sin abrir el desplegable largo.
- Una personalizada se teclea una sola vez: nunca más hay que reescribir sus macros.
- El Diario queda completo cada día, porque registrar cuesta menos.

## Constraints & assumptions
- Todo en localStorage por usuario, como el resto de la app (la sincronización es #22).
- Las personalizadas guardadas entran en el backup JSON (exportar e importar).
- Los alimentos sueltos se repiten tal cual, con macros fijos. Escalar por cantidad o gramos es #13.
- Las comidas fuera de casa casi no se repiten: guardar les ayuda poco y no se diseña para ellas.
- El issue #12 se parte: esta entrega cubre recientes y guardados; lo demás va a Follow-ups.

## Directions considered
### A. Recientes arriba: lo mínimo
En «Añadir comida», antes del formulario, una lista con las últimas ~8 entradas distintas (recetas y personalizadas). Un toque las registra en la franja elegida con los mismos macros y raciones. Sale del historial que ya existe, sin nada nuevo que gestionar. **Risk:** lo habitual pero poco frecuente se cae de la lista.

### B. «Mis alimentos»: guardados + favoritos
Al añadir una personalizada, «Guardar para reutilizar» la convierte en un alimento propio. «Añadir comida» muestra Favoritos, Recientes y un buscador sobre recetas y guardados. **Risk:** hay que mantener una lista (editar, borrar), lo que ya es una pantalla nueva.

### C. Sugerencias por franja: la contraria
Sin favoritos que mantener: al elegir la franja, la app ofrece lo que más registras en ella, por frecuencia en las últimas semanas. **Risk:** con pocos datos o hábitos cambiantes sugiere cosas raras, y no se puede forzar nada.

### D. Copiar en lugar de buscar: simplificar
«Repetir» o «Copiar a…» en cada entrada y cada día del Diario. El historial es la biblioteca. **Risk:** obliga a buscar el día de origen; resuelve bien los días calcados y mal lo suelto.

### E. Buscador único con autocompletado
Un solo campo sustituye al desplegable de recetas y al nombre de la personalizada. Al escribir salen recetas y personalizadas pasadas, y elegir una rellena los macros. **Risk:** sigue haciendo falta teclear, y en móvil escribir cuesta más que tocar.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Recientes arriba | Med | Low | High | Lo habitual se registra lo bastante a menudo como para seguir en los últimos ~8 |
| B. Mis alimentos + favoritos | High | Med | Med | Merece la pena mantener una lista (marcar, editar, borrar) |
| C. Sugerencias por franja | Med | Med | Low | Los hábitos por franja son estables y hay datos suficientes |
| D. Copiar entrada o día | Med | Low | Med | Buscar el día de origen es más rápido que buscar la comida |
| E. Buscador único | Med | Med | Med | En móvil, teclear 3 letras compensa frente a tocar una lista |

## Recommended bet
**A + la parte de «guardar» de B**, elegida por el usuario (coincide con la recomendación de Claude).

- **Recientes:** una sección en «Añadir comida» con las últimas ~8 entradas distintas, recetas y personalizadas.
- **Guardados:** una sección aparte con las personalizadas guardadas, por nombre. Se guarda con una casilla «Guardar para reutilizar» en el formulario de Personalizada, solo al crearla.
- **Un toque registra directo** en la franja elegida, con los mismos macros y raciones. Si te equivocas, la entrada se borra con la ✕ de siempre.
- **Gestión mínima:** los guardados se borran desde su propia lista. Para cambiar los macros, se borra y se vuelve a guardar.

Por qué: Recientes resuelve la mayoría de los casos sin gestionar nada, y guardar ataca de frente el dolor principal (re-teclear macros), incluso para lo que no se ha comido esta semana. Favoritos, buscador y copiar día quedan para después.

Qué nos haría cambiar de opinión: registrar sobre todo días calcados (favorece D), o una lista de guardados que crece hasta necesitar búsqueda (adelanta E).

## What to prototype
La pantalla «Añadir comida» en móvil, con las secciones Recientes y Guardados, más el formulario de Personalizada con la casilla «Guardar para reutilizar».

Pregunta que debe responder: **¿caben Recientes y Guardados en «Añadir comida» sin estorbar?** Encima ya están el selector de franja, las pestañas Receta/Personalizada y el formulario. Lo habitual tiene que quedar a 1–2 toques sin enterrar el formulario.

## Open questions
- Con solo 3 guardados visibles y sin «Ver más», ¿cómo se llega al 4.º guardado y siguientes? (¿qué 3 se muestran: los más recientes, los más usados, por orden alfabético?) Decidido en el prototipo: 3 recientes y 3 guardados.
- ¿Qué cuenta como «distinto» en Recientes? Por ejemplo, la misma receta con otras raciones, o una personalizada con el mismo nombre y otros macros.
- ¿Qué pasa al guardar una personalizada con un nombre que ya existe en Guardados?

## Prototype
_Design: https://claude.ai/artifact/67Fp8tdVv3BE9gSe15hkC8 · 2026-09-27_
- Screens: `1A · Listas sobre las pestañas` (**elegido**), `1B · Pestaña «Rápido»` y `1C · Chips en carrusel` (descartados), y `2 · Personalizada con «Guardar»` sobre el encaje A. Móvil, tema oscuro de la app, franja Pre-entreno, con una línea que marca el pliegue de 844 px.
- Decisions (confirmed by the user):
  - **Encaje A**: dentro de «Añadir comida», franja → Recientes → Guardados → pestañas Receta/Personalizada → formulario.
  - Un toque en cualquier parte de la fila registra directo en la franja elegida, con los mismos macros y raciones; aviso «Añadido a <franja> · Deshacer» (~4 s) y el panel sigue abierto.
  - Filas con nombre + raciones + kcal. **3 recientes y 3 guardados, sin «Ver más»**.
  - Un mismo alimento puede salir en Recientes y en Guardados a la vez.
  - Los guardados se borran con la ✕ de su fila.
  - «Guardar para reutilizar»: solo al crear una personalizada, desmarcada por defecto; «Añadir» registra y, con la casilla marcada, además guarda. Se guardan nombre y macros, no la franja.
  - Aspecto de la app actual y datos reales (recetario + plan de septiembre).
- Pending ASSUMPTIONs: ninguna.
- What to learn from testing it: si con 3 + 3 lo habitual queda a 1–2 toques sin empujar el formulario por debajo del pliegue.
