# Frutas y verduras de temporada y recetas destacadas: Technical design
_Status: Draft · Updated: 2026-10-05_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Un calendario nacional estático (`src/data/seasonal.json`) y una librería pura (`src/lib/seasonal.ts`) casan los ingredientes de cada receta con los productos del mes actual, siempre al vuelo. La interfaz se queda dentro de `/recetas`: franja, destacadas y chip de filtro en la lista, indicadores en tarjeta y detalle, y dos vistas por parámetro de URL (`?producto=` y `?vista=calendario`). La IA recibe un campo opcional nuevo, `preferredIngredient`, en `server/`. Esfuerzo: M (8 tareas).

## Context
- La app es un export estático (`next.config.ts`: `output: "export"`), con datos en localStorage. `/api/recipes` vive en un proyecto aparte, `server/app/api/recipes/route.ts`, que importa `src/lib/recipePrompt.ts` y `src/lib/allergens.ts`. El cliente lo llama con `apiUrl()` (`src/lib/apiBase.ts`).
- `src/app/recetas/page.tsx` (417 líneas) es un único componente cliente. El detalle de receta es estado local (`selectedId`), no una ruta. Los filtros actuales son «Usa lo que tengo» (`rankByPantry`), «Solo favoritas» y búsqueda (`searchRecipes`, `sortByName` en `src/lib/recipeSearch.ts`), combinados en el `useMemo` de `results`.
- Casado de ingredientes reutilizable: `parseIngredientLine` y `normalizeKey` en `src/lib/shopping/parse.ts`; `classify` en `src/lib/shopping/classify.ts` casa por palabra completa (clave con espacios alrededor). `src/lib/pantryRecipes.ts` es el precedente de cruzar recetas con un dato externo.
- Patrón de estado en URL: `?semana=` con `useSearchParams` dentro de `<Suspense>` (`src/lib/useWeekParam.ts`), necesario por el export estático.
- Tipo `Recipe` en `src/lib/types.ts`: `ingredients: string[]`. Las recetas de IA, propias e importadas ya tienen esta forma, así que no hace falta tocar el modelo.
- Iconos: Lucide (`src/lib/categoryIcons.ts`). Chips: `src/components/ui/Chip.tsx`. Aviso de alérgenos: `src/components/ui/AllergenBadge.tsx`.
- Pruebas: Vitest en `tests/unit`, Playwright en `tests/e2e` (con axe). `signIn` en `tests/e2e/helpers.ts` fija el reloj a `TODAY`, que hoy es septiembre de 2026; los casos de temporada deben fijar su propio mes.

## Approaches considered
### A. Dato estático + librería pura de casado (chosen)
`seasonal.json` con productos y meses; `seasonal.ts` casa por palabra completa con `parseIngredientLine`/`normalizeKey` y deriva todo del mes. · **Pros**: cumple R6 (nada guardado en las recetas), sirve a recetas nuevas por cualquier vía, testeable sin UI, mismo patrón que Despensa→recetas. · **Cons**: falsos positivos con conservas, asumidos en la spec. · **Effort** M
### B. Ampliar `classify.ts`
Añadir temporada a las reglas de pasillo. · **Pros**: un solo sitio de palabras clave. · **Cons**: mezcla pasillos con temporada y acopla la lista de la compra a esta función. · **Effort** M
### C. Tags de temporada guardados en cada receta
Calcular al guardar. · **Pros**: casado una sola vez. · **Cons**: contradice R6 y una receta de calabaza dejaría de serlo en junio sin recalcular. Descartada. · **Effort** M

