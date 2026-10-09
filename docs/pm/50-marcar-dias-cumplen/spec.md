# Marcar los días que cumplen en la gráfica semanal: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-10-05_
_Related: [brief](brief.md)_

## TL;DR
La gráfica «Calorías esta semana» no enseña qué días cumplieron el objetivo, aunque la tarjeta «Medias y adherencia» ya cuenta cuántos. Marcaremos con un icono bajo la barra los días cumplidos, con el mismo criterio que esa tarjeta, y cada barra llevará texto accesible. Funcionó si los días marcados coinciden siempre con el «X de N» de la tarjeta.

## Problem
El usuario ve «5 de 7 días dentro del objetivo» en la tarjeta de adherencia, pero en la gráfica de arriba no puede saber cuáles son. Para averiguarlo tiene que comparar a ojo cada barra con la línea del objetivo, y eso ni siquiera tiene en cuenta la proteína.

## Goals
- Ver de un vistazo qué días de la semana mostrada cumplieron el objetivo (kcal dentro de la tolerancia y proteína en rango).
- Que lo marcado coincida con la tarjeta «Medias y adherencia», usando `isCompliantDay` (`src/lib/diaryStats.ts`).
- Que el estado de cada día sea accesible sin depender del color ni solo del icono.

## Non-goals
- Marcar los días que cumplen en el selector del Plan (R8 Could de [#10](../10-macros-plan/brief.md)).
- Cambiar el criterio de «cumplido» (lo define `isCompliantDay`).
- Una gráfica de 30 días.
- Colorear las barras según cumplan o no.

## Users & key scenarios
Usuario único de la app, que sigue un plan nutricional prescrito y registra a diario.
1. **Revisión semanal.** Abre el Diario y quiere saber qué días de la semana cumplió, no solo cuántos.
2. **Semana pasada.** Elige una fecha anterior y ve la semana que acaba en ella con sus días marcados.
3. **Días sin apuntar.** Un día sin registros no aparece ni como cumplido ni como incumplido.
4. **Lector de pantalla.** Recorre las barras y oye el estado de cada día.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Cada día de la gráfica que cumple el objetivo según `isCompliantDay` lleva un icono bajo su barra. | Must |
| R2 | Hoy, los días posteriores a hoy y los días sin registros nunca se marcan. Los días pasados con registros que no cumplen quedan sin icono. | Must |
| R3 | Cada barra lleva texto accesible (`sr-only`) con su estado: «Cumple el objetivo», «No cumple el objetivo», «Sin registros» o «Día en curso». | Must |
| R4 | Bajo la gráfica hay una leyenda visible corta que explica el icono. | Should |

## User flows
1. El usuario abre el Diario con la fecha de hoy. Ve la gráfica de los 7 días que acaban hoy: los días pasados que cumplen llevan icono; hoy y los días vacíos no.
2. Elige una fecha pasada. La gráfica pasa a los 7 días que acaban en ella y los iconos se recalculan. Si esa fecha es anterior a hoy, ese último día también se evalúa.
3. Cambia el perfil (objetivo, rango de proteína, tolerancia). Al volver al Diario, los iconos reflejan el nuevo criterio.

## Acceptance criteria
**R1**
- Given un perfil con `calorieGoal` 2000 y `proteinRange` 130–160 y un día pasado con 2150 kcal y 135 g, when se muestra la gráfica, then ese día lleva icono bajo su barra.
- Given el mismo perfil y un día pasado con 2150 kcal y 125 g, when se muestra la gráfica, then ese día no lleva icono.
- Given una semana mostrada, when se cuentan los iconos, then su número es igual al de días cumplidos que da `periodStats` para esos mismos días pasados.

**R2**
- Given hoy con entradas que sumarían un día cumplido, when se muestra la gráfica, then hoy no lleva icono.
- Given un día pasado sin ninguna entrada, when se muestra la gráfica, then no lleva icono.
- Given que se selecciona una fecha futura con entradas, when se muestra la gráfica, then ningún día igual o posterior a hoy lleva icono.
- Given un día pasado con registros que no cumple, when se muestra la gráfica, then no lleva icono ni ninguna otra marca visible.

**R3**
- Given cada una de las 7 barras, when se lee con un lector de pantalla, then cada una expone una de las cuatro etiquetas: «Cumple el objetivo» (día pasado cumplido), «No cumple el objetivo» (día pasado con registros incumplido), «Sin registros» (día pasado o futuro sin registros, y futuro con registros) o «Día en curso» (hoy).
- Given un día cumplido, when se ve la gráfica sin distinguir colores, then el estado se sigue entendiendo por el icono y por el texto.

**R4**
- Given la gráfica visible, when se mira bajo ella, then hay una línea de texto que dice que el icono marca los días dentro del objetivo (kcal y proteína).

## Edge cases
- Fecha seleccionada borrada o futura: la gráfica ya se calcula respecto a esa fecha; los días iguales o posteriores a hoy no se marcan, tengan o no entradas.
- Entradas restauradas de un backup con un macro ausente o no numérico: no deben romper la marca (se tratan como las de `dailyTotals`, que suma 0).
- Tolerancia o rango de proteína editados en el Perfil: el criterio sale siempre del perfil actual.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Días marcados en la gráfica coinciden con los días cumplidos de «Medias y adherencia» para el mismo periodo | No existe | 100 % | Test unitario que compara ambos cálculos |

## Risks & dependencies
- Depende de `isCompliantDay` y `dailyTotals` (`src/lib/diaryStats.ts`), que ya existen.
- `WeekBarChart` es genérico (`{label, value}`), así que su contrato de datos cambia: hay que cuidar que otros usos, si los hay, no se rompan.
- La semana de la gráfica incluye hoy y la tarjeta de adherencia no; hay que mantener esa diferencia a propósito (R2).

## Open questions
- [ ] Icono concreto y su posición exacta bajo la barra (tech design / dev-code).
