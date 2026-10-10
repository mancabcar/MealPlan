# Favoritos en «Añadir comida»: personalizadas que se guardan y se corrigen

_Status: spec · Updated: 2026-10-10 · Issue: [#55](https://github.com/mancabcar/MealPlan/issues/55) (relacionado: [#58](https://github.com/mancabcar/MealPlan/issues/58)) · Prototype: [canvas](https://claude.ai/artifact/4YYejg1TynbXR8TESnokGX) · Spec: [spec.md](spec.md)_

## Follow-ups
- Autocompletar desde el historial: al escribir en Personalizada o en el buscador, ofrecer las personalizadas ya registradas (dirección E). Tapa el hueco si no se marca la ⭐. (brainstorm)
- Fusionar personalizadas duplicadas o casi iguales («Tostada aceite» / «tostada con aceite») (dirección C). (brainstorm)
- Recientes ordenados por frecuencia en la franja («lo que más registras en Cena»): la segunda mitad de #55. Hoy Recientes ya pone primero lo registrado en la franja, pero por recencia. (brainstorm) → [#158](https://github.com/mancabcar/MealPlan/issues/158)
- Reordenar Favoritos a mano (no-objetivo del spec). Solo si el orden por frecuencia (R8) no basta. (spec)
- Cerrar [#58](https://github.com/mancabcar/MealPlan/issues/58) cuando esto se entregue: queda absorbido aquí. (brainstorm)

## Problem
Tú, el único usuario de la app, registras comidas personalizadas a diario (pestaña Personalizada de «Añadir comida»: nombre, kcal, macros y fibra opcional). Necesitas tener a mano las habituales para registrarlas sin volver a escribirlas. Hoy esas comidas solo existen como entradas del Diario: Recientes las deduce del historial (`recentMeals` en `src/lib/diary.ts`), pero solo enseña 5. Cuando una se cae de ahí, la vuelves a teclear. Además, si te equivocaste en un macro o en el nombre, no hay ningún «molde» que corregir, así que el error se repite, y las variantes casi iguales se acumulan sin forma de limpiarlas.

Contexto del issue: #55 partía de que en la v1 de #12 las personalizadas se podían borrar y volver a guardar, pero eso no llegó a construirse. En el código no existe ninguna lista de personalizadas guardadas.

## Success looks like
- Una personalizada que ya metiste una vez se registra con uno o dos toques, aunque haga semanas que no la usas, sin volver a teclear nombre ni macros.

## Constraints & assumptions
- Corregir un favorito **no toca el Diario**: solo cambia los registros futuros. Las medias y la adherencia de días pasados se quedan como están (decidido por el usuario).
- Sin pantalla aparte: todo vive dentro de «Añadir comida».
- El usuario no ha puesto restricciones especiales. Nota técnica, sin decidir: si los favoritos se guardan como datos nuevos, tendrán que entrar en la sincronización (#22, `SYNC_KEYS` del servidor) y en la copia de seguridad, como el resto de datos.
- El problema se centra en las personalizadas, pero el alcance incluye todo #58 (recetas y alimentos favoritos en «Añadir comida»). Las personalizadas son el motivo; #58 es la superficie donde se resuelve.

## Directions considered
### A. Recientes con más memoria: «Ver más» y «Olvidar»
Recientes recorre todo el historial con un «Ver más», y cada fila tiene un «Olvidar» para quitar variantes. No se guarda nada nuevo. **Risk:** no resuelve corregir un error, porque se repite la última entrada tal cual.

### B. Favoritos con estrella en «Añadir comida» (#58 + edición)
Una ⭐ en Recientes y en Personalizada guarda la comida como favorita: una personalizada como plantilla con sus macros, una receta reutilizando el favorito de #20 y un alimento con su cantidad. Aparece una sección «Favoritos» encima de Recientes, desde la que se edita o se borra sin tocar el Diario. **Risk:** hay que acordarse de marcar la estrella; si no, se vuelve al problema de hoy.

### C. Pantalla «Mis alimentos»
Una sección propia con todas las personalizadas guardadas y los favoritos, con buscador, edición, borrado y fusión de duplicados. En «Añadir comida» salen como favoritos y en el buscador. **Risk:** mucho trabajo para un solo usuario; una pantalla de gestión aparte se visita poco.

### D. «Guardar como receta»
En Personalizada, un check convierte la comida en receta propia (#18) con sus macros. Así se puede editar en Recetas, marcar como favorita (#20) y elegir en el selector. **Risk:** el recetario se llena de comidas sueltas, y las recetas piden ingredientes y pasos que aquí sobran.

### E. Autocompletar desde el historial
Al escribir en Personalizada o en el buscador, salen las personalizadas pasadas como «Tuyas» y rellenan los macros. Para «corregir» se registra la versión buena y se oculta la mala. **Risk:** «la última versión manda» no se siente como editar, y las variantes siguen ahí, solo escondidas.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Recientes con más memoria | Med | Low | Med | Que con encontrar la comida basta, aunque no se pueda corregir |
| B. Favoritos con estrella + edición | High | Med | High | Que te acordarás de marcar la estrella en lo que repites |
| C. Pantalla «Mis alimentos» | High | High | Med | Que visitarás una pantalla de gestión aparte lo bastante como para que compense |
| D. Guardar como receta | Med | Low | Low | Que no molestará ver comidas sueltas mezcladas con recetas de verdad |
| E. Autocompletar del historial | Med | Med | Med | Que «registrar la buena y ocultar la mala» se siente como corregir |

Puntuaciones confirmadas por el usuario.

## Recommended bet
**B, Favoritos con estrella en «Añadir comida»**, elegida por el usuario (y también la recomendación de Claude). Cubre las tres molestias (re-teclear, corregir y lista desordenada), absorbe #58, reutiliza el favorito de recetas de #20 y no añade pantalla nueva.

Primera versión:
- Personalizadas: ⭐ para guardar (desde Personalizada y desde Recientes), y editar nombre y macros o borrar.
- Recetas favoritas: las de #20 aparecen en «Favoritos» y se pueden marcar o desmarcar desde aquí.
- Alimentos favoritos: un alimento de la base (#13) con su cantidad habitual (p. ej. «Avena 40 g»).
- Orden por franja dentro de Favoritos: primero lo que sueles registrar en la franja elegida.

**What would change our mind:** si en la práctica no se marca la ⭐, Favoritos se queda vacío y el problema sigue. En ese caso, añadir E (autocompletar desde el historial) como complemento.

## What to prototype
«Añadir comida» con la sección «Favoritos» (franja → Favoritos → Recientes → pestañas), la ⭐ en las filas de Recientes y en el formulario de Personalizada, y los estados con Favoritos vacío, con pocos y con muchos.

**La pregunta que debe responder:** ¿se ve y se usa la ⭐, y cómo cabe «Favoritos» en una pantalla que ya tiene franja, Recientes y pestañas sin estorbar?

## Open questions
- ~~Orden por franja~~ Resuelto en el spec: frecuencia en la franja (R8).
- ~~Flujo de editar o borrar~~ Resuelto en el spec: «Editar» junto al título, lápiz por fila (R4, R5).
- ~~¿La ⭐ en un alimento guarda la cantidad o la pide?~~ Resuelto en el prototipo: guarda la cantidad de la fila, sin diálogo.
- ~~¿⭐ de receta = favorito de #20?~~ Resuelto en el spec: el mismo (R2).
- ~~¿Tope de Favoritos visibles?~~ Resuelto en el prototipo: 5 y «Ver todos (N)».

## Prototype
_Design: https://claude.ai/artifact/4YYejg1TynbXR8TESnokGX · 2026-10-09_
- Screens: 1 · Favoritos vacío; 2 · ☆ en una fila de Recientes; 3 · ☆ en Personalizada; 4 · Confirmación; 5 · Favoritos con pocos (3); 6 · Favoritos con muchos (12), con el pliegue del móvil marcado.
- Decisions (confirmed by the user):
  - Móvil, con el aspecto de la app (tema oscuro, acento lima) y datos inventados realistas.
  - Favoritos vacío: una pista de una línea en el sitio de la sección.
  - Recientes: botón ☆ aparte a la derecha de cada fila; la fila sigue añadiendo con un toque.
  - Personalizada: casilla «Guardar en favoritos» justo encima de Añadir.
  - Favoritos usa las mismas filas que Recientes, encima de Recientes; con muchos, tope y «Ver todos (N)».
  - Lo que ya es favorito no se repite en Recientes.
  - Texto de la pista: «Toca ☆ en lo que repites para tenerlo aquí».
  - Un toque en ☆ guarda al momento, sin diálogo; para un alimento guarda la cantidad de esa fila y para una receta, sus raciones.
  - La casilla de Personalizada empieza desmarcada y se desmarca tras cada registro.
  - Confirmación: la fila sube a Favoritos y sale un aviso «Guardado en Favoritos · Deshacer» unos segundos.
  - En Favoritos, la ★ rellena quita el favorito con un toque, sin confirmar, con Deshacer.
  - Tope de 5 favoritos visibles; «Ver todos» despliega la lista en el sitio.
- Pending ASSUMPTIONs: ninguna (las seis del canvas se confirmaron el 2026-10-09).
- What to learn from testing it: si la ☆ se ve y se usa sin explicación, y si con 5 favoritos + 5 recientes las pestañas quedan demasiado abajo (pantalla 6).