Elegida A por el usuario, con la razón de que respeta R6 y reutiliza el parser existente.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Dato | `src/data/seasonal.json` (nuevo) | Productos del calendario nacional |
| Tipos | `src/lib/seasonal.ts` | `SeasonalProduct` y `SEASONAL_PRODUCTS` (el JSON tipado); fijado por los tests |
| Lógica | `src/lib/seasonal.ts` (nuevo) | Casado, mes, marcas, destacadas, recetas por producto |
| Param URL | `src/lib/useSeasonView.ts` (nuevo) | `?producto=` y `?vista=` con `useSearchParams` (Suspense) |
| Prompt | `src/lib/recipePrompt.ts` | `buildRecipePrompt` acepta `preferredIngredient` |
| API | `server/app/api/recipes/route.ts` | Lee y valida `preferredIngredient`; `count` ya existe |
| UI | `src/components/recetas/temporada/SeasonStrip.tsx`, `FeaturedRecipes.tsx`, `SeasonalChips.tsx`, `ProductView.tsx`, `SeasonCalendar.tsx` (nuevos) | Franja, destacadas, chips, página de producto, calendario |
| UI | `src/app/recetas/page.tsx` | Chip de filtro, cabecera condicional, indicadores en tarjeta y detalle, vistas por parámetro |
| Tests | `tests/unit/seasonal*.test.ts`, `tests/unit/recipe-prompt.test.ts`, `tests/e2e/temporada.spec.ts` | Ver Testing strategy |

### Data model
Sin cambios en `Recipe` ni en localStorage; no hay migración.
```ts
interface SeasonalProduct {
  id: string;            // slug para la URL: "calabaza"
  name: string;          // "Calabaza"
  kind: "verdura" | "fruta";
  months: number[];      // 1–12, meses de temporada
  keywords: string[];    // normalizados con normalizeKey: ["calabaza"]
  basic?: true;          // cebolla, ajo, patata, limón, zanahoria, champiñón de cultivo
}
```
- Marcas: «empieza» si el mes está y el anterior no (circular); «últimas» si está y el siguiente no. Un producto con un solo mes de temporada no lleva marca; uno con los 12 meses tampoco.
- Los productos `basic` salen solo en el calendario completo; no aparecen en la franja, en destacadas ni en el filtro. El calendario no los enlaza a una página de producto (ver Spec feedback).

### APIs / interfaces
- `currentMonth(): number` (1–12) sobre la misma fecha que `todayStr()`, para que el reloj de los tests lo controle.
- `seasonalProducts(month): { verduras: SeasonalProduct[]; frutas: SeasonalProduct[] }` y `monthMark(product, month): "empieza" | "últimas" | null`.
- `seasonalIn(recipe, month): SeasonalProduct[]`: productos no básicos del mes presentes en la receta, cada uno una sola vez.
- `featuredRecipes(recipes, favorites, month, limit = 10)`: orden por nº de productos, desempate favoritas y luego A–Z.
- `recipesWithProduct(recipes, product)`: recetas que llevan el producto, en cualquier mes.
- Calendario opcional: `seasonalProducts`, `seasonalIn` y `featuredRecipes` aceptan un último parámetro `products = SEASONAL_PRODUCTS` (en `featuredRecipes`, tras `limit`), que los tests usan para inyectar productos sintéticos.
- `safePreferredIngredient(raw: unknown): string | undefined` en `src/lib/recipePrompt.ts` (junto a `safeAllergies`); `buildRecipePrompt(profile, pantry, count, preferredIngredient?)`. `server/` llama a la primera y pasa el resultado a la segunda.
- `POST /api/recipes`: campo opcional `preferredIngredient?: string`. Validación en el servidor: tipo string, recortado, ≤ 40 caracteres, sin saltos de línea; si no cumple se ignora. El prompt lo añade como preferencia («incluye X como ingrediente principal si es posible»), no como regla sobre alergias ni dieta, que siguen mandando. El cliente manda `count: 1`.

