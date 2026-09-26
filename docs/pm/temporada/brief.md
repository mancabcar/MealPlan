# Frutas y verduras de temporada y recetas que las aprovechan
_Status: parked · Updated: 2026-09-26 · Issue: [#34](https://github.com/mancabcar/MealPlan/issues/34) · Prototype: [canvas](https://claude.ai/artifact/Ej1uFXxDYUsXWHFfoQY7Ts)_

## Follow-ups
- Lista de la compra: marcar los productos de temporada (o sugerir cambiar uno de fuera de temporada) cuando la lista se genera desde el plan ([lista-compra](../lista-compra/brief.md)).
- Autocompletar la semana con IA ([#15](https://github.com/mancabcar/MealPlan/issues/15)): usar la temporada como una señal más del prompt cuando se construya.
- Temporada regional (Andalucía frente a la media nacional) si el calendario nacional se queda corto.
- Encaja con [recetas-cocina](../recetas-cocina/brief.md): ambos son formas nuevas de filtrar o destacar dentro de Recetas, así que conviene diseñar juntos la zona de chips y filtros.

## Problem
Manuel (único usuario, en Sevilla, con un plan de nutricionista que pide «consumir frutas y vegetales a diario») necesita saber qué frutas y verduras están de temporada en España cada mes y tener a mano recetas que las usen, porque lo de temporada es más barato, más sabroso y más variado, y hoy la app no lo sabe. Hoy lo hace fuera de la app: mira un calendario de temporada en internet o se guía por lo que ve en el mercado, y luego busca a mano en el recetario, que no ayuda.

**¿Raíz o síntoma?** (Actualizado 2026-09-26: Manuel confirma que el tamaño del recetario no preocupa, porque va a crecer. La recomendación ya no se apoya en generar recetas; ver Recommended bet.) Parte síntoma. Al contar los ingredientes de las 40 recetas de `src/data/recipes.json` (2026-09-26), casi toda la verdura es de las de todo el año: cebolla (12 recetas), ajo (11), tomate (11), pimiento (8), zanahoria (6), patata (4). Lo que de verdad define el otoño y el invierno en España (calabaza 1, boniato 0, caqui 0, granada 0, mandarina 0, alcachofa 0, coliflor/col 0, setas silvestres 0) casi no existe. El problema de fondo es que **el recetario no tiene variedad de temporada**. Un marcador de «de temporada» sobre el catálogo actual destacaría siempre las mismas recetas de tomate y pimiento, o nada. Hay que saber qué hay de temporada y también **tener recetas nuevas con eso**.

## Success looks like
- Al abrir Recetas en cualquier mes veo qué está de temporada y al menos 3–5 recetas que usan algo de esa lista como protagonista, no solo de guarnición (ni cebolla ni ajo).
- Durante un mes, al menos una o dos comidas por semana del Plan usan un producto de temporada que antes no aparecía en el recetario.
- El recetario gana variedad con el tiempo: cada mes entran 2–3 recetas nuevas de temporada que se quedan guardadas.

## Constraints & assumptions
- App web Next.js 16, sin backend; los datos viven en localStorage. El calendario de temporada tiene que ser un dato estático del bundle (un JSON), no una API.
- Fuente del calendario: calendarios públicos de temporada en España (MAPA, Mercasa / campañas «alimentos de temporada»). Unos 60–80 productos × 12 meses. Supuesto: con el calendario nacional basta; el regional queda como follow-up.
- Los ingredientes de las recetas son texto libre en español («1/2 calabacín»). Casar productos con recetas es cuestión de palabras clave, con el mismo enfoque que `src/lib/shopping/classify.ts`. No hace falta modelo de ingredientes.
- Hay que excluir de la señal los básicos de todo el año (cebolla, ajo, patata, limón…) o tratarlos aparte. Si no, «de temporada» no significa nada.
- La generación con IA ya existe (`/api/recipes`, `src/lib/recipePrompt.ts`) y respeta alergias, dieta e ingredientes que no le gustan. Añadirle la temporada es una línea más de contexto.
- Supuesto: «mes» es el mes actual del dispositivo, sin elegir región ni hemisferio.

## Directions considered
### A. Etiqueta «De temporada»: el mínimo
Un JSON con el calendario y una función que marca con un chip las recetas del recetario que llevan algún producto de temporada del mes (sin contar los básicos), más un chip de filtro «De temporada» en Recetas. No añade pantallas. **Risk:** con el catálogo actual el filtro sale casi vacío en otoño e invierno y lleno de tomate y pimiento en verano, así que se deja de usar en dos semanas.

### B. «Este mes» en Recetas: calendario + destacadas + generar
Arriba de Recetas, una franja «De temporada en octubre» con los productos del mes (emoji + nombre). Debajo, las recetas del recetario que usan alguno, ordenadas por cuántos productos de temporada llevan. Si hay pocas, un botón «Sugerir receta de temporada» llama a la IA con los productos del mes como ingredientes preferidos y la guarda en el recetario como cualquier otra. Tocar un producto filtra las recetas que lo llevan, y si no hay ninguna ofrece generar una con él. **Risk:** que la IA genere recetas mediocres o repetitivas con el mismo producto; depende de la calidad del prompt.

### C. Solo IA, sin marcar el catálogo
No tocar la lista de recetas. El botón «Sugerir con IA» que ya existe pasa a usar siempre la temporada del mes como contexto («usa preferentemente: calabaza, boniato, setas…»), y se añade una pequeña línea informativa «De temporada: …» en Recetas. **Risk:** la temporada queda escondida: si no se pulsa el botón, no se ve, y no responde a «qué hay de temporada».

### D. La temporada como señal en toda la app: la ambiciosa
Tarjeta mensual en Inicio, sección en Recetas, el Plan semanal ordena las recetas de temporada primero al elegir franja, la lista de la compra marca lo de temporada y avisa de lo que no lo está, y al empezar el mes se ofrece «generar 3 recetas del mes». **Risk:** mucho esfuerzo repartido por cuatro pantallas antes de saber si la señal importa; además, la lista de la compra y el autocompletado (#15) todavía están en movimiento.

### E. Empezar por el producto: el mercado primero
En vez de «recetas destacadas», una pestaña o página «Temporada» con el calendario del año (12 meses × productos, con el mes actual resaltado). Tocar un producto lleva a «recetas con esto», o las genera. Imita cómo se compra de verdad: se ve algo bueno en el mercado y se busca qué hacer con ello. **Risk:** es una pantalla de consulta más que una recomendación; podría acabar como un póster que se mira una vez.

### F. Contraria: «¿qué hay hoy en tu despensa?» en vez de calendario
Olvidar el calendario y deducir la temporada de lo que ya está en la despensa y en la compra: si lo compró, es que estaba bueno y barato. Priorizar recetas con eso. **Risk:** no responde a la pregunta del usuario (saber qué está de temporada) y se solapa con [#16](https://github.com/mancabcar/MealPlan/issues/16) (aprovechar lo que caduca). La descarto como apuesta, pero sirve para recordar que la temporada ya se nota en el mercado.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Etiqueta «De temporada» | Low | Low | High | Que el recetario actual tenga recetas de temporada que destacar (el recuento dice que no) |
| B. «Este mes» + destacadas + generar | High | Med | Med | Que la IA con los productos del mes genere recetas que apetezca cocinar y guardar |
| C. Solo IA | Med | Low | Med | Que el usuario pulse el botón sin ver antes qué hay de temporada |
| D. Señal en toda la app | High | High | Low | Que la temporada importe lo bastante como para tocar Plan, Compra e Inicio |
| E. Calendario del año | Med | Med | Med | Que se vuelva a consultar tras la primera vez |
| F. Deducir de la despensa | Low | Med | Low | Que lo comprado represente la temporada |

## Recommended bet
**B. «Este mes» en Recetas**, con el calendario en JSON y el casado por palabras clave de A como base.

Por qué: responde a las dos mitades de la petición (saber qué hay de temporada y ver recetas con eso) en la pantalla donde ya se eligen recetas. **Decisión de Manuel (2026-09-26):** el tamaño actual del recetario no preocupa porque va a crecer (recetas propias [#18](https://github.com/mancabcar/MealPlan/issues/18), importar desde URL [#19](https://github.com/mancabcar/MealPlan/issues/19), IA). Por eso el centro de la apuesta es **el calendario y las recetas destacadas**. Generar con IA una receta de temporada queda como apoyo para cuando hay pocas coincidencias, no como el motor. La temporada se calcula siempre al vuelo a partir de los ingredientes, así que cualquier receta que entre por cualquier vía queda destacada sola en su mes.

Descarto D por ahora: es B más tres superficies, y conviene aprender primero con una. E queda como una vista secundaria dentro de B («ver calendario completo»), no como la apuesta.

**Qué me haría cambiar de opinión:** si tras un mes se mira la franja pero no se planifican más recetas de temporada, el valor está en saber qué hay (E o una tarjeta informativa), no en destacar recetas. Si el casado por palabras clave da falsos positivos molestos («tomate frito» de bote en enero), habrá que marcar a mano los ingredientes de temporada de cada receta.

**Prueba más barata de la suposición más arriesgada:** el prototipo, con los productos reales de octubre y las recetas reales que casan, para ver si la franja se entiende como «lo que está bueno ahora» y si las destacadas apetecen.

## What to prototype
- **Recetas con la franja «Este mes»** (octubre, con datos reales): productos del mes como chips con emoji y recetas destacadas debajo. Las del catálogo que casan hoy serán pocas, y eso tiene que verse.
- **Estado «pocas recetas de temporada»**: 0–1 coincidencias y el botón «Sugerir receta de temporada».
- **Tocar un producto** (p. ej. calabaza): recetas que lo llevan, o un estado vacío con «Generar una receta con calabaza».
- **Receta generada**: detalle con badge «De temporada · calabaza, boniato» y guardada en el recetario.
- (Opcional) **Calendario completo**: 12 meses × productos, el mes actual resaltado.

Preguntas que debe responder el prototipo: ¿la franja se entiende como «esto es lo que está bueno ahora» y no como un anuncio? ¿El vacío de recetas se lee como una invitación a generar (igual que el vacío de «India» en recetas-cocina) y no como un fallo? ¿Qué ocupa más: los productos o las recetas?

## Prototype
_Design: https://claude.ai/artifact/Ej1uFXxDYUsXWHFfoQY7Ts · 2026-09-26_
- Screens: 1 Recetas con la franja «De temporada · Octubre» (verduras y frutas con «empieza / últimas», enlace al calendario), «Destacadas este mes» en carrusel y chip de filtro «De temporada» en la lista · 2 Producto: calabaza (barra de 12 meses, recetas con calabaza, «Más ideas con calabaza» con IA como botón secundario) · 3 Producto sin recetas: caqui (estado vacío con «Sugerir receta con caqui» y nota de comerlo solo en la media mañana) · 4 Detalle de receta con badge «De temporada en octubre» e ingredientes de temporada marcados · 5 Calendario completo (verduras / frutas × 12 meses, mes actual resaltado).
- Decisions made while prototyping (ASSUMPTIONs):
  - La franja vive arriba de Recetas; ni en Inicio ni en una pestaña nueva.
  - Verduras y frutas separadas; los meses de transición se marcan como «empieza» / «últimas».
  - «Destacadas» = recetas con algún producto del mes, sin contar básicos (cebolla, ajo, patata, limón, zanahoria) ni champiñón de cultivo; ordenadas por nº de productos de temporada.
  - Cada receta muestra qué productos de temporada lleva; el badge se calcula al vuelo según el mes.
  - Cada producto tiene su página (barra de 12 meses + recetas). La IA es secundaria salvo en el estado vacío, donde es la acción principal.
  - Calendario nacional, estático en la app; los datos del prototipo son orientativos y la fuente exacta se decide en la spec.
  - La fruta sugiere también comerla sola (media mañana del plan de la nutricionista).
- What to learn from testing it: si la franja se entiende como «lo que está bueno ahora» y no como un anuncio; si las destacadas dan ganas de planificarlas; si la página de producto y el calendario completo aportan o sobran (candidatos a recortar en la spec); si el estado vacío invita a generar en vez de parecer un fallo.

## Open questions
- Aparcado por Manuel el 2026-09-26, después del prototipo y antes de la spec. Para retomarlo: revisar el prototipo y seguir con pm-spec.
- ¿Frutas y verduras juntas o separadas? La fruta se come sola (media mañana del plan) más que en recetas; quizá la fruta solo se muestra y la verdura es la que empuja recetas.
- ¿Qué productos cuentan como «básicos de todo el año» y se excluyen? Hace falta una lista explícita (cebolla, ajo, patata, limón, zanahoria…).
- Mes de transición: ¿se muestra «empieza» o «último mes» (p. ej. «últimas brevas», «primeras mandarinas»)? Los calendarios públicos distinguen temporada plena y parcial.
- ¿Las recetas generadas de temporada llevan una etiqueta en `tags` (p. ej. «temporada») o la temporada se calcula siempre al vuelo a partir de los ingredientes? Al vuelo es más honesto, porque una receta de calabaza deja de ser «de temporada» en junio.
- ¿Nacional o Andalucía? Supuesto: nacional para empezar.
