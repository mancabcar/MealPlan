# Recetas: valoración, filtros y orden: Spec
_Status: Draft · Owner: Manuel Cabrera Carmona · Updated: 2026-10-05_
_Related: [brief](brief.md) · [spec de #20](../20-recetas-filtros/spec.md) · Issue [#111](https://github.com/mancabcar/MealPlan/issues/111)_

## TL;DR
La página Recetas solo permite buscar por texto y filtrar por favoritas, de temporada y despensa, y siempre ordena A–Z. Vamos a añadir valoración 1–5 por usuario, filtros de tiempo, kcal y proteína, ocultar recetas con mis alérgenos, y un selector de orden. Sabremos que funciona si encontrar una receta de ≥30 g de proteína y ≤30 min lleva ≤3 toques.

## Problem
Manuel (único usuario hoy) tiene un recetario de 107 recetas del catálogo más las propias, de IA e importadas. No puede anotar cuáles le gustaron, acotar por tiempo o macros, ni ocultar lo que no puede comer (hoy solo hay un aviso de alérgenos), ni ordenar la lista. La v1 de [#20](../20-recetas-filtros/brief.md) se acotó a favoritos y franja.

## Goals
- Valorar recetas de 1 a 5 y que la nota persista por usuario y viaje en la copia de seguridad y la sincronización.
- Acotar el recetario por tiempo, kcal y proteína, combinable con la búsqueda y con los filtros actuales.
- Poder ocultar las recetas con mis alérgenos.
- Ordenar por proteína, kcal, tiempo o valoración.

## Non-goals
- Filtro por nota mínima («3★ o más»): solo orden por valoración.
- Valorar o filtrar desde el selector del Plan y del Diario.
- Selector único con autocompletado ([#113](https://github.com/mancabcar/MealPlan/issues/113)).
- Recordar filtros y orden entre visitas: se reinician al salir de Recetas.
- Puntuar desde la tarjeta: la tarjeta solo muestra la nota.
- Cambiar cómo se editan tiempo o macros de las recetas propias.

## Users & key scenarios
Usuario: Manuel, en el móvil.
1. Prueba una receta, abre el detalle y le pone 4★.
2. Quiere cenar rápido y con proteína: abre Filtros y pulsa ≤30 min y ≥30 g.
3. Quiere repetir lo mejor: ordena por valoración.
4. Activa «Ocultar mis alérgenos» y deja de ver recetas que no puede comer.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | En el detalle de una receta se puede puntuar de 1 a 5; tocar la nota actual la quita y tocar otra la cambia. | Must |
| R2 | La valoración persiste por usuario, entra en la copia de seguridad (exportar e importar) y en la sincronización, y se ignora para recetas que ya no existen. | Must |
| R3 | Filtros de tiempo máximo, kcal máximas y proteína mínima, combinables entre sí, con la búsqueda y con «Solo favoritas», «De temporada», «Usa lo que tengo» y el filtro por ítem. | Must |
| R4 | Interruptor «Ocultar mis alérgenos» que oculta las recetas con algún alérgeno del perfil. | Must |
| R5 | Selector de orden: A–Z (por defecto), proteína, kcal, tiempo y valoración. | Must |
| R6 | La nota se muestra en la tarjeta y en el detalle. | Should |
| R7 | Panel plegable «Filtros» con contador de filtros activos y botón «Quitar filtros». | Should |

## User flows
1. **Valorar.** Recetas → abre una receta (1) → toca 4★ (2) → queda marcada; al volver a la lista, la tarjeta muestra 4★.
2. **Acotar.** Recetas → «Filtros» (1) → chip «≤30 min» (2) → chip «≥30 g» (3) → la lista se reduce y el botón muestra «Filtros (2)».
3. **Ordenar.** Recetas → selector de orden → «Valoración»; las valoradas de mayor a menor y luego las sin valorar.
4. **Sin resultados.** Filtros que no dejan ninguna receta → mensaje con los filtros activos y «Quitar filtros».

## Acceptance criteria
**R1**
- Given el detalle de una receta sin nota, when toco 3★, then queda con 3 y se ve marcada.
- Given una receta con 3★, when toco 3★ de nuevo, then queda sin valorar.
- Given una receta con 3★, when toco 5★, then pasa a 5.
- Given una receta de IA, importada o propia, when la puntúo, then funciona igual que con las del catálogo.
- Given los controles de nota, when los leo con un lector de pantalla, then cada uno indica la receta y la nota («Valorar X con 4 estrellas»).

**R2**
- Given que valoro y recargo la app, when vuelvo, then la nota sigue.
- Given dos usuarios en el mismo navegador, when cada uno valora, then las notas no se mezclan.
- Given una copia de seguridad exportada, when la importo (incluida una anterior sin valoraciones), then las notas se restauran o quedan vacías sin error.
- Given una nota fuera de 1–5 o de una receta que ya no existe, when se carga, then se ignora en silencio y se limpia al guardar.
- Given una cuenta sincronizada, when valoro en un dispositivo, then aparece en los demás tras sincronizar.

**R3**
- Given el chip «≤30 min», when está activo, then solo aparecen recetas con `prepTimeMinutes` ≤ 30.
- Given el chip «≤600 kcal», when está activo, then solo aparecen recetas con kcal ≤ 600.
- Given el chip «≥30 g», when está activo, then solo aparecen recetas con proteína ≥ 30 g.
- Given tramos de tiempo ≤15/30/45 min, kcal ≤400/600/800 y proteína ≥20/30/40 g, when elijo uno de un tipo, then solo hay uno activo por tipo y tocarlo de nuevo lo quita.
- Given filtros activos y un texto de búsqueda, when ambos están activos, then la lista cumple todos.
- Given una receta sin dato en el campo filtrado, when el filtro está activo, then se compara con el valor guardado (0 si falta).

**R4**
- Given que tengo alergias en el perfil y activo el interruptor, when se muestra la lista, then no aparecen recetas con esos alérgenos.
- Given el interruptor apagado (por defecto), when veo una receta con mi alérgeno, then se muestra con el aviso de alérgenos como hoy.
- Given que no tengo alergias en el perfil, when abro Filtros, then el interruptor no aparece.

**R5**
- Given el orden por proteína, when se muestra, then va de mayor a menor proteína; por kcal y por tiempo, de menor a mayor; con empate, por nombre A–Z.
- Given el orden por valoración, when se muestra, then van de mayor a menor nota, con empate por nombre, y las sin valorar al final.
- Given el orden por defecto, when se muestra, then es A–Z como hoy.
- Given «Usa lo que tengo» activo, when se muestra, then el ranking de la despensa manda sobre el orden elegido.

**R6**
- Given una receta con nota, when se muestra su tarjeta, then lleva la nota; sin nota, no lleva nada.

**R7**
- Given N filtros activos (tiempo, kcal, proteína, alérgenos), when veo el botón del panel, then muestra «Filtros (N)».
- Given filtros activos y cero resultados, when veo la lista, then aparece un mensaje con los filtros activos y «Quitar filtros»; al pulsarlo se limpian los filtros de tiempo, kcal, proteína y alérgenos, sin tocar la búsqueda de texto ni el orden.
- Given que salgo de Recetas y vuelvo, when se abre, then filtros y orden están restablecidos.
- Given cualquier filtro, búsqueda u orden distinto de A–Z, when veo Recetas, then el bloque «Destacadas» está oculto.

## Edge cases
- Todas las recetas sin nota con orden por valoración: se muestran A–Z.
- Ocultar alérgenos y «Solo favoritas» a la vez: la favorita con alérgeno no aparece.
- Receta valorada y luego borrada: la nota se limpia al guardar.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Toques para llegar a una receta de ≥30 g de proteína y ≤30 min | TBD (sin filtros no hay atajo) | ≤3 | Prueba manual y un test e2e |

## Risks & dependencies
- El dato nuevo debe sumarse a `USER_DATA_KEYS`, a la migración de la copia de seguridad y a la sincronización ([`src/lib/userData.ts`](../../../src/lib/userData.ts), [`src/lib/backup.ts`](../../../src/lib/backup.ts), [`src/lib/syncMigration.ts`](../../../src/lib/syncMigration.ts)).
- Solapa con [#42](https://github.com/mancabcar/MealPlan/issues/42), que toca esos mismos ficheros: conviene saber cuál se fusiona primero.
- Los tramos de los chips pueden no encajar con la distribución real del catálogo; se revisan en el tech design.
- El orden por valoración depende de que se valore: con pocas notas es casi A–Z.

## Open questions
- [ ] ¿Se fusiona #42 antes de empezar el código de #111? (Manuel)
