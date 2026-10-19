# Rellenar la semana según mis objetivos de macros: Spec
_Status: Draft · Owner: Manuel Cabrera · Updated: 2026-10-19_
_Related: [brief](brief.md) · [spike](spike.md) · Issue [#15](https://github.com/mancabcar/MealPlan/issues/15)_

## TL;DR
Cuadrar a mano 5 tomas × 7 días con los objetivos de macros es tedioso, así que el Plan acaba sin cumplir o vacío. «Rellenar semana» rellena, con un solver local (sin IA, sin coste), las franjas vacías de la semana de hoy en adelante con recetas del recetario: cada día cumple kcal y proteína, sin repetir recetas, con días coherentes y priorizando las recetas «plan nutricionista» y favoritas. Funcionó si los días rellenados cumplen (≥ 95 % en el test del solver) y el usuario lo usa cada semana con pocos retoques.

## Problem
El usuario necesita una semana planificada que cumpla sus objetivos (plan vigente: 2000 kcal, 230 g HC, 130–160 g proteína, 69 g grasa), variada y parecida a lo que pauta su nutricionista, sin hacer cuentas. Hoy asigna franja a franja, copia la semana anterior y retoca, pasa a mano los menús de la nutricionista, o no planifica. El [spike](spike.md) mostró que un solver local con el recetario real cuadra 28/28 días, pero sin reglas junta platos del mismo ingrediente en un día y pone snacks poco adecuados en Pre-entreno.

## Goals
- G1. Con un toque, las franjas vacías de la semana visible (de hoy en adelante) quedan rellenas con días que cumplen: kcal dentro de la tolerancia y proteína en rango.
- G2. Variedad y coherencia: ninguna receta repetida en la semana; ningún día con dos platos del mismo ingrediente base.
- G3. Fidelidad: se priorizan las recetas «plan nutricionista» y las favoritas.
- G4. Seguro: nunca un alérgeno ni una receta fuera de la dieta; todo se puede deshacer.

## Non-goals
- Ninguna llamada a la IA ni recetas nuevas inventadas (follow-ups D y «recetas nuevas» del brief).
- No toca las franjas ya asignadas ni sus raciones («Cuadrar semana», F).
- No planifica sobras ni batch cooking (#17).
- No hay «Completar el día» suelto (E), plantillas de menús (A) ni límite de repetición configurable.
- No cambia la lista de la compra ni la sincronización: funcionan sobre el plan resultante tal cual.
- HC y grasa no cuentan para «cumple» (solo se intenta acercarlos).

## Users & key scenarios
Usuario único de la app, que sigue el plan de una nutricionista con 5 tomas al día.
1. **Semana nueva vacía:** el domingo navega a la semana siguiente, pulsa «Rellenar semana» y obtiene los 7 días planificados y cumpliendo.
2. **Semana a medias:** ya puso a mano un par de comidas (p. ej. lentejas el lunes, comida fuera el sábado); el relleno completa el resto y cuadra cada día contando lo que ya había.
3. **No le convence:** pulsa Deshacer en el aviso y vuelve a pulsar «Rellenar semana» para obtener otra propuesta.
4. **Miércoles de la semana en curso:** solo se rellenan miércoles a domingo.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | En el Plan, en la semana actual y en las futuras, hay un «Rellenar semana» | Must |
| R2 | Solo rellena franjas vacías de las comidas activas del perfil, de hoy en adelante; no toca las asignadas | Must |
| R3 | Nunca usa una receta con un alérgeno del perfil ni fuera de la dieta | Must |
| R4 | Cada día rellenado queda con kcal dentro de la tolerancia y proteína en rango, contando lo ya asignado | Must |
| R5 | Si un día no se puede cuadrar, se avisa de qué días no cumplen | Must |
| R6 | Deshacer devuelve la semana a como estaba antes del relleno | Must |
| R7 | Ninguna receta se repite en la semana, tampoco una ya asignada a mano | Must |
| R8 | Coherencia: un día no tiene dos platos del mismo ingrediente base | Must |
| R9 | Ajusta raciones para afinar | Should |
| R10 | Prioriza recetas «plan nutricionista» y favoritas, sin limitarse a ellas | Should |
| R11 | Pre-entreno prefiere recetas «pre-gym» | Should |
| R12 | Respeta los «no me gusta» | Should |
| R13 | El resultado aparece en menos de 1 s y funciona sin conexión | Should |
| R14 | Prefiere recetas mejor valoradas y evita las de 1 estrella (#111) | Could |
| R15 | Tras rellenar, un resumen: «Rellenadas N franjas · K días no cumplen» | Must |

## User flows
**Rellenar (escenarios 1, 2 y 4)**
1. El usuario está en el Plan, en la semana actual o una futura.
2. Pulsa «Rellenar semana», junto a «Copiar semana anterior».
3. Las franjas vacías de las comidas activas, de hoy en adelante, se rellenan al momento (sin previsualización).
4. Aparece un aviso de 10 s: «Rellenadas N franjas» (y «· K días no cumplen» si los hay) con «Deshacer».
5. El resumen de macros de cada día (#10) refleja el resultado; los días que no cumplen se ven como no cumplidos.

**Otra propuesta (escenario 3)**
1. En el aviso, pulsa «Deshacer»: la semana vuelve a como estaba.
2. Pulsa otra vez «Rellenar semana»: sale una propuesta distinta.

## Acceptance criteria
**R1**
- Given el Plan en la semana actual o una futura, then se ve «Rellenar semana» junto a «Copiar semana anterior».
- Given el Plan en una semana pasada, then no se ve «Rellenar semana».
- Given que, de hoy en adelante, ninguna comida activa tiene franja vacía en la semana visible, then el botón está desactivado con una explicación visible (como «Copiar semana anterior» con la semana origen vacía).

**R2**
- Given una semana con franjas asignadas (normales, sobras o cocinadas de una tanda), when se rellena, then esas franjas quedan idénticas (receta, raciones, tanda).
- Given la semana en curso y hoy miércoles, when se rellena, then lunes y martes no cambian.
- Given una comida que no está activa en el perfil, when se rellena, then no se crea ninguna franja de esa comida.
- Given una semana futura, when se rellena, then se rellenan los 7 días.

**R3**
- Given un perfil con alergias (preset o propias), when se rellena, then ninguna receta asignada tiene violaciones según la misma regla que `recipeViolations` (`src/lib/allergens.ts`).
- Given dieta vegetariana, then solo se asignan recetas con tag «vegetariano» o «vegano».
- Given dieta vegana, then solo se asignan recetas con tag «vegano».
- Given dieta pescetariana, then solo se asignan recetas con tag «vegetariano», «vegano», «pescado» o «marisco».
- Given dieta omnívora, then la dieta no filtra.

**R4**
- Given un día con franjas vacías, when se rellena, then sus kcal totales (lo asignado + lo rellenado, con raciones) están dentro de la tolerancia del perfil (`tolerancePct`, 10 % por defecto) y la proteína dentro de `proteinRange` (o del objetivo con tolerancia si no hay rango), con la misma regla que el resumen del día (`macroStatus`).
- HC y grasa no condicionan «cumple».

**R5**
- Given un día que ninguna combinación permitida puede cuadrar (p. ej. lo ya asignado supera las kcal), when se rellena, then el día se rellena igualmente con la combinación más cercana al objetivo y el resumen del día lo muestra como no cumplido.
- Then el aviso de R15 incluye cuántos días no cumplen.

**R6**
- Given un relleno recién hecho, when se pulsa «Deshacer» en el aviso (10 s), then los 7 días de la semana vuelven exactamente a su estado anterior al relleno, y nada fuera de esa semana cambia.
- Given que el aviso desaparece, then ya no hay Deshacer para ese relleno.

**R7**
- Given una semana rellenada, then ninguna receta aparece en dos franjas rellenadas de esa semana, ni en una rellenada si ya estaba asignada a mano esa semana.
- Qué pasa si no hay recetas suficientes para no repetir: _ver Open questions_.

**R8**
- Given un día rellenado, then no contiene dos recetas cuyo nombre incluya el mismo ingrediente base de la lista cerrada (cada legumbre, cada pescado, cada carne, arroz, pasta). Ejemplo: no «Garbanzos crujientes» + «Puchero de garbanzos»; sí «Tostadas con salmón ahumado» + «Merluza con patata».
- La regla también cuenta las recetas ya asignadas del día.

**R15**
- Given un relleno, then aparece un aviso «Rellenadas N franjas» con N = franjas creadas, más «· K días no cumplen» cuando K > 0, y la acción «Deshacer».

## Comportamiento de los Should y Could
- **R9:** raciones entre 0,5 y 2 en pasos de 0,25; con 1 ración no se guarda (como #29).
- **R10:** a igualdad de ajuste, una receta «plan nutricionista» o favorita gana; las demás se usan cuando hace falta para cuadrar o para variar.
- **R11:** Pre-entreno usa antes recetas «pre-gym»; si no hay suficientes, cualquier receta con tag «snack».
- **R12:** las recetas con un ingrediente de «no me gusta» quedan excluidas.
- **R13:** el cálculo es local, en el navegador: sin red y en menos de 1 s para una semana.
- **R14:** a igualdad, gana la mejor valorada; las de 1 estrella no se usan.
- Cada relleno es distinto (no determinista): deshacer y volver a rellenar da otra propuesta.
- Recetas sin tag de franja (desayuno, comida, cena, snack) no se usan.

## Edge cases
- Semana sin franjas vacías de hoy en adelante → botón desactivado (R1).
- Hoy es domingo en la semana actual → solo se rellena el domingo.
- Día con todas sus comidas asignadas → no cambia, aunque no cumpla.
- Franja con una receta que ya no existe (borrada) → cuenta como asignada o como vacía: _ver Open questions_.
- Perfil con alergias o dieta que deja una franja sin ninguna receta posible: _ver Open questions_.
- Comida «Merienda» activa → usa recetas «snack», como Media mañana.
- Sincronización entre dispositivos: el relleno es un cambio normal del plan.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Días rellenados que cumplen (kcal + proteína) | — | ≥ 95 % | Test automatizado del solver con el recetario real y varios perfiles (2000 kcal; vegetariano; con alergias) |
| Semanas planificadas enteras | TBD | Lo valora el usuario tras 4 semanas | Valoración del usuario: ¿usa el relleno cada semana? |
| Retoques tras rellenar | — | ≤ 3 franjas cambiadas por semana | Valoración del usuario en las primeras semanas |

## Risks & dependencies
- **Calidad de los tags** del recetario: franjas, dieta, «pre-gym» y «plan nutricionista» viven en tags; un tag que falta o sobra saca la receta del relleno o la mete donde no toca.
- **Lista de ingredientes base** (R8): buscar por nombre puede fallar con nombres que no mencionan el ingrediente principal.
- **Pocas recetas por franja** con dietas restrictivas (vegano: 11 recetas en total) pueden forzar repeticiones o días que no cumplen.
- Depende de lo existente: macros por día (#10), tolerancia (#49), raciones (#29), favoritas (#20), valoración (#111), Deshacer de «Copiar semana anterior» (#53).

## Open questions
- [ ] Contenido exacto de la lista cerrada de ingredientes base (R8): engineering propone en la tech design y el usuario la confirma.
- [ ] Si no hay recetas suficientes para no repetir (R7), ¿se repite o se deja la franja vacía? El criterio de R7 propone repetir; confirmar. (usuario)
- [ ] Franja sin ninguna receta posible (alergias, dieta, «no me gusta»): ¿queda vacía y el día cuenta como no cumplido en el aviso? (usuario)
- [ ] Franja con una receta borrada del recetario: ¿cuenta como ocupada (no se toca) o como vacía (se rellena)? (usuario)
