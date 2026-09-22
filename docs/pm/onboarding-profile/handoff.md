# Better onboarding profile: Handoff for dev-review
_Updated: 2026-09-22 · Branch: `feature/onboarding-profile` (17 commits on `main`, local, **not pushed, no PR yet**)_
_Related: [spec](spec.md) · [tech design](tech.md) (tasks, UI test contract, test coverage) · [brief](brief.md)_

## What was built
All **14 tasks** in tech.md are done, one commit each (plus 2 handoff commits).

- **Onboarding:** 2 paths, "Calcúlalo por mí" and "Tengo un plan de mi nutricionista".
- **Profile:** a versioned v2 profile, migrated on load, with a `_v1_backup`.
- **Meals:** 6 meal slots, per user.
- **Allergies:** allergies are a hard exclusion in the AI prompt, and the server filters out any recipe that contains one. Dislikes are a soft preference.
- **Perfil:** split into sections, with a badge showing where the targets came from, a source switch and the recalculation banner.
- **Dashboard:** the protein range shows as a band.
- **Allergen badges** on seed recipes and in the pickers.

To review: `git diff main..feature/onboarding-profile` (44 files, +6.8k / −0.9k; about 2.4k of that is tests and docs).

## Verification status (2026-09-22, local)
| Check | Result |
|---|---|
| `npm run lint` | clean. This also fixes the 2 errors that were already on `main` in `store.tsx`. |
| `npm run typecheck` | clean |
| `npm test` (Vitest) | **156 / 156** pass, 7 files |
| `npm run test:e2e` (Playwright, Chromium, Pixel 7 viewport) | **31 / 31** pass |
| `npm run build` | OK |
| Manual walkthrough (browser pane, mobile 375×812) | Opening the app on a real existing v1 profile migrated it correctly: goals unchanged, `profile_v1_backup` written, 6 meals, straight to the diary. Perfil and Plan render, and there are no console errors. |
| **CI on GitHub** | **never run.** The branch hasn't been pushed. |

**Not verified:**
- **Real Claude generation:** it needs an API key and costs money, and the route is only tested with a mocked SDK. The spec's manual metric ("0 allergens in 20 generations") is still to be done.
- **Onboarding in the browser pane:** I didn't click through it by hand, to avoid creating accounts in your real localStorage. The e2e suite covers it end to end.
- **The macro-mismatch warning UI:** only the calculation is tested.

## Requirement → implementation → test
| Req | Where | Tests |
|---|---|---|
| R1–R2 | `src/components/Onboarding.tsx`, `profile/steps.tsx` (`GoalPicker`, `TargetSourcePicker`) | e2e `onboarding-calculated` |
| R3 | `lib/nutrition.ts` `validateBodyData`, `lib/profileDraft.ts` `parseBody`, `BodyDataForm` | unit `nutrition`, `profile-draft`; e2e R3 |
| R4 | `calculateTargets` + `SuggestedTargets` (derivation, floor, editable) | unit (Lucía 1750/112/200/56, floors, 3 goals); e2e R4 ×2 |
| R5–R6 | `validatePrescribed`, `fillPrescribed`, `parsePrescribed`, `PrescribedTargetsForm` | unit (Manuel F 68 / C 192); e2e R5 ×2 + scenario 2 |
| R7–R8 | `MealSlotPicker`; `app/plan/page.tsx`, `app/page.tsx` read `profile.meals` | e2e R7, `meals.spec` ×3 |
| R9, R11, R12 | `AllergyDietDislikes`, `ChipInput` (case- and accent-insensitive dedupe) | e2e scenario 1 |
| R10 | `lib/recipePrompt.ts` `buildRecipePrompt` (separate blocks) | unit `recipes-route` |
| R13, R15 | `app/perfil/page.tsx` sections, badge, source switch | e2e `perfil` |
| R14 | `lib/migrate.ts`, `lib/store.tsx` `load({ upgrade, backup })` | unit `migrate`; e2e `migration` |
| R16 | Perfil `BodySection` → `onRecalcOffer` → banner | e2e `perfil` R16 ×3 |
| R17 | `MacroBar` `range` prop; route sends the midpoint | e2e `onboarding-prescribed`, `dashboard`; unit `recipe-prompt` |
| R18 | `lib/allergens.ts` `recipeViolations`; route filter + `droppedCount`; recipes empty state | unit `allergens` (every family term), `recipes-route`; e2e `recipes` |
| R19 | **cut** (PM decision) | — |
| PM #2 badges | `allergenWarning` in Recetas, Plan and Diario pickers | e2e `allergen-badges` ×4 |

