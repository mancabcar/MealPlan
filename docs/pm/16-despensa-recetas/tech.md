# Aprovechar lo que caduca: Technical design
_Status: Draft · Updated: 2026-09-29_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Lógica pura nueva en `src/lib/pantryRecipes.ts` que reutiliza el parser y el matcher de la lista de la compra (`parseIngredientLine`, `indexPantry`/`matchIndexed`). Recetas gana un toggle "Usa lo que tengo" y un chip "con: <ítem>"; Despensa gana el botón "Recetas con esto", que pasa el ítem a Recetas mediante estado efímero en el store. Sin datos persistidos ni dependencias nuevas. Esfuerzo S–M, 7 tareas.

## Context
- Next 16.2.9 con `output: "export"` (`next.config.ts`, hosting estático); la convención del repo evita `useSearchParams` (comentario en `src/app/plan/compra/page.tsx`).
- `src/lib/shopping/parse.ts`: `parseIngredientLine(line)` → ingredientes con `key` normalizado.
- `src/lib/shopping/pantryMatch.ts`: `indexPantry`, `matchIndexed(key, index, today)` (todas las palabras del ingrediente están en el nombre del ítem; los caducados no cuentan como `match`).
- `src/lib/shopping/classify.ts`: `classify(key).basic` marca los básicos (sal, agua, aceite…), que la compra no cruza con la Despensa.
- `src/lib/types.ts`: `isExpiringSoon` (0–2 días), `isExpired`, `todayStr`, `PantryItem`, `Recipe.ingredients: string[]`.
- `src/app/recetas/page.tsx`: lista filtrada por texto, `AllergenBadge` en tarjeta y detalle. `src/app/despensa/page.tsx`: ítems con chips "caduca pronto"/"caducado".
- `src/lib/store.tsx`: `AppContext` con `useApp()`.

## Approaches considered
### A. Lógica pura + estado efímero en el store (chosen)
Módulo puro testeable; la Despensa fija `recipeFocus` y navega con `router.push("/recetas")`. **Pros**: sigue la convención del repo (lógica en `lib`, UI que solo pinta), sin Suspense, un solo matcher en toda la app. **Cons**: el filtro por ítem se pierde al recargar (aceptado). **Effort** S–M.
### B. Query `?con=<id>` con `useSearchParams` + `<Suspense>`
Enlazable y sobrevive a recargar, pero rompe la convención del repo y complica el export estático. **Effort** M. Descartada.
### C. sessionStorage
Estado oculto fuera del store. Descartada.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lógica | `src/lib/pantryRecipes.ts` (nuevo) | `recipeUsage`, `recipesUsingItem`, `rankByPantry` |
| Store | `src/lib/store.tsx` | `recipeFocus: string \| null` + `setRecipeFocus` (efímero, no se persiste ni entra en backup) |
| Recetas | `src/app/recetas/page.tsx` | toggle "Usa lo que tengo", chip "con: <ítem>", vacíos, "Tienes N de M" |
| Despensa | `src/app/despensa/page.tsx` | botón "Recetas con esto" en ítems con `isExpiringSoon` |
| Tests | `tests/unit/pantry-recipes.test.ts`, `tests/e2e/despensa-recetas.spec.ts` | nuevos |

### Data model
Ninguno persistido. Tipo interno: `RecipeUsage = { matched: number; total: number; soonest?: string }` (`soonest` = fecha YYYY-MM-DD). Los ingredientes básicos u opcionales no entran en `matched` ni en `total`.

### APIs / interfaces
- `recipeUsage(recipe, index: PantryIndex, today): RecipeUsage`: parsea cada línea de `recipe.ingredients`, descarta básicos, cuenta los que casan con un ítem no caducado (un ingrediente cuenta una vez aunque casen varios ítems) y devuelve la fecha de caducidad más próxima entre los ítems coincidentes con fecha.
- `recipesUsingItem(recipes, item, today): Recipe[]`: recetas con ≥1 ingrediente no básico que casa con `item` (mismo matcher, índice de un solo ítem); orden del recetario.
- `rankByPantry(recipes, pantry, today): { recipe: Recipe; usage: RecipeUsage }[]`: solo `matched ≥ 1`; orden por `matched` descendente, luego `soonest` ascendente (sin fecha al final), luego orden original (sort estable).

