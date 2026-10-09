# Importar una receta desde una URL
_Status: shipped (2026-10-01) · Updated: 2026-10-05 · Issue: [#19](https://github.com/mancabcar/MealPlan/issues/19) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#88](https://github.com/mancabcar/MealPlan/pull/88) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

_Entrada en el pipeline: resumen del issue confirmado por el usuario; se saltan brainstorm completo y prototype (el formulario de receta ya existe por #18) y se entra en spec._

## Follow-ups
- Endurecer el importador: `toNumber`, Content-Type, NAT64/6to4, timeout de la IA, `rateLimit`, delimitador del prompt (hallazgos 4–9 de la review). (review) → [#140](https://github.com/mancabcar/MealPlan/issues/140)
- `tagHint` se devuelve pero la UI no lo usa; aceptado por el usuario. (review)

## Problem
Paprika y Samsung Food importan recetas de cualquier web. Hoy en MealPlan hay que copiarlas a mano.

## Success looks like
- Una web con JSON-LD de receta se importa sin llamar a la IA.
- Los macros estimados por IA se marcan como estimados.
- Nada se guarda sin que el usuario confirme en el formulario.

## Constraints & assumptions
- Depende de #18 (recetas propias), ya mergeado ([PR #85](https://github.com/mancabcar/MealPlan/pull/85)): el formulario de receta es el destino del prerrellenado.
- Front estático en IONOS; las rutas de servidor viven en Vercel (`server/app/api/*`, ver #69). La descarga de la página y la llamada a Claude van en una ruta nueva allí, con CORS; la clave de Claude nunca llega al cliente.

## Recommended bet
Pegar una URL → el servidor descarga la página, extrae el JSON-LD `schema.org/Recipe` si existe y, si no, usa Claude para extraer ingredientes, pasos y estimar macros → se abre el formulario de receta prerrellenado para revisar.

## Open questions (para la spec)
- Páginas bloqueadas, sin receta o con error: qué ve el usuario.
- Protección del servidor frente a URLs internas (SSRF), tamaño y tiempo máximos de descarga.
- Cómo se marcan en el formulario y al guardar los macros estimados por IA.
- Cómo se mapean los ingredientes importados (texto libre) al modelo de receta de #18.
