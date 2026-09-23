# Lista de la compra: Review
_PR: https://github.com/mancabcar/MealPlan/pull/24 · Reviewed: 2026-09-23 · Verdict: ⚠️ Approve with follow-ups_

## Summary
The branch implements all 14 requirements (10 Must, 4 Should) the way `tech.md` designed them. The pure `src/lib/shopping/` module derives the list, the per-week intent state is persisted, and the Plan card and the list read the same `buildShoppingView`. Every acceptance criterion has an automated unit and/or e2e test. I re-ran the checks at `80c857f`: 303/303 unit tests, 37/37 in `shopping-list.spec.ts` + `accessibility.spec.ts`, typecheck and ESLint all pass. No tests were loosened or skipped. I found no blocking issues. The most important follow-up is the plural stemmer, which fails to merge `-e` words such as "verde"/"verdes". That is a real gap in R4's "simple Spanish plural" rule, although no seed recipe triggers it.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 (Must) Plan entry, N por comprar · M ya los tienes | ✅ Done | src/app/plan/page.tsx:18, :54-68; view.ts:51-58 | ✅ unit + e2e |
| R2 (Must) current week, active meals only | ✅ Done | aggregate.ts:21 `collectSources`; week.ts:11; useShoppingList.ts:22 | ✅ unit + e2e |
| R3 (Must) qty/unit/name, compound split, never drop | ✅ Done | parse.ts:109-123 | ✅ unit (145-line corpus) + e2e |
| R4 (Must) merge + sum per unit, "al gusto" | ⚠️ Done, one gap in the plural rule | aggregate.ts:47, :95; parse.ts:64-70 | ✅ (gap untested, see N1) |
| R5 (Must) Ya lo tienes / expired note | ✅ Done | pantryMatch.ts:12-23; view.ts:43-48 | ✅ unit + e2e |
| R6 (Must) detail + override per week | ✅ Done | plan/compra/page.tsx:189-239; state.ts:60 | ✅ unit + e2e (reload) |
| R7 (Must) tick/untick, Comprados, progress | ✅ Done | page.tsx:87-89, :117; state.ts:53 | ✅ unit + e2e |
| R8 (Must) per-user, per-week persistence | ✅ Done | store.tsx:99; state.ts:35 `forWeek` | ✅ unit + e2e (2 users, new week) |
| R9 (Must) derived list, unmark on total change | ✅ Done | view.ts:39 (bought iff signature matches) | ✅ unit + e2e |
| R10 (Must) empty state → Ir al Plan | ✅ Done | page.tsx:56-67; plan/page.tsx:60-62 | ✅ e2e |
| R11 (Should) aisles | ✅ Done | classify.ts:55 | ✅ unit (0 seed items in Otros) + e2e |
| R12 (Should) Especias y básicos | ✅ Done | classify.ts; view.ts:43, :46, :52 | ✅ unit + e2e |
| R13 (Should) move sheet, Nuevo, undo ~10 s | ✅ Done | page.tsx:241-307; useShoppingList.ts:41-64; despensa/page.tsx:21, :31-32, :105, :122-136 | ✅ e2e with 2-3 items; 35 items and the 10 s timeout are not automated (disclosed) |
| R14 (Should) moved items leave Comprados | ✅ Done | view.ts:35 | ✅ unit + e2e |

**Must: 10/10 done** (R4 has the follow-up N1). **Should: 4/4 done.**

**Edge cases:** deleted recipe ✅, mid-week meal change ✅ (derived), fractions ½+½ / ½×3 ✅, first-seen unit order ✅, one Despensa item matching many ✅, no expiry date = valid ✅, old weeks discarded with 12-week usage counters ✅ (see N6 on accuracy).
**Scope:** nothing the spec excluded was built. `recipePrompt.ts` is Task 14 in `tech.md`, and the `AppShell` prefix match is part of the design, so neither is unrelated.
**Tech design:** followed closely (Approach A, file layout, API and state shape, batch pantry actions, no `useSearchParams`). The only divergence is that `lastMove.at` holds a full ISO timestamp instead of a date. It is disclosed in the PR and commented in useShoppingList.ts:52.

## Blocking
None.