### UI
- Recetas: bajo el buscador, botón-toggle "Usa lo que tengo" (`aria-pressed`) y, si hay `recipeFocus`, chip quitable "con: <ítem>" (al quitarlo, `setRecipeFocus(null)`). Pipeline: `recipeFocus` → toggle → texto (R7). `AllergenBadge` sigue en cada tarjeta sin tocarlo (R5). Vacíos (R6): "Ninguna receta usa <ítem>" o "Nada que aprovechar todavía", con el botón "Sugerir con IA" ya existente como salida.
- Con el toggle activo cada tarjeta muestra "Tienes N de M ingredientes" y un chip `expiring` "caduca pronto" si `soonest` está a 0–2 días (R8).
- Despensa: botón "Recetas con esto" junto al chip "caduca pronto" (R1); `setRecipeFocus(item.id)` + `router.push("/recetas")`.
- Si el ítem de `recipeFocus` ya no existe (borrado), se ignora y se limpia.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Botón condicionado a `isExpiringSoon(item)` en Despensa |
| R2 | `recipeFocus` + `recipesUsingItem` + chip quitable |
| R3 | `rankByPantry` (≥1 coincidencia, orden por `matched`) |
| R4 | Desempate por `soonest`, luego orden del recetario |
| R5 | `AllergenBadge` intacto en tarjeta y detalle |
| R6 | Mensajes vacíos con "Sugerir con IA" |
| R7 | Pipeline focus → toggle → texto |
| R8 | `RecipeUsage` en la tarjeta |
| R9 | Fuera de alcance (follow-up) |

## Risks & mitigations
- Falsos positivos/negativos del matcher por texto libre: se acepta, misma regla que la compra.
- `recipeFocus` se pierde al recargar: aceptado; el chip desaparece y la lista vuelve completa.
- Coste de parsear los ingredientes de todas las recetas en cada render con el toggle activo: `useMemo` sobre `recipes`/`pantry`; el recetario es pequeño.
- Un ítem cuyo nombre solo casa con ingredientes básicos (p. ej. "sal") da un vacío en "Recetas con esto": aceptado.

## Testing strategy
- Unit (`tests/unit/pantry-recipes.test.ts`): conteo, orden, desempate por caducidad, sin fecha, caducados excluidos, ítems duplicados contando una vez, básicos y opcionales excluidos, "leche entera" vs "leche de almendras".
- E2E (`tests/e2e/despensa-recetas.spec.ts`): ítem que caduca en 2 días → botón → recetas correctas y chip (R1, R2); ítem a 3+ días sin botón; toggle y orden (R3, R4); receta con alérgeno del perfil conserva aviso (R5); vacíos (R6); toggle + texto (R7); "Tienes N de M" (R8). Sembrado de despensa y recetas como en los e2e existentes.

## Tasks
1. [ ] `src/lib/pantryRecipes.ts` + unit (covers R2–R4)
2. [ ] `recipeFocus`/`setRecipeFocus` efímero en el store
3. [ ] Recetas: toggle "Usa lo que tengo", orden, vacío y combinación con texto (covers R3, R4, R6, R7)
4. [ ] Recetas: chip "con: <ítem>" leyendo `recipeFocus` (covers R2)
5. [ ] Despensa: botón "Recetas con esto" (covers R1)
6. [ ] Tarjeta "Tienes N de M" + chip caduca pronto (covers R8)
7. [ ] E2E `despensa-recetas.spec.ts` (covers R1–R8)

## Spec feedback
- Pregunta abierta de la spec resuelta: "con: <ítem>" casa por palabras con el matcher de la compra (decidido 2026-09-29).
- Precisión sobre R8: M (y N) no cuentan ingredientes básicos ni opcionales; `spec.md` no se ha cambiado.
- R9 queda fuera; se anota como follow-up en el brief.

