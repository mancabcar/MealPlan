# Tolerancia de «cumplido» editable en Perfil, compartida por Plan y Diario

_Status: tech design · Updated: 2026-10-05 · Issue: [#49](https://github.com/mancabcar/MealPlan/issues/49) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
La tolerancia de «cumplido» es fija en ±10 % (`PLAN_TOLERANCE_PCT`, `src/lib/planMacros.ts`), así que el usuario no puede ajustar lo estricta que es la adherencia.

## Apuesta
- Tolerancia editable en Perfil (5–20 %, por defecto 10 %).
- Un único valor compartido por el resumen de macros del Plan (#10) y la adherencia y medias del Diario (#11).
- El valor viaja en la copia de seguridad (`USER_DATA_KEYS`) y en la sincronización (incluido `SYNC_KEYS` del servidor).
- `macroStatus` recibe la tolerancia como parámetro en vez de leer la constante.
- Lo que no tiene rango de proteína se sigue juzgando con esa tolerancia.

## Fuera de alcance
- Tolerancia por macro.
- Cambiar el funcionamiento de los rangos.

## Riesgos a cerrar en la spec
- Backups y sync antiguos sin el campo.
- Valores fuera de 5–20 %.

## Decisiones del pipeline
- Entrada en el paso 3 (spec): el issue ya define el comportamiento, así que se saltan brainstorm y prototipo (la única UI es un campo en Perfil). Confirmado por el usuario el 2026-10-05.
- Comentarios en el issue: se pregunta antes del primero.

## Follow-ups
(ninguno todavía)
