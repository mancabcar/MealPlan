# Better onboarding profile: Technical design
_Status: Draft · Updated: 2026-09-22_
_Related: [spec](spec.md) · [brief](brief.md) · [prototype](https://claude.ai/artifact/LrZVe1J6ozWvYm5BgFYozD)_

## Summary
Move the profile to a versioned v2 shape (goal, target source, body data, protein range, meal slots, allergies, diet type, dislikes), migrated once when the store loads. All the logic goes into three pure, testable modules: `nutrition.ts` (formula), `allergens.ts` (family matching) and `migrate.ts`. The onboarding steps are built as components shared with Perfil. `MealType` grows from 4 to 6 slots. The recipe route gets a structured prompt plus a server-side allergen filter. Effort is **M–L**, about 12 small commits, and nothing needs a backend.

## Context
- **Stack:** Next.js 16.2.9 (App Router; note the README still says 15), React 19.2, Tailwind 4, TypeScript. No runtime deps besides `@anthropic-ai/sdk`. **No tests and no CI** (there's no `.github/`).
- **Profile type:** `src/lib/types.ts` `UserProfile` is flat. `mealsPerDay` is written as `3` and never read. `MealType = "Desayuno" | "Comida" | "Cena" | "Snack"`, used by `MealEntry.mealType` and `DayPlanSlot.mealType`.
- **Persistence:** `src/lib/store.tsx` `usePersisted` reads each `mp_<userId>_<key>` from localStorage in an effect once `ready` is true. There is no schema version and nowhere a migration can hook in.
- **Consumers of profile data:**
  - Dashboard `src/app/page.tsx`: `MacroBar` for the 4 goals, the weekly kcal line, and a meal `<select>` over all `MEAL_TYPES`.
  - Planner `src/app/plan/page.tsx`: `MEAL_TYPES.slice(0, 3)`.
  - Recipes `src/app/recetas/page.tsx`: POSTs the whole `profile` to `src/app/api/recipes/route.ts`, which builds one prompt with restrictions and dislikes under a single "respeta y evita".
- **Onboarding:** `src/components/Onboarding.tsx` has 3 steps held in local `useState`. It's mounted by `src/components/AppShell.tsx` when `profile` is null.
- **Perfil:** `src/app/perfil/page.tsx` is one flat draft form (numbers plus comma-separated text).

## Approaches considered
### A. Versioned profile + pure logic modules + shared step components (recommended)
Add `schemaVersion: 2` to a new `UserProfile` and run `migrateProfile()`, `migrateEntries()` and `migrateWeekPlan()` inside the store's load path. The formula, allergen matching and migration live in framework-free modules under `src/lib/`. Each onboarding step is a controlled component (`value` / `onChange`), so Perfil can reuse it inside an "Editar" section.
**Pros:** every spec number (1750/112/200/56, 68 F / 192 C) is a unit-testable pure function. Consumers read one clean shape with no `?? default` scattered around. Perfil and onboarding can't drift apart.
**Cons:** touches every screen once. The migration runs against real data on first load.
**Effort:** M–L.

### B. Optional fields + defaults at the read sites
Keep the flat type, add optional fields, and default them where they're read (`profile.meals ?? ALL_MEALS`).
**Pros:** there's no migration step.
**Cons:** it can't meet R14. Legacy `"sin frutos secos"` has to become an allergy, and `"Snack"` entries have to become `"Merienda"`, which means rewriting stored data anyway. Defaults would also end up repeated in 5 files. **Rejected.**

A form library (react-hook-form + zod) isn't worth it. There are about 15 fields with simple range checks, and the repo has no dependencies of that kind.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Types | `src/lib/types.ts` | New `UserProfile` v2, `Goal`, `Sex`, `ActivityLevel`, `DietType`, `TargetSource`, `Allergen`. `MealType` becomes 6 values. `MEAL_TYPES` and `MEAL_TYPE_ICONS` are updated. |
| Formula | `src/lib/nutrition.ts` (new) | `calculateTargets()`, `fillPrescribed()`, `ageFromBirthYear()`, `macroMismatch()`, `ACTIVITY_FACTORS` |
| Allergens | `src/lib/allergens.ts` (new) | `ALLERGEN_FAMILIES`, `normalize()`, `ingredientMatches()`, `recipeViolations()` |
| Migration | `src/lib/migrate.ts` (new) | `migrateProfile()`, `migrateEntries()`, `migrateWeekPlan()`, `LEGACY_RESTRICTION_MAP` |
| Store | `src/lib/store.tsx` | `usePersisted` takes an optional `migrate` fn, applies it on load and writes the result back if it changed. `loaded` becomes true only after the values are read (see Risks). |
| Step components | `src/components/profile/` (new): `GoalPicker`, `TargetSourcePicker`, `BodyDataForm`, `SuggestedTargets`, `PrescribedTargetsForm`, `MealSlotPicker`, `AllergyDietDislikes`, `ChipInput` | Controlled components shared by onboarding and Perfil |
| Onboarding | `src/components/Onboarding.tsx` | Rewritten as a step machine over a single `OnboardingDraft` state. "Atrás" keeps the draft. |
| Perfil | `src/app/perfil/page.tsx` | Sections (Objetivo, Objetivos diarios + source badge, Datos corporales, Comidas, Alergias y dieta), each with "Editar". Plus the recalculation banner and the source switch. |
| Dashboard | `src/app/page.tsx` | `MacroBar` gets an optional band for protein. The meal `<select>` is built from `profile.meals`, and its default is the first selected meal. |
| Planner | `src/app/plan/page.tsx` | Rows come from `profile.meals`. `dayKcal` only sums the visible slots. |
| AI route | `src/app/api/recipes/route.ts` | Separate prompt sections (ALERGIAS "nunca uses" with family terms / DIETA as a rule / NO LE GUSTA as a preference). The protein target is the midpoint. Returned recipes are filtered with `recipeViolations()`, and the response includes `droppedCount`. |
| Recipes UI | `src/app/recetas/page.tsx` | When `recipes.length === 0 && droppedCount > 0`, it shows "Ninguna receta era segura para tus alergias. Prueba de nuevo." |
| Docs | `README.md` | Fix the Next version and describe the onboarding and meal slots |

### Data model
```ts
type Goal = "lose" | "maintain" | "gain";
type Sex = "male" | "female";                      // + "unspecified" if PM says yes
type ActivityLevel = "poco" | "algo" | "bastante" | "mucho";
type DietType = "omnivore" | "pescetarian" | "vegetarian" | "vegan";
type TargetSource = "calculated" | "prescribed";
type PresetAllergen = "frutos_secos" | "gluten" | "lactosa" | "marisco" | "huevo" | "soja";

type MealType = "Desayuno" | "Media mañana" | "Comida" | "Merienda" | "Pre-entreno" | "Cena";

interface UserProfile {
  schemaVersion: 2;
  name: string;
  goal: Goal;
  targetSource: TargetSource;
  body?: { sex: Sex; birthYear: number; heightCm: number; weightKg: number; activity: ActivityLevel };
  weightKg?: number;               // prescribed path may store weight without full body data
  calorieGoal: number;
  proteinGoal: number;             // the single value, or the midpoint when a range is set
  proteinRange?: { min: number; max: number };
  carbsGoal: number;
  fatGoal: number;
  meals: MealType[];               // >= 1, always stored in MEAL_TYPES order
  allergies: { preset: PresetAllergen[]; custom: string[] };
  diet: DietType;
  dislikedIngredients: string[];
  createdAt: string;
}
```
- **Why keep `proteinGoal`:** it keeps the dashboard, the weekly chart and the AI route reading the same field (the midpoint is what R17 asks the AI to aim at). `proteinRange` only adds the band.
- **Removed:** `mealsPerDay`, `dietaryRestrictions`.
- **Migration** (`schemaVersion` missing means v1, run once on load, idempotent):
  - Restrictions map as `vegetariano → vegetarian`, `vegano → vegan` (the strictest wins if both are present), `sin gluten → gluten`, `sin lactosa → lactosa` and `sin frutos secos → frutos_secos`. Anything else goes to `allergies.custom`.
  - `targetSource = "prescribed"`, no `body`, all 6 meals, and the targets and dislikes are copied as they are.
  - Any dislike that is also an allergy is removed from dislikes.
  - `MealEntry.mealType` and `DayPlanSlot.mealType` change `"Snack"` to `"Merienda"`. The other values are unchanged.
- **Future changes:** the next schema change bumps `schemaVersion` and adds a step to `migrate.ts`.

### APIs / interfaces
```ts
// nutrition.ts — pure
calculateTargets(i: { sex; birthYear; heightCm; weightKg; activity; goal; now?: Date }):
  { kcal; protein; carbs; fat; derivation: { bmr; factor; tdee; adjustmentPct; floorApplied?: number } }
fillPrescribed(i: { kcal; protein: number | {min,max}; carbs?; fat?; weightKg? }): { carbs; fat }
macroMismatch(kcal, p, c, f): number   // relative diff; UI warns if > 0.10
```
- **Rounding order matters for the spec's own numbers:**
  1. kcal = round-to-50 of TDEE × (1 + adj).
  2. Apply the floor (1200 F / 1500 M).
  3. P and F are `Math.round`ed.
  4. C = `Math.round((kcal − 4·P − 9·F) / 4)` using the **rounded** P and F.

  This gives Lucía 1750/112/200/56 and Manuel F 68 / C 192. Using unrounded F would give C 191 and fail the acceptance criterion.
- **Prescribed with no weight:** F = round(0.25·kcal / 9).

```ts
// allergens.ts — pure, used on the server
normalize(s): string                   // lowercase, NFD strip accents, collapse spaces
ingredientMatches(ingredient, allergen: PresetAllergen | string): boolean
recipeViolations(recipe, allergies): string[]   // matched terms; empty = safe
```
- **Matching is token-based, not substring.** Substring matching would make `pan` match "panceta" and `nuez` match inside unrelated words. Each family term (which may be several words, like "nuez de brasil") must match on word boundaries. Plural suffixes `s | es` are accepted, and the `z → ces` rule means "nueces" matches "nuez".
- **"sin" exception:** if the normalized ingredient contains `sin <allergen name or family term>`, then that allergen doesn't match that ingredient.
- **Custom allergens** match their own normalized name with the same plural rules.
- **What gets checked:** the recipe's ingredients **and its name**. The name costs nothing and catches cases like "Pollo al romesco" if the user adds romesco as a custom allergen.

- **`POST /api/recipes`:** the request is unchanged (`{ profile, pantryItems, count }`). The response becomes `{ recipes: Recipe[], droppedCount: number }`. The route reads `profile.allergies ?? { preset: [], custom: [] }` defensively. It trusts the client-sent profile, as it does today.

### UI
Mapped to the prototype artboards:
| Artboard | Component |
|---|---|
| 1 Nombre y objetivo | `GoalPicker` + name input. Perder grasa is preselected. |
| 2 Elegir ruta | `TargetSourcePicker` |
| 3a Datos corporales | `BodyDataForm`: inline errors, "62,0" parsed by `parseDecimal()` |
| 4a Objetivos sugeridos | `SuggestedTargets`: derivation open by default, editable numbers, disclaimer |
| 3b Plan del nutricionista | `PrescribedTargetsForm`: "Es un rango" toggle, optional C/F/weight, non-blocking mismatch warning |
| 5 Comidas del día | `MealSlotPicker`: chips, ≥ 1 required |
| 6 Alergias vs. no me gusta | `AllergyDietDislikes`: red allergy chips + custom `ChipInput`, single-choice diet, dislikes `ChipInput` (case-insensitive dedupe) |
| 7 Perfil | Sections + source badge + recalc banner (only when `targetSource === "calculated"` and a saved `weightKg` or `activity` changed) |

Onboarding keeps a single `draft` object, and steps are indices. "Atrás" just decrements the index, so values are kept for free.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `GoalPicker`, `profile.goal` |
| R2 | `TargetSourcePicker` → step 3a or 3b |
| R3 | `BodyDataForm` validation (120–230 cm, 30–250 kg, age 14–100), `parseDecimal` |
| R4 | `calculateTargets` + `SuggestedTargets` (derivation, floor note, editable) |
| R5 | `PrescribedTargetsForm`, kcal 800–6000, min ≤ max |
| R6 | `fillPrescribed` |
| R7 | `MealSlotPicker`, `profile.meals` |
| R8 | Planner rows and diary `<select>` from `profile.meals`. History still renders over all `MEAL_TYPES`. |
| R9 | `AllergyDietDislikes`, `profile.allergies` |
| R10 | Route prompt section "ALERGIAS — nunca uses", listing the family terms for each preset allergen |
| R11 | `profile.diet`, stated as a rule in the prompt |
| R12 | `ChipInput` for dislikes; prompt section "Preferiblemente evita" |
| R13 | Perfil sections reuse the step components. Switching source pre-fills from the current values (calc → prescribed) or re-runs 3a with the saved `body` (prescribed → calc). |
| R14 | `migrate.ts` inside `usePersisted` load |
| R15 | Badge from `targetSource` |
| R16 | Banner compares the draft body with the saved one. It calls `calculateTargets` and applies the result only on "Recalcular". |
| R17 | `MacroBar` `range` prop draws the band; the AI gets `proteinGoal` (the midpoint) |
| R18 | `recipeViolations` filter in the route + empty-state message |
| R19 | **Deferred**, see Spec feedback |

## Risks & mitigations
- **Migration runs on real data (the only one-way step).** It's idempotent and gated by `schemaVersion`. Before it writes, it copies the raw v1 values to `mp_<userId>_profile_v1_backup` (and the same for entries and weekplan). Unit tests cover the spec's R14 example and the "Snack" mapping.
- **Existing onboarding flash.** Today `loaded` flips true one render *before* `usePersisted` has read localStorage, so a user who has a profile briefly renders `<Onboarding />`. It's harmless now but more jarring with a 6-step flow. Fix it in the store task: read synchronously in the same effect and set `loaded` after the values are set.
- **Allergen safety is best-effort.** A term list can't catch brand names or hidden ingredients. The mitigations are the prompt instruction plus the server filter plus over-exclusion, and the family table lives in one file so it's easy to review. Say so in the UI ("revisa siempre los ingredientes").
- **Seed recipes and planner picks aren't checked.** The spec only filters AI output, but the 40 seed recipes in `src/data/recipes.json` can be added to the diary or planner by someone with an allergy. See Spec feedback.
- **Word-boundary matching vs. compounds.** "empanado" won't match `pan`. Accepted: those are dish-level words, and the AI rarely lists them as ingredients. Add terms to the family table if they show up.
- **`MealType` rename touches stored strings.** Covered by the migration. `"Desayuno" | "Comida" | "Cena"` keep their exact spelling, so only "Snack" changes.
- **Sensitive data:** sex, birth year and weight stay in the user's own localStorage and are sent to the recipe route only as part of `profile`. Better: send only what the prompt uses. The route builds the prompt from targets, diet, allergies and dislikes, so the client can strip `body` before the POST.

## Testing strategy
The repo has **no test setup**. I recommend running dev-test first to add Vitest (unit) and Playwright (e2e), plus a minimal GitHub Actions workflow (`lint`, `build`, `test`).
- **Unit (Vitest), which is where most of the acceptance criteria get verified:**
  - `nutrition.test.ts`: Lucía 1750/112/200/56 with derivation BMR 1320 / 2046 / −15%, the floor cases, and Manuel's F 68 / C 192. Also the no-weight 25% case, the mismatch > 10%, and `parseDecimal("62,0")`.
  - `allergens.test.ts`: "almendras laminadas" and "Nueces" match Frutos secos; "leche sin lactosa" and "queso sin lactosa" don't match Lactosa; "leche de coco" matches Lactosa; "panceta" doesn't match Gluten; accents and case; custom allergens.
  - `migrate.test.ts`: the spec's R14 example, the legacy free-text restriction, "Snack" → "Merienda", idempotency, and an allergy/dislike overlap.
- **Route:** tested through `POST` with `@anthropic-ai/sdk` mocked (`tests/unit/recipes-route.test.ts`). The tests check the prompt's separate sections and the filter. They never call the real API. If you extract `buildPrompt`, put it in `src/lib/recipePrompt.ts`, because a `route.ts` may only export HTTP handlers and segment config.
- **E2E (Playwright):** calculated path end to end (Lucía's numbers on 4a, then the dashboard shows them), prescribed path (1980, 130–170, then the dashboard band), "Atrás" keeps values, the continue buttons are disabled on invalid input, a 5-meal planner shows exactly 5 rows, and a seeded v1 localStorage profile lands on the dashboard (not onboarding) with the migrated values.
- **Manual:** 20 AI generations with "Frutos secos" set (the spec's metric), and the timed household session.

## Tasks
1. [x] Add Vitest + Playwright + a CI workflow (dev-test). Feature tests are written, and the `nutrition` / `allergens` / `migrate` stubs throw "not implemented".
2. [x] Implement `nutrition.ts` (R3–R6).
3. [x] Implement `allergens.ts` (R10, R18).
4. [x] Implement `migrate.ts` (R14). The v2 types already live in `types.ts` as `UserProfileV2` / `MealSlot`.
5. [x] Store: `migrate` hook in `usePersisted`, v1 backup, the loaded-flash fix. **This also clears the 2 pre-existing `react-hooks/set-state-in-effect` lint errors in `store.tsx`**, so CI's lint step stays red until this task. Rename `UserProfileV2` → `UserProfile` and `MealSlot` → `MealType`. Update the existing consumers so they compile on v2: dashboard, planner and route read `profile.meals` / `allergies` (R8, R14).
6. [ ] Planner and diary show `profile.meals`; `dayKcal` only sums visible slots (R8).
7. [ ] Route: `buildPrompt` with separate sections, the allergen filter, `droppedCount`, and the recipes empty-state message (R10–R12, R18).
8. [ ] Shared step components in `src/components/profile/` (R1–R7, R9, R11, R12).
9. [ ] Rewrite onboarding on top of the step components, with back navigation (R1–R12).
10. [ ] Perfil sections + source badge + source switch (R13, R15).
11. [ ] Perfil recalculation banner (R16).
12. [ ] Dashboard protein band (R17).
13. [ ] Make the remaining e2e tests green; update the README's sections table.
14. [ ] Non-blocking allergen badge ("⚠ contiene …") in Recetas and in the planner and diary recipe pickers (decided spec feedback #2).

Each step leaves the app working. Task 5 is the only point where old and new code meet, so after it every screen reads v2.

## UI test contract
The e2e tests find elements the way users do, by role and accessible name, using the copy from the spec and prototype. Build the UI to match this, or change the test and the spec together.

**Element roles**
- **Single choice** (goal, sex, activity, diet) is a `radio`.
- **Multiple choice** (meals, preset allergies, "Es un rango") is a `checkbox`. Chips can be styled native inputs.
- **Chip inputs** add an item on Enter. Each chip has a remove button named `Quitar <item>`.

**Onboarding labels by step**
- **Step 1:** "¿Cómo te llamas?"; radios Perder grasa / Mantenerme / Ganar músculo; button "Continuar".
- **Step 2:** buttons "Calcúlalo por mí" / "Tengo un plan de mi nutricionista". Every later step has "Atrás".
- **Step 3a:** radios Hombre / Mujer; fields "Año de nacimiento", "Altura (cm)", "Peso (kg)"; radios Poco / Algo / Bastante / Mucho; button "Calcular mis objetivos".
  - The height error text includes "120" and "230".
- **Step 4a:** "Calorías (kcal)", "Proteínas (g)", "Carbohidratos (g)", "Grasas (g)" as inputs; "¿De dónde salen estas cifras?"; button "Usar estos objetivos".
- **Step 3b:** "Calorías (kcal)"; checkbox "Es un rango"; fields "Proteína mínima (g)" / "Proteína máxima (g)" (or "Proteínas (g)" when it isn't a range); "Carbohidratos (g)", "Grasas (g)", "Peso (kg)".
  - The min > max error mentions "mínima" and "máxima".
- **Step 5:** checkboxes named after the meals. The hint contains "al menos una".
- **Step 6:** allergy checkboxes; "Otra alergia" chip input; diet radios Como de todo / Pescetariana / Vegetariana / Vegana; "No me gusta" chip input; button "Empezar".

**Other screens**
- **Diary:** the meal `<select>` is labelled "Comida del día". Macro bars read `consumed / goal`, and for a protein range `consumed / min–max` (for example "0 / 130–170").
- **Perfil:**
  - Each section is a `<section aria-labelledby>` region: "Objetivos diarios", "Datos corporales", "Comidas del día" and so on. Each has its own "Editar" / "Guardar".
  - The badge text is "Calculado" or "De tu nutricionista".
  - The recalculation banner has `role="status"` and buttons "Recalcular" / "Mantener los actuales".
  - "Objetivos diarios" has a "Tengo un plan de mi nutricionista" / "Calcúlalo por mí" button to switch source.
- **Recipes empty state:** "Ninguna receta era segura para tus alergias. Prueba de nuevo."

## Test coverage
Written before the code on 2026-09-22. 🔴 means failing as expected until the feature is built.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | `tests/e2e/onboarding-calculated.spec.ts` › "R1: 'Continuar' está desactivado sin nombre…" | e2e | 🔴 |
| R2 | `onboarding-calculated.spec.ts` › "R2: cada opción del paso 2…" | e2e | 🔴 |
| R3 | `tests/unit/nutrition.test.ts` › "R3: validación de datos corporales" (ranges, boundaries, comma decimal) | unit | 🔴 |
| R3 | `onboarding-calculated.spec.ts` › "R3: altura fuera de 120–230 cm…" | e2e | 🔴 |
| R4 | `nutrition.test.ts` › "R4: objetivos calculados" (Lucía 1750/112/200/56, derivation, 3 goals, factors, floors, age) | unit | 🔴 |
| R4 | `onboarding-calculated.spec.ts` › "R4: Lucía ve 1750…", "R4: si edita un valor sugerido…" | e2e | 🔴 |
| R5 | `nutrition.test.ts` › "R5: validación del plan del nutricionista" | unit | 🔴 |
| R5 | `onboarding-prescribed.spec.ts` › "R5: con rango, mínimo > máximo…", "R5: kcal vacías o fuera…" | e2e | 🔴 |
| R6 | `nutrition.test.ts` › "R6: …" (Manuel F 68 / C 192, no weight 25%, partial fill) | unit | 🔴 |
| R6 | `onboarding-prescribed.spec.ts` › "Escenario 2 completo…" | e2e | 🔴 |
| R7 | `onboarding-calculated.spec.ts` › "R7: sin ninguna comida marcada…" | e2e | 🔴 |
| R8 | `tests/e2e/meals.spec.ts` › "R8: el plan semanal…", "R8: al añadir al diario…", edge case for a deselected meal | e2e | 🔴 |
| R9, R11, R12 | `onboarding-calculated.spec.ts` › "Escenario 1 completo…" (preset + custom allergy, diet, dislike dedupe) | e2e | 🔴 |
| R10 | `tests/unit/recipes-route.test.ts` › "R10: …" (separate "nunca uses" block with family terms, custom allergies) | unit | 🔴 |
| R11, R12 | `recipes-route.test.ts` › "R11–R12: …" | unit | 🔴 |
| R13 | `tests/e2e/perfil.spec.ts` › "R13: un cambio en Perfil persiste…", "R13: pasar de calculado a nutricionista…" | e2e | 🔴 |
| R14 | `tests/unit/migrate.test.ts` › "R14: …" + "Snack → Merienda" | unit | 🔴 |
| R14 | `tests/e2e/migration.spec.ts` › "R14: un perfil v1 entra directo al diario…" (incl. v1 backup) | e2e | 🔴 |
| R15 | `perfil.spec.ts` › "R15: …" (×2) | e2e | 🔴 |
| R16 | `perfil.spec.ts` › "R16: …" (×3: recalc, keep, prescribed shows no banner) | e2e | 🔴 |
| R17 | `recipes-route.test.ts` › "R17: …" (AI gets the midpoint) + `onboarding-prescribed.spec.ts` (dashboard "0 / 130–170") | unit + e2e | 🔴 |
| R18 | `tests/unit/allergens.test.ts` (every family term, plurals, word boundaries, "sin", recipe name, custom) | unit | 🔴 |
| R18 | `recipes-route.test.ts` › "R18: …" (drops, `droppedCount`, lactose-free kept) + `tests/e2e/recipes.spec.ts` (empty-state message) | unit + e2e | 🔴 |
| R19 | — (proposed cut, see Spec feedback) | — | — |
| Edge cases | macro mismatch > 10% (unit); allergy ∩ dislike, unmapped legacy restriction (unit); "sin <alérgeno>", "leche de coco" (unit); "Atrás" keeps values (e2e) | unit + e2e | 🔴 |

Not automated: the 10% mismatch *warning UI* (only the calculation is tested), and the manual metrics (20 AI generations, the timed onboarding session).

## Spec feedback
**Decided 2026-09-22 (Manuel):**
- R19 is cut.
- Allergen badges on seed recipes and pickers are in scope (task 14).
- "Prefiero no decirlo" is added. It sets `Sex = "unspecified"`, the BMR constant is −78 (the average of +5 and −161), and the calorie floor is 1350 (the average of the two floors).
- A protein range counts as on target anywhere inside the band.
- "avena" stays in Gluten.

Original feedback, kept for context:
1. **Cut R19 (custom meal slot) from this release.** It turns `MealType` from a closed union into free strings. That breaks icons, ordering and the "Snack" mapping, and adds a custom-slot lifecycle (renaming, deleting it with entries attached). "Recena" is a nice-to-have for nobody in the current household. Revisit it as a separate small change.
2. **Allergen checks on seed recipes and planner/diary picks.** Right now an allergic user can add a seed recipe containing almonds without any warning. I'd add a non-blocking "⚠ contiene Frutos secos" badge in Recetas, the planner picker and the diary picker. It reuses `recipeViolations()` and costs about half a day. Should it be in scope?
3. **"Prefiero no decirlo":** it's trivial to support by averaging the constants (−78). I'd add it, since the sex question is the most sensitive field.
4. **"avena" in Gluten:** keep it (over-exclusion is the spec's stated principle), and mention in the UI that oats can be tolerated if certified.
5. **Range "on target":** I'd treat anywhere inside the band as met. That's what the band implies, and it's no more work.

Minor points for PM to confirm:
- "Pre-entreno" vs. the brief's "Pre-gym": the spec wins.
- The matching rules are word-boundary based, so compounds like "empanado" aren't caught by `pan`. That's acceptable given the over-exclusion elsewhere.
- Filtering also checks the recipe **name**, not only its ingredients.
- The recipe route should stop receiving body data it doesn't use.
