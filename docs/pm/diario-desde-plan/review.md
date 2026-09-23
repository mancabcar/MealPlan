# Registrar en el Diario una comida planificada con un toque: Review
_PR: [#25](https://github.com/mancabcar/MealPlan/pull/25) · Reviewed: 2026-09-23 · Verdict: ⚠️ Approve with follow-ups_

## Summary
The PR builds all ten requirements (7 Must, 2 Should, 1 Could) the way tech.md describes: pending is derived by a pure `pendingSlots()` and rendered inside each meal card, with no data model changes. Every acceptance criterion has an automated test, and the suites are green on the PR head (344 unit, 94 e2e). Nothing blocks. The main follow-up is to make double-tap safety less dependent on screen layout.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 (Must) | ✅ Done | `src/lib/diary.ts:25`, `src/app/page.tsx:84`, `:170` | ✅ unit + e2e |
| R2 (Must) | ✅ Done | `src/app/page.tsx:175` → `recipeEntry` (`src/lib/diary.ts:6`) | ✅ unit + e2e (today, yesterday, double tap) |
| R3 (Must) | ✅ Done | derived from `entries` (`src/lib/diary.ts:51`); totals unchanged | ✅ unit + e2e (incl. reload) |
| R4 (Must) | ✅ Done | `src/lib/diary.ts:51` (any entry of the meal type); `weekPlan` never written | ✅ unit + e2e (plan unchanged, Plan still shows "Comida Lentejas") |
| R5 (Must) | ✅ Done | `src/lib/diary.ts:41` | ✅ unit + e2e |
| R6 (Must) | ✅ Done | by construction (derived) | ✅ unit + e2e |
| R7 (Must) | ✅ Done | muted text + `Chip` "Pendiente" (`src/app/page.tsx:181`); not in `dayEntries` | ✅ e2e + axe contrast case |
| R8 (Should) | ✅ Done | `src/app/page.tsx:146` (≥ 2, above the cards) | ✅ e2e (3 entries, position, hidden with 1, hidden in future) |
| R9 (Should) | ✅ Done | `MEAL_TYPES` loop in `pendingSlots` and cards | ✅ unit + e2e |
| R10 (Could) | ✅ Done | `src/app/page.tsx:164`, `:184` | ✅ e2e |

**Edge cases:** meal type not in `profile.meals` ✅ (unit + e2e) · deleted recipe ✅ (unit) · several entries of one meal ✅ (unit) · double tap ✅ (e2e, 1-pending case only; see non-blocking 2) · midnight ✅ (`todayStr()` per render; not tested, as tech.md agreed) · past weeks ✅ (unit).

**Scope:** no non-goal was built. The diff touches only `src/app/page.tsx`, the new `src/lib/diary.ts`, tests/fixtures and docs. No test was skipped, deleted or loosened.

**Tech design:** followed, with one change that is documented and explained: "Hecho" sits on the **left** of the pending row instead of the right, so a double tap's second tap lands on the new entry's name and not its ✕ (tech.md › UI, PR notes).

## Blocking
None.

## Non-blocking
_Items 1–3 fixed in `fe8d521`: "Hecho", "Registrar todo el día" and ✕ ignore the second click of a double tap (`event.detail > 1`), and "Hecho" gets `aria-describedby` pointing at the recipe name. New e2e tests in `diario-desde-plan.spec.ts` › R2 cover a double tap with 2 pending, a detail-2 click landing on the ✕ and on another card's "Hecho" (this test fails without the fix), and the accessible description. Suites: 344 unit and 97 e2e green._

1. ✅ **Fixed.** **Double-tap safety depends on the screen layout**: `src/app/page.tsx:171`. Nothing in the handlers stops the second tap. It only works because "Hecho" (left) and the new entry's ✕ (right) are in different places. A future restyle, or a narrow viewport that wraps the row, could bring back "double tap creates and then deletes". → Guard in code as well: for example, ignore the ✕ when `event.detail > 1`, so a second click that started as a double tap elsewhere can't delete.
2. ✅ **Fixed.** **Layout shift when "Registrar todo el día" disappears**: `src/app/page.tsx:146`. With 2 pending, "Hecho" leaves 1, the bulk button unmounts, and everything below moves up about 58px. With current sizes the second tap of a double tap lands in the next card's top padding (harmless), but the margin is small and the e2e double-tap test only covers the 1-pending case. → The guard in item 1 covers the ✕. For the next card's "Hecho", add an e2e double-tap with 2 pending, or keep the button's space reserved (for example `invisible` rather than unmounted) until the date changes.
3. ✅ **Fixed.** **Several buttons share the name "Hecho"**: `src/app/page.tsx:174`. A screen reader's buttons list hears "Hecho" several times with no meal context. → Add `aria-describedby` pointing at the card heading or the recipe name. The accessible name stays "Hecho", so the tests still pass.

## Code review findings
- **Efficiency**: `src/lib/diary.ts:51` scans the whole entry history once per meal type on every render. It's cheap today, but pre-filtering the date's entries once (or a `Set` of logged meal types) is simpler and costs nothing.
- **Pre-existing, now on more paths**: `recipeEntry`'s default id uses `crypto.randomUUID()`, which only exists in secure contexts. Opening the dev server from a phone over `http://192.168.x.x` makes "Hecho" throw, as the add form already did. Worth a fallback only if LAN phone testing is a real workflow.
- **Styling consistency**: the pending row's allergen warning uses `Chip tone="expired"`, while Recetas uses its own `AllergenBadge` (slightly different padding, and it can wrap). tech.md asked for the same pill. → Move `AllergenBadge` onto `Chip` in `components/ui` and use it in both places.
- **Tooling (outside the PR)**: `npm run lint` lints `.claude/worktrees/*/.next`, which gives 758 errors from build output. `eslint src tests` is clean. → Add `.claude/**` to the ESLint ignores.
