# Historial de peso y medidas corporales: Review
_PR: [#35](https://github.com/mancabcar/MealPlan/pull/35) · Reviewed: 2026-09-26 · Verdict: ⚠️ approved with follow-ups_

## Summary
La PR implementa los 17 requisitos (12 Must, 4 Should, 1 Could) siguiendo la tech design: lib pura, séptima clave en el store y en la copia de seguridad, subruta `/perfil/evolucion`, gráfica SVG propia y `RecalcOffer` extraída sin cambios de comportamiento. Todos los tests escritos antes del código pasan sin haberse tocado (535 unit, 200 e2e, CI 3/3 en verde). No hay nada bloqueante; quedan un par de fallos menores en casos límite (la cifra de 30 días de la tarjeta, la validación de fechas y de la copia) y los avisos de R16, que con datos reales avisan demasiado en los pliegues.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/lib/measurements.ts:158 (`parseMeasurementDraft`), src/components/evolucion/MeasurementForm.tsx | ✅ unit + e2e |
| R2 | ✅ Done | src/components/evolucion/MeasurementForm.tsx:187 | ✅ e2e |
| R3 | ✅ Done | src/lib/measurements.ts:35 (`METRICS`), MeasurementForm.tsx (3 `fieldset`) | ✅ unit + e2e |
| R4 | ✅ Done | src/lib/measurements.ts:158 | ✅ unit + e2e |
| R5 | ✅ Done | src/app/perfil/evolucion/page.tsx:135, :156; src/lib/store.tsx:129 | ✅ unit + e2e |
| R6 | ✅ Done | src/lib/userData.ts (`LOAD_OPTIONS.measurements`), src/lib/backup.ts:109 | ✅ unit + e2e (recarga, por usuario, copia) |
| R7 | ✅ Done | src/app/perfil/evolucion/page.tsx; src/app/perfil/page.tsx:328 | ✅ e2e |
| R8 | ✅ Done | src/lib/measurements.ts:244; src/components/evolucion/LineChart.tsx | ✅ unit + e2e |
| R9 | ✅ Done | src/lib/measurements.ts:212, :219, :229 | ✅ unit + e2e |
| R10 | ✅ Done | src/app/perfil/evolucion/page.tsx:150; src/components/perfil/RecalcOffer.tsx | ✅ e2e |
| R11 | ✅ Done | src/app/perfil/evolucion/page.tsx:180 | ✅ e2e + axe |
| R12 (Should) | ✅ Done | src/app/perfil/page.tsx:328 (`EvolutionCard`) | ✅ unit + e2e |
| R13 (Should) | ✅ Done | src/lib/measurements.ts:287; page.tsx:230 | ✅ unit + e2e |
| R14 (Should) | ✅ Done | src/lib/measurements.ts:272; MeasurementForm.tsx (`<output>`) | ✅ unit + e2e |
| R15 (Should) | ✅ Done | src/lib/measurements.ts:298; page.tsx:263 | ✅ unit + e2e |
| R16 (Could) | ✅ Done | src/lib/measurements.ts:324 | ✅ unit + e2e |
| R17 | ✅ Done | src/app/perfil/page.tsx:419, :436 | ✅ e2e |

Edge cases de la spec: varias el mismo día (desempate por `savedAt`), borrar la última pesada o quitarle el peso sin tocar el perfil, rangos, métrica con un solo punto, periodo sin datos y usuario sin datos corporales: todos cubiertos, casi todos con test. Non-goals: no se ha construido nada excluido. Tech design: seguida; las dos divergencias (selector de métrica en una fila con scroll y «Guardar» en barra fija inferior) están explicadas en la PR y en `tech.md › Risks`.

## Blocking
Ninguno.

## Non-blocking
- ✅ **Arreglado:** **R16 da demasiados avisos en los pliegues con datos reales**: src/lib/measurements.ts:324. Al editar la toma del 31/07 avisa en 3 de los 6 pliegues (bajar de 6,5 a 4,5 mm ya supera el 30 %). Si avisa siempre, deja de servir para cazar erratas → no comparar los pliegues con la toma anterior (mantener el aviso izq./der.) o subir su umbral. Es un cambio de spec (Could): lo decide Manuel. _Hecho (decisión de Manuel): los pliegues no se comparan con la toma anterior; spec R16 actualizada y test con junio → julio._
- ✅ **Arreglado:** **La tarjeta (R12) puede decir «0 kg en 30 días» sin pesadas recientes**: src/lib/measurements.ts:260. Si la última pesada cae dentro de la ventana de hace 25–35 días, es a la vez base y final → exigir que la última pesada sea posterior a la base (o de los últimos ~7 días) y, si no, no mostrar la cifra. _Hecho: la base tiene que ser anterior a la última pesada; test en measurements.test.ts._
- ✅ **Arreglado:** **Fechas imposibles pasan el saneado**: src/lib/measurements.ts:193. «2026-02-31» cumple el regex y deja `dayNumber` en NaN (la tendencia la excluye y la gráfica se rompe) → validar con `dayNumber` en `sanitizeMeasurements`. _Hecho, con test._
- ✅ **Arreglado:** **La copia de seguridad descarta mediciones mal formadas sin avisar**: src/lib/backup.ts:109. `SECTION_SHAPE.measurements` no comprueba `source` ni `savedAt`, que sí exige el saneado; esas entradas desaparecen al importar aunque la importación diga que ha ido bien, en contra del «todo o nada» (backup-datos R8) → alinear la comprobación de forma con `sanitizeMeasurements`. _Hecho: la forma de la sección es «sanitizeMeasurements no descarta nada», con tests (source, savedAt, fecha imposible)._
- ✅ **Arreglado:** **El aviso de la nutricionista tapa el botón «Añadir» durante 10 s**: src/app/perfil/evolucion/page.tsx:167. `Toast` y el botón flotante comparten `fixed bottom-24` → subir el botón mientras se ve el aviso, o colocar el aviso más arriba. _Hecho: el botón sube a bottom-44 mientras se ve el aviso (comprobado en el navegador a 375 px)._
- **Resumen de las bilaterales**: el flujo del escenario 4 habla de «diferencia desde la primera»; para las métricas de un solo lado está, pero para Bíceps, Pierna y Gemelo solo se muestran los valores actuales. Menor.

## Code review findings
- `MeasurementForm` repite la conversión y la comprobación de rangos de `parseMeasurementDraft` para la suma de pliegues y los avisos (MeasurementForm.tsx:127) → sacar un `validValues(draft)` a measurements.ts.
- La barra fija de «Guardar» usa márgenes negativos que dependen del padding interno de `Sheet` (MeasurementForm.tsx:215) → añadir un hueco `footer` a `Sheet`.
- `RecalcOffer` copia las clases `saveBtn`/`cancelBtn` de perfil/page.tsx (RecalcOffer.tsx:8) → compartirlas desde un solo sitio.
- `ChipRadios` repite el estilo de chip de `ChoiceGroup` (page.tsx:66) → una variante de `ChoiceGroup` con `role="radiogroup"` y sin el punto del radio.

## Re-review (2026-09-26)
Los cuatro fallos no bloqueantes de código (R12 «0 kg», fechas imposibles, copia de seguridad y aviso sobre el botón) están arreglados en la misma rama, con tests nuevos: 536 unit y 200 e2e en verde, build correcto. Después, por decisión de Manuel, R16 ya no compara los pliegues con la toma anterior (537 unit en verde). Quedan solo los cuatro retoques de limpieza de «Code review findings». El veredicto sigue siendo ⚠️ approved with follow-ups por esa limpieza pendiente, que no bloquea el merge.
