# Historial de peso y medidas corporales con gráfica

_Status: in review · Updated: 2026-09-26 · PR: [#35](https://github.com/mancabcar/MealPlan/pull/35) · Review: [⚠️ approved with follow-ups](review.md) · Issue: [#9](https://github.com/mancabcar/MealPlan/issues/9) (@mancabcar) · Prototype: [canvas](https://claude.ai/artifact/UC1WMWf2YsQwbkVU88LGEz) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
El perfil solo guarda el peso actual. La nutricionista entrega mediciones mensuales (BIA, perímetros y pliegues; ver [`docs/referencia/evolucion-agosto-2026.md`](../../referencia/evolucion-agosto-2026.md)) y no hay dónde registrarlas ni ver cómo evolucionan. Las apps competidoras lo tienen; MacroFactor incluso ajusta objetivos según la tendencia.

## Apuesta (del issue)
- Registro de mediciones con fecha: peso y, opcionalmente, % grasa, masa muscular y perímetros (cintura, cadera…).
- Gráfica de evolución por métrica, con tendencia (media móvil de 7 días para el peso).
- Al registrar un peso nuevo, actualizar el peso del perfil y reutilizar la oferta de recalcular objetivos que ya existe.

## Criterios de aceptación (del issue)
- Puedo añadir, editar y borrar mediciones; persisten por usuario.
- La gráfica muestra el peso en el tiempo con línea de tendencia.
- Con objetivos "Calculado", un peso nuevo ofrece recalcular; con "De tu nutricionista", no se tocan.
- Las métricas de la nutricionista se pueden introducir tal cual aparecen en su informe.

## Contexto técnico
- El peso vive en dos sitios: `UserProfile.weightKg` y `UserProfile.body.weightKg` (`src/lib/types.ts`). La tarjeta de datos corporales de `src/app/perfil/page.tsx` ya ofrece recalcular (R16 de onboarding-profile) cuando cambia el peso o la actividad con `targetSource === "calculated"`; con `"prescribed"` solo guarda el peso.
- El informe de la nutricionista trae más de lo que propone el issue: BIA (peso, masa muscular kg, grasa kg, IMC, % grasa, grasa visceral), perímetros con valores izquierda-derecha (bíceps, pierna, gemelo) y pliegues cutáneos (6 + suma). "Tal cual aparecen en su informe" obliga a decidir en la spec qué métricas entran.
- La toma del 31/07 tiene valores BIA incoherentes (anotado en la referencia): la app no debería "corregir" nada, pero sí dejar editar.
- No hay librería de gráficas en `package.json`.
- Hay tests unitarios (Vitest) y e2e (Playwright) en `tests/`.

## Pasos del pipeline
- Brainstorm: saltado. El issue ya trae problema, propuesta y criterios de aceptación.
- Prototipo: sí (Manuel, 2026-09-24), porque hay pantalla nueva (lista, formulario y gráfica). Comentario de inicio publicado en el issue. Canvas con 8 pantallas (ver Prototype). Aprobado sin cambios (Manuel, 2026-09-24).
- Spec: [spec.md](spec.md), aprobada el 2026-09-24 (11 Musts R1–R11, 4 Should, 1 Could). Las 3 preguntas abiertas se resolvieron con las propuestas: izq./der. como dos líneas, borrar no revierte el peso del perfil, las tomas de mayo–julio se introducen a mano.
- Tech design: [tech.md](tech.md), aprobado el 2026-09-26. SVG propio sin dependencias, colección `measurements` en el store, subruta `/perfil/evolucion`, `RecalcOffer` extraído; esfuerzo M, 12 tareas. Decisiones (Manuel, 2026-09-26): «Datos corporales» crea una medición de hoy al cambiar el peso (nuevo R17, Must) y la oferta mantiene «Mantener los actuales». Siguiente: tests primero (dev-test).
- Tests: escritos antes del código el 2026-09-26 (dev-test), rama `feature/historial-medidas`: `tests/unit/measurements.test.ts` (64), 10 nuevos en `store.test.tsx`, 9 ajustados o nuevos en `backup.test.ts`, `tests/e2e/evolucion.spec.ts` (43), 3 en `accessibility.spec.ts` y 2 ajustados en `backup-datos.spec.ts`. Fallan porque la funcionalidad no existe; 1 e2e de R17 es una guardia que ya pasa. **Añadido en esta fase:** las mediciones son el séptimo dato de la copia de seguridad (backup-datos, PR #32, llegó después de la tech design); ver tech.md › Data model y spec R6. Cobertura en [tech.md › Test coverage](tech.md#test-coverage). Siguiente: código (dev-code).

## Prototype
_Design: https://claude.ai/artifact/UC1WMWf2YsQwbkVU88LGEz · 2026-09-24_
- Screens: 1 Perfil con tarjeta «Evolución» · 2 Evolución vacía · 3 Evolución del peso (chips de métrica, rango, gráfica con puntos de casa y de la nutricionista, tendencia, historial, botón «Añadir») · 4 Apuntar peso (hoja: fecha + peso) · 5 Editar informe de la nutricionista (22 métricas en BIA, perímetros y pliegues; eliminar) · 6 Peso nuevo con objetivos «Calculado» → «¿Recalculamos?» · 7 Peso nuevo con objetivos «De tu nutricionista» → aviso, sin cambios · 8 Otra métrica (cintura).
- Decisions made while prototyping (ASSUMPTIONs):
  - Evolución vive dentro de Perfil (tarjeta + subpantalla), sin sexta pestaña.
  - El peso del perfil pasa a ser el de la medición más reciente; editar una medición antigua no lo cambia.
  - El peso actual del perfil no se importa como medición (no tiene fecha).
  - Dos formas de añadir: «Solo peso» (rápido, en casa) e «Informe completo»; cada medición tiene origen Casa/Nutricionista.
  - Perímetros bilaterales (bíceps, pierna, gemelo) como izq./der.; el IMC se introduce tal cual; la suma de pliegues se calcula.
  - Los valores raros avisan pero no bloquean (p. ej. «9,7» en pierna der.).
  - Tendencia = media de las pesadas de los últimos 7 días, solo para el peso; el resto de métricas se unen con una línea.
  - La oferta de recalcular solo aparece si la medición es la más reciente y trae peso.
- What to learn from testing it: si copiar un informe de 22 valores es llevadero en el móvil; si la tendencia se entiende con pesadas espaciadas; si «Solo peso» basta para pesarse en casa sin fricción; cómo mostrar métricas izq./der. en la gráfica (pregunta abierta).

## Follow-ups
- Ajuste automático de objetivos según la tendencia de peso (estilo MacroFactor): fuera del issue, candidato a issue propio.
- Non-goals de la spec que podrían volver: importar el PDF de la nutricionista con IA, metas de peso/medidas, exportar el historial, fotos de progreso.
