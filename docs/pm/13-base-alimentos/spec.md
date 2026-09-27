# Base de datos de alimentos: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-09-27_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/8TZ5a1jtbR6xst5EvzzBJK) · [issue #13](https://github.com/mancabcar/MealPlan/issues/13)_

## TL;DR
Lo que como fuera de receta no lo registro, porque calcular sus macros a mano (etiqueta o tabla, más la regla de tres) cuesta demasiado. Añadimos a «Añadir comida» una pestaña «Alimento»: se busca por nombre en una tabla local de genéricos del plan y, al pulsar un botón, en Open Food Facts para los productos de marca; se indican gramos o unidades y la app calcula los macros. Habrá funcionado si aparecen entradas de alimento en el Diario cada semana, es decir, si registro lo que antes me saltaba.

## Problem
El usuario sigue un plan nutricional que reparte cantidades en gramos de alimentos genéricos, crudos o cocidos («60 g en crudo», «80 g cocidos»; ver `docs/referencia/`), y además come envasados de marca. Hoy «Añadir comida» (`src/app/page.tsx`) solo tiene dos modos: Receta y Personalizada, que obliga a teclear nombre, kcal, P, C y G. Para todo lo que no es receta hay que buscar los valores por 100 g y hacer la regla de tres, así que no se registra y el Diario queda incompleto. `MealEntry` no guarda ni gramos ni alimento de origen.

## Goals
- Registrar un genérico del plan o un envasado de marca buscándolo por nombre e indicando gramos o unidades, sin calcular macros a mano.

