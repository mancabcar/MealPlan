# Better onboarding profile: Review
_PR: [#2](https://github.com/mancabcar/MealPlan/pull/2) (**merged before this review finished**, `a356cb9`) · Reviewed: 2026-09-22 · Verdict: 🔁 Changes requested_
_**Both blocking items are fixed** in the follow-up branch `fix/onboarding-profile-review` (see the note at the end)._

## Summary
PR #2 implements all 18 in-scope requirements, plus the 4 PM decisions. R19 was cut. The design in tech.md is followed closely, and every acceptance criterion has an automated test.

- **Tests:** 156 unit and 31 e2e pass, both locally and in CI. GitHub Actions `test` passed in 1m11s, and the Vercel preview deployed.
- **Blocking:** one correctness bug in the target formula. It gives heavier users a **negative carbohydrate target**, which breaks R4 and R6.
- **Also recommended:** a safety gap in the allergen "sin …" exception.

Both need a follow-up PR, because #2 is already on `main`.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 Goal | ✅ Done | `src/components/profile/steps.tsx:30`, `Onboarding.tsx:45` | ✅ e2e |
| R2 Target source | ✅ Done | `steps.tsx:41` | ✅ e2e |
| R3 Body data + validation | ✅ Done | `lib/nutrition.ts:126`, `lib/profileDraft.ts` `parseBody`, `steps.tsx:81` | ✅ unit + e2e (height only in e2e) |
| R4 Suggested targets + derivation | ⚠️ Partial | `nutrition.ts:73`, `steps.tsx:140` | ✅ unit + e2e |
| R5 Prescribed targets / range | ✅ Done | `nutrition.ts:140`, `steps.tsx:186` | ✅ unit + e2e |
| R6 Fill empty carbs/fat | ⚠️ Partial | `nutrition.ts:105` | ✅ unit + e2e |
| R7 Meal slots (≥ 1) | ✅ Done | `steps.tsx:245` | ✅ e2e |
| R8 Planner/diary show chosen meals | ✅ Done | `app/plan/page.tsx:25,82`, `app/page.tsx:183` | ✅ e2e ×3 |
| R9 Allergies preset + free text | ✅ Done | `steps.tsx:276` | ✅ e2e |
| R10 Hard-exclusion prompt with families | ✅ Done | `lib/recipePrompt.ts:39,48` | ✅ unit |
| R11 Diet type as a rule | ✅ Done | `recipePrompt.ts` `DIET_RULES` | ✅ unit + e2e |
| R12 Dislikes as a preference, dedupe | ✅ Done | `components/profile/ui.tsx` `ChipInput`, `recipePrompt.ts` | ✅ unit + e2e |
| R13 Everything editable in Perfil + source switch | ✅ Done | `app/perfil/page.tsx:136,318,407,438` | ✅ e2e (calc → prescribed switch only) |
| R14 Migration without data loss | ✅ Done | `lib/migrate.ts:39,81`, `lib/store.tsx:34` | ✅ unit + e2e (incl. backup); verified on a real v1 profile |
| R15 Source badge | ✅ Done | `perfil/page.tsx:148` | ✅ e2e ×2 |
| R16 Recalculation offer | ✅ Done | `perfil/page.tsx:371,513` | ✅ e2e ×3 |
| R17 Protein band, midpoint to the AI | ✅ Done | `app/page.tsx:13`, `recipePrompt.ts:12` | ✅ unit + e2e ×3 |
| R18 Drop AI recipes with allergens | ⚠️ Partial | `lib/allergens.ts:86`, `api/recipes/route.ts:54,64`, `recetas/page.tsx:47` | ✅ unit + e2e |
| R19 Custom slot (Could) | ➖ Cut by PM | — | — |
| PM: "Prefiero no decirlo" | ✅ Done | `nutrition.ts` `SEX_CONSTANT` | ✅ unit |
| PM: allergen badges | ✅ Done | `allergens.ts:96`, `recetas/page.tsx:11`, pickers | ✅ e2e ×4 |

**Edge cases.** All 8 listed in the spec are handled:
- entries for deselected meals;
- Snack → Merienda;
- macro mismatch warning (`steps.tsx:232`, only unit-tested);
- allergy ∩ dislike;
- unmapped legacy text;
- "sin <alérgeno>" (see Blocking #2 on its scope);
- "leche de coco";
- switching source.

**Non-goals and scope.**
- Nothing excluded by the spec was built: no weight log, no meal times, no PDF import.
- In scope beyond the spec, agreed beforehand: the test stack and CI, the README, and the 2 PM additions.
- The fix for the 2 lint errors already on `main` in `store.tsx` is part of tech.md task 5.

**Tech design.** The implementation follows tech.md. Two divergences were never documented there:
1. There's a new module, `lib/profileDraft.ts`, for form drafts (it's tested).
2. The step components live in 2 files (`steps.tsx`, `ui.tsx`) rather than one file each.

Neither is a problem. `buildRecipePrompt` in `lib/recipePrompt.ts` is documented.

**Test integrity.** No tests were skipped or deleted. 3 selectors were changed after being written, and each change is explained in the handoff (a substring match, a missing auto-wait, and `role="alert"` for the range error). None of them weakens what's asserted.

## Blocking
1. **The carbohydrate target can be negative.** `src/lib/nutrition.ts:65` (`carbsFrom`), used by `calculateTargets` (R4) and `fillPrescribed` (R6).
   - **Why:** protein (up to 2 g/kg) and fat (0.9 g/kg) scale with total body weight while kcal gets the deficit, so nothing floors carbs at 0.
   - **Reproduced:**
     - Calculated path: Mujer, born 1986, 170 cm, 150 kg (inside the accepted 30–250 kg range), Poco, Perder grasa → **2250 kcal / P 270 / F 135 / C −11**.
     - Prescribed path: 1500 kcal, P 170, 110 kg, carbs empty → **C −18**. No mismatch warning appears, because the negative carbs make the sum match.
   - **What the user sees:** the value is pre-filled on 4a, saved, shown as "x / -11" on the dashboard and sent to the AI prompt. Heavier people are a core audience for "Perder grasa", so this isn't an obscure edge case.
   - **Suggested fix** (the choice between options needs a PM decision):
     - (a) Clamp carbs at a minimum (0 or around 50 g), take the difference out of fat, and say so in the derivation.
     - (b) At a high BMI (> 30), base protein and fat on an adjusted body weight: ideal weight + 0.4 × (actual − ideal).

     Either way, add unit tests for both paths. Also have `parsePrescribed` reject or warn when the filled-in carbs come out below 0.

2. **"sin …" exempts the whole ingredient line**, which is a safety gap in R18. `src/lib/allergens.ts:90–91`.
   - **Why:** if "sin <allergen or family term>" appears anywhere in the line, the whole line counts as safe.
   - **Example:** with the Lactosa allergy, "nata y leche sin lactosa" isn't matched, even though "nata" is a lactose term. The recipe is kept and shows no badge.
   - **Spec:** it only exempts the product that "sin" qualifies ("leche sin lactosa").
   - **Why it's blocking:** the spec's goal is that the AI never suggests a declared allergen, and this is a false negative. It's rare with one ingredient per line, but cheap to fix.
   - **Suggested fix:** discount only the matches that come directly before a "sin <x>" (for example, `leche sin lactosa`) and still match every other family term in the line. Add the two tests from this finding.

## Non-blocking
- **R13 switch back:** switching prescribed → calculated in Perfil has no e2e test. Only the calculated → prescribed direction is covered. Suggest dev-test.
- **R3 errors in the UI:** the weight and birth-year error messages are only unit-tested. The e2e test covers height only.
- **Silent disabled buttons:** on 4a and in Perfil's `MacroFields`, an out-of-range kcal value disables the button with no message. The prescribed form does show one.
- **Birth year** accepts decimals ("1992,5") because it goes through `parseDecimal`. It should require an integer.
- **Goal changes:** changing the goal in Perfil doesn't offer a recalculation. The spec only asks for weight or activity, but for calculated targets a goal change affects them more. This is a PM question.
- **Model ID:** `api/recipes/route.ts` still uses `claude-opus-4-8`, unchanged from `main`. Check it separately.
- **Manual metric still to do:** "0 allergens in 20 generations" with a real API key.

## Code review findings
Pass 1 (`code-review`, high) reported only the 2 findings above. Both are listed under Blocking.

## Follow-up fix (2026-09-22)
Branch `fix/onboarding-profile-review`, both blocking items:
1. **Carbs floor.** `splitCarbsFat` in `lib/nutrition.ts` keeps carbs at **50 g minimum** and takes the difference out of fat, never below 0. It applies to both paths (`calculateTargets` and `fillPrescribed`). `derivation.carbsFloorApplied` drives a line in "¿De dónde salen estas cifras?". The 50 g floor was chosen over 0 so nobody gets an accidental keto plan; it is a nutrition decision worth confirming.
   - Tests: the 150 kg case now gives C 50 with lower fat, the 1500 kcal / 170 g / 110 kg plan gives C 50, and a sweep over 30–250 kg × 3 goals × 3 sexes asserts no macro is ever negative.
2. **"sin <alérgeno>" scope.** `ingredientMatches` now discounts only a term immediately followed by "sin <that family>", so "nata y leche sin lactosa" matches Lactosa again while "leche sin lactosa" and "pan sin gluten" stay exempt.
   - Tests: the 2 cases from this review, plus the existing exemption cases.

Remaining non-blocking items are untouched.