### UI
Todo en `/recetas`, mapeado al prototipo:
- **Recetas con franja** (artboard 1): `SeasonStrip` arriba, con verduras y frutas, Carrot/Apple por tipo y «empieza»/«últimas»; enlace «Ver calendario completo» (`?vista=calendario`). `FeaturedRecipes` debajo, hasta 10. Ambos se ocultan con búsqueda o con cualquier filtro activo, incluido el nuevo chip «De temporada».
- **Producto** (artboards 2 y 3): `?producto=<id>` muestra `ProductView` en lugar de la lista: barra de 12 meses con el mes actual resaltado, recetas que lo llevan y, si no hay, estado vacío con «Sugerir receta con <producto>»; con recetas, «Más ideas con <producto>» como acción secundaria. Al generar se guarda con `addRecipes` y se abre con `selectedId`. Botón Volver quita el parámetro.
- **Detalle de receta** (artboard 4): chips de productos de temporada que enlazan a su página, y los ingredientes correspondientes marcados.
- **Tarjeta de la lista**: chip «De temporada» con hasta 2 nombres y «+N».
- **Calendario completo** (artboard 5): `?vista=calendario`, tabla de verduras y frutas × 12 meses, mes actual resaltado; aquí sí salen los básicos.
- `AllergenBadge` se reutiliza en destacadas y en la página de producto (R7).

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `SeasonStrip` con `seasonalProducts` y `monthMark` |
| R2 | `featuredRecipes` + `FeaturedRecipes` |
| R3 | Chip de filtro en `page.tsx` con `seasonalIn`; `SeasonalChips` en tarjeta y detalle |
| R4 | `?producto=` + `ProductView` + `recipesWithProduct` |
| R5 | Estado vacío y botón en `ProductView`; `preferredIngredient` en el prompt y la ruta |
| R6 | Nada se guarda en las recetas; todo sale de `seasonal.json` y `currentMonth()` |
| R7 | `AllergenBadge` en cada vista nueva; el servidor ya descarta recetas inseguras |
| R8 | `?vista=calendario` + `SeasonCalendar` |

## Risks & mitigations
- **Servidor desplegado aparte**: si `server/` no se redespliega, el campo se ignora y se genera una receta genérica. Mitigación: campo opcional validado (string ≤ 40 caracteres, sin saltos de línea); redesplegar antes de usar la función.
- **Calidad del dato**: ~70 productos × meses transcritos de fuentes públicas. Mitigación: test de forma del JSON, fuentes citadas en el PR y revisión de Manuel; lo dudoso se marca.
- **Falsos positivos del casado** («col» frente a «color», «calabaza» frente a «calabacín», «tomate frito»). Mitigación: tests con ingredientes del recetario real; el caso de conservas se acepta sin reglas extra.
- **Mes y zona horaria**: una sola `currentMonth()` sobre la fecha del dispositivo; los tests fijan el reloj.
- **`page.tsx` sigue creciendo**: la lógica nueva va a `seasonal.ts` y los componentes a `temporada/`.
- **`useSearchParams` en export estático**: va dentro de `<Suspense>`, como `?semana=`.

## Testing strategy
- **Unit**: `tests/unit/seasonal-data.test.ts` (forma del JSON: meses 1–12, ids únicos, palabras clave normalizadas, kind válido, básicos marcados); `tests/unit/seasonal.test.ts` (casado por palabra completa con ingredientes reales, meses circulares, marcas, un solo mes sin marca, destacadas con límite 10, básicos fuera, orden con empates por favoritas y A–Z, una receta nueva queda destacada, producto sin recetas); `recipe-prompt.test.ts` (con y sin `preferredIngredient`, validación recortada).
- **E2E**: `tests/e2e/temporada.spec.ts` con `page.clock.setFixedTime` en octubre y en otro mes: franja y destacadas (R1, R2), filtro (R3), cambio de mes sin tocar datos, receta nueva destacada, producto sin recetas con la acción de IA simulada (R4, R5), aviso de alérgenos (R7), calendario (R8), y axe en las vistas nuevas.
- Cada criterio de aceptación de la spec tiene al menos una prueba.

