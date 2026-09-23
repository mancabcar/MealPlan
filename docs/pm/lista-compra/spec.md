# Lista de la compra: Spec
_Status: Approved (tech-design defaults accepted 2026-09-23) · Owner: Manuel Cabrera · Updated: 2026-09-23_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/P1MhiwSReXZZ668pVjNAgW) · [issue #5](https://github.com/mancabcar/MealPlan/issues/5)_

## TL;DR
The weekly plan only stores which recipe goes in which slot, so there's no way to know what to buy. We're adding a shopping list, opened from Plan, that:
- collects the ingredients of the week's planned recipes;
- adds up identical ingredients;
- marks what the Despensa already has as "Ya lo tienes";
- lets the user tick items off in the shop and optionally move them into the Despensa.

It has worked if the household uses the list for its weekly shop most weeks without writing a separate list.

## Problem
Household members plan the week in Plan (`WeekPlan`: date → `{ mealType, recipeId }[]`). Then, to shop, they open each recipe and copy ingredients by hand, checking the fridge from memory. That's slow and error-prone: an ingredient used by three recipes gets bought once, or not at all. A shopping list is the main reason people use a meal planner (Mealime, Paprika, Samsung Food and Eat This Much all have one), and the app already has everything needed to build it: recipes with ingredients, the plan, and a Despensa.

The constraint is data quality. `Recipe.ingredients` is free text: `"150g pechuga de pollo"`, `"1/2 pimiento rojo"`, `"1 bote pequeño de garbanzos cocidos (240g)"`, `"sal, pimienta y ajo en polvo"`, `"zumo de 1/2 lima"`. The 40 seed recipes have 145 distinct ingredient strings, and AI-generated recipes add more of the same shape.

## Goals
- A user can go from a planned week to a usable shopping list in one tap, without typing anything.
- Ingredients shared by several recipes appear once, with the total amount when that can be added up reliably.
- The list doesn't ask the user to buy what the Despensa already has.
- The list works in the shop: ticking items off is fast and survives closing the app.

## Non-goals
- **Choosing a date range.** The list always covers the current week (Monday–Sunday), the same week Plan shows.
- **Unit conversion.** 1 kg and 200 g, or 1 lata and 80 g, are not added together.
- **Comparing quantities with the Despensa.** "Ya lo tienes" is a name match. The app doesn't decide whether 3 filetes cover 420 g (user decision, 2026-09-23).
- **Adding items by hand**, or editing an item's name or quantity in the list.
- **Sharing or syncing** the list between household members or devices. It's per user, in localStorage, like the rest of the app.
- **Prices, stores, or online ordering.**
- **Scaling recipes by servings.** Each planned slot uses the recipe's quantities as written.

## Users & key scenarios
Household members who plan their week in the app. Each has their own profile, plan and Despensa.

1. **Sunday planning.** Manuel has filled most of next week's slots. He opens the list from Plan and checks what's missing. He sees the Despensa already has chicken, but three meals need 420 g, so he adds it to the list anyway.
2. **In the shop.** He ticks items off as they go into the trolley. The app gets closed between aisles, and when he reopens it the ticks are still there. At the end, 3 items weren't in stock.
3. **Back home.** He moves the 35 bought items into the Despensa in one step, checking that each one goes to Nevera, Despensa or Congelador.
4. **Empty week.** A new household member opens the list before planning anything and is sent to Plan.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Plan shows an entry point to the shopping list with the number of items still to buy (unbought, so it goes down while shopping) and the number already in the Despensa. Especias y básicos count in neither number. | Must |
| R2 | The list covers the recipes assigned in the current week (Monday–Sunday), **only in the meal slots active in the user's profile**. Slots whose meal is inactive, and slots without a recipe, are ignored, just as they are for Plan's kcal totals. | Must |
| R3 | Each ingredient line is split into quantity, unit and name. Lines that name several ingredients (`"limón, sal y eneldo"`) are split into one item per ingredient, without a quantity. A line that can't be parsed appears as its own item with its original text, and is never dropped. | Must |
| R4 | Ingredients with the same normalized name become one item (normalization rules below). If all their quantities share a unit, the quantities are added up (150 g + 150 g → 300 g; 1 + 1 + 2 huevos → 4). If units differ, all the amounts are shown together unsummed ("200 g + 1 bote"). Items with no quantity show "al gusto". | Must |
| R5 | An item whose name matches an unexpired Despensa item goes in a "Ya lo tienes" section and isn't counted as to-buy. The row shows which Despensa item it matched and its quantity ("Tienes: Arroz integral · 1 kg"). An expired Despensa item doesn't count, and the to-buy row says "El de tu Despensa está caducado". | Must |
| R6 | Tapping an item opens its detail: the total needed, each meal that uses it (day, meal, recipe, amount), and for "Ya lo tienes" items the matched Despensa item. From there the user can override a match ("Añadir a la lista de todos modos"). The override persists for that week. | Must |
| R7 | The user can mark an item as bought, and unmark it. Bought items move to a collapsible "Comprados" section. A progress line shows "N de M comprados". | Must |
| R8 | Bought state and overrides persist per user and per week in localStorage, so they survive reloads and closing the app. | Must |
| R9 | The list reflects the plan as it is now. Changing a slot adds or removes items. A bought item stays bought if it's still on the list. A bought item whose total changed is unmarked, so the user checks the new amount. | Must |
| R10 | When the week has no qualifying recipes, the list shows an empty state that links to Plan. | Must |
| R11 | To-buy items are grouped by aisle: Frutas y verduras, Carne y pescado, Lácteos y huevos, Despensa y conservas, and Otros for anything unrecognized. | Should |
| R12 | Common seasonings and basics (sal, pimienta, especias, vinagre, agua, caldo en pastilla…) go in a collapsed "Especias y básicos" group that isn't counted in the totals. Aceite de oliva is not a basic: it matches the Despensa like any other item. Fresh herbs (perejil, albahaca, cebollino, jengibre) are Frutas y verduras, not basics. The basics list is fixed in code. | Should |
| R13 | Once at least one item is bought, the user can move bought items into the Despensa. A review sheet lists each one with its summed quantity, a suggested location (Nevera, Despensa or Congelador, from the aisle) that can be changed, and a checkbox to leave it out. Confirming adds each one as a new Despensa item, even if one with the same name already exists, and shows an undo option. Moved items are marked "Nuevo" in the Despensa on the day they were moved. The undo option stays for about 10 seconds. | Should |
| R14 | Items moved to the Despensa are removed from the list's "Comprados" section, so they aren't moved twice. | Should |

### Normalization rules (R3, R4, R5)
- Case, accents and surrounding whitespace are ignored. Parenthetical notes are removed from the name: `(en seco)`, `(opcional)`, `(240g)`, `(o maicena)`. "(opcional)" is kept as a label on the item.
- Leading quantities are parsed as integers, decimals and fractions (`1/2`, `½`), with or without a space before the unit (`150g`, `150 g`).
- Recognized units: g, kg, ml, l, cucharada, cucharadita, lata, bote, diente, rebanada, unidad, cazo, hoja, rama, and their plurals (tech design may add a few more ahead of AI recipes). Quantities are added only when the unit is identical after the singular/plural merge. There's no g↔kg conversion.
- Filler words between the unit and the name are removed: `de`, and size words like `pequeño`, `grande` and `mediano`.
- A simple Spanish plural is merged: `huevo`/`huevos`, `calabacín`/`calabacines`, `lomo`/`lomos`. Different words stay different: "patata" and "patata pequeña" merge because size words are removed, but "cebolla" and "cebolla morada" don't.
- `zumo de X` becomes the item X.
- Alternatives keep the first option: `"harina o maicena"` → harina; `"leche o bebida vegetal"` → leche.
- Trailing notes are removed: `al gusto`, `para …`.

### Despensa matching (R5)
A Despensa item matches an ingredient when every word of the ingredient's normalized name appears in the Despensa item's normalized name. For example, "arroz" matches "Arroz integral" and "lomo de salmón" matches "Lomos de salmón". If several Despensa items match, the first unexpired one is used. False positives are accepted: the user can override them (R6).

## User flows
Artboard names refer to the prototype.

**Plan and shop.** *1 · Plan semanal* → tap "Lista de la compra" → *2 · Lista de la compra* shows the to-buy items by aisle, plus "Ya lo tienes" and "Especias y básicos" → tap "Pechuga de pollo" in "Ya lo tienes" → *3 · Ya lo tienes: detalle* → "Añadir a la lista de todos modos" → back on the list, it's now in Carne y pescado → in the shop, tick items → *4 · En la tienda*: bought items collapse into "Comprados".

**Move to Despensa.** *4 · En la tienda* → "Pasar 35 comprados a la Despensa" → *5 · Pasar a la Despensa*: review locations, untick anything to keep out → "Añadir 35 a la Despensa" → *6 · Despensa actualizada*, with new items marked "Nuevo" and an undo toast.

**Nothing planned.** Plan → list → *7 · Sin recetas en el plan* → "Ir al Plan".

## Acceptance criteria
**R1**
- Given a week with planned recipes, when the user opens Plan, then an entry "Lista de la compra" shows "N por comprar · M ya los tienes", and N and M match the list.

**R2**
- Given the profile's active meals are Desayuno, Comida and Cena, and Tuesday's Merienda has a recipe assigned, when the list is built, then no ingredient from that Merienda recipe appears.
- Given a recipe assigned last week, or next week, when the list is built, then its ingredients don't appear.
- Given the same recipe is planned on two days, when the list is built, then its quantities count twice.

**R3**
- Given `"sal, pimienta y ajo en polvo"`, then it produces three items (sal, pimienta, ajo en polvo) with no quantity.
- Given `"1 bote pequeño de garbanzos cocidos (240g)"`, then it produces one item "garbanzos cocidos", 1 bote.
- Given a line the parser can't read, then it appears as one item with the original text.

**R4**
- Given "150g brócoli" in two planned recipes, then the list shows one "Brócoli · 300 g".
- Given "1 huevo" twice and "2 huevos" once, then the list shows "Huevos · 4".
- Given "200g X" and "1 bote de X", then the list shows one item "X · 200 g + 1 bote".
- Given "1 patata pequeña" and "200g patata", then they are one item "Patata · 200 g + 1".
- Given "1/2 cebolla" and "1/4 cebolla morada", then they are two items.
- Given the planned recipes, then no two to-buy items have the same normalized name (issue #5 criterion: no exact duplicates).

**R5**
- Given the Despensa has "Arroz integral · 1 kg" and a recipe needs "60g arroz", then "Arroz" appears in "Ya lo tienes" with "Tienes: Arroz integral · 1 kg" and isn't counted as to-buy.
- Given the Despensa has "Espárragos verdes" with an expiry date before today, then "Espárragos verdes" is to-buy, with the note "El de tu Despensa está caducado".

**R6**
- Given "Pechuga de pollo" is in "Ya lo tienes", when the user opens it, then they see the total (420 g), the three meals that use it with their amounts, and the matched item "Pechuga de pollo · 3 filetes · Congelador".
- When they tap "Añadir a la lista de todos modos", then the item moves to to-buy, and it stays there after a reload during the same week.

**R7**
- When the user taps a to-buy item, then it moves to "Comprados" and the progress line goes up by 1. When they tap it in "Comprados", it goes back.

**R8**
- Given 5 items are marked as bought, when the user reloads the page, then the same 5 are bought.
- Given two users on the same device, then each sees only their own bought state (issue #5 criterion).
- Given a new week starts, then the list starts with nothing bought.

**R9**
- Given "Brócoli · 300 g" is bought, when the user removes one of the two broccoli recipes from the plan, then the item shows 150 g and is no longer marked as bought.
- Given "Huevos" is bought, when an unrelated slot changes, then "Huevos" stays bought.

**R10**
- Given no recipe is assigned in any active slot this week, when the user opens the list, then they see "Nada que comprar todavía" and a link "Ir al Plan" that opens Plan.

**R11 · R12** (Should)
- Given "brócoli", then it's under Frutas y verduras. Given an unknown ingredient, then it's under Otros.
- Given sal, pimienta, orégano or vinagre, then they're under "Especias y básicos", collapsed and not counted in N.

**R13 · R14** (Should)
- Given 35 bought items, when the user confirms "Añadir 35 a la Despensa", then 35 Despensa items are created, each with the summed quantity as its text and the chosen location. They leave "Comprados" and appear in the Despensa marked "Nuevo".
- When the user taps "Deshacer", then those 35 Despensa items are removed and the items are back in "Comprados".

## Edge cases
- **Recipe deleted** after being planned: its slot is ignored, the same as Plan does today.
- **Profile's active meals change mid-week:** the list recalculates (R2, R9).
- **Very long week** (6 meals × 7 days): the list must stay readable. Aisle groups and the collapsed sections carry that.
- **Fractions that add up to a whole:** ½ + ½ shows as 1, ½ × 3 as 1½. Decimals are rounded to at most one decimal.
- **Quantities in several units on one item:** they are listed in first-seen order, joined by " + ".
- **The same Despensa item matches several ingredients** ("Aceite de oliva" for every recipe that uses it): that's fine, every match shows it.
- **Despensa item with no expiry date:** counts as unexpired.
- **Old weeks' bought state** is discarded once the week is over, so localStorage doesn't grow forever. Small per-week counters (items bought, overrides) are kept for the last 12 weeks so the success metrics can be read.

## Success metrics
There are no analytics in the app. These are checked by hand, by looking at localStorage and asking the household.

| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Weeks where the list is used for shopping (≥ 1 item marked bought) | 0 (feature doesn't exist) | ≥ 3 of the first 4 weeks after release | Per-week counters in localStorage (last 12 weeks) |
| Items overridden from "Ya lo tienes" to to-buy, per week | TBD | Low enough that the household still trusts the match (to be read after 4 weeks) | Per-week override counter in localStorage |
| Separate shopping list still written by hand | Yes | No, for most weeks | Ask the household after 4 weeks |

## Risks & dependencies
- **Parsing quality** is the main risk. Free text from seed recipes can be tested, but AI-generated recipes may use shapes the rules don't cover. R3's "never drop a line" is the safety net. The fix could be a stricter ingredient format in `recipePrompt.ts` (see Open questions).
- **The aisle keyword list** needs curating. Anything missing falls into Otros, which is acceptable but noisy.
- **Depends on `design-refresh`** shipping first (decided 2026-09-23). The list uses its look and components, and the entry point goes in the redesigned Plan. If the redesign slips, this slips with it.
- **Plan's week** is computed with `weekDates(todayStr())` in `src/app/plan/page.tsx`. The list must use the same logic, ideally extracted and shared, so the two can't drift.

## Open questions
- [x] **When a bought item is already in the Despensa, does moving it add to the existing entry or create a new line?** Decided 2026-09-23: **create a new line**. The existing entry is left untouched.
- [x] **Does this ship before or after `design-refresh`?** Decided 2026-09-23: **after**. The list is built in the new visual language, and the Plan entry point targets the redesigned Plan.
- [ ] Should AI-generated recipes be asked to write ingredients as "`<cantidad> <unidad> de <ingrediente>`", one per line with no compound lines, to make parsing reliable? Doesn't block. (engineering, in tech design)
- [x] Is the "Especias y básicos" list fixed in code, or can the user edit it? Decided 2026-09-23: fixed in code.