## Non-blocking
1. **N1. Plural stemmer breaks singulars ending in `-e`.** `src/lib/shopping/parse.ts:67`. `/[nrldzjs]es$/` strips "es" from "verdes", "chiles", "dulces" (the `-ces→z` rule at :66). Verified: `"1 pimiento verde"` gives the key `pimiento verde`, but `"2 pimientos verdes"` gives `pimiento verd`, so recipe A and recipe B show up as **two items** that are never summed (R4). A Despensa "Pimiento verde" does **not** match the ingredient "pimientos verdes" (`matchPantry` returns `{}`), so the user is told to buy what they already have (R5). `judías verdes` gives `judia verd` and is classified as **Otros**, while `judía verde` goes to Frutas y verduras (R11). None of the 145 seed lines contains both forms, but AI recipes and Despensa names will. → After stripping the plural, also drop a trailing `e` from every word (`verde`/`verdes` → `verd`, `tomate`/`tomates` → `tomat`, `chile`/`chiles` → `chil`), or strip `es` only when the singular form isn't seen. Add a unit case for `verde`/`verdes` and accept the snapshot change.
2. **N2. Header meal count and progress collapse after moving items.** `src/app/plan/compra/page.tsx:38-40`. `plannedMeals` is counted from `allRows`, and `buildShoppingView` drops moved rows (view.ts:35). Move everything bought: `list.empty` stays false, so the page shows "0 comidas planificadas" and "0 de 0 comprados", and nothing below them (no sections and no empty state). → Count meals from `items`/sources (expose them from the hook), and show a "Todo comprado" state when every item has been moved.
3. **N3. Mixed numbers aren't parsed.** `src/lib/shopping/parse.ts:36`. `"1 1/2 tazas de harina"` gives qty 1, no unit and the key `1/2 taza de harina` (Otros, won't merge). `"1½ cucharadas"` gives qty 1 and the name `½ cucharada…`. The spec only lists integers, decimals and fractions, so this isn't a spec miss, but AI recipes produce it. → Accept `\d+\s+\d+/\d+` and `\d+[½¼¾]` in `QTY_RE`, and add them to the parse tests.
4. **N4. Undo can silently do nothing across a Monday boundary.** `src/lib/shopping/useShoppingList.ts:60-64`. `undoLastMove` reads `forWeek(shopping, monday).current.lastMove`, which is empty once the week has changed. A move at Sunday 23:59:55 followed by "Deshacer" at 00:00:03 closes the toast but leaves the pantry items in place. The window is tiny. → Read `lastMove` from the raw `shopping.current`, or hide the toast when `lastMove` belongs to another week.
5. **N5. `shopping` is persisted without an `upgrade`/shape guard.** `src/lib/store.tsx:99`. Unlike profile, entries and weekPlan, this key has no upgrade step, and `view.ts:35-40` / `state.ts:41` dereference `moved`, `bought` and `overrides` without checks. Any stored value missing one of them (an earlier dev build, a manual edit, a future field) throws a TypeError on both `/plan` and `/plan/compra`. → Add `upgrade: (raw) => ({ ...EMPTY, ...raw, current: { ...EMPTY.current, ...raw?.current } })`.
6. **N6. The usage metric counts stale ticks.** `src/lib/shopping/state.ts:41`. `Object.keys(old.bought)` includes keys whose total changed (visually unticked by R9) or whose item left the plan. Tick 5, then change the plan so 3 of them change: the week records 5 bought. This only affects the hand-read success metric, and the "≥ 1 item bought" threshold still holds. → Accept, or prune `bought` against the current signatures when writing.
7. **N7. The Sheet dialog doesn't manage focus.** `src/components/ui/Sheet.tsx:11-24`. It sets `aria-modal="true"` but doesn't move focus into the sheet, trap it, or restore it on close. Keyboard and screen-reader users stay on the page behind it. The Escape listener also re-subscribes on every render, because `onClose` is always an inline arrow. → Focus the dialog or its close button on mount and restore focus on unmount, or use a native `<dialog>` with `showModal()`.
8. **N8. Not automated (disclosed in the PR):** the 35-item move and the 10 s undo timeout. The batch code path is the same as the one the e2e move covers. Acceptable.

## Code review findings
Pass-1 (`code-review`, high) items not already listed above, all cleanup:
- **Store setter altitude.** `src/lib/store.tsx:115-116`. `addPantryItems`/`removePantryItems` work around `usePersisted`'s non-functional setter. A functional `setValue(prev => …)` in `usePersisted` would fix the stale-closure trap for every setter. This is a pre-existing pattern that `tech.md` chose deliberately, so it's fine for this PR.
- **Duplicated accent-stripping normalizer.** `src/lib/shopping/aggregate.ts:41` (`plain`), `parse.ts:72` (`keyOf`) and `src/lib/allergens.ts` (`normalize`) are three copies that differ on whitespace collapsing. Worth extracting.
- **`matchPantry` re-normalizes each Despensa name per item.** `src/lib/shopping/pantryMatch.ts:17`. That is O(items × pantry) `normalizeKey` calls per view rebuild, on Plan, the list and the Despensa. Negligible at current sizes, but it could be precomputed once in `buildShoppingView`.

## Follow-up status
_Updated 2026-09-23, after the review above (which describes `80c857f`)._

| Finding | Status |
|---|---|
| N1 plural stemmer, `-e` singulars | ✅ Fixed in `d4c5def`: singular rule mirrors the plural one; tests for verde/verdes, judías verdes → Frutas y verduras, Despensa match. Key snapshot updated (spelling only; still 107 keys, same merges). |
| N2 header/progress after moving everything | ✅ Fixed in `72556f1`: meals counted from all items; "Todo comprado y guardado" state; e2e test. |
| N3 mixed numbers | ✅ Fixed in `d4c5def`: `1 1/2`, `1½`, `2 ½` parse as one quantity. |
| N4 undo across Monday | ✅ Fixed in `b4ea406`: `undoLastMove(state, monday)` undoes in the move's week, then rolls over. |
| N5 unvalidated persisted state | ✅ Fixed in `b4ea406`: `loadShoppingState` as the `upgrade` step. |
| N6 usage counts stale ticks | ✅ Fixed in `aa63d99`: `pruneBought` drops stale marks on every write; moved items untouched. |
| N7 Sheet focus management | ✅ Fixed in `5bfd0ee`: focus moves in, Tab is trapped, focus returns on close; keyboard e2e test. |
| Cleanup (store setter, normalizer copies, `matchPantry` cost) | Open. |

Checks after the fixes: 321/321 unit, 74/74 e2e, lint, typecheck and build pass.