## Test coverage
Hechos ancla del calendario real, acordados con Manuel en dev-test: calabaza, caqui y membrillo en octubre; fresa en mayo y no en octubre; membrillo empieza en octubre; los 6 básicos con `basic: true`. Si la fuente contradijera alguno, se habla con Manuel antes de tocar el test. Contrato de UI de los e2e: cabecera de `tests/e2e/temporada.spec.ts`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/seasonal.test.ts › "R1: marcas «empieza» / «últimas»", "R1: seasonalProducts…" | unit | 🔴 failing (not built) |
| R1 | tests/e2e/temporada.spec.ts › "R1: franja «De temporada · <mes>»" (3 casos) | e2e | 🔴 failing (not built) |
| R2 | tests/unit/seasonal.test.ts › "R2: featuredRecipes" (orden, límite 10, básicos fuera, empate, vacío) | unit | 🔴 failing (not built) |
| R2 | tests/unit/seasonal-data.test.ts › "R2: los 6 básicos…" | unit | 🔴 failing (not built) |
| R2 | tests/e2e/temporada.spec.ts › "R2: «Destacadas este mes»" (4 casos, incluida la cabecera oculta con filtros) | e2e | 🔴 failing (not built) |
| R3 | tests/unit/seasonal.test.ts › "R3/R6: seasonalIn casa los ingredientes por palabra completa" | unit | 🔴 failing (not built) |
| R3 | tests/e2e/temporada.spec.ts › "R3: filtro «De temporada» e indicadores" (4 casos) | e2e | 🔴 failing (not built) |
| R4 | tests/unit/seasonal.test.ts › "R4: recipesWithProduct" | unit | 🔴 failing (not built) |
| R4 | tests/e2e/temporada.spec.ts › "R4: página de producto" (2 casos) | e2e | 🔴 failing (not built) |
| R5 | tests/unit/recipe-prompt.test.ts › "R5: ingrediente preferido en el prompt", "R5: safePreferredIngredient…" | unit | 🔴 failing (not built; 6 de 9 fallan, 3 ya pasan por ser el comportamiento actual) |
| R5 | tests/e2e/temporada.spec.ts › "R5: producto sin recetas y sugerencia con IA" (3 casos; la IA se simula con `page.route`) | e2e | 🔴 failing (not built) |
| R6 | tests/unit/seasonal.test.ts › "R6: currentMonth…", seasonalIn no modifica la receta, receta nueva destacada | unit | 🔴 failing (not built) |
| R6 | tests/unit/seasonal-data.test.ts › "R6: forma del calendario estático" | unit | 🔴 failing (not built) |
| R6 | tests/e2e/temporada.spec.ts › "R5 … queda destacada" (receta nueva sin tocar nada más) | e2e | 🔴 failing (not built) |
| R7 | tests/e2e/temporada.spec.ts › "R7: el aviso de alérgenos sigue en las vistas nuevas" | e2e | 🔴 failing (not built) |
| R8 | tests/e2e/temporada.spec.ts › "R8: calendario completo" | e2e | 🔴 failing (not built) |
| R8 | tests/unit/seasonal-data.test.ts › "R1/R8: hechos ancla" | unit | 🔴 failing (not built) |
| — | tests/e2e/temporada.spec.ts › "Accesibilidad de las vistas nuevas (axe)" (4 vistas) | e2e | 🔴 failing (not built) |

## Tasks
1. [ ] `src/data/seasonal.json` + `SeasonalProduct` + `tests/unit/seasonal-data.test.ts` (covers R6, R8)
2. [ ] `src/lib/seasonal.ts` (casado, mes, marcas, destacadas, recetas por producto) + `tests/unit/seasonal.test.ts` (covers R1, R2, R3, R6)
3. [ ] `preferredIngredient` en `recipePrompt.ts` y `server/app/api/recipes/route.ts` + tests del prompt (covers R5)
4. [ ] Franja, destacadas y chip «De temporada» en `/recetas`, cabecera oculta con filtros (covers R1, R2, R3, R7)
5. [ ] Indicadores en tarjeta y detalle (chip con +N, chips con enlace, ingredientes marcados) (covers R3, R4)
6. [ ] Página de producto `?producto=` con barra de 12 meses, vacío e IA (count 1, guardar y abrir) (covers R4, R5, R7)
7. [ ] Calendario completo `?vista=calendario` (covers R8)
8. [ ] `tests/e2e/temporada.spec.ts` con reloj fijado y axe (covers R1–R8)

## Spec feedback
Decididas por el usuario en este paso, y recogidas en `spec.md`:
- Un producto con una ventana de un solo mes no lleva marca («empieza»/«últimas»). (Antes pregunta abierta de R1.)
- Los básicos aparecen solo en el calendario completo, no en la franja. (Antes pregunta abierta.)
- La IA genera una sola receta (`count: 1`), la guarda y la abre; hoy la generación genera 3 y no abre ninguna. (Precisa R5.)

Abiertas, sin bloquear el código:
- [ ] ¿Los productos básicos tienen página de producto al tocarlos en el calendario? Por defecto el calendario no los enlaza. (Manuel)
