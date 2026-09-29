# Aprovechar lo que caduca: Spec
_Status: Draft · Owner: Manuel Cabrera · Updated: 2026-09-29_
_Related: [brief](brief.md) · [issue #16](https://github.com/mancabcar/MealPlan/issues/16)_

## TL;DR
La Despensa avisa de lo que caduca pero no lo conecta con las recetas. Añadimos "Recetas con esto" en los ítems "caduca pronto" y un filtro "Usa lo que tengo" en Recetas que ordena por ingredientes ya disponibles, desempatando por caducidad. Se sabrá que funciona cuando los tres criterios de aceptación del issue pasen; no hay métricas de uso (app personal sin analytics).

## Problem
Hoy la Despensa solo marca "caduca pronto" (0–2 días) y alimenta la generación de recetas con IA. Quien tiene leche que caduca mañana no puede ver qué recetas de su recetario la usan, y en Recetas no hay forma de priorizar lo que ya tiene en casa.

## Goals
- Desde un ítem "caduca pronto", ver las recetas del recetario que lo usan.
- Filtro "Usa lo que tengo" en Recetas, ordenado por nº de ingredientes en despensa y desempatado por la caducidad más próxima.
- Los avisos de alérgenos del perfil siguen visibles en todos los resultados.

## Non-goals
- Generar recetas nuevas con IA desde estas vistas (solo se enlaza a la generación existente).
- Cantidades y unidades: cuenta solo la presencia del ingrediente.
- Sugerir comprar lo que falta.
- Notificaciones de caducidad.
- Editar los ingredientes de las recetas.

## Users & key scenarios
Usuario único de la app, con Despensa y recetario propios.
1. Ve que la leche caduca mañana y pulsa "Recetas con esto" para decidir qué cocinar.
2. Abre Recetas, activa "Usa lo que tengo" y ve arriba las que aprovechan más de lo que tiene.
3. Tiene alergia a frutos secos: una receta sugerida los contiene y sigue mostrando su aviso.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Cada ítem de la Despensa "caduca pronto" (no caducado, quedan 0–2 días) muestra la acción "Recetas con esto"; los demás ítems no. | Must |
| R2 | "Recetas con esto" navega a Recetas mostrando solo las recetas cuyos ingredientes contienen ese ítem, con un chip quitable "con: <ítem>". | Must |
| R3 | Recetas ofrece el filtro "Usa lo que tengo": muestra solo recetas con ≥1 ingrediente presente en la Despensa (no caducado), ordenadas por nº de ingredientes coincidentes descendente. | Must |
| R4 | Empates en R3 se resuelven por la caducidad más próxima entre los ingredientes coincidentes (los sin fecha van después); si sigue el empate, orden actual del recetario. | Must |
| R5 | Todas las recetas mostradas por R2 y R3 conservan su aviso de alérgenos. | Must |
| R6 | Estados vacíos: sin recetas para el ítem (R2) o sin resultados con el filtro (R3) se muestra un mensaje con salida a la generación de recetas con IA. | Must |
| R7 | El filtro "Usa lo que tengo" y la búsqueda por texto se combinan (ambas condiciones a la vez). | Must |
| R8 | Con el filtro activo, cada tarjeta muestra "Tienes N de M ingredientes" y un chip "caduca pronto" si algún coincidente lo está. | Should |
| R9 | La tarjeta indica "caduca en X días" del ingrediente coincidente más próximo. | Could |

## User flows
1. Despensa → ítem "Leche" con chip "caduca pronto" → "Recetas con esto" → Recetas con chip "con: leche" y las recetas que la usan → quitar el chip vuelve a la lista completa.
2. Recetas → activar "Usa lo que tengo" → lista ordenada; escribir en búsqueda restringe además por texto → desactivar el filtro restaura el orden normal.

## Acceptance criteria
**R1**
- Given un ítem que caduca en 2 días, when abro la Despensa, then veo "Recetas con esto" en ese ítem.
- Given un ítem que caduca en 3+ días, sin fecha o caducado, then no hay acción.

**R2**
- Given un ítem "leche" que caduca en 2 días y dos recetas con "leche" entre sus ingredientes, when pulso "Recetas con esto", then Recetas muestra solo esas dos y el chip "con: leche".
- Given el chip, when lo quito, then vuelven todas las recetas.

**R3 / R4**
- Given receta A con 3 ingredientes en despensa y B con 1, then A aparece antes que B.
- Given A y B con 2 coincidencias cada una y el ingrediente de B caduca antes, then B aparece antes que A.
- Given una receta con 0 coincidencias (o cuyos coincidentes están caducados), then no aparece.

**R5**
- Given alergia a frutos secos en el perfil y una receta con frutos secos en los resultados de R2 o R3, then su aviso de alérgeno se muestra igual que en la lista normal.

**R6**
- Given un ítem sin recetas, when pulso "Recetas con esto", then veo un mensaje ("Ninguna receta usa <ítem>") y un enlace a generar recetas.
- Given despensa vacía y filtro activo, then veo un mensaje con el mismo enlace.

**R7**
- Given filtro activo y texto "pollo", then solo aparecen recetas que cumplen ambos.

**R8**
- Given filtro activo y una receta con 3 de 5 ingredientes en despensa, then su tarjeta muestra "Tienes 3 de 5 ingredientes".

## Edge cases
- Coincidencia de ingredientes: la misma regla que la lista de la compra ([`pantryMatch.ts`](../../../src/lib/shopping/pantryMatch.ts)): todas las palabras del ingrediente están en el nombre del ítem (ignorando "de"). Los ítems caducados no cuentan.
- Ítem sin fecha de caducidad: cuenta como coincidencia para R3, pero no desempata.
- Dos ítems de despensa coinciden con el mismo ingrediente: cuenta una vez, con la caducidad más próxima.

## Risks & dependencies
- Coincidencia por texto libre: pueden aparecer falsos positivos/negativos ("leche" vs "leche de almendras"). Se acepta el comportamiento ya existente en la lista de la compra.

## Open questions
- [ ] ¿"con: <ítem>" debe casar con el nombre del ítem entero o por palabras, como en la lista de la compra? (Manuel; se propone lo segundo, por coherencia — decidir en tech design)
