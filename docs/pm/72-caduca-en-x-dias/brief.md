# "Caduca en X días" en la tarjeta de receta

_Status: in review · Updated: 2026-11-04 · Issue: [#72](https://github.com/mancabcar/MealPlan/issues/72) · PR: [#187](https://github.com/mancabcar/MealPlan/pull/187)_

## Problema
R9 (Could) de la [spec de #16](../16-despensa-recetas/spec.md), que quedó fuera de la PR #71: con "Usa lo que tengo" activo, la tarjeta solo dice "caduca pronto" (0–2 días) y no cuánto queda.

## Apuesta
Cambio pequeño, entrada directa a dev-code (sin spec ni tech design propios; el requisito es el R9 de #16). Decisiones de Manuel (2026-11-04):
- El chip sale siempre que algún ingrediente coincidente tenga fecha, y solo con el filtro activo (como "Tienes N de M").
- Sustituye al chip "caduca pronto" de la tarjeta: naranja (`expiring`) con 0–2 días, neutro con más.
- Textos: "caduca hoy" (0), "caduca mañana" (1), "caduca en X días" (2+).
- Sin cambios de datos: usa `usage.soonest`, que ya calcula `recipeUsage`.

## Fuera de alcance
- El chip "caduca pronto" de la Despensa no cambia.

## Follow-ups
- Ninguno por ahora.
