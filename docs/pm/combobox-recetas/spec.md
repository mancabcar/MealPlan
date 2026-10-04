# Selector de recetas: búsqueda resaltada y orden A–Z: Spec
_Status: Draft · Owner: mancabcar · Updated: 2026-10-04_
_Related: [brief](brief.md) · prototype: omitido por decisión del usuario_

## TL;DR
Con más de 60 recetas, encontrar una receta es lento. El PR #89 (#20 v1) ya entregó un selector compartido por Plan y Diario con búsqueda, A–Z y «Sin resultados». Este spec cubre solo lo que falta de #84: resaltar el texto que coincide (en el selector y en Recetas), ordenar la pantalla Recetas A–Z y hacer su búsqueda insensible a tildes y mayúsculas y mostrar «Sin resultados» en ella. Se sabrá que funciona porque los criterios de aceptación pasan en la app y en los tests.

## Problem
Quien usa la app asigna y registra recetas entre más de 60, muchas generadas con IA. #89 resolvió el selector de Plan y Diario, pero la pantalla Recetas sigue en orden de guardado y su buscador distingue tildes («pure» no encuentra «Puré»). Ninguna de las dos pantallas muestra qué parte del nombre ha coincidido.

## Goals
- Ver de un vistazo por qué una receta aparece al buscar (texto resaltado).
- Recetas sale en orden A–Z y se comporta como el selector al buscar.

## Non-goals
- Lista A–Z plana en el selector: se mantiene la agrupación por franja de #89 (★ Favoritas, la franja, otras), con A–Z dentro de cada grupo.
- Orden por relevancia o por recientes (queda en Follow-ups del brief).
- Botón «crear receta» desde «Sin resultados».
- Bottom sheet u otro rediseño del selector.
- Mostrar o resaltar la etiqueta cuando la coincidencia es solo por etiqueta.
- Cambios en alérgenos, kcal o «Quitar» del selector.

## Users & key scenarios
Usuario único de la app, en móvil y en ordenador.
- Escribo «pure» en el selector del Plan y veo «**Pur**é de calabaza» con el tramo resaltado.
- Abro Recetas y las veo de la A a la Z sin tocar nada.
- Escribo «pollo» en Recetas y aparecen las recetas con «pollo» en el nombre o en una etiqueta, con el nombre resaltado.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Al escribir en el buscador del selector (Plan y Diario) y en el de Recetas, el tramo del nombre que coincide aparece resaltado. | Must |
| R2 | La pantalla Recetas se ordena A–Z por nombre, salvo cuando «Usa lo que tengo» aplica su ranking por despensa. | Must |
| R3 | La búsqueda de Recetas ignora tildes y mayúsculas, igual que la del selector, y sigue buscando por nombre y etiqueta. | Must |
| R4 | El selector conserva su comportamiento actual: agrupación por franja, A–Z, kcal, aviso de alérgenos, favoritas, «Quitar», «Ver todas» y «Sin resultados». | Must |
| R5 | La pantalla Recetas muestra «Sin resultados para «…»» cuando una búsqueda de texto no encuentra nada (hoy solo sale con un filtro de ítem, «Usa lo que tengo» o «Solo favoritas»). | Must |

## User flows
1. Plan o Diario → abrir el selector → escribir «pure» → la lista se reduce y «Puré» sale resaltado en cada nombre → tocar una fila para elegirla.
2. Recetas → la lista aparece A–Z → escribir «pollo» → se filtra por nombre o etiqueta y el nombre sale resaltado.
3. Recetas → activar «Usa lo que tengo» → manda el ranking por despensa (sin A–Z forzado).

## Acceptance criteria
**R1**
- Given recetas con «Puré de calabaza», when escribo «pure» en el buscador del selector o de Recetas, then el tramo «Pur» (con su tilde original, «Puré» entero si coincide) aparece resaltado dentro del nombre.
- Given una búsqueda vacía o solo con espacios, when se muestra la lista, then ningún nombre lleva resaltado.
- Given una receta que coincide solo por etiqueta, when busco esa etiqueta, then la receta aparece y su nombre no lleva resaltado.
- El resaltado no cambia el texto del nombre ni su nombre accesible (el texto se lee igual).

