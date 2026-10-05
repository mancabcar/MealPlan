# Recetas: valoración 1–5, filtros y orden en el recetario
_Status: tests · Updated: 2026-10-05 · Issue: [#111](https://github.com/mancabcar/MealPlan/issues/111) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Follow-ups
- [#113](https://github.com/mancabcar/MealPlan/issues/113): selector único con autocompletado (queda fuera de esta idea).
- Conflicto previsible con [#42](https://github.com/mancabcar/MealPlan/issues/42) (rama `feature/42-catalogo-recetas`), que toca `userData.ts`, `store.tsx` y `syncMigration.ts`: el dato nuevo `ratings` debe rebasarse sobre lo que se fusione primero.

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
