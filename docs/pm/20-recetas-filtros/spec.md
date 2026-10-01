# Recetas: favoritos y selector por franja: Spec
_Status: Draft · Owner: Manuel Cabrera Carmona · Updated: 2026-10-01_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/D4XE1CEYJQKxZ4zHm2EzEJ) · Issue [#20](https://github.com/mancabcar/MealPlan/issues/20)_

## TL;DR
Elegir una receta en el Plan o en «Añadir comida» obliga a recorrer un `<select>` con las 107 recetas. Vamos a sustituirlo por una lista táctil filtrada por la franja elegida, con una sección ★ Favoritas arriba y la opción de ver todas. Sabremos que funciona si asignar una Cena favorita al Plan lleva 2 toques o menos.

## Problem
Manuel (único usuario hoy) tiene un recetario que crece (107 recetas en el catálogo, más las de IA, importadas y propias). Para elegir comida en el Plan ([`src/app/plan/page.tsx`](../../../src/app/plan/page.tsx)) o en «Añadir comida» del Diario ([`src/app/page.tsx`](../../../src/app/page.tsx)) usa un `<select>` largo; la página Recetas solo tiene búsqueda por texto. Ya le cuesta encontrar lo que quiere.

## Goals
- Elegir comida en el Plan y en el Diario en ≤2 toques cuando es una favorita de la franja.
- Marcar y desmarcar favoritas con una estrella.
- Que los favoritos persistan por usuario y viajen en la copia de seguridad.

## Non-goals
- Valoración 1–5 y orden por valoración (follow-up).
- Filtros por tiempo, kcal, proteína y alérgenos, y orden por macros (follow-up). Los alérgenos solo se avisan, no se ocultan.
- Favoritos de comidas personalizadas guardadas de [#12](https://github.com/mancabcar/MealPlan/issues/12): hoy no existen como entidad (segunda entrega).
- Buscador único con autocompletado sobre recetas y guardados (segunda entrega, dirección C).
- Límite de favoritas, analítica o backend.

## Users & key scenarios
Usuario: Manuel, en el móvil.
1. Planifica la Cena del lunes: abre la franja y toca una favorita.
2. Registra en el Diario una merienda: ve primero las recetas de snack.
3. Quiere algo fuera de la franja: pulsa «Ver todas».
4. Descubre una receta que le gusta en Recetas y la marca con la estrella.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Al elegir comida en el Plan o en «Añadir comida» del Diario, el selector es una lista táctil filtrada por la franja elegida, con un campo de búsqueda por texto. | Must |
| R2 | El selector tiene una sección ★ Favoritas arriba y cada fila lleva una estrella que marca o desmarca la favorita sin cerrar el selector. | Must |
| R3 | «Ver todas» muestra todas las recetas, con las de la franja primero y las de otras franjas debajo con la etiqueta de su franja. | Must |
| R4 | Los favoritos persisten por usuario y entran en la copia de seguridad (exportar e importar). | Must |
| R5 | La página Recetas muestra la estrella en tarjeta y detalle, y un filtro «Solo favoritas» combinable con la búsqueda por texto. | Should |

## User flows
1. **Favorita de la franja (≤2 toques).** Plan → toca la franja Cena del lunes (1) → el selector se abre filtrado, con ★ Favoritas arriba (artboard «1 · Plan: elegir Cena») → toca la receta (2) → queda asignada y el selector se cierra.
2. **Ver otras.** En el selector → «Ver todas las recetas» (artboard «2 · Plan: Ver todas») → toca una receta de otra franja.
3. **Primera vez, sin favoritas.** Abre Merienda → la sección ★ muestra una pista (artboard «3 · Plan: Merienda sin favoritas»).
4. **Marcar.** En cualquier fila del selector o en Recetas toca la estrella; la receta pasa a ★ Favoritas.

## Acceptance criteria
**R1**
- Given que abro el selector de la franja Cena, when se muestra, then solo aparecen recetas con tag `cena`.
- Given Media mañana, Merienda o Pre-entreno, when se muestra, then aparecen las recetas con tag `snack`.
- Given que escribo en el buscador, when coincide por nombre o etiqueta, then la lista se reduce combinando búsqueda y franja.
- Given una receta con alérgenos de mi perfil, when aparece en la lista, then su fila lleva el aviso de alérgenos como hoy.
- Given una receta ya asignada a la franja, when reabro el selector, then está resaltada en su sección y hay una opción «Quitar» arriba.
- Given el «Añadir comida» del Diario, when elijo franja, then funciona igual que en el Plan.

**R2**
- Given recetas favoritas de la franja, when abro el selector, then aparecen en ★ Favoritas y no se repiten en la lista de la franja.
- Given una favorita de otra franja, when abro el selector de Cena, then no está en ★ (sí en «Ver todas»).
- Given que toco la estrella de una fila, when se marca o desmarca, then el selector sigue abierto y la receta cambia de sección.
- Given favoritas y resto, when se muestran, then van en orden A–Z dentro de cada sección.
- Given que no hay favoritas en la franja, when abro el selector, then la sección ★ muestra una pista de cómo marcarlas.
- Given que marco muchas favoritas, when sigo marcando, then no hay límite.

**R3**
- Given que pulso «Ver todas las recetas», when se abre, then veo ★ Favoritas (de todas las franjas), las de la franja y «Otras franjas» con la etiqueta de cada una, y el buscador se mantiene.

**R4**
- Given que marco favoritas y recargo la app, when vuelvo, then siguen marcadas.
- Given dos usuarios en el mismo navegador, when cada uno marca favoritas, then no se mezclan.
- Given una copia de seguridad exportada, when la importo (incluida una copia anterior sin favoritos), then los favoritos se restauran o quedan vacíos sin error.
- Given un favorito de una receta que ya no existe, when se carga, then se ignora en silencio y se limpia al guardar.

**R5**
- Given la página Recetas, when toco la estrella de una tarjeta o del detalle, then se marca o desmarca y se refleja en el selector.
- Given el filtro «Solo favoritas» y un texto de búsqueda, when ambos están activos, then la lista cumple los dos.
- Given que no hay favoritas, when activo «Solo favoritas», then veo un estado vacío que explica cómo marcarlas.

## Edge cases
- Recetas de IA, importadas o propias: pueden marcarse como favoritas igual que las del catálogo.
- Franja con pocas recetas: se completan con las de otras franjas bajo «Otras recetas» si hay menos de 5 (con el catálogo actual ninguna franja llega a ese caso).
- Receta con varios tags de franja (p. ej. `comida` y `cena`): aparece en ambas franjas.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Toques para asignar una Cena favorita en el Plan | TBD (con el `<select>` actual no hay atajo) | ≤2 | Prueba manual y un test e2e |

## Risks & dependencies
- Depende de que los tags de franja sigan completos (hoy las 107 recetas tienen al menos uno).
- El dato nuevo debe sumarse a `USER_DATA_KEYS` y a la migración de la copia de seguridad ([`src/lib/userData.ts`](../../../src/lib/userData.ts), [`src/lib/backup.ts`](../../../src/lib/backup.ts)).
- Solapa con [#58](https://github.com/mancabcar/MealPlan/issues/58) y [#84](https://github.com/mancabcar/MealPlan/issues/84): #20 los absorbe en parte; se cierran cuando se entregue lo que cubre cada uno.
- Encaja con #22/#66 (sincronización y backend): los favoritos son datos del usuario, separados del catálogo.

## Open questions
- [ ] ¿Qué queda de #58 y #84 tras la v1 (autocompletado y personalizadas)? Decidir al cerrar la v1 (Manuel).
- [ ] Dónde se guardan exactamente los favoritos (lista de ids en clave propia vs campo en cada receta): lo decide el tech design (ingeniería).
