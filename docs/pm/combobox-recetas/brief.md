# Selector de recetas con búsqueda y orden A–Z
_Status: in review · Updated: 2026-10-04 · Issue: [#84](https://github.com/mancabcar/MealPlan/issues/84) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#104](https://github.com/mancabcar/MealPlan/pull/104)_

## Follow-ups
- Ordenar por relevancia (últimas usadas, adecuadas al tipo de comida) cuando el campo está vacío (dirección E). Hoy choca con «Lista A–Z siempre»; revisar cuando haya uso real.

## Problem
Tú necesitas poder encontrar rápido una receta al asignarla a una comida (Plan) o al registrarla (Diario), porque con más de 60 recetas el desplegable nativo las muestra sin orden y no deja escribir para filtrar; hoy tienes que recorrer la lista entera a ojo.

Dónde ocurre: Plan semanal ([plan/page.tsx](../../../src/app/plan/page.tsx), `<select>` al asignar receta) y Diario ([page.tsx](../../../src/app/page.tsx), modo «Receta»). Ambos pintan `recipes.map` en orden de guardado. La pantalla Recetas ya tiene buscador, pero también muestra el orden de guardado.

## Success looks like
- Escribo parte del nombre y la lista se reduce a las recetas que lo contienen.
- Sin escribir nada, la lista sale siempre ordenada A–Z.
- La búsqueda también encuentra por etiqueta, como ya hace la pantalla Recetas.

## Constraints & assumptions
- Volumen: más de 60 recetas, sobre todo generadas con IA, y creciendo.
- Uso por igual en móvil y en ordenador.
- Se conserva del selector actual: kcal en cada opción, aviso de alérgenos, opción «Sin asignar» (solo en Plan) y comportamiento de desplegable.
- Reglas del repo: Next.js con cambios de API; leer `node_modules/next/dist/docs/` antes de escribir código.

## Directions considered
### A. Solo ordenar A–Z: el arreglo mínimo
Ordena `recipes` alfabéticamente en ambos selectores. **Risk:** con más de 60 recetas no resuelve escribir para filtrar.
### B. Combobox propio: campo de texto + lista filtrada
Componente compartido: escribes, filtra por nombre o etiqueta, lista A–Z, filas con kcal y aviso de alérgenos, «Sin asignar» en Plan. **Risk:** teclado en móvil y accesibilidad al dejar el `<select>` nativo.
### C. Filtro encima del `<select>` nativo
Campo de búsqueda que reduce las opciones del desplegable. **Risk:** dos controles para una tarea; torpe en móvil.
### D. Bottom sheet con buscador y tarjetas
Botón «Elegir receta» abre una hoja con buscador y lista A–Z, filas más ricas. **Risk:** más trabajo y más toques; se aleja de «desplegable».
### E. Orden por relevancia con el contexto
Sobre B, últimas usadas y adecuadas a la comida arriba. **Risk:** choca con «A–Z siempre»; depende de etiquetas fiables.
### F. Asignar desde la pantalla Recetas
Quitar el selector y añadir «Añadir al plan» en cada receta. **Risk:** cambia el flujo entero y no arregla el Diario.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Solo A–Z | Media | Baja | Alta | Que el orden basta sin poder escribir |
| B. Combobox propio | Alta | Media | Alta | Que funciona bien con el teclado en móvil |
| C. Filtro + `<select>` | Media | Baja | Media | Que dos controles no confunden |
| D. Bottom sheet | Alta | Alta | Media | Que compensa el paso extra |
| E. Orden por relevancia | Media | Alta | Baja | Que las etiquetas bastan para inferir la comida |
| F. Asignar desde Recetas | Baja | Alta | Baja | Que reorganizar el flujo es aceptable |

## Recommended bet
**B. Combobox propio**, elegido por el usuario (coincide con la recomendación de Claude): cubre los tres criterios de éxito y conserva kcal, alérgenos y «Sin asignar». Cambiaríamos a D si en móvil el combobox resulta incómodo.

Primera versión (v1):
- Plan y Diario a la vez, con el mismo componente.
- Solo A–Z + búsqueda por nombre o etiqueta.
- Resaltado del texto que coincide.
- Ordenar A–Z también la pantalla Recetas.

## What to prototype
Pregunta que debe responder: **¿se siente bien en móvil?** Teclado en pantalla, más de 60 recetas, elegir con un toque. Pantallas: Plan (asignar comida, con «Sin asignar») y Diario (modo Receta), con la lista filtrada y el estado vacío («Sin resultados»).

## Open questions
- ¿Qué pasa al escribir algo sin coincidencias? (mensaje y posible salida a «crear receta»)
- ¿Búsqueda insensible a tildes y mayúsculas («pure» encuentra «puré»)?

## Spec decisions (2026-10-04)
- Prototipo omitido por decisión del usuario.
- #89 (#20 v1) ya entregó el selector con búsqueda, A–Z, tildes y «Sin resultados». #84 queda reducido a: resaltado (selector y Recetas), Recetas A–Z, búsqueda de Recetas sin tildes. Se mantiene la agrupación por franja.
