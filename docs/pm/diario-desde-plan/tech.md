# Registrar comidas planificadas desde el Diario: Technical design
_Status: Approved (2026-09-23) · Updated: 2026-09-23_
_Related: [spec](spec.md) · [brief](brief.md) · [issue #6](https://github.com/mancabcar/MealPlan/issues/6) · no prototype_

## Summary
"Pendiente" is **never stored**. It is derived on each render by a new pure function `pendingSlots()` in `src/lib/diary.ts` from `weekPlan`, `entries`, `recipes`, `profile.meals`, the selected date and today. The Diario (`src/app/page.tsx`) renders each pending slot **inside its own meal card** as a muted row with a "Pendiente" chip and a "Hecho" button. "Hecho" calls the existing `addEntry` with an entry built by a shared `recipeEntry()` helper, which `submitAdd` also uses. No data model, store or migration changes. Effort: **S** (about 1 day including tests).

## Context
- Stack: Next 16.2.9 App Router, React 19.2.4, Tailwind v4 tokens, `lucide-react`. The Diario is a client page and all data lives in localStorage via `AppProvider` (`src/lib/store.tsx`), so nothing Next-specific is involved (no routing, no search params, no server code).
- **Diario** (`src/app/page.tsx`): `date` state (default `todayStr()`, changed by `<input type="date">`), `dayEntries = entries.filter(e => e.date === date)`, totals, ring, 7-day `WeekBarChart`, macro bars, then `MEAL_TYPES.map(...)` rendering one `Card` per meal type **only when `items.length > 0`** (line 153). It iterates `MEAL_TYPES`, not `profile.meals`, so old entries of dropped meal types still show (covered by `tests/e2e/meals.spec.ts` › "Edge case"). `submitAdd` (line 102) builds a recipe entry by copying `calories/protein/carbs/fat` from the recipe.
- **Data** (`src/lib/types.ts`): `WeekPlan = Record<date, DayPlanSlot[]>`, `DayPlanSlot = { mealType, recipeId }`. `MealEntry = { id, date, mealType, recipeId?, customName?, calories, protein, carbs, fat }`. `todayStr()` gives local YYYY-MM-DD, so dates compare correctly as strings.
- **Plan** (`src/app/plan/page.tsx`): active meals are `profile?.meals ?? MEAL_TYPES`; slots whose meal type isn't in them are hidden (line 44), and the slot for a meal type is the first match (`slots.find`). A missing recipe renders as "Añadir". We mirror both rules.
- **Store**: `addEntry` / `removeEntry` go through `usePersisted`'s setter, which since `3f15e17` chains writes within the same event (`latest` ref). So calling `addEntry` several times in one click handler keeps all of them. There's no `removeRecipe`, so a "deleted recipe" only happens with stale/imported data, but we still guard it.
- `migrateWeekPlan` never prunes old dates, so the plan for past weeks is still there (relevant to the "Days in past weeks" edge case).
- **Tests**: Vitest (`tests/unit`, `environment: "node"`, pure logic) and Playwright (`tests/e2e`, clock fixed at `TODAY = 2026-09-22` by `signIn`, seed any `mp_<user>_<key>` through its `data` arg, including `weekplan`). No existing Diario e2e seeds a `weekplan`, so no current test changes behaviour. `tests/e2e/accessibility.spec.ts` runs axe `color-contrast` on `/`.

## Approaches considered

### A. Derived pending + rows inside each meal card (recommended)
A pure `pendingSlots()` computes the list. The meal-card loop renders a card when it has entries **or** a pending slot. Because *any* entry of that meal type clears the slot, a card holds either entries or one pending row, never both, so there's no mixed-state layout to design. "Hecho" appends a normal `MealEntry`; on re-render the slot is no longer pending and the same card shows the entry with ✕.
- **Pros:** matches the spec's own flow ("Under 'Comida' they see the planned recipe…", "the row becomes a normal logged entry") and the brief's prototype decision ("una fila nueva dentro de las tarjetas por franja"). R9 order comes free from the existing `MEAL_TYPES` loop. The row doesn't jump elsewhere after "Hecho", it just changes in place. R3/R6 hold by construction (no flags to keep in sync). Zero storage changes.
- **Cons:** cards now appear for meal types with no entries, which changes the Diario's look on planned days (intended). The muted styling has to pass the axe contrast check.
- **Effort:** S.

### B. Derived pending + a separate "Pendiente" section above the meal cards
Same `pendingSlots()`, but rendered as one card listing every pending slot, with "Registrar todo el día" at its foot.
- **Pros:** "Registrar todo el día" has an obvious home; meal cards stay "entries only".
- **Cons:** the meal type appears in two places, and after "Hecho" the item moves from the Pendiente card to a meal card lower down (feels like it vanished, especially on a phone where the meal cards are below the ring, chart and macro bars). It contradicts the spec's user flow and the brief. Rejected.

### C. Persist a "done" flag on the plan slot
Add `done?: boolean` (or `entryId`) to `DayPlanSlot` and set it on "Hecho".
- **Cons:** two sources of truth that must be reconciled on every add and delete (R4 "any entry clears it", R6 "deleting makes it pending again"), a type change touching Plan and the lista-compra `collectSources`, and the spec explicitly makes "remembering the origin" a non-goal. Rejected.

**Recommendation: A.**

## Design

### Components & files
| Area | File(s) | Change |
|---|---|---|
| Pure logic | `src/lib/diary.ts` **(new)** | `recipeEntry()` and `pendingSlots()` (see APIs). No React, no store. |
| Diario | `src/app/page.tsx` | `submitAdd` uses `recipeEntry()`. Compute `pending = pendingSlots(...)`. Meal-card loop renders when `items.length > 0 \|\| slot`. Pending row, "Hecho" handler, "Registrar todo el día" button. Card becomes a labelled `section` (see UI). |
| Unit tests | `tests/unit/diary.test.ts` **(new)** | Every pending rule + `recipeEntry`. |
| E2E | `tests/e2e/diario-desde-plan.spec.ts` **(new)**, `tests/e2e/accessibility.spec.ts` | One test per AC; add a "Diario con pendientes" contrast case. |

Not touched: `types.ts`, `store.tsx`, `migrate.ts`, Plan, lista-compra.

### Data model
None. `MealEntry`, `DayPlanSlot` and `WeekPlan` are unchanged; no new localStorage key, no migration.

### APIs / interfaces
```ts
// src/lib/diary.ts
import type { MealEntry, MealType, Recipe, WeekPlan } from "./types";

/** Entrada de receta con sus macros tal cual (la misma que el formulario "Receta"). */
export function recipeEntry(recipe: Recipe, date: string, mealType: MealType, id = crypto.randomUUID()): MealEntry;

export interface PendingSlot { mealType: MealType; recipe: Recipe }

/** Franjas planificadas sin ninguna entrada, en orden MEAL_TYPES. Vacío para fechas futuras. */
export function pendingSlots(i: {
  date: string;          // fecha seleccionada, YYYY-MM-DD
  today: string;         // todayStr(), inyectado para poder testear
  weekPlan: WeekPlan;
  recipes: Recipe[];
  entries: MealEntry[];
  meals: MealType[];     // profile.meals
}): PendingSlot[];
```
Rules, in this order (one per spec bullet):
1. `date === "" || date > today` → `[]` (R5; string compare is valid for YYYY-MM-DD; `""` covers a cleared date input).
2. For each `mt` of `MEAL_TYPES` (R9) that is in `meals`: take the **first** slot of `weekPlan[date]` with that meal type (same as Plan's `find`; covers duplicates left by the `Snack` migration).
3. Skip if the recipe isn't found (deleted recipe edge case).
4. Skip if `entries.some(e => e.date === date && e.mealType === mt)` (R3, R4, R6).

`crypto.randomUUID` is available in Node 20 (Vitest) and the browser; tests pass an explicit `id` to keep assertions exact.

### UI
No prototype; spec R7 AC gives the direction ("muted styling plus a 'Pendiente' label").

- **Meal card**: `<Card as="section" aria-labelledby={id}>` with the existing `h3` given that `id` (`useId()` prefix + index, or a slug of `mt`). This makes `getByRole("region", { name: "Comida" })` work in tests and helps screen readers. It is rendered when the meal type has entries or a pending slot. Entries render exactly as today.
- **Pending row** (only when the card has no entries): left, recipe name in `--color-text-muted` plus `Chip tone="neutral"` "Pendiente"; right, `"{kcal} kcal"` muted and a small outlined button "Hecho" with the Lucide `Check` icon (`border-[var(--color-accent)] text-[var(--color-accent)]`, same shape as the Receta/Personalizada toggles). Muted text plus the chip is enough to read as "not eaten yet", and both use tokens design-refresh already contrast-checked. Accessible name of the button: visible text "Hecho" (tests scope by the card region).
- **R10 (Could, included, ~5 lines)**: under the name, `allergenWarning(recipe, profile.allergies)` in the same expired-tone pill as `recetas/page.tsx › AllergenBadge`. Reuse by rendering `Chip tone="expired"` with the warning text.
- **"Registrar todo el día" (R8)**: when `pending.length >= 2`, a full-width secondary button (outlined, accent text, `CheckCheck` icon) directly **above** the meal cards `section`, labelled "Registrar todo el día". Its handler: `pending.forEach(p => addEntry(recipeEntry(p.recipe, date, p.mealType)))`; the chained setter keeps all writes. Hidden for future dates automatically (pending is empty).
- **Totals, ring, week chart**: unchanged code; they read `entries` only, so pending never counts (R7) and a new entry counts immediately (R3).
- **Double tap**: React flushes discrete events (click) synchronously, so after the first click the row is gone before a second click can land. The handler is also built from the current `pending`, and the same slot can't be pending once its entry exists. No extra guard needed; the e2e test double-clicks to prove it.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `pendingSlots()` → pending row with meal (card heading), recipe name and kcal. |
| R2 | "Hecho" → `addEntry(recipeEntry(recipe, date, mealType))`; `date` is the selected date, so yesterday works. |
| R3 | Pending is derived from `entries`; the new entry clears it on the same render; totals/ring/chart read `entries`. Survives reload because entries are persisted and pending isn't stored. |
| R4 | Rule 4 matches any entry of that meal type; "Añadir comida" is unchanged; `weekPlan` is never written. |
| R5 | Rule 1 (`date > today` → `[]`). |
| R6 | Removing the entry via ✕ makes rule 4 false again. |
| R7 | Muted text + "Pendiente" chip; not part of `dayEntries`, so not in any total. |
| R8 | Button above the cards when `pending.length >= 2`, loops `addEntry` over the same helper. |
| R9 | Iteration over `MEAL_TYPES` in both `pendingSlots` and the card loop. |
| R10 | `allergenWarning` chip on the pending row. |
| Edge: meal type not in `profile.meals` | Rule 2 filter; old entries of such types still render (card loop keeps using `MEAL_TYPES`). |
| Edge: deleted recipe | Rule 3. |
| Edge: midnight | `today = todayStr()` on each render, as elsewhere. |

## Risks & mitigations
- **Contrast of the muted row** (axe runs on `/`): use only existing tokens (`--color-text-muted`, `Chip neutral`, accent outline button) that design-refresh already verified; add an accessibility case seeded with pending slots.
- **Past weeks never pruned**: picking a date months ago shows its old plan as pending. That's what the spec's edge case asks for; it only appears when the user deliberately navigates back. No mitigation needed.
- **Layout change on planned days**: cards now appear for unlogged planned meals. Intended by the spec; the existing "no plan" days look exactly as before (AC R1 #2), and an e2e test asserts that.
- **Future multi-recipe slots** (spec risk): `pendingSlots` takes the first slot per meal type; if Plan ever allows several, this function is the single place to revisit.

## Testing strategy
- **Unit** `tests/unit/diary.test.ts` (pure, node env), with small inline fixtures:
  - `recipeEntry` copies the four macros, date, mealType, recipeId; no `customName`.
  - `pendingSlots`: today with a slot and no entries → pending (R1); no plan for the date → `[]`; entry of the same meal type (other recipe, custom) → not pending (R3/R4); entry of another meal type → still pending (R4 AC #2); future date → `[]` (R5); past date → pending; meal type not in `meals` → skipped; unknown recipeId → skipped; output order follows `MEAL_TYPES` even when the plan lists slots out of order (R9); duplicate slots for one meal type → first wins; `date === ""` → `[]`.
- **E2E** `tests/e2e/diario-desde-plan.spec.ts` (seed `profile`, `recipes` with Lentejas 520/30/60/12, `weekplan`, `entries` through `signIn`; use `TODAY` and `2026-09-21`/`2026-09-23` for yesterday/tomorrow):
  - R1: "Comida" region shows "Lentejas", "520 kcal", "Pendiente", button "Hecho"; no plan → no "Pendiente"/"Hecho" anywhere; all slots logged → none.
  - R2: tap "Hecho" → `readStored("entries")` has exactly one entry with the expected fields; with the date input set to yesterday → entry dated yesterday. Double-click → still one entry.
  - R3: after "Hecho", "Pendiente" gone, the card lists "Lentejas" with an "Eliminar" button, ring shows "520 kcal"; `page.reload()` → still not pending.
  - R4: add custom "Ensalada" in Comida → Lentejas no longer pending, ring shows only Ensalada's kcal, `readStored("weekplan")` unchanged; add in Cena → Comida still pending.
  - R5: date = tomorrow with a plan → no "Pendiente", no "Hecho", no "Registrar todo el día".
  - R6: "Hecho" then "Eliminar" → pending again.
  - R7: 2 pending, no entries → ring "0 kcal", both rows show "Pendiente".
  - R8: 3 pending → "Registrar todo el día" → 3 stored entries with each recipe's macros, no pending; 1 pending → button absent.
  - R10: profile with `lactosa`, planned recipe with "queso" → pending row shows "⚠ contiene Lactosa".
  - Edge: plan slot in a meal type not in `profile.meals` (e.g. Merienda for `manuel`) → not pending.
- **Accessibility**: add a "Diario con pendientes" case to `accessibility.spec.ts`.

## Tasks
1. [ ] **Pure helpers** `src/lib/diary.ts` (`recipeEntry`, `pendingSlots`) + `tests/unit/diary.test.ts`. No UI yet. (R1–R6, R9 logic)
2. [ ] **Refactor `submitAdd`** in `src/app/page.tsx` to build recipe entries with `recipeEntry()`. No behaviour change; existing tests stay green. (R2 "same result as the form")
3. [ ] **Meal cards as labelled regions** (`Card as="section" aria-labelledby`), rendered when there are entries or a pending slot; pending row with "Pendiente" chip, kcal and "Hecho". (R1–R7, R9)
4. [ ] **"Registrar todo el día"** button above the cards when ≥ 2 pending. (R8)
5. [ ] **Allergen chip** on the pending row. (R10, Could; can be dropped without affecting the rest)
6. [ ] **E2E** `tests/e2e/diario-desde-plan.spec.ts` for every AC + accessibility case. **Written by dev-test** (see Test coverage); the task is to make them pass. (all)

Each task leaves the app working; 1–2 are invisible to users, 3 delivers all Musts.

## Test coverage
Commands: `npm test` (unit), `npm run test:e2e` (e2e). Shared fixtures: `tests/fixtures/diario.ts` (Lentejas 520/30/60/12, Tortilla, Merluza, Kéfir, Macarrones con queso; hoy = 2026-09-22). Status as of dev-test (2026-09-23): 🔴 means the test fails because `src/lib/diary.ts` doesn't exist yet (unit) or the Diario has no pending rows / labelled meal regions yet (e2e). These tests define "done" for dev-code.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/unit/diary.test.ts` › "R1: franjas pendientes…" (pending with its recipe; no plan / other date / empty slots → `[]`; all logged → `[]`) | unit | 🔴 failing (not built) |
| R1 | `tests/e2e/diario-desde-plan.spec.ts` › "R1" › Comida region shows Lentejas, "520 kcal", "Pendiente", "Hecho"; all slots logged → no pending | e2e | 🔴 failing (not built) |
| R1 | `diario-desde-plan.spec.ts` › "R1" › no plan → no pending, only the "Cena" card, as today | e2e | 🟢 passing (regression guard; passes today by construction) |
| R2 | `diary.test.ts` › "recipeEntry" (copies date, meal, recipeId and the 4 macros, no customName; fresh id each call) | unit | 🔴 failing (not built) |
| R2 | `diario-desde-plan.spec.ts` › "R2" › "Hecho" → exactly one stored entry with today/Comida/Lentejas/520·30·60·12; yesterday selected → entry dated yesterday; double tap → one entry | e2e | 🔴 failing (not built) |
| R3 | `diary.test.ts` › "R3 · R4 · R6" › planned-recipe entry clears the slot; several entries of one meal | unit | 🔴 failing (not built) |
| R3 | `diario-desde-plan.spec.ts` › "R3" › row gone, entry with ✕, ring "520 kcal" and "520 / 1750"; still not pending after reload | e2e | 🔴 failing (not built) |
| R4 | `diary.test.ts` › other recipe / custom entry clear it; an entry in Cena or on another date doesn't | unit | 🔴 failing (not built) |
| R4 | `diario-desde-plan.spec.ts` › "R4" › custom "Ensalada" in Comida clears Lentejas, ring 250, stored `weekplan` unchanged, Plan still shows "Comida Lentejas"; an entry in Cena keeps Comida pending | e2e | 🔴 failing (not built) |
| R5 | `diary.test.ts` › "R5" (tomorrow → `[]`; yesterday and a date a month ago → pending; `""` → `[]`) | unit | 🔴 failing (not built) |
| R5 | `diario-desde-plan.spec.ts` › "R5" › same plan today (control: "Registrar todo el día" visible) and tomorrow → no pending, no "Hecho", no button | e2e | 🔴 failing (not built) |
| R6 | `diary.test.ts` › "R6: sin la entrada…" | unit | 🔴 failing (not built) |
| R6 | `diario-desde-plan.spec.ts` › "R6" › "Hecho" then ✕ → pending again, entries `[]`, ring 0 | e2e | 🔴 failing (not built) |
| R7 | `diario-desde-plan.spec.ts` › "R7" › 2 pending → ring "0 kcal", "0 / 1750", both show "Pendiente", no ✕ | e2e | 🔴 failing (not built) |
| R7 | `tests/e2e/accessibility.spec.ts` › "Diario con pendientes" (color-contrast of muted rows, chips, "Hecho", allergen chip, "Registrar todo el día") | e2e | 🔴 failing (not built) |
| R8 | `diario-desde-plan.spec.ts` › "R8" › 3 pending → one tap stores 3 entries with each recipe's macros, ring 1230, none left; the button sits above the first meal card; 1 pending → no button (future date: see R5) | e2e | 🔴 failing (not built) |
| R9 | `diary.test.ts` › "R9" (unordered plan → MEAL_TYPES order) | unit | 🔴 failing (not built) |
| R9 | `diario-desde-plan.spec.ts` › "R9" › card headings Desayuno, Comida, Merienda, Cena | e2e | 🔴 failing (not built) |
| R10 | `diario-desde-plan.spec.ts` › "R10" › lactosa allergy → "⚠ contiene Lactosa" on Macarrones, nothing on Merluza | e2e | 🔴 failing (not built) |
| Edge: meal not in `profile.meals` | `diary.test.ts` › "Edge cases" (Manuel vs Lucía); `diario-desde-plan.spec.ts` › "Edge cases" › Manuel's Merienda not shown | unit + e2e | 🔴 failing (not built) |
| Edge: deleted recipe | `diary.test.ts` › "Edge cases" › unknown recipeId skipped | unit | 🔴 failing (not built) |
| Edge: duplicate slots | `diary.test.ts` › "Edge cases" › first wins | unit | 🔴 failing (not built) |
| Edge: double tap | `diario-desde-plan.spec.ts` › "R2" › double tap → one entry | e2e | 🔴 failing (not built) |
| Edge: past weeks | `diary.test.ts` › "R5" › a date a month ago | unit | 🔴 failing (not built) |
| Edge: midnight | Not tested: `today` is injected into `pendingSlots`, and the page reads `todayStr()` on each render as elsewhere. An e2e would have to move the clock with the page open, for little value. | — | — |

## Spec feedback
No blocking issues; the spec is buildable as written. Proposed defaults, which dev-code will follow unless the owner objects:
1. **Where "Registrar todo el día" goes (R8)** isn't specified. Proposed: a secondary full-width button directly above the meal cards, only when ≥ 2 pending. **Confirm or redirect.**
2. **Pending lives inside the meal card**, not in a separate "Pendiente" section (spec risk resolved, see Approaches). Since any entry clears the slot, a card shows either entries or one pending row, never both.
3. **R10 (Could) is included**: it's a few lines reusing `allergenWarning`, and it's useful at the moment of logging. Drop task 5 if unwanted.
4. **Clarification, no decision needed:** in R3's AC, "the calorie total increases by 520" is checked on the ring (`img` "520 kcal") and "N / goal" text. Pending rows show the recipe's kcal too, so tests must scope kcal assertions to the ring, not page text.
5. **Clarification, no decision needed:** a date cleared in the native date input (`""`) shows no pending, same as today's behaviour of showing no entries.