## Non-goals
- Escáner de código de barras (→ [#14](https://github.com/mancabcar/MealPlan/issues/14)).
- Combinar varios alimentos en un plato y registrarlo como una sola entrada (→ [#56](https://github.com/mancabcar/MealPlan/issues/56)).
- Editar los gramos de una entrada ya registrada (→ [#57](https://github.com/mancabcar/MealPlan/issues/57)).
- Caché local de los productos de OFF, para buscar marcas sin red.
- Añadir o editar alimentos de la tabla local desde la app.
- Buscar alimentos fuera de «Añadir comida» (Recetas, Plan, Despensa, lista de la compra).
- Estimar macros con Claude a partir de texto libre.
- Calculadora «por 100 g» en Personalizada.
- Guardados/Favoritos (→ [#58](https://github.com/mancabcar/MealPlan/issues/58)).

## Users & key scenarios
Usuario único de la app, que sigue un plan nutricional y registra a diario.
- **Genérico del plan:** en el almuerzo come 80 g de arroz cocido. Escribe «arroz coc», toca «Arroz blanco, cocido», pulsa el chip 80 g… o escribe 80, y añade.
- **Por unidades:** desayuna 2 huevos. Busca «huevo», el alimento abre en Unidades, toca «2 ud» y ve el peso equivalente.
- **Envasado de marca:** un yogur griego de marca. Busca «yogur griego», pulsa «Buscar «yogur griego» en productos de marca», elige el suyo y registra 125 g.
- **Sin red:** la búsqueda de marcas falla; los básicos siguen funcionando y puede registrar a mano en Personalizada.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | «Añadir comida» tiene una tercera pestaña «Alimento» (Receta / Alimento / Personalizada), debajo de Recientes (#12) cuando exista. | Must |
| R2 | Al escribir 2 letras o más, el bloque «Básicos» muestra coincidencias de la tabla local: casa si el nombre contiene todas las palabras escritas, sin distinguir tildes ni mayúsculas; primero las que empiezan por lo escrito; hasta 8 filas. Crudo y cocido son filas distintas. Cada fila muestra nombre + kcal por 100 g. | Must |
| R3 | La app trae empaquetada una tabla de ~150 alimentos genéricos, centrada en los alimentos de los planes de agosto y septiembre y en básicos de despensa, con kcal, P, C y G por 100 g. Cada alimento anota su fuente (BEDCA o USDA), que no se muestra en la interfaz. Los que tienen una unidad natural (huevo, pieza de fruta, rebanada, yogur…) llevan su peso típico. | Must |
| R4 | Bajo los básicos hay un botón «Buscar «…» en productos de marca», que repite lo escrito entre comillas. Al pulsarlo, se busca en Open Food Facts solo entre productos vendidos en España, con el nombre en español cuando exista, y se muestra el bloque «Productos de marca» con hasta 5 resultados (nombre, marca, kcal por 100 g) y un pie con la licencia ODbL y «revisa la etiqueta». Los productos a los que les falten kcal, P, C o G por 100 g no se muestran. No se busca en OFF mientras se escribe. | Must |
| R5 | Al tocar un resultado, la lista se sustituye por la tarjeta del alimento, con «← Otro alimento» para volver a la búsqueda tal como estaba. | Must |
| R6 | La cantidad se indica en gramos enteros (1–2000) con un campo y chips 50/100/150/200 g. Los macros se recalculan en vivo y se muestran redondeados a entero; la grasa, con un decimal si es menor que 1 g. Fuera de rango, el botón de añadir se desactiva y se muestra un aviso. | Must |
| R7 | Si el alimento tiene unidad (peso típico en la tabla, o `serving_size` en gramos en OFF), aparece un selector Gramos/Unidades que abre en Unidades, con chips 1–4 ud y cantidades de 0,5 a 10 en pasos de 0,5. Se muestra el peso equivalente en gramos. Sin unidad no hay selector. | Should |
| R8 | El botón «Añadir <cantidad>» (p. ej., «Añadir 150 g», «Añadir 2 ud») crea una entrada en la fecha del Diario y la franja elegidas con: nombre (el del básico, o «Producto · Marca» en OFF), alimento de origen, gramos, unidades si se usaron, y macros calculados. El formulario se cierra. | Must |
| R9 | En el Diario, una entrada de alimento muestra junto al nombre la cantidad: «150 g», o «2 ud · 120 g» si se registró en unidades. No muestra la fuente. | Must |
| R10 | Al añadir, aparece el aviso «Añadido a <franja> · <cantidad> · Deshacer», con el mismo componente y la misma duración que el de la Despensa. Deshacer quita esa entrada. | Should |
| R11 | Si la búsqueda en OFF falla (sin red, error de la API o límite de peticiones), el error se muestra solo en el bloque de marcas, con «Reintentar»; los básicos, la tarjeta del alimento y la pestaña Personalizada siguen funcionando. | Must |
| R12 | Al alcanzar el límite de peticiones de OFF, el botón de marcas se desactiva y muestra una cuenta atrás hasta que se puede volver a buscar. | Should |
| R13 | Si existe Recientes (#12), las entradas de alimento aparecen en ella. Dos entradas de alimento son «la misma» si tienen el mismo alimento de origen y la misma cantidad (mismos gramos, o mismas unidades). Tocar una crea una entrada nueva con esa misma cantidad y esos macros, sin red. | Should |
| R14 | Bajo los resultados, un enlace «¿No lo encuentras? Añádelo a mano» abre Personalizada con el nombre ya escrito. | Could |

## User flows
**Genérico en gramos** (artboards `0`, `1A`, `2`, `5`)
1. En el Diario, pulsa «Añadir comida», elige la franja y la pestaña «Alimento».
2. Escribe «arroz coc»: el bloque «Básicos» muestra «Arroz blanco, cocido» con sus kcal/100 g (`0 · Escribiendo: solo básicos`).
3. Toca la fila: aparece la tarjeta del alimento (`2 · Cantidad en gramos`).
4. Toca el chip 150 g o escribe la cantidad; los macros se actualizan.
5. Pulsa «Añadir 150 g»: el formulario se cierra, aparece el aviso con Deshacer y la entrada sale en la franja con «150 g» (`5 · Registrado en el Diario`).

**Genérico en unidades** (artboard `3`)
1. Busca «huevo» y toca «Huevo».
2. La tarjeta abre en Unidades; toca «2 ud» y ve el peso equivalente.
3. Pulsa «Añadir 2 ud»: la entrada muestra «2 ud · <g> g».

**Producto de marca** (artboard `1A`)
1. Escribe «yogur griego» y pulsa «Buscar «yogur griego» en productos de marca».
2. Aparece el bloque «Productos de marca», debajo de «Básicos», con hasta 5 productos y el pie de licencia.
3. Toca uno y sigue como en el flujo de gramos (o unidades, si trae `serving_size`).

**Error de OFF** (artboards `4A`, `4B`)
1. Pulsa el botón de marcas sin red: el bloque de marcas muestra el error con «Reintentar»; los básicos siguen ahí.
2. Si se ha alcanzado el límite, el botón se desactiva con una cuenta atrás.
3. Puede registrar a mano en Personalizada.

## Acceptance criteria
**R1**
- Given abro «Añadir comida», then veo las pestañas en el orden Receta / Alimento / Personalizada.
- Given existe Recientes, then la pestaña Alimento está debajo de Recientes.

**R2**
- Given escribo «a», then no se muestra el bloque «Básicos».
- Given escribo «arroz coc», then aparece «Arroz blanco, cocido» y no aparece «Arroz blanco, crudo».
- Given escribo «platano», then aparece «Plátano» (sin distinguir tildes).
- Given escribo «arroz», then «Arroz blanco, crudo» y «Arroz blanco, cocido» son dos filas distintas, cada una con sus kcal/100 g.
- Given hay más de 8 coincidencias, then se muestran 8 filas, primero las que empiezan por lo escrito.
- Given no hay coincidencias, then se muestra «Ningún básico coincide» y, debajo, el botón de marcas.

**R3**
- Given la tabla local, then contiene los alimentos genéricos de los planes de agosto y septiembre de `docs/referencia/`, con crudo y cocido por separado cuando el plan los distingue.
- Given cualquier alimento de la tabla, then tiene kcal, P, C y G por 100 g y una fuente (BEDCA o USDA).
- Given estoy sin red, when busco en básicos, then los resultados salen igual.

**R4**
- Given escribo «yogur griego», when miro el formulario sin pulsar nada más, then no se ha hecho ninguna petición a OFF.
- Given pulso «Buscar «yogur griego» en productos de marca», then aparece el bloque «Productos de marca» debajo de «Básicos» con resultados que tienen macros por 100 g (criterio del issue).
- Given OFF devuelve más de 5 productos válidos, then se muestran 5.
- Given un producto de OFF no trae proteína por 100 g, then no aparece en la lista.
- Given el bloque de marcas tiene resultados, then se ve el pie con la licencia ODbL y «revisa la etiqueta».
- Given OFF no devuelve ningún producto válido, then el bloque de marcas dice que no hay resultados.

**R5**
- Given toco un resultado, then la lista desaparece y veo la tarjeta del alimento.
- Given pulso «← Otro alimento», then vuelvo a la búsqueda con el mismo texto y los mismos resultados.
- Given busqué en marcas, when cambio a Personalizada y vuelvo a Alimento, then veo el mismo texto y los mismos resultados.
- Given busqué en marcas, when cambio el texto, then el bloque de marcas desaparece.

**R6**
- Given un alimento con 130 kcal, 2,7 g P, 28 g C y 0,3 g G por 100 g, when indico 150 g, then la tarjeta muestra 195 kcal, 4 g P, 42 g C y 0,5 g G (criterio del issue: «registrar 150 g calcula correctamente los macros»).
- Given toco el chip 200 g, then el campo pasa a 200 y los macros se recalculan.
- Given escribo 0, 2001 o 12,5, then el botón de añadir está desactivado y se ve un aviso.

**R7**
- Given «Huevo» tiene peso típico, when abro su tarjeta, then está en Unidades y veo los chips 1–4 ud.
- Given elijo 2 ud, then veo el peso equivalente (2 × peso típico) y los macros de ese peso.
- Given escribo 1,5 ud, then es válido; given escribo 0,3 u 11, then el botón se desactiva.
- Given un producto de OFF con `serving_size` en gramos, then tiene selector de unidades; given uno sin él, then solo gramos.
- Given un alimento sin unidad, then no hay selector.

**R8**
- Given la fecha del Diario es D y la franja F, when pulso «Añadir 150 g», then se crea una entrada en D y F con el nombre del alimento, su alimento de origen, 150 g y los macros calculados, y el formulario se cierra.
- Given el alimento viene de OFF, then el nombre guardado es «<producto> · <marca>».
- Given registro en unidades, then la entrada guarda las unidades y los gramos equivalentes.
- Given hago doble toque en «Añadir», then se crea una sola entrada.

**R9**
- Given una entrada de 150 g, then en el Diario se lee «150 g» junto al nombre.
- Given una entrada de 2 ud de 60 g, then se lee «2 ud · 120 g».
- Given cualquier entrada de alimento, then no se muestra la fuente.
- Given las entradas de receta y personalizadas existentes, then se ven igual que antes.

**R10**
- Given añado 150 g en Almuerzo, then aparece «Añadido a Almuerzo · 150 g · Deshacer».
- Given pulso Deshacer, then la entrada desaparece del Diario.

**R11**
- Given estoy sin red, when pulso el botón de marcas, then el bloque de marcas muestra un error con «Reintentar», y los básicos siguen visibles y seleccionables (criterio del issue).
- Given OFF responde con error, then pasa lo mismo.
- Given el error de OFF está a la vista, when cambio a Personalizada, then puedo registrar a mano.
- Given pulso «Reintentar» con la red recuperada, then se muestran los productos.

**R12**
- Given se ha alcanzado el límite de peticiones, then el botón de marcas está desactivado y muestra los segundos que faltan; al llegar a 0, se vuelve a activar.

**R13**
- Given registré 150 g de arroz cocido dos veces, then Recientes lo muestra una sola vez.
- Given registré 100 g y 150 g de arroz cocido, then Recientes muestra dos filas.
- Given estoy sin red, when toco una reciente de un producto de OFF, then se añade con los mismos gramos y macros.

**R14**
- Given escribo «tortilla de mi abuela», when pulso «¿No lo encuentras? Añádelo a mano», then se abre Personalizada con el nombre «tortilla de mi abuela».

## Edge cases
- Cambiar de pestaña (Receta, Personalizada) y volver a Alimento conserva la búsqueda y sus resultados mientras el formulario siga abierto.
- Cambiar el texto después de buscar en marcas oculta el bloque de marcas de la búsqueda anterior; hay que volver a pulsar el botón.
- `serving_size` de OFF en otras unidades (ml, «1 bote») no cuenta como unidad: ese producto va solo en gramos.
- Un producto de OFF sin marca se guarda solo con el nombre del producto.
- Las copias de seguridad y los datos guardados con entradas antiguas (sin gramos) siguen funcionando igual.
- Los totales del día, las medias y la adherencia (#11) cuentan las entradas de alimento como cualquier otra, por sus macros.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Entradas de alimento (con gramos) registradas por semana | 0 | TBD | Contarlas en los datos del usuario (localStorage o copia de seguridad), revisión a las 2 semanas del lanzamiento |

## Risks & dependencies
- **Licencia de BEDCA** sin confirmar: si no permite empaquetar sus valores, toda la tabla sale de USDA (ver Open questions).
- **Límite de OFF** (~10 búsquedas por minuto por IP; pide un User-Agent identificable): las peticiones pasan por un route handler de servidor, como `src/app/api/recipes/route.ts`. En Next 16, leer antes la guía de route handlers en `node_modules/next/dist/docs/`.
- **Calidad de OFF:** datos aportados por la comunidad, incompletos o erróneos; de ahí «revisa la etiqueta» y ocultar los productos sin macros.
- **#12 (Recientes)** no está mergeado. #13 funciona sin él; R13 aplica cuando exista.
- **Migración de datos:** `MealEntry` gana campos opcionales (alimento de origen, gramos, unidades); las entradas existentes no cambian.
- Preparar la tabla de ~150 alimentos es trabajo manual de datos, no solo de código.

## Open questions
- [ ] ¿La licencia de BEDCA permite empaquetar sus valores en la app? Si no, todo desde USDA. (Se resuelve en la tech design; no bloquea el spec.)