## Decisions and deviations to check
PM decisions from 2026-09-22 are recorded in tech.md › Spec feedback:
- R19 is cut.
- Allergen badges are in scope.
- "Prefiero no decirlo" uses −78 and a 1350 floor.
- Anywhere inside the protein band counts as met.
- Oats stay in Gluten.

Judgment calls the spec didn't cover:
1. **Migrated profiles get `goal: "maintain"`.** v1 had no goal, and this only affects any later recalculation.
2. **Allergen matching** is word-based with plurals (`-s`, `-es`, `z→ces`) and ignores accents. A custom allergen typed as a preset's name ("gluten") uses that preset's whole family. The **recipe name** is checked as well as the ingredients.
3. **Dislikes that are already allergies** are dropped from dislikes, both on migration and on save. This uses the same family matching, so "Nueces" is dropped when Frutos secos is an allergy.
4. **Privacy:** the client sends only targets, allergies, diet and dislikes to `/api/recipes` (`toRecipeProfile`). Body data never leaves the browser.
5. **Store rewrite:** `usePersisted` now reads localStorage synchronously in the `useState` initializer. This relies on `AppProvider` mounting only on the client, after auth has loaded (the `AppShell` gate). It removes the flash of onboarding and the `set-state-in-effect` lint errors. **This is worth checking.**
6. **Unknown values from the client:** the route ignores any preset allergen keys it doesn't recognize (`safeAllergies`).
7. **Changing the goal in Perfil doesn't offer a recalculation.** The spec only asks for this on a weight or activity change. This might need a follow-up.

**Tests changed after they were written.** Each change fixes a selector bug; none makes the test weaker.
- `getByText("0 / 1980")` was a substring match that also caught "80 / 1980", so it's now `exact: true` (also used for the other macro texts).
- `allTextContents()` doesn't auto-wait, so I added visibility waits before it.
- The R5 range error: `/mínim.*máxim/` also matched the field labels. The error is now `role="alert"`, filtered by text, because Next's route announcer is also an alert. The UI contract in tech.md is updated.

## Known limitations and follow-ups (out of scope)
- **Word-boundary matching** misses compound words ("empanado" doesn't match `pan`), which the spec accepts. The family table still needs a review by someone who knows the household's allergies (spec open question).
- **The route's model ID** `claude-opus-4-8` is unchanged from `main`. Worth checking separately.
- **Old test tool versions (Vitest 3 / Vite 6)** because local Node is 20.15. CI uses Node 22.

## Review focus (suggested)
1. `src/lib/store.tsx`: migration and backup semantics, write-back only when something changed, and the SSR assumption.
2. `src/lib/allergens.ts`: false negatives, and the "sin" exception scope.
3. `src/app/api/recipes/route.ts` + `src/lib/recipePrompt.ts`: prompt blocks, filtering, and the response contract.
4. `src/app/perfil/page.tsx`: the largest file (~520 lines, 5 section components). Check the state transitions in `TargetsSection`.
5. Accessibility: native radios and checkboxes styled as chips, and a `<section aria-labelledby>` for each Perfil section.

## How to run
```bash
npm test
```
```bash
npm run test:e2e
```
E2E reuses a dev server that's already running on :3000, or starts one. Next 16 won't run 2 dev servers in the same folder.

## Before merge
- **Push and open the PR.** Pending: the repo is **public**, and the PM docs and fixtures contain Manuel's plan figures and weight.
- **Let CI run** on GitHub for the first time.
- **Set the brief's status** to `in review` with the PR link.
