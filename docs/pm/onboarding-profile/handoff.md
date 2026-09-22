# Better onboarding profile: Handoff
_Updated: 2026-09-22 · Branch: `feature/onboarding-profile` (local, not pushed, no PR yet)_
_Related: [spec](spec.md) · [tech design](tech.md) (tasks + UI test contract + test coverage)_

## Where we are
Tasks **1–7 of 14 are done**, one commit each on the branch.

| Suite | Status |
|---|---|
| Unit (`npm test`) | all 146 pass |
| E2E (`npm run test:e2e`) | 7 pass (smoke, migration, meals, recipes), **18 fail**: onboarding and Perfil UI, tasks 8–12 |
| `npm run typecheck` / `npm run lint` | clean. The 2 lint errors that were already on `main` are fixed. |

**What's built:**
- `src/lib/nutrition.ts`: the formula, validation and prescribed fill.
- `src/lib/allergens.ts`: family matching with plurals, accents, whole words and the "sin …" exception.
- `src/lib/migrate.ts`: v1 → v2 migration, and Snack → Merienda.
- The store (`src/lib/store.tsx`):
  - reads localStorage synchronously, so there's no onboarding flash;
  - migrates on load;
  - writes a `<key>_v1_backup` before overwriting.
- `UserProfile` and `MealType` are now the v2 shapes (6 meals).
- The planner and the diary show `profile.meals`.

**Interim code, to be replaced:**
- `Onboarding.tsx` is still the old 3-step form. It builds a v1 profile and passes it through `migrateProfile`.
- Perfil edits custom allergies as comma-separated text.
- (Task 7 done: route prompt blocks + allergen filter + `droppedCount`; the prompt builder is in `src/lib/recipePrompt.ts`.)

## PM decisions (2026-09-22)
- R19 is cut.
- The allergen badge on seed recipes and pickers is in scope (**task 14**).
- "Prefiero no decirlo" is built: `Sex = "unspecified"`, BMR constant −78, floor 1350. The UI still needs the radio.
- A protein range counts as met anywhere inside the band.
- "avena" stays in Gluten.

## Next steps (in order, see tech.md › Tasks)
7. ~~Route~~: done (commit `20942f8`).
8. **Step components** in `src/components/profile/`. Follow the **UI test contract** in tech.md exactly: radios for single choice, checkboxes for multi, `Quitar <x>` chip buttons, and the exact labels.
9. **Onboarding rewrite**: a step machine over one draft (1 → 2 → 3a/4a or 3b → 5 → 6), with "Atrás" keeping values. Include the "Prefiero no decirlo" radio.
10. **Perfil** sections as `<section aria-labelledby>` regions, each with Editar/Guardar, plus the "Calculado" / "De tu nutricionista" badge and the source switch.
11. **Perfil recalculation banner** (`role="status"`, "Recalcular" / "Mantener los actuales"). It only appears for calculated targets.
12. **Dashboard protein band**: `MacroBar` shows `consumed / min–max`, and anywhere inside the band counts as met.
13. Get all e2e tests green, then update the README's sections table.
14. **Allergen badge** "⚠ contiene …" in Recetas and in the planner and diary pickers, using `recipeViolations(recipe, profile.allergies)`.

Then:
- Walk through each acceptance criterion in the running app (`preview_start` "mealplan", port 3000).
- Push, open the PR, and set the brief's status to `in review`.
- Run dev-review.

## Gotchas
- **Node:** local Node is 20.15, which is why the test tools are pinned to Vitest 3 / Vite 6. CI uses Node 22.
- **Dev server:** Next 16 won't start 2 dev servers in the same folder. Playwright reuses whatever is running on :3000.
- **Line endings:** files are checked out with CRLF, so `sed`/regex edits on multi-line blocks can silently miss. Use the Edit tool. Python isn't installed.
- **E2E helpers:**
  - `tests/e2e/helpers.ts` › `signIn()` seeds a session (and optional data) and freezes the clock at 2026-09-22.
  - Fixtures (Lucía, Manuel, the legacy profile) are in `tests/fixtures/profiles.ts`.
- **`docs/referencia/`** (the nutritionist PDFs) is deliberately left uncommitted.
