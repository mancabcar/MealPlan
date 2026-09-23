# Lista de la compra: Technical design
_Status: Draft · Updated: 2026-09-23_
_Related: [spec](spec.md) · [brief](brief.md) · [prototype](https://claude.ai/artifact/P1MhiwSReXZZ668pVjNAgW) · depends on [design-refresh](../design-refresh/tech.md)_

## Summary
All the logic lives in a new **pure, framework-free module `src/lib/shopping/`** that does four things: it parses ingredient lines, adds them up across the week, sorts them into aisles and basics, and matches them against the Despensa. It also holds the per-week bought/override state. The module is covered by Vitest unit tests, including a test that runs all 145 seed ingredient strings through the parser. The UI is a thin client page at `/plan/compra`, built from the design-refresh primitives (`Card`, `Chip`, tokens, lucide icons). Persistence adds one `usePersisted` key (`mp_<user>_shopping`) plus batch pantry actions in `src/lib/store.tsx`. Effort: **M** (about 3–4 focused days). Most of the risk is in the parser, and it can be tested in isolation before any UI exists.

## Context
- **Branching base.** design-refresh is **already merged on `origin/main`** (PR #4, `64b5592`). Local `main` (`a356cb9`) and the current branch (`fix/onboarding-profile-review`) are behind it and still show the old zinc/emerald Plan. dev-code must branch from an up-to-date `origin/main`. Every path below refers to the `origin/main` tree.
- Stack: Next 16.2.9 App Router (client pages; `AppProvider` only mounts on the client, so localStorage reads are synchronous), React 19.2.4, Tailwind v4 tokens in `src/app/globals.css`, `lucide-react` ^0.545, Vitest (`tests/unit`, `environment: "node"`) and Playwright (`tests/e2e`, Pixel 7, clock fixed at `2026-09-22` via `tests/e2e/helpers.ts › signIn`). CI (`.github/workflows/ci.yml`) runs lint → typecheck → unit → build → e2e.
- **Plan** (`src/app/plan/page.tsx`): a private `weekDates(todayStr())` gives Monday–Sunday. Active meals are `profile?.meals ?? MEAL_TYPES`, and slots are filtered with `meals.includes(s.mealType)`. The redesigned layout is `DaySelector` + one `Card` for the selected day. `DAY_NAMES` is duplicated locally.
- **Data** (`src/lib/types.ts`): `Recipe.ingredients: string[]` (free text), `WeekPlan = Record<date, {mealType, recipeId}[]>`, `PantryItem {id, name, quantity: string, expiryDate?, category: "Nevera"|"Despensa"|"Congelador"}`, and `isExpired()` (no date counts as not expired).
- **Store** (`src/lib/store.tsx`): `usePersisted(key, fallback, {upgrade})` writes the whole value on each set, with keys from `userKey(userId, k)` = `mp_<userId>_<k>`. **Pitfall:** `addPantryItem`/`removePantryItem` close over the current render's `pantry`, so calling them in a loop (moving 35 items, or undoing that) keeps only the last write. The move and undo flows need batch actions.
- **Despensa** (`src/app/despensa/page.tsx`): items are grouped by `PANTRY_CATEGORIES` with `Chip tone="expired"|"expiring"`. It has no concept of a "new" item.
- **Seed data:** 40 recipes with 145 distinct ingredient strings (`src/data/recipes.json`). AI recipes come from `src/lib/recipePrompt.ts › buildRecipePrompt`, whose JSON example today shows `"ingredients": ["ingrediente 1", "ingrediente 2"]`, which gives the model no format guidance.
- Next 16 note (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`): a client page that calls `useSearchParams` without a `<Suspense>` boundary **fails `next build`**. This design keeps all list state (open detail, sheet) in component state or the store, not in query params, so it never calls `useSearchParams`.

## Approaches considered

### A. Pure `src/lib/shopping/` module + derived view + one persisted state key (recommended)
The list is **never stored**. On each render it is derived from `weekPlan`, `recipes`, `profile.meals`, `pantry` and the current week's dates. Only user intent is persisted: bought, overrides, moved. Bought state is stored as `key → amountSignature`. An item counts as bought only while its current signature equals the stored one, so R9 ("unmark if the total changed, keep if unrelated slots change") falls out automatically, with no effects and no reconciliation code. Week rollover is also derived: state whose `week` ≠ this Monday is read as empty.
- **Pros:** the list can't drift from the plan (R9 by construction). Everything hard is pure and unit-testable. There's no migration, because the new key starts empty. It reuses the `usePersisted` and `userKey` pattern exactly (R8, per-user isolation for free).
- **Cons:** recomputed on every render. That's negligible: at most 42 slots × ~10 lines, microseconds, and memoized with `useMemo`.
- **Effort:** M.

### B. Materialize the list into localStorage when opened, then reconcile against plan changes
Store `ShoppingItem[]` for the week and diff against the plan on each visit.
- **Pros:** the list is stable while the user is in the shop.
- **Cons:** the reconciliation logic is exactly what R9 describes, written by hand and full of edge cases (a total changed, an item removed then re-added, the meal set changed). There would be two sources of truth. Rejected: all cost, no benefit over A.

### C. Structured ingredients (change `Recipe.ingredients` to `{qty, unit, name}[]`)
Migrate the seed JSON and AI output to structured data.
- **Pros:** the most reliable aggregation in the long run.
- **Cons:** a schema migration across stored recipes (`withSeedRecipes` only adds missing ids and never rewrites them), changes to Recetas rendering, the AI JSON contract and the recipe tests. It is disproportionate when the measured parse coverage is already 100% (see below). Keep it in mind as a later step if AI recipes prove noisy. The prompt change below is the cheap half of it.

**Recommendation: A.**

### Parser coverage (measured against the 145 seed strings)
I ran a throwaway prototype of the parser (not committed) on every distinct string in `recipes.json`:

| Rule set | Qty + recognized unit | Qty, count only (`1/2 cebolla`) | No qty, single | Compound, split | Clean | Noisy (still shown, never dropped) | Distinct items |
|---|---|---|---|---|---|---|---|
| Spec rules exactly as written | 75 | 36 | 11 | 23 | **134 / 145 (92%)** | 11 | 113 |
| Spec + 3 small extensions (below) | 78 | 33 | 11 | 23 | **145 / 145 (100%)** | 0 | 107 |

The 11 noisy lines under the literal spec fall into three patterns. Each gets a small extension:
1. **Units missing from the list:** `1 cazo de proteína…`, `1 hoja de laurel`, `1 rama de apio`. Add `cazo, hoja, rama`, plus `loncha, pizca, taza, vaso, filete, puñado, sobre` pre-emptively for AI recipes. `unidad(es)` is treated the same as a bare count (`1 unidad de X` ≡ `1 X`).
2. **Alternatives:** `leche o bebida vegetal`, `caldo de pescado o agua`, `queso fresco batido o en lonchas`, `rúcula u hojas verdes`. Keep the first alternative as the name. The original text stays visible in the detail view (R6).
3. **Trailing notes:** `al gusto`, `para terminar`, `para la sartén`. Strip these phrases from the name.

Merges produced on the seed data, all as intended: `huevo/huevos` (1+2+3), `diente/dientes de ajo`, `1/2 calabacín + 2 calabacines`, `1 patata pequeña + 200g patata`, `pechuga de pollo 120 g + 150 g`, `3× copos de avena`, `3× guisantes`, `carne picada de ternera` (with and without "(magra)"), `zumo de 1/2 limón` + `limón` from `limón, sal y eneldo`. Kept separate, as the spec wants: `cebolla` / `cebolla morada`, `arroz` / `arroz integral`, `lentejas` / `lentejas secas` / `lentejas rojas`, `claras de huevo` / `huevo`.

Aisle check: a draft list of about 70 keywords (longest match wins) put every one of the 107 seed items into a named aisle or into basics. **0 fell into "Otros".**

## Design

### Components & files
| Area | File(s) | Change |
|---|---|---|
| Week helper | `src/lib/week.ts` **(new)** | Move `weekDates()` and `DAY_NAMES` out of `plan/page.tsx`, and add `mondayOf(date)`. Plan and the list both import it, so they can't drift (spec risk). |
| Plan | `src/app/plan/page.tsx` | Import from `@/lib/week`. Add the entry `Card` (R1) between `DaySelector` and the day card, as a `Link` to `/plan/compra` showing "N por comprar · M ya los tienes" (from `useShoppingList`). |
| Parser | `src/lib/shopping/parse.ts` **(new, pure)** | `parseIngredientLine`, `normalizeKey`, the unit table, size and filler words, the plural stemmer. |
| Aggregator | `src/lib/shopping/aggregate.ts` **(new, pure)** | `collectSources` (plan → sources, R2), `aggregate` (sources → items, R4), `formatAmount`, `amountSignature`. |
| Classifier | `src/lib/shopping/classify.ts` **(new, pure)** | `AISLE_KEYWORDS`, `BASICS`, `classify(key)` → `{aisle, basic}` (R11, R12). Fixed in code, per the spec's assumption. |
| Pantry match | `src/lib/shopping/pantryMatch.ts` **(new, pure)** | `matchPantry(key, pantry, today)` → `{match?, expiredMatch?}` (R5). |
| State | `src/lib/shopping/state.ts` **(new, pure)** | `ShoppingState` type, `forWeek`, `toggleBought`, `setOverride`, `recordMove`, `undoMove`, and the usage counters. |
| View | `src/lib/shopping/view.ts` **(new, pure)** | `buildShoppingView(...)` → sections and counts, the single function the UI and the Plan card both call. |
| Hook | `src/lib/shopping/useShoppingList.ts` **(new, client)** | `useMemo` wrapper over `useApp()` + `buildShoppingView`, plus action callbacks. The only non-pure file in the folder. |
| Store | `src/lib/store.tsx` | New `usePersisted<ShoppingState>(k("shopping"), EMPTY)` + `setShopping`. New batch actions `addPantryItems(items[])` and `removePantryItems(ids[])`, each a single write. |
| Types | `src/lib/types.ts` | `PantryItem.addedFromListAt?: string` (ISO date, optional, so existing data needs no migration), used for the "Nuevo" chip. |
| List page | `src/app/plan/compra/page.tsx` **(new)** | List screen, detail sheet, move-to-Despensa sheet, empty state. |
| New primitives | `src/components/ui/Sheet.tsx`, `src/components/ui/Toast.tsx` **(new)** | Bottom sheet (detail, move review) and undo toast. Collapsible sections use native `<details>/<summary>`, so they need no component. |
| Despensa | `src/app/despensa/page.tsx` | `Chip tone="accent"` "Nuevo" when `addedFromListAt === todayStr()`. Undo toast when the store's `shopping.current.lastMove` is recent (R13). |
| Nav | `src/components/AppShell.tsx` | Active tab becomes `pathname === href \|\| (href !== "/" && pathname.startsWith(href + "/"))`, so Plan stays highlighted on `/plan/compra`. |
| AI prompt | `src/lib/recipePrompt.ts` | Stricter ingredient format (see "AI recipe prompt"). Independent Should task. |

### Pieces from design-refresh this depends on (all already in `origin/main`)
- **Tokens** in `globals.css`: `--color-surface`, `--color-surface-2`, `--color-border`, `--color-text(-muted)`, `--color-accent`/`--color-on-accent`, `--color-expired`, `--color-expiring`, `font-display`.
- **`Card`** (`padding` prop) for the Plan entry card, aisle sections and rows. **`Chip`**: `accent` for "Nuevo", `expired` for "El de tu Despensa está caducado", `neutral` for "Tienes: …". **`inputCls`** for the location `<select>` in the move sheet.
- **Redesigned Plan layout** (`DaySelector` + day `Card`): the entry card slots between them. It is week-level, so it doesn't follow the selected day.
- **`lucide-react`**: `ShoppingCart` (entry), `Check`/`Circle` (bought toggle), `ChevronDown`, `Undo2`. **`PANTRY_CATEGORY_ICONS`** (Lucide) for the location picker.
- **`tests/e2e/accessibility.spec.ts`** (axe `color-contrast`): add `/plan/compra` to it.
- Not provided by design-refresh, so added here: `Sheet` and `Toast`.

### Data model
New persisted key `mp_<userId>_shopping`. No migration: it's absent → `EMPTY`.

```ts
// src/lib/shopping/state.ts
export interface ShoppingWeekState {
  week: string;                        // Monday, YYYY-MM-DD
  bought: Record<string, string>;      // itemKey → amountSignature at the time of ticking (R7, R9)
  overrides: string[];                 // itemKeys forced from "Ya lo tienes" to to-buy (R6)
  moved: Record<string, string>;       // itemKey → signature when moved to the Despensa (R14)
  lastMove?: { at: string; pantryIds: string[]; entries: Record<string, string> }; // for undo (R13)
}
export interface ShoppingState {
  current: ShoppingWeekState;
  usage: Record<string, { bought: number; overrides: number }>; // per past week, capped to 12 (success metrics)
}
```
- `forWeek(state, monday)`: if `current.week !== monday`, return an empty week. The old week's counts are folded into `usage` on the next write, and `usage` is trimmed to 12 entries. Old item-level state is discarded, as the edge case asks.
- Bought iff `bought[key] === amountSignature(item)`. Moved items (signature still equal) are hidden from the list. If the plan later changes their total, they come back as to-buy.
- `PantryItem.addedFromListAt?: string`: set only by the move flow.

### APIs / interfaces
```ts
// parse.ts
export type Unit = "g"|"kg"|"ml"|"l"|"cucharada"|"cucharadita"|"lata"|"bote"|"diente"|"rebanada"
  |"cazo"|"hoja"|"rama"|"loncha"|"pizca"|"taza"|"vaso"|"filete"|"puñado"|"sobre"; // null = bare count
export interface ParsedIngredient {
  raw: string; qty: number | null; unit: Unit | null;
  name: string;      // display: cleaned, accents kept ("garbanzos cocidos")
  key: string;       // normalized: no accents/case, no size/filler words, per-word singular ("garbanzo cocido")
  optional: boolean; // "(opcional)" seen
  parsed: boolean;   // false → fallback item with original text (R3)
}
export function parseIngredientLine(line: string): ParsedIngredient[]; // never returns []
export function normalizeKey(name: string): string;                     // also used for Despensa names

// aggregate.ts
export interface ItemSource { date: string; mealType: MealType; recipeId: string; recipeName: string; raw: string; qty: number|null; unit: Unit|null }
export interface ShoppingItem { key: string; name: string; amounts: { unit: Unit|null; qty: number }[]; // first-seen order
  sources: ItemSource[]; optional: boolean; aisle: Aisle; basic: boolean }
export function collectSources(i: { weekPlan: WeekPlan; recipes: Recipe[]; dates: string[]; meals: MealType[] }): ItemSource[];
export function aggregate(sources: ItemSource[]): ShoppingItem[];
export function formatAmount(item: ShoppingItem): string;    // "300 g", "200 g + 1 bote", "4", "1½", "al gusto"
export function amountSignature(item: ShoppingItem): string; // stable string of amounts, e.g. "g:300|bote:1"

// view.ts
export function buildShoppingView(i: { items: ShoppingItem[]; pantry: PantryItem[]; state: ShoppingWeekState; today: string }): {
  toBuy: Record<Aisle, Row[]>; haveIt: Row[]; basics: Row[]; bought: Row[];
  counts: { pending: number; toBuyTotal: number; bought: number; haveIt: number };
};
```
Parsing rules (in order):
1. Detect `zumo de <qty> X` → X with that qty.
2. Leading qty (int, decimal with `.` or `,`, `a/b`, `½ ¼ ¾`).
3. Optional unit (table above, singular/plural merged, no space needed: `150g`).
4. The rest is the name. Parenthetical notes are removed (`(opcional)` → flag). Size words and a leading `de` are removed. The first ` o `/` u ` alternative is kept. `al gusto` / `para …` are stripped.
5. Lines **without** a leading qty are split on `,` and ` y ` into one item per ingredient. Lines with a qty are never split, which avoids breaking names.
6. Empty result → one `parsed:false` item with the original text.

Key stemming, per word, skipping `de`: `-ces → -z`, `[nrldzjs]es → strip "es"`, `-s → strip "s"`, applied to both forms, so `dientes/diente`, `calabacines/calabacín`, `champiñones/champiñón`, `lomos/lomo` collapse.

Display name: the first-seen `name`, capitalized. When the total count is > 1 and a plural form was seen, use the plural ("Huevos · 4").

Amount formatting: sum per unit. `formatQty` renders fractions within 0.01 of ¼, ½, ¾ as glyphs (`1½`), otherwise at most one decimal. A mix of quantified and unquantified sources shows the quantified sum. "al gusto" appears only when no source had a quantity.

Despensa match: `words(key(ingredient)) ⊆ words(normalizeKey(pantry.name))`, ignoring `de`. The first unexpired match is used. If only expired items match, `expiredMatch` is set. Basics skip matching entirely.

### UI
| Prototype artboard | Implementation |
|---|---|
| 1 · Plan semanal (entry card) | `Card` + `Link` in `plan/page.tsx`: "Lista de la compra · {pending} por comprar · {haveIt} ya los tienes". With no qualifying recipes it still shows, reading "Nada que comprar todavía", and links to the empty state (R10). |
| 2 · Lista de la compra | `plan/compra/page.tsx`: header ("N comidas planificadas · Desayuno, Comida y Cena"), a progress bar "N de M comprados", aisle `Card`s (`Frutas y verduras`, `Carne y pescado`, `Lácteos y huevos`, `Despensa y conservas`, `Otros`, empty ones hidden), then `<details>` "Ya lo tienes" (open), `<details>` "Especias y básicos" (closed), `<details>` "Comprados" (closed). Each row has a checkbox-role button (tick) and a name button (opens the detail). |
| 3 · Detalle "ya lo tienes" | `Sheet`: total, the source list (day · meal · recipe · raw amount), the matched Despensa item + category, "Añadir a la lista de todos modos" (or "Quitar de la lista" to undo an override). |
| 4 · En la tienda | Same page. When `bought > 0`, a sticky accent button "Pasar {n} comprados a la Despensa". |
| 5 · Pasar a la Despensa | `Sheet`: per item a checkbox + name + `formatAmount` + a location `<select>` prefilled from the aisle (Frutas y verduras, Carne y pescado, Lácteos y huevos → Nevera; the rest → Despensa). Confirm → `addPantryItems` + `recordMove` → `router.push("/despensa")`. |
| 6 · Despensa actualizada | `despensa/page.tsx`: "Nuevo" chips and a `Toast` "{n} añadidos · Deshacer" (about 10 s) that calls `removePantryItems(lastMove.pantryIds)` + `undoMove`. |
| 7 · Estado vacío | "Nada que comprar todavía" + a `Link` "Ir al Plan" → `/plan`. |

The whole page is a client component, like every other screen. There is no `useSearchParams`: the detail and sheet are `useState`.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Plan entry card reads `counts.pending` and `counts.haveIt` from the same `buildShoppingView` the list uses, so they can't disagree. |
| R2 | `collectSources` iterates `weekDates(todayStr())` from the shared `@/lib/week`, filters `meals.includes(slot.mealType)`, and skips missing recipes. Each slot adds its own sources, so a recipe planned twice counts twice. |
| R3 | `parseIngredientLine` (compound split, `parsed:false` fallback, never empty). Covered by a corpus test over all seed strings. |
| R4 | `aggregate` groups by `key` and sums per identical unit. `formatAmount` joins different units with " + " and shows "al gusto" when no quantity was given. |
| R5 | `matchPantry` (word-subset, first unexpired). An expired-only match puts the row in to-buy with an `expired` chip. |
| R6 | `Sheet` detail from `item.sources` + the match. The override is stored in `current.overrides`, scoped to the week. |
| R7 | `toggleBought` writes or deletes `bought[key]`. The `Comprados` `<details>` holds them, and the progress line uses `counts`. |
| R8 | `mp_<userId>_shopping` via `usePersisted`/`userKey`. `forWeek` resets on a new Monday. |
| R9 | Derived list + bought-iff-signature-matches. No reconciliation code. |
| R10 | Empty state when `collectSources` returns [] (active, assigned, existing recipes only). |
| R11 | `classify` with longest-keyword match, falling back to `Otros`. |
| R12 | `BASICS` list, collapsed `<details>`, excluded from `counts`. `aceite` is explicitly not a basic. |
| R13 | Move `Sheet` → `addPantryItems` (always new lines, fresh `id`s, `addedFromListAt`) + `recordMove`. Undo via `lastMove`. |
| R14 | `moved[key]` hides the item while its signature is unchanged. |

## Risks & mitigations
- **AI recipes in new shapes.** R3's fallback means nothing is ever dropped. The corpus test pins the known shapes. The prompt change below reduces new noise. Once real AI output exists, add every new noisy line to the test fixture as a regression case.
- **Stale-closure writes in the store.** Looping `addPantryItem` loses items. Mitigation: `addPantryItems`/`removePantryItems` batch actions, and each user action does exactly one `setShopping` and one pantry write. Unit-test the pure `state.ts` transitions, and cover the 35-item move + undo in e2e.
- **False positives in "Ya lo tienes"** (word-subset). Seen in the seed data: `huevo` matches a Despensa "Claras de huevo", `leche` matches "Leche de coco", `aceite` matches any oil. The spec accepts this, and R6 shows the matched item and allows an override. The override counter in `usage` tells whether it's a problem.
- **Keyword lists need curating** (aisles, basics). They sit in one file with a unit test per aisle. Unknown items land in "Otros" and are never lost.
- **Week boundary while the app is open.** The list uses `todayStr()` per render, like Plan does after the midnight fix (`6b02350`). `forWeek` handles the rollover lazily.
- **localStorage growth:** one small object per user. `usage` is capped at 12 weeks.

## Testing strategy
- **Unit (Vitest, `tests/unit/`, node env, no DOM):**
  - `shopping-parse.test.ts`: one table-driven case per spec normalization rule and each R3/R4 example (`"1 bote pequeño de garbanzos cocidos (240g)"` → 1 bote garbanzos cocidos; `"sal, pimienta y ajo en polvo"` → 3 items; the unparseable fallback; fractions `1/2`, `½`, `1,5`; `150g` vs `150 g`; plurals; `zumo de 1/2 lima`; `(opcional)` flag). **A corpus test** loads `src/data/recipes.json`: every line yields ≥ 1 item, no empty names, no names containing ` o `, `al gusto` or `para`, and a snapshot of the key set, so any change to the rules shows up in review.
  - `shopping-aggregate.test.ts`: R2 (inactive meal ignored, other weeks ignored, same recipe twice counts twice, deleted recipe ignored), R4 (brócoli 300 g, huevos 4, `200 g + 1 bote`, patata `200 g + 1`, cebolla vs cebolla morada, no duplicate keys), formatting (½+½ = 1, ½×3 = 1½, one decimal).
  - `shopping-classify.test.ts`: brócoli → Frutas y verduras, unknown → Otros, sal/pimienta/orégano/vinagre → basic, aceite de oliva → not basic.
  - `shopping-pantry.test.ts`: arroz ↔ Arroz integral, lomo de salmón ↔ Lomos de salmón, expired → `expiredMatch`, no date → valid.
  - `shopping-state.test.ts`: R8 new week → empty and folded into `usage`; R9 total changed → unbought, unrelated change → still bought; override; record/undo move; R14 hides moved.
  - `week.test.ts`: `weekDates`/`mondayOf` across Sunday and month or year boundaries.
  - `recipe-prompt.test.ts` (extend): the prompt contains the ingredient-format rule.
- **E2E (Playwright, `tests/e2e/shopping-list.spec.ts`)**, seeding `weekplan`/`pantry`/`profile` through `signIn` with `TODAY = 2026-09-22`: R1 card counts equal the list's counts; R2 Merienda recipe with `lucia` (Merienda active) vs `manuel` (inactive); R5 "Tienes: Arroz integral · 1 kg" and the expired asparagus note; R6 override survives a reload; R7/R8 tick 5, reload, same 5, second user isolated; R9 remove one broccoli slot in Plan → 150 g and unbought; R10 empty state → "Ir al Plan"; R13/R14 move → Despensa shows "Nuevo" items → Deshacer restores them. Add `/plan/compra` to `accessibility.spec.ts`.

## Test notes
Written by dev-test (2026-09-23), tests-first. Where the API above was ambiguous, the tests pick the reading below. dev-code implements to match, or changes test and doc together and says why.

**API decisions**
1. **`week.ts`** exports `weekDates(date)`, `mondayOf(date)` and `DAY_NAMES`, all using the local-date `YYYY-MM-DD` strings Plan uses today.
2. **`parse.ts`**
   - A unit is only looked for right after a leading quantity, and only as a whole word. `"1 limón"` has no unit, and `"hojas de lechuga"` (no quantity) is all name.
   - `unidad(es)` gives `unit: null`, the same as a bare count.
   - `ParsedIngredient.name` keeps the source casing and accents (`"brócoli"`). Capitalizing is done in `aggregate`.
   - The fallback item is `{ raw, name: raw, qty: null, unit: null, parsed: false }`. Examples: `"250g"`, `"½"` and `"(para decorar)"` all end up with an empty name.
   - `normalizeKey(name)` applies the same name rules as the parser: parentheses, size words, leading `de`, alternatives and trailing notes. So `normalizeKey("Garbanzos cocidos (bote)") === "garbanzo cocido"`.
3. **`aggregate.ts`**
   - `ItemSource` is `{ date, mealType, recipeId, recipeName } & ParsedIngredient`. `aggregate` needs each source's `key`/`name`/`optional`, and a compound line produces one source per ingredient.
   - Sources are ordered by date, then by `MEAL_TYPES` order within a day.
   - `ShoppingItem.name` is the first-seen name, capitalized. It becomes the plural when a plural form was seen and the bare count is > 1 ("Huevos").
   - `formatAmount`:
     - quantity and unit are separated by a space (`"300 g"`);
     - ¼ ½ ¾ are shown as glyphs (`"1½"`, `"¾"`);
     - other decimals are rounded to one place and use a **comma** (`"1,3 l"`);
     - different units are joined with `" + "` in first-seen order;
     - `"al gusto"` is shown only when no source had a quantity.
     
     The tests don't pin the plural spelling of units ("2 botes").
   - `amountSignature` is only tested for equality: the same total gives the same signature, and a different total gives a different one.
   - `ShoppingItem.optional`: only the single-source case is tested. Suggested rule: true iff every source was optional.
4. **`classify.ts`** exports `type Aisle` and `AISLES` (the five, in list order). `classify(key)` returns exactly `{ aisle, basic }`. For basics, `aisle` isn't asserted. The tests pin these basics: sal, pimienta, orégano, vinagre, agua, comino, pimentón, canela, caldo en pastilla. They also pin one aisle per example in `shopping-classify.test.ts`, and require that none of the seed ingredients lands in "Otros".
5. **`pantryMatch.ts`**
   - Returns `{}` when nothing matches, `{ match }` for the first unexpired match in Despensa order, and `{ expiredMatch }` only when every match has expired.
   - "Expired" means `expiryDate < today`, using the `today` argument (not the system clock), so an item that expires today still counts.
   - The ingredient's `de` is ignored.
6. **`state.ts`**
   - `EMPTY = { current: { week: "", bought: {}, overrides: [], moved: {} }, usage: {} }`.
   - The transitions take and return a **`ShoppingWeekState`**, not the whole `ShoppingState`. The hook does `setShopping({ ...s, current: toggleBought(s.current, …) })` after `s = forWeek(shopping, monday)`.
   - `toggleBought(week, key, signature)` removes the entry only when the stored signature equals the one given. Otherwise it stores the new one, so re-ticking an item whose total changed marks it at the new total.
   - `setOverride(week, key, on)` is idempotent.
   - `recordMove(week, move)` takes the `lastMove` shape `{ at, pantryIds, entries: key → signature }`. It records `moved`, removes those keys from `bought`, and stores `lastMove`.
   - `undoMove(week)` puts the entries back into `bought`, removes them from `moved` and clears `lastMove`.
   - `forWeek(state, monday)` returns `state` unchanged for the same week. For a new week it returns an empty `current` and folds the old week into `usage[oldMonday] = { bought: |bought| + |moved|, overrides: |overrides| }`, keeping the 12 most recent weeks. A `week: ""` week (from `EMPTY`) isn't folded.
   - All transitions are pure. Tests call them with frozen input.
7. **`view.ts`**
   - `Row = { item: ShoppingItem; amount: string /* formatAmount */; bought: boolean; overridden: boolean; match?: PantryItem; expiredMatch?: PantryItem }`.
   - `toBuy` always has all five aisle keys, with empty arrays for empty aisles.
   - Basics are never matched against the Despensa.
   - An overridden row goes to `toBuy[aisle]` and keeps its `match`, so the detail can still show it.
   - A bought basic appears in `bought`, not in `basics`, and isn't counted.
   - `counts`:
     - `pending` = the number of `toBuy` rows;
     - `bought` = non-basic rows in `bought`;
     - `toBuyTotal = pending + bought`;
     - `haveIt` = the number of `haveIt` rows.
8. **Seed corpus:** all 145 distinct seed lines parse cleanly (`parsed: true`) into **107 distinct keys**, with the merges and separations listed under "Parser coverage". A `toMatchSnapshot()` of the sorted key set is written on dev-code's first local run. Review it before committing, because CI refuses to write new snapshots.

Validation: all unit tests were run against a throwaway reference implementation of these modules. It was not committed, but it proves the tests are consistent and passable: 141/141 green, typecheck and lint clean.

**UI test contract** (`tests/e2e/shopping-list.spec.ts`; the copy is from the spec)
- The page has an `h1` "Lista de la compra" and a progress text "`{bought} de {toBuyTotal} comprados`".
- **Aisle group:** `<section aria-label="{Aisle}">` (role `region`). Empty aisles aren't rendered.
- **Collapsible groups:** native `<details>`, with a `<summary>` whose text starts with "Ya lo tienes" (open by default), "Especias y básicos" (closed) or "Comprados" (closed).
- **Item row:** an `<li>` containing:
  - a button whose accessible name starts with `"{Name} · {amount}"` (e.g. "Brócoli · 300 g", "Huevos · 4", "Cebolla · ½"), which opens the detail;
  - in to-buy, basics and Comprados rows, a checkbox (native or `role="checkbox"`) whose accessible name is exactly the display name ("Brócoli"), checked iff the item is bought;
  - notes as visible row text: "Tienes: {Despensa name} · {quantity}" and "El de tu Despensa está caducado".
- **Detail:** `role="dialog"` named by the item's display name. It shows the total, one `<li>` per use (day name, meal, recipe name, original line) and "{name} · {quantity} · {category}" for the matched Despensa item. "Añadir a la lista de todos modos" applies the override **and closes the dialog**.
- **Plan entry:** a link to `/plan/compra` whose name contains "Lista de la compra" and "`{N} por comprar · {M} ya los tienes`", or "Nada que comprar todavía" when the week is empty.
- **Empty state:** the text "Nada que comprar todavía" and a link "Ir al Plan".
- **Move flow:**
  - a button "`Pasar {n} comprados a la Despensa`" opens a `role="dialog"` named "Pasar a la Despensa";
  - each item has a checkbox named after the item (checked by default) and a `<select aria-label="Ubicación de {Name}">` with the options Nevera, Despensa and Congelador;
  - the confirm button reads "`Añadir {k} a la Despensa`";
  - after confirming, the app navigates to `/despensa`.
- **Despensa after a move:**
  - the toast is `role="status"` with "`{k} añadidos`" and a "Deshacer" button;
  - the "Nuevo" chip sits in the same element as the item's name and quantity (today's row markup);
  - moved items are stored with `addedFromListAt: today`, with `quantity` = `formatAmount` ("300 g", "1 bote").

## Test coverage
Commands: `npm test` (unit), `npm run test:e2e` (e2e). Status as of dev-test: 🔴 means the test fails because `src/lib/shopping/*`, `src/lib/week.ts` or `/plan/compra` don't exist yet. These tests define "done" for dev-code.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/unit/shopping-state.test.ts` › "R1: recuentos…" (3) | unit | 🟢 passing |
| R1 | `tests/e2e/shopping-list.spec.ts` › "R1: entrada desde Plan" › card shows `10 por comprar · 2 ya los tienes` and matches the list; N goes down after ticking; Plan tab stays active on `/plan/compra` | e2e | 🟢 passing |
| R2 | `tests/unit/shopping-aggregate.test.ts` › "R2: qué recetas entran en la lista" (inactive Merienda, other weeks, same recipe twice, deleted recipe, sources carry day/meal/recipe/line, compound line = one source per ingredient); `tests/unit/week.test.ts` (Mon–Sun, Sunday, month/year boundaries) | unit | 🟢 passing |
| R2 | `shopping-list.spec.ts` › "R2: …" (Merienda active vs. Manuel inactive, other weeks absent, same recipe twice = 300 g) | e2e | 🟢 passing |
| R3 | `tests/unit/shopping-parse.test.ts` › "R3: cantidad, unidad y nombre", "cantidades", "líneas con varios ingredientes", "una línea ilegible nunca se pierde", **corpus** (145 lines, 145/145 clean, no leftover notes, 107 keys, key snapshot, expected merges/separations) | unit | 🟢 passing |
| R3 | `shopping-list.spec.ts` › "R3 · R4" › garbanzos → "Garbanzos cocidos · 1 bote"; "sal, pimienta y orégano" → 3 items | e2e | 🟢 passing |
| R4 | `shopping-parse.test.ts` › "Normalización" (every spec rule); `shopping-aggregate.test.ts` › "R4: ingredientes iguales se suman" (brócoli 300 g, Huevos 4, `200 g + 1 bote`, `Patata · 200 g + 1`, cebolla ≠ cebolla morada, no g↔kg, al gusto, mixed qty, opcional, **no duplicate keys over all 40 seed recipes**) + "Edge cases: formato" + "amountSignature" | unit | 🟢 passing |
| R4 | `shopping-list.spec.ts` › "Brócoli · 300 g" (single), "Huevos · 4", "Cebolla · ½" + "Cebolla morada · ¼" | e2e | 🟢 passing |
| R5 | `tests/unit/shopping-pantry.test.ts` (word subset, plurals/accents, `de` ignored, no reverse match, expired → `expiredMatch`, expires today = valid, no date = valid, first unexpired wins); `shopping-state.test.ts` › "R5: Ya lo tienes" (+ aceite de oliva matches) | unit | 🟢 passing |
| R5 | `shopping-list.spec.ts` › "R5" › "Tienes: Arroz integral · 1 kg" not counted; expired asparagus note | e2e | 🟢 passing |
| R6 | `shopping-state.test.ts` › "R6" (420 g, 3 sources, match; override → Carne y pescado, keeps match, counts; un-override; idempotent) | unit | 🟢 passing |
| R6 | `shopping-list.spec.ts` › "R6" › detail content; override moves the item and survives a reload | e2e | 🟢 passing |
| R7 | `shopping-state.test.ts` › "R7" (tick/untick; basics tickable but not counted) | unit | 🟢 passing |
| R7 | `shopping-list.spec.ts` › "R7" › tick → Comprados, `1 de 10`; untick → back | e2e | 🟢 passing |
| R8 | `shopping-state.test.ts` › "R8" (EMPTY, same week unchanged, new week empty + usage counter, last week's bought not shown, 12-week cap) + "transiciones puras" | unit | 🟢 passing |
| R8 | `shopping-list.spec.ts` › "R8" › 5 bought survive a reload (+ `mp_<user>_shopping`); two users isolated; next Monday starts empty | e2e | 🟢 passing |
| R9 | `shopping-state.test.ts` › "R9" (total changed → unbought 150 g; unrelated change keeps it bought; removed item disappears; re-tick at new total) | unit | 🟢 passing |
| R9 | `shopping-list.spec.ts` › "R9" › remove a broccoli recipe in Plan → 150 g unbought; unrelated slot change → Huevos still bought | e2e | 🟢 passing |
| R10 | `shopping-list.spec.ts` › "R10" › empty state + "Ir al Plan"; only-inactive-slot week is empty; Plan card says "Nada que comprar todavía" | e2e | 🟢 passing |
| R10 | `shopping-aggregate.test.ts` › deleted recipe → no sources (the empty-state input) | unit | 🟢 passing |
| R11 (Should) | `tests/unit/shopping-classify.test.ts` › "R11: pasillos" (order, brócoli, unknown → Otros, 13 aisle examples, **0 seed items in Otros**); `shopping-state.test.ts` › "R11 · R12: secciones" | unit | 🟢 passing |
| R11 (Should) | `shopping-list.spec.ts` › "R11 · R12" › aisle regions | e2e | 🟢 passing |
| R12 (Should) | `shopping-classify.test.ts` › "R12" (9 basics, aceite de oliva not basic, fresh herbs → Frutas y verduras); `shopping-state.test.ts` (basics never matched, excluded from counts) | unit | 🟢 passing |
| R12 (Should) | `shopping-list.spec.ts` › "Especias y básicos" collapsed and not counted | e2e | 🟢 passing |
| R13 (Should) | `shopping-state.test.ts` › "R13 · R14" (`lastMove`, undo restores to Comprados) | unit | 🟢 passing |
| R13 (Should) | `shopping-list.spec.ts` › "R13 · R14" › review sheet (suggested locations, change one, leave one out) → Despensa items with "Nuevo" + toast; same-name item → new line; Deshacer removes them and restores Comprados | e2e | 🟢 passing |
| R14 (Should) | `shopping-state.test.ts` › moved items leave the list, come back if their total changes; `shopping-list.spec.ts` › moved items gone from Comprados | unit + e2e | 🟢 passing |
| Contrast (design-refresh R6) | `tests/e2e/accessibility.spec.ts` › "Lista de la compra" | e2e (axe) | 🟢 passing |

Not automated: the 35-item move from the spec's example. The e2e move uses 2–3 items, because the store's batch write is what matters and it's the same code path. The ~10 s undo timeout isn't asserted, to avoid a timing-based test. The "Nuevo" chip is only shown for today's moves, not the next day. Task 14 (the prompt change) needs no new test yet.

**Typecheck while red:** `npm run typecheck` currently fails only with `TS2307 Cannot find module '@/lib/shopping/*' / '@/lib/week'`, plus the `TS7006` implicit-`any` errors those cause in the test files. With the modules in place (checked against the reference implementation) it's clean. The test files were **not** excluded from `tsconfig`, so they're type-checked against the real API as soon as it exists. ESLint is clean on `src/`, `tests/` and the root configs. Locally, `npm run lint` also scans the untracked `.claude/worktrees/` copies (pre-existing, not in git), which CI doesn't have. The branch is local only, so CI is unaffected until dev-code pushes.

## Tasks
Every task leaves the app working. Tasks 2–7 are pure logic with unit tests and no UI, so they can be written test-first with dev-test.

1. [x] Branch from up-to-date `origin/main` (design-refresh merged). Extract `weekDates`, `DAY_NAMES` and a new `mondayOf` into `src/lib/week.ts`, make `plan/page.tsx` import them, and add `week.test.ts`. Pure refactor. (R2 prerequisite)
2. [x] **Pure ingredient parser** `src/lib/shopping/parse.ts` + `shopping-parse.test.ts`, including the seed-corpus test. (R3, R4 normalization)
3. [x] **Pure aggregator** `src/lib/shopping/aggregate.ts` (`collectSources`, `aggregate`, `formatAmount`, `amountSignature`) + `shopping-aggregate.test.ts`. (R2, R4)
4. [x] **Pure classifier** `src/lib/shopping/classify.ts` (aisles + basics keyword lists) + tests. (R11, R12)
5. [x] **Pure Despensa matcher** `src/lib/shopping/pantryMatch.ts` + tests. (R5)
6. [x] **Pure state + view** `src/lib/shopping/state.ts` and `view.ts` + `shopping-state.test.ts`. (R6–R9, R14 logic, usage counters)
7. [x] Store: `shopping` persisted key + `setShopping`; batch `addPantryItems`/`removePantryItems`; `PantryItem.addedFromListAt?`; `useShoppingList` hook. No UI yet. (R8, R13 prerequisite)
8. [x] `Sheet` and `Toast` primitives in `src/components/ui/`. AppShell active-tab prefix match. (UI prerequisites)
9. [x] List page `/plan/compra`: header, progress, aisle sections, "Ya lo tienes", "Especias y básicos", "Comprados", tick/untick, empty state. (R2–R5, R7, R10–R12)
10. [x] Item detail sheet with override. (R6)
11. [x] Plan entry card in `plan/page.tsx`. (R1)
12. [x] Move-to-Despensa sheet + Despensa "Nuevo" chip + undo toast. (R13, R14)
13. [x] E2E `tests/e2e/shopping-list.spec.ts` for every AC; add `/plan/compra` to `accessibility.spec.ts`. (all) — **written by dev-test** (see Test coverage); the task is now to make them pass.
14. [x] `recipePrompt.ts`: stricter ingredient format + test. Independent, can land any time. (risk mitigation, open question)

## AI recipe prompt (open question: answer is yes, as a cheap Should)
Recommended. It's a few prompt lines and one test assertion, it lowers noise for every future AI recipe, and it changes no contract. Add to `INSTRUCCIONES` in `buildRecipePrompt`, and replace the `"ingrediente 1"` placeholder in the JSON example with real examples:

> - Cada ingrediente en su propia línea con el formato "<cantidad> <unidad> de <ingrediente>", usando solo g, kg, ml, l, cucharada, cucharadita, lata, bote, diente o rebanada; para piezas enteras, solo el número ("2 huevos", "1/2 cebolla").
> - Un ingrediente por línea: nada de "sal y pimienta" ni alternativas con "o". Condimentos sin cantidad, cada uno en su línea ("sal", "pimienta").
> - Notas entre paréntesis al final ("(en seco)", "(opcional)").

The parser must **not** depend on this. Existing stored AI recipes and the seed data keep today's shapes, and the model won't always comply. So it's a noise reducer, not a contract. No validation or rejection of AI output.

## Spec feedback
**Resolved 2026-09-23:** the user accepted every proposed default below, and they are now folded into spec.md (R1, R3 normalization rules, R12, R13, Edge cases, Success metrics).
1. **Success metrics vs. "old weeks' bought state is discarded".** The first metric ("weeks where the list is used", read from localStorage "per week") can't be measured if old weeks are wiped. Proposed default: discard item-level state but keep a tiny per-week counter `usage[monday] = {bought, overrides}`, capped at 12 weeks (in the design above). **Confirm.**
2. **R1 "N por comprar": remaining or total?** Proposed: N = to-buy items **not yet bought** (it goes down as you shop). M = "ya los tienes". Basics are excluded from both. **Confirm.**
3. **"Nuevo" lifetime and undo window aren't specified (R13).** Proposed: "Nuevo" shows for items moved **today** (`addedFromListAt === today`). The undo toast lasts about 10 s after landing on the Despensa, and undo stays possible until the next move. **Confirm.**
4. **R3 unit list is too narrow for the data.** Taken literally it leaves 11/145 seed lines noisy. Adding `cazo, hoja, rama` (+ `loncha, pizca, taza, vaso, filete, puñado, sobre` for AI recipes), keeping the first ` o ` alternative, and stripping `al gusto`/`para …` reaches 145/145. It's within R3's intent, so I'd treat it as an engineering call unless PM objects. `unidad` is merged with a bare count.
5. **Fresh herbs in basics?** R12 lists "especias". Fresh `perejil`, `albahaca`, `cebollino` and `jengibre` are usually bought fresh. Proposed: dried spices and condiments are basics; fresh herbs go to Frutas y verduras. Also on the existing open question: keep the basics list fixed in code for now (editing would need a settings UI and isn't in scope).
6. **Small AC clarifications (no decision needed, noted for tests):** "Patata · 200 g + 1" depends on first-seen order, so the test plans the 200 g recipe first. "Huevos · 4" relies on the display rule "plural if seen and total > 1". Basics can be ticked and moved but never count toward N/M. Items moved to the Despensa have no expiry date.
