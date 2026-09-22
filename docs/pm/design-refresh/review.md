# Rediseño visual moderno de Comidas: Review
_PR: [#4](https://github.com/mancabcar/MealPlan/pull/4) (`feature/design-refresh` → `main`) · Reviewed: 2026-09-23 · Verdict: ⚠️ Approve with follow-ups_

## Summary
This is a clean, well-scoped visual re-skin that follows tech.md closely: 9/9 in-scope Must/Should requirements (R1–R9) are implemented and covered by tests I ran myself, R10 (light theme) is correctly left out as a deliberate product-owner non-goal, and the two headline risk claims both held up under independent verification — `Login.tsx`/`Onboarding.tsx` and `src/components/profile/{ui,steps}.tsx` have a genuine **zero-line diff** against `origin/main`, and `tests/e2e/accessibility.spec.ts`'s 6 contrast checks pass for real (161 unit / 41 e2e tests all green, no `test.fail()` left). There's one real (if low-severity) functional regression in the new `Plan` day selector, a couple of stale/misleading code comments, and some avoidable class-string duplication — none of it rises to "don't merge," but the day-selector bug is worth a quick follow-up.

## Verification performed (not just self-report)
- Base for the "real" PR diff is `origin/main` (56a816b), **not** local `main` (a356cb9, stale — missing the already-merged PR #3). `git merge-base origin/main HEAD` confirms 56a816b; diffing against local `main` would have wrongly pulled in an unrelated already-shipped `nutrition.ts`/`allergens.ts` fix (PR #2 review) that this branch does not actually touch.
- `npm run typecheck`, `npm run lint`: clean.
- `npm test` (Vitest): **161/161 pass**, matches PR claim.
- `npx playwright test` (41 tests, chromium): **41/41 pass**, including all 6 `accessibility.spec.ts` cases (Diario, Plan, Recetas—lista, Recetas—detalle, Despensa, Perfil) — read the file: it contains **zero** `test.fail()` calls, confirming the contrast claim is real, not aspirational.
- `git diff origin/main..HEAD -- src/components/Login.tsx src/components/Onboarding.tsx src/components/profile/ui.tsx src/components/profile/steps.tsx`: **empty** except for one unrelated 6-line addition to `profile/steps.tsx` — see Blocking/Non-blocking below — confirming the fork isolation claim.
- `grep`/ripgrep for `zinc-`/`emerald-` and emoji ranges across the 5 in-scope screens + `AppShell.tsx` + `components/ui/` + `components/perfil/`: no matches (only comments referencing the old classes for context).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 (token system) | ✅ Done | `src/app/globals.css`, `src/app/layout.tsx` | ✅ (contrast e2e + manual read) |
| R2 (floating nav) | ✅ Done | `src/components/AppShell.tsx` | ✅ `design-refresh.spec.ts` R2 |
| R3 (5 screens, no functionality lost) | ✅ Done | `page.tsx`, `plan/page.tsx`, `recetas/page.tsx`, `despensa/page.tsx`, `perfil/page.tsx` | ✅ full e2e suite (perfil/meals/onboarding/smoke specs all pass unchanged) |
| R4 (no emoji icons) | ✅ Done, 2 documented exceptions | `src/lib/types.ts`, all 5 screens | ✅ grep confirms no emoji in-scope; exceptions verified deliberate (see below) |
| R5 (semantic macro/status colors) | ✅ Done | `globals.css` tokens, `components/ui/Chip.tsx` | ✅ implicit in contrast/e2e coverage |
| R6 (contrast ≥4.5:1 / ≥3:1) | ✅ Done | `globals.css` token values | ✅ **I ran** `accessibility.spec.ts` myself — 6/6 pass, no `test.fail()` |
| R7 (calorie ring + 7-bar chart) | ✅ Done | `page.tsx` + `ProgressRing`/`WeekBarChart` | ✅ `design-refresh.spec.ts` R7 |
| R8 (day selector) | ✅ Done, 1 bug found | `plan/page.tsx` + `DaySelector` | ✅ `design-refresh.spec.ts` R8, `meals.spec.ts` — but see Blocking #1 |
| R9 (recipe cards/detail) | ✅ Done | `recetas/page.tsx` | ✅ `design-refresh.spec.ts` R9 |
| R10 (light theme) | N/A — correctly deferred | tech.md § Spec feedback: explicit non-goal decision by product owner | N/A |

**Non-goals respected**: Login/Onboarding untouched (verified, zero diff); no new product functionality added; no real recipe photos; no analytics instrumentation.

## Blocking
None. Nothing here rises to "must fix before merge" for a personal single-user app, but item 1 is a real regression worth a fast follow-up.

## Non-blocking
1. **`src/app/plan/page.tsx:30,34-35` — stale `selectedDate` after a midnight rollover.** `selectedDate` is initialized once via `useState(todayStr())`, but `dates` is recomputed fresh from `todayStr()` on every render. If the Plan tab is left mounted across midnight (no navigation/remount), the next render's `dates` no longer contains the old `selectedDate`, `dayIndex` becomes `-1`, and `DAY_NAMES[-1]` renders as `undefined` in the day heading (`plan/page.tsx:85`). This is a **new** regression from R8 — the pre-redesign version rendered all 7 days at once with no persisted "selected day" state, so it couldn't go stale this way. Low real-world likelihood for a personal app, but cheap to fix (e.g. `useEffect` resetting `selectedDate` when `dates` changes, or deriving a safe fallback index).
2. **`src/components/ui/Card.tsx:17` — hardcoded `p-4` can silently beat a caller's padding override.** `Card` always emits `p-4` before appending `className`; Tailwind resolves same-property utility conflicts by generated-CSS order, not JSX class-string order, so `<Card className="p-3">` (used for the 3 macro stat cards in `recetas/page.tsx:124`) may not reliably get the tighter padding depending on build-time class-discovery order. Consider a `padding` prop instead of relying on className override.
3. **Stale/misleading code comments left over from the pre-implementation plan**, in both cases in test files:
   - `tests/e2e/accessibility.spec.ts:8-18`'s header comment says every test "usa `test.fail()`" — none of the 6 tests actually call `test.fail()` anymore (correctly, since the tokens now pass); the comment describes the pre-redesign state and should be trimmed once task 12 landed, so a future reader isn't misled into thinking CI tolerates failures here.
   - `tests/e2e/dashboard.spec.ts:1-6` similarly narrates a not-yet-landed task 6 change ("la aserción marcada FRÁGIL... dejará de encontrar el texto") as future work, but the assertion below it was already updated to the post-task-6 form (`getByRole("img", { name: "Cumplido" })`). Harmless, but worth a cleanup pass.
4. **Presentational duplication newly introduced by this PR**: the identical `inputCls` Tailwind string (`"w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"`) is copy-pasted into `page.tsx`, `plan/page.tsx`, `recetas/page.tsx`, and `despensa/page.tsx` instead of living in the new `components/ui/` primitives layer this PR created specifically to deduplicate this class of repetition. Same observation applies structurally to the `perfil/` vs `profile/` fork (546 lines duplicated by design, per Manuel's explicit decision — not a finding, just noting the maintenance cost tech.md already flags is real: this PR itself had to apply the unrelated `carbsFloorApplied` message in both `profile/steps.tsx` and — presumably — needs the same in `perfil/steps.tsx` to stay in sync long-term, though that particular change predates this branch and isn't part of this PR's diff against `origin/main`).
5. **`⚠ contiene X` allergen warning staying as plain text is a genuine hard constraint, not a shortcut.** Confirmed: it's rendered inside native `<option>` elements (`plan/page.tsx:73`, `page.tsx:219`) as well as outside them (`recetas/page.tsx` `AllergenBadge`, which *could* take an icon). HTML `<option>` cannot render arbitrary child elements/components, only text — so for the two select-dropdown call sites this is unavoidable without abandoning native `<select>`. Worth noting for a future iteration: the standalone `AllergenBadge` in `recetas/page.tsx` (not inside an `<option>`) could pair the "⚠" with a Lucide `TriangleAlert` icon for R4 consistency there, even if the `<option>` instances can't.

## Code review findings (pass 1)
Ran the `code-review` skill at `high` effort against `origin/main..HEAD`. Findings not already folded into the table above:
- Confirmed and included above: `Card.tsx` padding-override footgun, stale `accessibility.spec.ts` comment, `inputCls` duplication, `perfil/`↔`profile/` fork maintenance cost.
- The tool's suggested "Plan day-selector goes stale" and "Card padding" findings were independently verified by reading the actual code and pre-redesign diff (confirmed as a genuine new regression and a genuine specificity footgun, respectively — not false positives).

## Notes on claims from the task brief
- **Login/Onboarding 100% untouched**: confirmed true — `git diff origin/main..HEAD` is empty for `Login.tsx`, `Onboarding.tsx`, `components/profile/ui.tsx`, and `components/profile/steps.tsx` (steps.tsx has one unrelated 6-line hunk from an already-merged nutrition fix that only shows up if you diff against stale local `main`; against the real base `origin/main` it's also empty).
- **Font/token scoping to `AppShell`'s wrapper**: confirmed. `body` keeps `font-family: Arial...` and Tailwind's `bg-zinc-50 dark:bg-zinc-950` classes; the new tokens/`font-sans` are applied only on `UserShell`'s wrapper `<div>`, which is never rendered on the Login or Onboarding paths (both return before that wrapper in `AppShell.tsx`). No redesigned screen was left unstyled — all 5 screens are children of that wrapper.
- **Allergen warning as plain text is a real constraint**: confirmed (see Non-blocking #5) — not resolvable for the two `<option>`-based call sites without dropping native `<select>`.
- **161 unit / 41 e2e tests, contrast tests genuinely passing**: confirmed by running both suites myself, not by trusting the PR description.