**R2**
- Given Recetas con «Usa lo que tengo» desactivado, when se abre la pantalla, then las tarjetas están en orden alfabético español por nombre (`localeCompare("es")`).
- Given «Usa lo que tengo» activado, when se muestra la lista, then el orden es el ranking por despensa de hoy.
- Given un ítem enfocado sin «Usa lo que tengo», when se muestra la lista, then también va A–Z.

**R3**
- Given «Puré de calabaza», when busco «pure», «PURE» o «puré», then aparece.
- Given una receta con la etiqueta «Cena», when busco «cena», then aparece.

**R4**
- Los tests e2e y unitarios existentes de favoritos y selector por franja (`tests/e2e/favoritos-franja.spec.ts` y los de `recipeSlots`) siguen pasando sin cambios.

**R5**
- Given Recetas sin filtros activos, when escribo un texto sin coincidencias («zzzxqj»), then aparece «Sin resultados para «zzzxqj»» y ninguna tarjeta.
- Given que borro el texto, when la lista vuelve, then el mensaje desaparece.

## Edge cases
- Nombres con caracteres especiales de expresión regular (`(`, `+`, `.`): el resaltado no debe romperse ni lanzar error.
- Coincidencia repetida en el mismo nombre («pollo con pollo»): se resaltan todas, o al menos la primera, sin romper el texto.
- Normalizar puede cambiar la longitud del texto (p. ej. «ß», ligaduras): el tramo resaltado nunca debe salirse del nombre ni cortar mal.

## Success metrics
Sin métrica de producto (ajuste interno, sin analítica en la app). Comprobación manual de los criterios de aceptación y de que el resaltado se ve bien en móvil, hecha por el usuario al revisar.

## Risks & dependencies
- Depende de `normalize` en `src/lib/text.ts` y de `groupRecipes` (ya en main).
- El resaltado debe mapear posiciones del texto normalizado al original; hay que tratarlo con cuidado (ver edge cases).

## Open questions
- [x] ¿Qué pasa sin coincidencias? En el selector ya existe «Sin resultados para «…»». En Recetas no sale con búsqueda de texto: se añade (R5). Corregido el 2026-10-04: el spec decía antes que ya existía.
- [x] ¿Búsqueda insensible a tildes y mayúsculas? Sí; ya lo es en el selector y R3 lo extiende a Recetas.

## Test coverage
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/text-highlight.test.ts › "R1: highlightRanges" (9 casos) | unit | 🔴 failing (not built) |
| R1 | tests/e2e/recipes-busqueda.spec.ts › "R1: …" (Recetas con tilde; selector del Plan) | e2e | 🔴 failing (not built) |
| R1 | tests/e2e/recipes-busqueda.spec.ts › "R1: … solo coincide la etiqueta, sin resaltado" | e2e | 🟢 passing (protege el criterio) |
| R2 | tests/unit/recipeSearch.test.ts › "R2: sortByName" | unit | 🔴 failing (not built) |
| R2 | tests/e2e/recipes-busqueda.spec.ts › "R2: … A–Z" | e2e | 🔴 failing (not built) |
| R2 | tests/e2e/recipes-busqueda.spec.ts › "R2: … «Usa lo que tengo» manda el ranking" | e2e | 🟢 passing (protege el criterio) |
| R3 | tests/unit/recipeSearch.test.ts › "R3: searchRecipes" | unit | 🔴 failing (not built) |
| R3 | tests/e2e/recipes-busqueda.spec.ts › "R3: «pure» encuentra «Puré…»" | e2e | 🔴 failing (not built) |
| R3 | tests/e2e/recipes-busqueda.spec.ts › "R3: «VEGETARIANO» por etiqueta" | e2e | 🟢 passing (protege el criterio) |
| R4 | tests/e2e/favoritos-franja.spec.ts y despensa-recetas.spec.ts (existentes, sin tocar) | e2e | 🟢 passing (a re-ejecutar en dev-code) |
| R5 | tests/e2e/recipes-busqueda.spec.ts › "R5: … «Sin resultados» con texto" | e2e | 🔴 failing (not built) |
