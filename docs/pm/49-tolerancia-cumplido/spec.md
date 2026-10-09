# Tolerancia de «cumplido» editable en Perfil: Spec
_Status: Draft · Owner: Manuel Cabrera Carmona · Updated: 2026-10-05_
_Related: [brief](brief.md) · [issue #49](https://github.com/mancabcar/MealPlan/issues/49)_

## TL;DR
La tolerancia con la que se juzga «cumplido» está fija en ±10 %. Haremos que el usuario la edite en Perfil (5–20 %, defecto 10), con un único valor que usan el Plan y el Diario y que viaja en la copia de seguridad y la sincronización. Se sabrá que funciona porque cambiar el valor cambia a la vez el resumen del Plan y la adherencia y medias del Diario, sin que diverjan.

## Problem
Hoy `PLAN_TOLERANCE_PCT` fija ±10 % para todo objetivo numérico (kcal, hidratos, grasas y proteína sin rango). El usuario no puede hacerlo más estricto o más laxo. En #11 se dejó fija a propósito para que Plan y Diario no divergieran y para no tocar perfil ni backup.

## Goals
- Tolerancia editable en Perfil, entero entre 5 y 20, defecto 10.
- Un único valor compartido por el resumen de macros del Plan (#10) y la adherencia y medias del Diario (#11).
- El valor viaja con el perfil en backup y sincronización.

## Non-goals
- Tolerancia distinta por macro.
- Cambiar el funcionamiento de los rangos (la proteína con rango sigue usando min–max).
- Pedir la tolerancia en el onboarding.
- Guardar la tolerancia vigente en cada día del histórico.

## Users & key scenarios
Usuario único de la app, con objetivos de macros en Perfil.
- Quiere ser más estricto: baja la tolerancia a 5 % y ve menos días «cumplidos».
- Quiere más margen: la sube a 15 % y ve más días «cumplidos».
- Restaura una copia antigua sin el campo: todo se comporta como con 10 %.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | En Perfil el usuario puede editar la tolerancia como porcentaje entero entre 5 y 20; el defecto es 10. | Must |
| R2 | El Plan y el Diario juzgan «cumplido» con ese mismo valor, para todo objetivo numérico (kcal, hidratos, grasas y proteína sin rango). La proteína con rango sigue juzgándose con min–max. | Must |
| R3 | `macroStatus` recibe la tolerancia como parámetro en lugar de leer la constante. | Must |
| R4 | El valor forma parte del perfil y viaja en la copia de seguridad y en la sincronización entre dispositivos. | Must |
| R5 | Si falta o no es válido (perfil, copia o sync antiguos) se usa 10; si es un número fuera de 5–20 se ajusta al límite más cercano. | Must |
| R6 | Cambiar la tolerancia recalcula todo el histórico del Diario, porque no se guarda por día. | Must |
| R7 | Junto al campo, Perfil explica en una línea que afecta al Plan y al Diario. | Should |

## User flows
1. El usuario abre Perfil, cambia la tolerancia a 15 y guarda.
2. El Plan recalcula el estado de cada macro del día con ±15 %.
3. El Diario recalcula adherencia y medias, también de días pasados.

## Acceptance criteria
**R1**
- Given el perfil sin tolerancia guardada, when el usuario abre Perfil, then el campo muestra 10.
- Given un valor entero entre 5 y 20, when el usuario guarda, then se conserva al recargar.
- Given un valor menor que 5, mayor que 20, vacío o no entero, when el usuario intenta guardar, then no se guarda como válido y se le indica el rango admitido.

**R2 y R3**
- Given objetivo de 2000 kcal y tolerancia 5, when se consumen 1899, then el estado es `below`; con tolerancia 10 es `within`.
- Given la misma tolerancia, when se muestran Plan y Diario para un mismo valor, then ambos dan el mismo estado.
- Given proteína con rango, when cambia la tolerancia, then el estado de proteína no cambia.

**R4**
- Given una tolerancia de 15, when se exporta y se restaura la copia, then el valor es 15.
- Given dos dispositivos sincronizados, when se cambia en uno, then el otro lo recibe y lo usa.

**R5**
- Given una copia sin el campo, then se usa 10 sin errores.
- Given un valor no numérico o NaN, then se usa 10.
- Given 3 o 50, then se usan 5 y 20 respectivamente.

**R6**
- Given días pasados en el Diario, when cambia la tolerancia, then su adherencia y medias reflejan el nuevo valor.

**R7**
- Given Perfil, then junto al campo hay un texto que menciona Plan y Diario.

## Edge cases
- El servidor de sincronización rechaza o descarta campos de perfil que no conoce (`SYNC_KEYS`): hay que comprobar que el nuevo campo se conserva.
- Redondeo: la comparación entera de `macroStatus` debe seguir siendo exacta con cualquier entero 5–20.

## Risks & dependencies
- Toca perfil, backup, sync y servidor a la vez; un dispositivo con versión antigua podría no conservar el campo.

## Open questions
- [x] ¿Un dispositivo con versión antigua puede pisar el campo? Riesgo aceptado: vuelve a 10 (ver tech.md).
