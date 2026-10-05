# Frutas y verduras de temporada y recetas destacadas: Review
_PR: [#130](https://github.com/mancabcar/MealPlan/pull/130) · Reviewed: 2026-10-05 · Verdict: ⚠️ approved with follow-ups_

## Summary
Los 8 requisitos de la spec (7 Must y 1 Should) están implementados y cubiertos por tests automáticos; no hay cambios ajenos a la spec y las divergencias con `tech.md` están documentadas con su razón. El code-review (esfuerzo high) solo encontró fallos menores de pulido. Veredicto confirmado por Manuel: se puede mergear, con los hallazgos como seguimientos. Antes de usar la sugerencia con IA hay que redesplegar `server/`.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 Franja «De temporada · mes», «empieza» / «últimas» | ✅ Done | src/lib/seasonal.ts:32, src/components/recetas/temporada/SeasonStrip.tsx | ✅ unit + e2e |
| R2 «Destacadas este mes» (top 10, sin básicos, empate favoritas y A–Z) | ✅ Done | src/lib/seasonal.ts:79, FeaturedRecipes.tsx, src/app/recetas/page.tsx:404 | ✅ unit + e2e |
| R3 Chip de filtro y productos en tarjeta y detalle | ✅ Done | src/app/recetas/page.tsx:60, SeasonalChips.tsx, RecipeCard.tsx | ✅ unit + e2e |
| R4 Página de producto con 12 meses y recetas | ✅ Done | src/app/recetas/page.tsx:352, ProductView.tsx, src/lib/useSeasonView.ts | ✅ e2e |
| R5 Vacío con IA (1 receta, guarda y abre) | ✅ Done | src/app/recetas/page.tsx:153, src/lib/recipePrompt.ts:41, server/app/api/recipes/route.ts:34 | ✅ unit + servidor + e2e (IA simulada) |
| R6 Calculado al vuelo, calendario estático | ✅ Done | src/lib/seasonal.ts:26, src/data/seasonal.json | ✅ unit |
| R7 Aviso de alérgenos en las vistas nuevas | ✅ Done | FeaturedRecipes.tsx, RecipeCard.tsx | ✅ e2e |
| R8 Calendario completo (Should) | ✅ Done | src/app/recetas/page.tsx:350, SeasonCalendar.tsx | ✅ e2e |

Evidencia: 1280 tests unit, 185 de servidor y 489 e2e en verde (5 saltados ya existentes) al abrir el PR; `tsc`, ESLint y el build estático correctos.

## Blocking
Ninguno.

## Non-blocking
1. **El error de la IA se arrastra entre vistas** (src/app/recetas/page.tsx:123): el estado `error` es compartido por la lista y la página de producto y no se limpia al navegar. Un fallo en una vista aparece en la otra tras «Volver». → Limpiar el error al cambiar de vista o guardarlo por vista.
2. **El detalle puede abrirse tras salir de la vista** (src/app/recetas/page.tsx:161): si el usuario sale de la página de producto mientras la IA genera, `selectRecipe(generated[0])` abre el detalle de la receta nueva sin que lo haya pedido. La receta sí se guarda. → Ignorar el resultado si la vista ya no es la del producto, o avisar con un aviso en vez de saltar. (Plausible, no reproducido.)
3. **El e2e de orden de «Destacadas» depende de las recetas semilla** (tests/e2e/temporada.spec.ts:107): asume que ninguna semilla tiene 5 productos de octubre. Si el catálogo crece, el test puede fallar sin que el código esté mal. → Fijar el contenido con recetas propias o comprobar el orden relativo entre fixtures.
4. **Pregunta abierta de la spec:** los básicos no tienen página de producto desde el calendario; hoy no se enlazan.
5. **Calendario a revisar:** `src/data/seasonal.json` (57 productos, temporada plena) es una curación del autor de la rama; Manuel lo revisa antes de darlo por bueno.

Decisión del usuario sobre la spec R1: lechuga y rábano tienen dos ventanas al año (mar–jun y oct–nov); cada ventana cuenta por separado para «empieza» / «últimas».

## Code review findings
Los 3 hallazgos de la pasada 1 (código y test) están en «Non-blocking» (puntos 1–3). Nota informativa, sin acción: `safePreferredIngredient` acepta cualquier texto de una línea de hasta 40 caracteres; las alergias siguen protegidas porque el servidor descarta después las recetas que las incumplen.
