# Recetas: favoritos, valoración y filtros
_Status: merged (2026-10-02) · Updated: 2026-10-04 · Issue: [#20](https://github.com/mancabcar/MealPlan/issues/20) (@mancabcar) · Prototype: [canvas](https://claude.ai/artifact/D4XE1CEYJQKxZ4zHm2EzEJ) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#89](https://github.com/mancabcar/MealPlan/pull/89) (mergeado 2026-10-02) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Follow-ups
- Review #89 (no bloqueantes): orden de borrado de favoritas en `removeRecipe`; poda de `toggleFavorite` con el último valor escrito; búsqueda de Recetas sin tildes (reutilizar el matcher de `recipeSlots.ts`); test e2e que cuente los toques; e2e del fallback «Otras recetas».
- [#84](https://github.com/mancabcar/MealPlan/issues/84) tiene un brief propio sin fusionar en la rama `docs/84-brief-combobox-recetas` (`docs/pm/combobox-recetas/brief.md`): el mismo combobox compartido entre Plan y Diario. #20 lo absorbe (decidido el 2026-10-01); al entregar, enlazarlo y cerrar #84.
- Valoración 1–5 por receta y orden por valoración. (v1 lo deja fuera) → [#111](https://github.com/mancabcar/MealPlan/issues/111)
- Filtros del recetario: tiempo máximo, kcal máx., proteína mín., ocultar alérgenos, solo favoritos; orden por proteína/kcal/tiempo, combinables con la búsqueda. (v1 lo deja fuera) → [#111](https://github.com/mancabcar/MealPlan/issues/111)
- Segunda entrega (dirección C): selector único con buscador y autocompletado sobre recetas y guardados en Plan y «Añadir comida». Absorbe [#84](https://github.com/mancabcar/MealPlan/issues/84) y [#58](https://github.com/mancabcar/MealPlan/issues/58). → [#113](https://github.com/mancabcar/MealPlan/issues/113)
- Estrella también para las comidas personalizadas guardadas de [#12](https://github.com/mancabcar/MealPlan/issues/12) (comentario del issue). → [#58](https://github.com/mancabcar/MealPlan/issues/58)
- Cerrar #58 y #84 como duplicados cuando se entregue lo que absorbe cada uno.
- Dirección E (sugerencia automática por franja): solapa con [#15](https://github.com/mancabcar/MealPlan/issues/15).

## Problem
Manuel (único usuario hoy) necesita elegir una receta o comida en pocos toques, porque con un recetario que crece solo tiene búsqueda por texto en la página Recetas y un `<select>` largo en el Plan ([`src/app/plan/page.tsx`](../../../src/app/plan/page.tsx)). Hoy escribe o recorre la lista entera cada vez que planifica. Ya le cuesta encontrar cosas con las ~40 recetas actuales.

## Success looks like
- Encuentro la receta en ≤2 toques al elegir comida en el Plan.

## Constraints & assumptions
- Sin backend: todo en `localStorage`. Los datos nuevos (favoritos) entran en la copia de seguridad (backup-datos).
- #20 absorbe #58 y #84 (decidido por el usuario).
- Favoritos como dato del usuario, separado del catálogo, para no chocar con [#42](https://github.com/mancabcar/MealPlan/issues/42) ni con #22/#66. (Suposición mía, no decidida: confirmar en el spec.)
- Los tags de franja de las 40 recetas pueden estar incompletos: comprobar antes de fiarse de ellos.

## Directions considered
### A. Estrella mínima: favorito sí/no
Campo de favorito por receta, filtro «solo favoritos» y estrella en tarjeta y detalle. **Risk:** no resuelve el Plan.
### B. Recetario con filtros completos: lo que pide el issue en la página Recetas
Favoritos, valoración, filtros combinables, orden y búsqueda. **Risk:** mucha interfaz en móvil y poco uso si el dolor está en el Plan.
### C. Selector único con buscador
Buscador con autocompletado sobre recetas y guardados, filtrado por franja, favoritos arriba. **Risk:** componente nuevo en dos pantallas; las personalizadas no existen como entidad.
### D. Franja inteligente
Al elegir franja en el Plan salen solo las recetas de esa franja, con «ver todas». **Risk:** depende de que los tags de franja estén bien.
### E. Sugerencia automática
3 propuestas por franja sin filtros manuales. **Risk:** ambicioso, solapa con #15 y sin vía de escape si falla.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Estrella mínima | Bajo | Bajo | Alta | Un favorito sí/no basta para encontrar rápido |
| B. Recetario con filtros | Medio | Medio | Media | Usarás los filtros desde la página Recetas |
| C. Selector único | Alto | Medio-alto | Media | Un buscador sustituye bien al desplegable |
| D. Franja inteligente | Medio-alto | Bajo | Alta | Los tags de franja están bien en las 40 recetas |
| E. Sugerencia automática | Alto | Alto | Baja | Las sugerencias aciertan sin filtros manuales |

## Recommended bet
D+A como primera entrega, con C como segunda. Elegida por el usuario, coincide con la recomendación de Claude: cubre el criterio de ≤2 toques con poco esfuerzo y deja la estrella lista para C.

**Primera versión:** franja inteligente en el Plan (con «ver todas») + favoritos (estrella, filtro y orden). Valoración y filtros del recetario van a Follow-ups.

**Cambiaría de opinión si** los tags de franja están mal puestos: habría que etiquetarlos primero.

## What to prototype
- Pantallas: selector del Plan filtrado por franja con favoritos arriba y «ver todas»; recetario con estrella y filtro de favoritos.
- Pregunta a responder: con franja inteligente y favoritos arriba, ¿elegir comida en el Plan lleva ≤2 toques sin buscar?

## Open questions
- ~~¿Tags de franja completos?~~ Resuelto: el catálogo tiene 107 recetas y todas llevan al menos un tag de franja (desayuno 22, comida 39, cena 38, snack 16).
- ¿Dónde se guardan los favoritos exactamente (clave propia de localStorage) y cómo entran en la copia de seguridad?

## Prototype
_Design: https://claude.ai/artifact/D4XE1CEYJQKxZ4zHm2EzEJ · 2026-10-01_
- Screens: 1 · Plan: elegir Cena (favoritas arriba + «Ver todas»); 2 · Plan: Ver todas; 3 · Plan: Merienda sin favoritas.
- Decisions (confirmed by the user): el `<select>` pasa a lista táctil con sección ★ Favoritas arriba; el selector se abre filtrado por franja; Media mañana, Merienda y Pre-entreno usan las recetas con tag `snack`; look de la app actual con recetas reales; la pantalla del recetario con estrellas queda fuera del prototipo.
- Pending ASSUMPTIONs: ninguno (las cinco suposiciones del prototipo quedaron confirmadas el 2026-10-01: estrella sin cerrar el selector, orden A–Z por sección, «Ver todas» con la franja primero y etiqueta en las otras, buscador combinado con la franja, pista en ★ vacía y completar con otras si hay menos de 5).
- What to learn from testing it: si con franja inteligente y favoritos arriba, elegir comida en el Plan lleva ≤2 toques sin buscar.
