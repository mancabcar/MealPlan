# Frutas y verduras de temporada y recetas destacadas: Spec
_Status: Draft · Owner: Manuel · Updated: 2026-10-05_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/Ej1uFXxDYUsXWHFfoQY7Ts) · [issue #34](https://github.com/mancabcar/MealPlan/issues/34)_

## TL;DR
La app no dice qué frutas y verduras están de temporada en España ni qué recetas las aprovechan, así que hoy se mira un calendario fuera y se busca a mano en el recetario. Vamos a añadir a Recetas una franja «De temporada · <mes>», recetas destacadas del mes, un filtro, la temporada visible en cada receta y una página por producto, todo calculado al vuelo a partir del mes y de los ingredientes. Sabremos que funciona si, en un mes de uso, el Plan incluye una o dos comidas por semana con un producto de temporada que antes no aparecía (revisión manual).

## Problem
Manuel (único usuario, en Sevilla, con un plan de nutricionista que pide frutas y verduras a diario) quiere comer lo de temporada, que es más barato, más sabroso y más variado. Hoy consulta un calendario externo o se guía por el mercado, y luego busca recetas a mano. El recetario ya tiene 107 recetas y va a crecer (recetas propias, importación por URL, IA), así que la temporada tiene que destacar sola lo que entre.

## Goals
- Ver de un vistazo qué frutas y verduras están de temporada este mes, y cuáles empiezan o terminan.
- Encontrar en Recetas las que usan alguno de esos productos, sin contar los básicos de todo el año.
- Saber qué productos de temporada lleva cada receta.
- Consultar cualquier producto: en qué meses está y qué recetas lo llevan, o generar una con IA si no hay ninguna.
- Que una receta nueva, venga de donde venga, quede destacada en su mes sin tocar nada.

## Non-goals
- Temporada regional (Andalucía): se usa el calendario nacional.
- Elegir otro mes que no sea el actual en Recetas.
- Guardar la temporada como tag en las recetas: se calcula siempre al vuelo.
- Tocar Plan, Inicio, lista de la compra o autocompletar con IA ([#15](https://github.com/mancabcar/MealPlan/issues/15)).
- Fotos de producto o de receta.
- Distinguir conservas o procesados al casar ingredientes («tomate frito» cuenta como tomate).
- Métricas instrumentadas dentro de la app.

## Users & key scenarios
Usuario único, en la app web (móvil o escritorio), con datos en localStorage.
1. **Planificar la semana en octubre**: abre Recetas, ve los productos del mes y las destacadas, y elige una receta con calabaza.
2. **Ver qué hacer con algo del mercado**: toca «caqui» en la franja. No hay recetas, así que pide a la IA «Sugerir receta con caqui».
3. **Filtrar el recetario**: activa el chip «De temporada» y ve solo las recetas con productos del mes, cada una indicando cuáles lleva.
4. **Mirar el año**: abre el calendario completo para ver cuándo empieza o acaba un producto.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Recetas muestra una franja «De temporada · <mes actual>» con los productos del mes separados en verduras y frutas. En el primer mes de su ventana un producto lleva la marca «empieza» y en el último «últimas». | Must |
| R2 | Recetas muestra «Destacadas este mes»: las 10 recetas con más productos de temporada del mes. No cuentan los básicos (cebolla, ajo, patata, limón, zanahoria, champiñón de cultivo). Empates: favoritas primero, luego A–Z. | Must |
| R3 | La lista de Recetas tiene un chip de filtro «De temporada» que deja solo las recetas con algún producto de temporada (mismo criterio que R2). Cada receta, en la lista y en el detalle, indica qué productos de temporada lleva. | Must |
| R4 | Cada producto tiene una página con una barra de 12 meses (mes actual resaltado) y las recetas que lo llevan. Se abre desde la franja y desde los productos de temporada de una receta. | Must |
| R5 | Si un producto no tiene recetas, su página muestra un estado vacío con la acción principal «Sugerir receta con <producto>». Si tiene recetas, la IA queda como acción secundaria («Más ideas con <producto>»). La IA genera, guarda y abre la receta igual que la generación actual, con el producto como ingrediente preferido y respetando alergias y dieta. | Must |
| R6 | La temporada se calcula al vuelo con el mes del dispositivo y un calendario nacional estático incluido en la app. No se guarda nada en las recetas. | Must |
| R7 | Las recetas con alérgenos del perfil siguen mostrando su aviso en todas las vistas nuevas. | Must |
| R8 | Calendario completo: tabla de verduras y frutas × 12 meses, estática, con el mes actual resaltado. | Should |

## User flows
1. **Planificar (escenario 1)**: Recetas → franja «De temporada · Octubre» (R1) → carrusel «Destacadas este mes» (R2) → toca una receta → detalle con badge «De temporada» y productos marcados (R3).
2. **Producto sin recetas (escenario 2)**: franja → toca «caqui» → página de producto con barra de 12 meses y estado vacío (R4, R5) → «Sugerir receta con caqui» → receta generada y guardada → se abre su detalle.
3. **Filtrar (escenario 3)**: Recetas → chip «De temporada» → lista filtrada, cada tarjeta con sus productos de temporada (R3).
4. **Calendario (escenario 4)**: franja → enlace «Ver calendario completo» → tabla anual (R8).

## Acceptance criteria
**R1**
- Given que estamos en octubre, when abro Recetas, then veo la franja «De temporada · Octubre» con los productos de octubre en dos grupos, verduras y frutas.
- Given un producto cuyo primer mes de temporada es el actual, then lleva la marca «empieza»; si el actual es el último, lleva «últimas»; si su temporada es de un solo mes, no lleva marca.
- Given un producto básico (cebolla, ajo, patata, limón, zanahoria, champiñón de cultivo), then no aparece en la franja; solo en el calendario completo.
- Given que cambia el mes del dispositivo, when recargo Recetas, then la franja muestra los productos del nuevo mes.

**R2**
- Given octubre, then «Destacadas este mes» contiene solo recetas con al menos un producto de octubre que no sea uno de los 6 básicos, y nunca más de 10.
- Given dos recetas con distinto nº de productos de temporada, then la de más productos va antes; con igual nº, primero las favoritas y después por nombre A–Z.
- Given que ninguna receta casa, then la sección «Destacadas» no muestra tarjetas vacías ni rota (se oculta o muestra un mensaje breve).

**R3**
- Given el chip «De temporada» activo, then la lista solo tiene las recetas que usarían «Destacadas» sin el límite de 10, y se combina con los demás filtros (favoritas, «Usa lo que tengo», búsqueda).
- Given una receta con calabaza en octubre, then su tarjeta y su detalle indican «calabaza» como producto de temporada.
- Given una receta nueva (IA, propia o importada) que lleva un producto de temporada, when se guarda, then aparece en «Destacadas» y en el filtro sin más pasos.

**R4**
- Given que toco un producto de la franja, then se abre su página con la barra de 12 meses (meses de temporada marcados, mes actual resaltado) y la lista de recetas que lo llevan.
- Given una receta con productos de temporada, when toco uno, then se abre la página de ese producto.

**R5**
- Given un producto sin recetas, when abro su página, then veo un estado vacío con «Sugerir receta con <producto>» como acción principal.
- Given un producto con recetas, then no hay estado vacío y la IA aparece como acción secundaria «Más ideas con <producto>».
- Given que pulso la acción de IA, when la generación termina, then la receta queda guardada en el recetario y se abre su detalle; la petición incluye el producto como ingrediente preferido y respeta alergias y dieta del perfil.
- Given que la generación falla, then veo un mensaje de error y no se guarda nada.

**R6**
- Given cualquier receta, then no hay ningún campo nuevo guardado en ella por esta función.
- Given un producto del calendario, then su temporada sale solo del dato estático y del mes del dispositivo.

**R7**
- Given una receta con un alérgeno del perfil, then muestra el mismo aviso que en el resto de Recetas dentro de «Destacadas», del filtro y de la página de producto.

**R8** (Should)
- Given el calendario completo, then veo verduras y frutas × 12 meses con el mes actual resaltado.

## Edge cases
- Producto fuera de temporada en la ventana que cruza el cambio de año (p. ej. noviembre a febrero): la ventana de meses debe tratarse como circular.
- Recetas con ingredientes en texto libre («1/2 calabacín»): el casado es por palabra clave, con falsos positivos asumidos con conservas («tomate frito»).
- Un producto de temporada que también es un básico (zanahoria, patata) no aparece en destacadas ni en el filtro, pero puede aparecer en la franja si el calendario lo lista (ver Open questions).
- Receta con varias apariciones del mismo producto: cuenta una sola vez.
- Recetario con muy pocas coincidencias el mes que toca: las destacadas son pocas y no se rellenan con otras.
- Sin red: todo funciona salvo la acción de IA.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Comidas por semana en el Plan con un producto de temporada que antes no aparecía | TBD | 1–2 por semana durante un mes | Revisión manual del Plan por Manuel (sin instrumentar) |
| Recetas nuevas de temporada guardadas por mes | TBD | 2–3 (del brief) | Revisión manual del recetario |

## Risks & dependencies
- Calidad del calendario: hay que transcribirlo de fuentes públicas (MAPA/Mercasa), unos 60–80 productos; los datos del prototipo eran orientativos. Revisión de Manuel antes de dar el dato por bueno.
- Falsos positivos del casado por palabra clave («tomate frito», «col» dentro de otras palabras). Se asumen y se corrigen ajustando palabras clave.
- La IA puede generar recetas mediocres o repetitivas con un producto; depende del prompt de `src/lib/recipePrompt.ts`.
- Depende de [#20](https://github.com/mancabcar/MealPlan/issues/20) (favoritos y filtros ya en Recetas) y de la generación existente (`/api/recipes`). Comparte la zona de chips con [recetas-cocina](../recetas-cocina/brief.md).

## Open questions
- [x] ¿Qué marca lleva un producto con una ventana de un solo mes? Resuelto el 2026-10-05: ninguna.
- [x] ¿Los básicos aparecen en la franja y el calendario? Resuelto el 2026-10-05: solo en el calendario completo.
- [x] ¿La acción de IA respeta alergias y dieta? Resuelto: sí, usa la misma generación (`/api/recipes`), que ya las aplica y descarta recetas inseguras; genera una sola receta, la guarda y la abre ([tech.md](tech.md)).
- [ ] ¿Los básicos tienen página de producto al tocarlos en el calendario? Por defecto no se enlazan. (Manuel)
