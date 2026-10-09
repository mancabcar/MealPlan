# Recetas: valoración 1–5, filtros y orden en el recetario
_Status: in review · Updated: 2026-10-09 · Issue: [#111](https://github.com/mancabcar/MealPlan/issues/111) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#157](https://github.com/mancabcar/MealPlan/pull/157)_

## Follow-ups
- [#113](https://github.com/mancabcar/MealPlan/issues/113): selector único con autocompletado (queda fuera de esta idea).
- #42 ya está fusionado: `ratings` se rebasó sobre él sin conflictos. Desplegar el servidor antes que el cliente (SYNC_KEYS pasa a diez claves; ver #122).

## Problem
El recetario crece (107 recetas del catálogo más las propias, de IA e importadas) y la página Recetas solo permite buscar por texto y filtrar «Solo favoritas». No puedo valorar una receta, acotar por tiempo, kcal, proteína o alérgenos, ni ordenar. La v1 de [#20](../20-recetas-filtros/brief.md) se acotó a favoritos y franja.

## Scope (resumen del issue, confirmado por el usuario el 2026-10-05)
- Valoración 1–5 por receta y por usuario, que viaja en la copia de seguridad (como `favorites`).
- Filtros combinables entre sí y con la búsqueda: tiempo máximo, kcal máx., proteína mín. y ocultar recetas con mis alérgenos (hoy solo se avisa).
- Orden por proteína, kcal, tiempo o valoración.
- Fuera: selector único con autocompletado (#113).

## Constraints & assumptions
- Sin backend propio de recetas: `localStorage` por usuario; entra en backup y sincronización como `favorites`.
- Base: spec y tech de [#20](../20-recetas-filtros/spec.md) ([tech](../20-recetas-filtros/tech.md)).
- Entrada al pipeline en el paso 3 (spec): el comportamiento ya está acordado en el issue; se omiten brainstorm y prototipo (decidido por el usuario).
