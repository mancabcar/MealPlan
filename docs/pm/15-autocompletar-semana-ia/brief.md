# Rellenar la semana según mis objetivos de macros

_Status: prototype · Updated: 2026-10-19 · Issue: [#15](https://github.com/mancabcar/MealPlan/issues/15)_

## Follow-ups
- **D. Híbrido IA + solver:** Claude elige qué recetas tienen sentido juntas y aporta variedad; el solver cuadra raciones y valida. Candidato si el spike muestra días que cuadran pero no apetecen. (brainstorm)
- **Recetas nuevas inventadas por la IA** para franjas que el recetario no cubre (lo que pedía el issue). Requiere macros estimados y, si se usa la ruta de IA, [#165](https://github.com/mancabcar/MealPlan/issues/165) (reintentos y timeout). (brainstorm)
- **E. «Completar el día»:** botón por día que rellena las franjas vacías para cerrar lo que falta, con el mismo solver. (brainstorm)
- **F. «Cuadrar semana»:** ajustar raciones (o cambiar alguna receta) de un plan ya hecho para que cada día entre en rango, sin rellenar. (brainstorm)
- **A. Plantillas de menús de la nutricionista:** guardar sus menús (3 en septiembre) como plantillas y rotarlos. (brainstorm)
- **Límite de repetición configurable** (una receta como mucho N veces por semana). En v1 solo se penaliza repetir. (brainstorm)
- **Sobras y batch cooking en el relleno** ([#17](../17-sobras-batch-cooking/brief.md)): planificar una cocinada y sus sobras. (brainstorm)
- `POST /api/recipes` sigue en `claude-opus-4-8`; el último modelo es Opus 5.5. No afecta a esta apuesta, que no usa IA. (brainstorm) → [#180](https://github.com/mancabcar/MealPlan/issues/180)

## Problem
Manuel necesita una semana planificada que cumpla sus objetivos de macros (plan vigente: 2000 kcal, 230 g HC, 130–160 g proteína, 69 g grasa), variada y parecida a lo que pauta su nutricionista, sin tener que hacer cuentas. Hoy lo resuelve de cuatro maneras, ninguna buena: asigna franja a franja a mano, copia la semana anterior y retoca, pasa a la app los menús de la nutricionista, o directamente no planifica y apunta en el Diario sobre la marcha. Cuadrar 5 tomas × 7 días con los objetivos es tedioso, así que el Plan acaba sin cumplir o vacío.

(El issue lo enmarcaba como «planificar es lento»; el usuario eligió este enunciado porque lo que busca es cumplir, variedad y fidelidad, no velocidad.)

## Success looks like
- Los días rellenados cumplen el objetivo (kcal ±10 % y proteína en rango) sin que el usuario haga cuentas, o la app avisa de qué día no se pudo.
- Variedad sin pensar: la semana no repite siempre las mismas recetas.
- Fiel a la nutricionista: la semana se parece a sus menús más que a recetas al azar.

## Constraints & assumptions
- Coste bajo por relleno (restricción dura del usuario). La apuesta no llama a la IA: coste cero.
- Solo rellena franjas vacías de las comidas activas; no toca las ya asignadas (criterio del issue).
- Alergias y dieta: exclusión estricta, con la misma lógica que `recipeViolations` (`src/lib/allergens.ts`).
- Se puede deshacer (criterio del issue), como «Copiar semana anterior» ([#53](../53-copiar-semana-anterior/brief.md)).
- «Cumple» usa la misma tolerancia que el resto del Plan ([#10](../10-macros-plan/brief.md), [#49](../49-tolerancia-cumplido/brief.md)).
- Recetario de partida: 107 recetas de catálogo + las del usuario. Por etiqueta de comida: desayuno 22, comida 39, cena 38, snack 16, pre-gym 3; 24 con «plan nutricionista».

## Directions considered
### A. Rotar los menús de la nutricionista: plantillas sin IA
Los menús de la nutricionista se guardan como plantillas (cada toma → una receta del recetario) y «Rellenar semana» los rota por los días vacíos. **Risk:** poca variedad; mapear cada toma a una receta, y rehacerlo cuando cambie el plan.

### B. Solver local: un algoritmo cuadra recetas y raciones
En el navegador, elige para cada franja recetas con la etiqueta de esa comida y ajusta raciones para que cada día cumpla, penalizando repetir y filtrando alergias, dieta y gustos. Gratis, instantáneo, sin conexión, macros garantizados. **Risk:** días que cuadran en números pero no en el plato; depende de la calidad de las etiquetas.

### C. La IA elige del recetario: el issue tal cual
Se envía a Claude id + macros + tags; devuelve recetas y raciones por franja; el servidor valida alérgenos y macros y reintenta o avisa. **Risk:** los LLM suman mal (días fuera de rango, avisos frecuentes); coste y espera por relleno.

### D. Híbrido: la IA propone, el solver cuadra
Claude (modelo barato) elige combinaciones con sentido y variedad, y opcionalmente recetas nuevas; el solver ajusta raciones y valida. **Risk:** dos piezas; recetas nuevas con macros estimados.

### E. «Completar el día»: simplificar el alcance
Botón por día que rellena las franjas vacías para cerrar lo que falta, con el solver de B. **Risk:** no da la semana entera sin pensar.

### F. «Cuadrar semana»: ajustar, no rellenar
El usuario planifica como quiera y un botón ajusta raciones o cambia alguna receta para que cada día entre en rango. **Risk:** no sirve si se parte de cero.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Rotar menús nutricionista | Med | Low | High | Que no canse rotar 3 menús y que cada toma tenga receta en el recetario |
| B. Solver local | High | Med | Med | Que elegir por etiqueta y raciones dé días apetecibles, no solo que cuadren |
| C. IA elige del recetario | Med | Med | Low | Que Claude acierte con ±10 % sin que el servidor lo corrija siempre |
| D. Híbrido IA + solver | High | High | Med | Que la IA aporte bastante sobre B como para justificar coste y complejidad |
| E. Completar el día | Low | Low | High | Que baste ir día a día |
| F. Cuadrar semana | Med | Low | High | Que ya haya un plan de partida |

Puntuaciones propuestas por Claude; el usuario no pidió cambios.

## Recommended bet
**B. Solver local, con preferencia por las recetas «plan nutricionista».** Elegida por el usuario (coincide con la recomendación de Claude).

Primera versión:
- «Rellenar semana» en el Plan rellena las franjas vacías de las comidas activas de la semana, eligiendo recetas por la etiqueta de cada comida.
- **Ajusta raciones** (0,25–4, como [#29](../29-raciones-plan/brief.md)) para afinar cada día. El spike mostró que con este recetario no hacen falta para cuadrar (todo a 1 ración también da 7/7); se mantienen para acercar HC y grasa y para perfiles con otras kcal (decisión del usuario tras el spike).
- **Días a medias:** cuenta lo ya asignado en el día y rellena el resto para cerrar lo que falta.
- **Preferencia nutricionista: prioriza, no obliga.** Elige antes recetas «plan nutricionista» y favoritas; recurre al resto si no cuadra o para variar.
- **Variedad:** penaliza repetir una receta dentro de la semana, sin límite fijo configurable. Lo ya asignado a mano cuenta para la variedad.
- **Coherencia (tras el spike):** reglas en el solver para que el día tenga sentido en el plato, al menos no repetir el ingrediente base en el mismo día (p. ej. tres platos de garbanzo) y que Pre-entreno prefiera recetas «pre-gym». El detalle de las reglas se define en el spec.
- Alergias y dieta excluidas de forma estricta; si un día no se puede cuadrar, se avisa.
- Se puede deshacer.

Por qué: cumple «coste bajo» (sin IA), garantiza los macros sin depender de la aritmética de un LLM y deja la base para E y F. **Qué nos haría cambiar de opinión:** que el spike genere días que cuadran pero no se comerían (combinaciones absurdas o repetitivas); entonces se pasa a D.

## What to prototype
**Spike del solver, no canvas de diseño** (decidido en la gate: el spike sustituye a pm-prototype). La UI es conocida (como «Copiar semana anterior»); el riesgo está en el contenido. Un script que genere 3–4 semanas con el recetario real y el perfil vigente (2000 kcal, 230 HC, 130–160 P, 69 G; 5 tomas), con y sin días a medias, para que el usuario juzgue: ¿comería esa semana? ¿Se parece a la nutricionista? ¿Cuántos días no cuadran?

**Resultado (2026-10-19)** — [spike.md](spike.md), generado por `scripts/spike-solver.mjs` (búsqueda aleatoria de 400 combinaciones por día + ajuste de raciones 0,5–2; perfil sin alergias ni «no me gusta», omnívoro):
- 4 semanas (3 desde cero, 1 con días a medias): **28/28 días cumplen** kcal ±10 % y proteína 130–160. ~49 % de recetas «plan nutricionista», ninguna repetida en la semana, 7–10 franjas con raciones ≠ 1 por semana. Menos de 2 s en total.
- Control con todo a 1 ración: también 7/7 en las tres semanas desde cero.
- Fallos: coherencia del día (Mié de la semana 3: garbanzos crujientes + puchero de garbanzos + hummus) y Pre-entreno con snacks que no son pre-gym (hummus, mousse de cacao). HC y grasa quedan a menudo algo por debajo (solo informativo).
- Veredicto del usuario: **se lo comería, con reglas de coherencia**; B se mantiene, sin pasar a D. La fidelidad (~49 % ★) le parece bien.

## Open questions
- ¿Se muestra una previsualización antes de aplicar, o se aplica directamente con Deshacer?
- Alcance de Deshacer: ¿todo el relleno de una vez?
- «No me gusta»: ¿excluye o solo penaliza? (En la IA de recetas es preferencia, no regla.)
- ¿Rellena solo la semana visible, o también deja elegir días concretos?
- Recetas sin etiqueta de comida (p. ej. propias o importadas): ¿se usan, y en qué franja?
- Franja «Pre-entreno» con solo 3 recetas pre-gym: ¿se completa con snacks, y con cuáles? (el spike mostró snacks poco adecuados)
- Reglas de coherencia: ¿qué cuenta como «ingrediente base» (legumbre, pescado, carne…) y de dónde sale (tags, ingredientes)?
- Límites de raciones en el relleno: el spike usó 0,5–2; ¿se permite todo 0,25–4?
