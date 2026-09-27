# Base de datos de alimentos: buscar por nombre y registrar por gramos
_Status: prototype · Updated: 2026-09-27 · Issue: [#13](https://github.com/mancabcar/MealPlan/issues/13) (@mancabcar) · Prototype: [canvas](https://claude.ai/artifact/8TZ5a1jtbR6xst5EvzzBJK)_

## Follow-ups
- Escáner de código de barras para envasados (fuera de esta entrega por decisión del usuario). (brainstorm) → ya cubierto por [#14](https://github.com/mancabcar/MealPlan/issues/14) (depende de #13)
- Combinar varios alimentos con sus gramos en un plato y registrarlo como una sola entrada. (brainstorm) → [#56](https://github.com/mancabcar/MealPlan/issues/56)
- Caché local de los alimentos de Open Food Facts usados, para volver a buscarlos sin red y sin llamar a la API. (brainstorm)
- Editar los gramos de una entrada ya registrada (hoy solo se borran con la ✕). (brainstorm) → [#57](https://github.com/mancabcar/MealPlan/issues/57)
- «Alimento no encontrado → Personalizada» con el nombre ya escrito. (brainstorm)
- Dirección E: escribir en texto libre y que Claude estime los macros. No encaja con «solo fuentes gratuitas». (brainstorm)
- Dirección A: calculadora «por 100 g» en Personalizada para copiar la etiqueta. (brainstorm)
- Ampliar la tabla local más allá de los ~150 alimentos del plan. (brainstorm)

## Problem
Necesito que registrar lo que como fuera de receta, sea un genérico del plan (arroz, pollo, avena, fruta; en crudo o cocido), un envasado de marca o los ingredientes de un plato casero, cueste tan poco como marcar una receta. Hoy calcular sus macros a mano (etiqueta o tabla, más la regla de tres) cuesta tanto que **no lo registro**, y el Diario se queda incompleto.

Hoy, en «Añadir comida» (`src/app/page.tsx`), solo hay dos modos: Receta y Personalizada, que obliga a teclear nombre, kcal, P, C y G. `MealEntry` no guarda ni gramos ni alimento de origen. Los planes nutricionales del usuario (`docs/referencia/`) reparten cantidades en gramos de alimentos genéricos, indicando crudo o cocido («60 g en crudo», «80 g cocidos»).

## Success looks like
- Registro lo que antes saltaba: los días del Diario quedan completos, también con lo que va fuera de receta.

## Constraints & assumptions
- Solo fuentes de datos gratuitas: nada de APIs de pago.
- Los datos del usuario siguen en localStorage. No hay servidor propio con datos del usuario (la sincronización es #22). Un route handler que haga de proxy hacia una API pública sí vale, como `src/app/api/recipes/route.ts`.
- Usable sin red: no es un requisito duro. El criterio del issue se mantiene: sin red o si la API falla, se muestra un error y Personalizada sigue disponible.
- Un alimento por entrada. Combinar platos queda fuera.
- Crudo y cocido son alimentos distintos (p. ej., «Arroz blanco, crudo» y «Arroz blanco, cocido»), cada uno con sus valores por 100 g.
- BEDCA no tiene una API pública documentada (solo la web y un endpoint XML no oficial), y su licencia de reutilización está por confirmar. Por eso los genéricos se sirven desde una tabla local empaquetada con la app.
- Open Food Facts limita la búsqueda a unas 10 peticiones por minuto por IP y pide un User-Agent identificable. Es fuerte en marcas españolas e irregular en genéricos.
- Encaje con #12: «Añadir comida» queda como franja → Recientes → Guardados → pestañas. Este issue añade una pestaña. Como una entrada guarda sus macros, repetirla desde Recientes funciona sin red aunque no haya caché de OFF.
- Sin escáner de código de barras en esta entrega.

## Directions considered
### A. Calculadora por 100 g en Personalizada: lo mínimo
Personalizada gana la opción «por 100 g»: se copian los valores de la etiqueta, se ponen los gramos y la app hace la regla de tres. Con el «Guardar» de #12, se teclea una sola vez. **Risk:** sigue haciendo falta tener la etiqueta o buscar los valores fuera, que es justo lo que hoy hace que no se registre.

### B. Modo «Alimento» con Open Food Facts: el issue tal cual
Una tercera pestaña que busca en OFF a través de un route handler. Se elige un resultado, se ponen los gramos y la app calcula. Lo ya usado queda en caché. **Risk:** para los genéricos del plan, OFF devuelve ruido de marcas y entradas incompletas, y no distingue crudo de cocido.

### C. Tabla local de genéricos (sin red)
Un JSON en el repo con los alimentos habituales en España, crudo y cocido por separado, con valores de BEDCA o USDA. La búsqueda es instantánea y funciona offline. Los envasados siguen por Personalizada. **Risk:** hay que preparar y mantener la tabla, y lo que no esté en ella deja al usuario tirado.

### D. Buscador híbrido: genéricos locales + OFF para marcas (lo ambicioso)
Un solo buscador: primero la tabla local (C) y, debajo, OFF (B) para envasados, todo calculado por gramos. **Risk:** es la opción de más esfuerzo; dos fuentes en una lista pueden confundir, y el límite de peticiones de OFF obliga a buscar al pulsar, no mientras se teclea.

### E. Texto libre estimado por Claude: la contraria
Se escribe «150 g arroz cocido + 120 g pollo a la plancha» y Claude devuelve los macros por línea, que se revisan antes de registrar. También resuelve combinar platos. **Risk:** son estimaciones sin fuente, cada registro gasta API y choca con «solo fuentes gratuitas».

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Calculadora por 100 g | Low | Low | Med | Tener la etiqueta a mano basta para que registre |
| B. Open Food Facts | Med | Med | Med | OFF da buenos resultados para los genéricos del plan |
| C. Tabla local de genéricos | High | Med | Med | ~150–300 alimentos cubren casi todo lo que se come fuera de receta |
| D. Híbrido local + OFF | High | High | Med | Mezclar dos fuentes en un buscador no confunde |
| E. Texto libre con Claude | High | Med | Low | Fiarse de macros estimados sin fuente, y el coste de la API no importa |

Puntuaciones confirmadas por el usuario.

## Recommended bet
**D, con la tabla local como base**, elegida por el usuario (coincide con la recomendación de Claude).

- **Tercera pestaña «Alimento»** en «Añadir comida»: Receta / Alimento / Personalizada, bajo Recientes y Guardados de #12.
- **Un buscador, dos fuentes:** arriba los resultados de una tabla local de **~150 genéricos centrada en el plan del usuario** (alimentos de los planes de agosto y septiembre y básicos de despensa, crudo y cocido como alimentos distintos). Debajo, los de **Open Food Facts** para envasados de marca, a través de un route handler de servidor.
- **Valores de la tabla:** BEDCA primero y USDA si falta. Cada alimento lleva anotada su fuente.
- **Cantidad en gramos o en unidades** («1 huevo», «1 yogur»), con el peso típico de cada unidad.
- **La entrada guarda nombre + gramos + macros calculados.** En el Diario se ve «150 g», y repetirla desde Recientes usa los mismos gramos.

Por qué: la mayoría de lo que se come fuera de receta son genéricos del plan, y ahí una tabla local gana a OFF en calidad, velocidad, crudo/cocido y funcionamiento sin red. OFF cubre los envasados de marca, que el usuario también registra.

Qué nos haría cambiar de opinión: que lo que más se salta sean envasados (adelantaría B como fuente principal), o que la mezcla de dos fuentes en una lista confunda en el prototipo (separarlas o quedarse con C en v1).

## What to prototype
La pestaña «Alimento» en móvil, dentro del encaje de #12: búsqueda con resultados locales y de OFF, elegir un resultado, indicar gramos o unidades con los macros calculados en vivo, y los estados de error de OFF (sin red, límite de peticiones) con Personalizada a mano.

Pregunta que debe responder: **¿se distingue lo local de lo de OFF sin confundir?** Incluye cómo se ven crudo y cocido en los resultados y si el paso de los gramos o unidades es cómodo en móvil.

## Open questions
- ¿Se busca en OFF al pulsar «Buscar» o con debounce mientras se teclea? Con el límite de ~10 peticiones por minuto, lo primero es lo seguro.
- ¿Qué unidades tiene cada alimento y de dónde sale su peso típico? En los productos de OFF, ¿se usa su `serving_size` cuando lo trae?
- ¿La licencia de BEDCA permite empaquetar sus valores en la app? Si no, ¿todo desde USDA?
- ¿Cómo se marca en el Diario una entrada de alimento frente a una personalizada (p. ej., «150 g» junto al nombre)? ¿Tiene que verse la fuente?
- ¿Qué hacemos con los productos de OFF a los que les faltan macros por 100 g: se ocultan o se muestran marcados?

## Prototype
_Design: https://claude.ai/artifact/8TZ5a1jtbR6xst5EvzzBJK · 2026-09-27_
- Screens: `0 · Escribiendo: solo básicos`, `1A · Resultados en dos bloques` y `1B · Una lista con etiqueta de fuente` (variantes a comparar), `2 · Cantidad en gramos`, `3 · Cantidad en unidades`, `4A · Marcas: sin conexión`, `4B · Marcas: demasiadas búsquedas`, `5 · Registrado en el Diario`. Móvil (390 px), tema oscuro de la app, franja Almuerzo, con la línea del pliegue a 844 px.
- Decisions (confirmed by the user):
  - Tercera pestaña «Alimento» (Receta / Alimento / Personalizada), con Recientes y Guardados de #12 encima, tal cual.
  - Los básicos (tabla local) salen al escribir; Open Food Facts solo al pulsar «Buscar «…» en productos de marca», por el límite de ~10 búsquedas por minuto.
  - Crudo y cocido son filas distintas. Cada fila muestra nombre + kcal/100 g (+ marca en OFF).
  - Al tocar un resultado, la lista se sustituye por la tarjeta del alimento, con «← Otro alimento» para volver.
  - Cantidad: campo de gramos + chips rápidos, con selector gramos/unidades cuando el alimento tiene unidad; macros en vivo.
  - Si OFF falla, los básicos siguen y el error se queda en el bloque de marcas, con Reintentar; Personalizada sigue a mano.
  - La entrada guarda nombre + gramos + macros; en el Diario se ve «150 g» junto al nombre.
- Pending ASSUMPTIONs:
  - Se añadió la pantalla `0` (antes de buscar en marcas) y el error de OFF se partió en `4A` y `4B`.
  - El botón de marcas va debajo de los básicos y repite la búsqueda entre comillas.
  - Máximo 4–5 resultados de OFF, con un pie de licencia ODbL y «revisa la etiqueta».
  - Chips 50/100/150/200 g (y 1–4 ud); macros redondeados a entero, grasa con un decimal si es < 1 g; el botón dice «Añadir 150 g».
  - El selector Gramos/Unidades solo aparece si el alimento tiene unidad y abre en Unidades; se muestra el peso equivalente.
  - Texto de los errores; al llegar al límite, el botón de marcas se desactiva con cuenta atrás.
  - Aviso «Añadido a Almuerzo · 150 g · Deshacer»; el Diario no muestra la fuente.
  - Marcas y productos de OFF inventados; valores de la tabla aproximados.
- What to learn from testing it: si se distingue lo local de lo de marca (1A frente a 1B) y si el paso de gramos o unidades es cómodo en móvil.