## Test coverage
Tests escritos antes del código el 2026-09-29 (dev-test). Comandos: `npx vitest run tests/unit/pantry-recipes.test.ts` y `npx playwright test tests/e2e/despensa-recetas.spec.ts`. Los e2e usan ingredientes poco comunes (requesón, cuscús, membrillo, mascarpone, ricotta, remolacha) porque la app añade las ~90 recetas semilla al recetario; con estos nombres los resultados filtrados son exactos.

| Req | Test | Layer | Status |
|---|---|---|---|
| R2, R3 | `tests/unit/pantry-recipes.test.ts` › "R2: recipesUsingItem…" (orden del recetario, "leche entera" vs "leche de almendras", vacío, solo básicos) | unit | 🔴 failing (not built) |
| R3 | `tests/unit/pantry-recipes.test.ts` › "R3: rankByPantry ordena por nº…" (orden, 0 coincidencias fuera, caducados fuera, despensa vacía) | unit | 🔴 failing (not built) |
| R4 | `tests/unit/pantry-recipes.test.ts` › "R4: rankByPantry desempata…" y "R4: recipeUsage devuelve la caducidad más próxima…" | unit | 🔴 failing (not built) |
| R8 | `tests/unit/pantry-recipes.test.ts` › "R8: recipeUsage cuenta…" (N de M, básicos, opcionales, caducados, duplicados) | unit | 🔴 failing (not built) |
| R1 | `tests/e2e/despensa-recetas.spec.ts` › "R1: … solo en ítems que caducan pronto" | e2e | 🔴 failing (not built) |
| R2 | `tests/e2e/despensa-recetas.spec.ts` › "R2: … lleva a las recetas que usan el ítem" (flujo, chip quitable, independencia con el toggle) | e2e | 🔴 failing (not built) |
| R2 | `tests/e2e/despensa-recetas.spec.ts` › "R2: … sin pasar por la Despensa no hay chip" | e2e | 🟢 passing (guardia de regresión) |
| R3, R4 | `tests/e2e/despensa-recetas.spec.ts` › "R3 / R4: …" (orden, caducados no cuentan, desactivar restaura) | e2e | 🔴 failing (not built) |
| R5 | `tests/e2e/despensa-recetas.spec.ts` › "R5: los avisos de alérgenos se mantienen" | e2e | 🔴 failing (not built) |
| R6 | `tests/e2e/despensa-recetas.spec.ts` › "R6: estados vacíos…" (ítem sin recetas, Despensa vacía) | e2e | 🔴 failing (not built) |
| R7 | `tests/e2e/despensa-recetas.spec.ts` › "R7: … búsqueda por texto" | e2e | 🔴 failing (not built) |
| R8 | `tests/e2e/despensa-recetas.spec.ts` › "R8: … cada tarjeta muestra cuánto tengo" | e2e | 🔴 failing (not built) |
| R9 | — (fuera de alcance) | — | ⚪ not planned |

### UI test contract
Nombres accesibles y textos que los e2e esperan; dev-code debe respetarlos (si algo tiene que cambiar, se cambia aquí y en el test a la vez):
- Despensa: botón por ítem que caduca pronto, texto visible "Recetas con esto" y `aria-label="Recetas con esto: <nombre del ítem>"`; ninguno en el resto de ítems.
- Recetas: botón toggle "Usa lo que tengo" con `aria-pressed="true|false"`.
- Chip de ítem: texto visible "con: <nombre del ítem>" y un botón `aria-label="Quitar filtro con: <nombre del ítem>"`. Tras el `router.push`, la URL es `/recetas`.
- Vacíos: "Ninguna receta usa <nombre del ítem>" (chip de ítem sin resultados) y "Nada que aprovechar todavía" (toggle sin resultados); ambos con el botón "Sugerir con IA" visible.
- Tarjeta con el toggle activo: "Tienes N de M ingredientes" y, si algún coincidente caduca en 0–2 días, el chip "caduca pronto". Sin toggle no aparece "Tienes …".
- Las tarjetas siguen siendo botones que contienen el texto "kcal" (los e2e las localizan así); `AllergenBadge` dentro de la tarjeta.
- Módulo `@/lib/pantryRecipes` con `recipeUsage(recipe, index, today)`, `recipesUsingItem(recipes, item, today)` y `rankByPantry(recipes, pantry, today)`, `index` = `indexPantry(pantry)`.
