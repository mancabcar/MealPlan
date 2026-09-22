# Better onboarding profile: Spec
_Status: Draft · Owner: Manuel Cabrera · Updated: 2026-09-22_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/LrZVe1J6ozWvYm5BgFYozD)_

## TL;DR
Onboarding currently makes every household member type calories and macros from nothing, so most people end up on the 2000 / 120 / 200 / 65 defaults. We're replacing the targets step with two paths:
- **"Calcúlalo por mí":** the user enters body data and gets suggested targets they can edit.
- **"Tengo un plan de mi nutricionista":** the user types in prescribed targets, and protein can be a range.

The same release adds per-user meal slots and separates allergies (a hard exclusion) from dislikes (a soft preference). It has worked if a household member without a nutritionist finishes onboarding in under 2 minutes and keeps the suggested targets for their first week.

## Problem
Household members set up MealPlanner by typing daily calorie and macro goals into blank number fields (`Onboarding.tsx`, step 1). Only someone with a nutritionist knows what to type. Manuel's August plan prescribes 1980 kcal and 130–170 g protein, which can't even be entered, because protein is a single number. Everyone else keeps the defaults.

Three gaps in the current profile:
- `mealsPerDay` is hard-coded to `3` and nothing reads it. The planner shows 3 fixed slots (`MEAL_TYPES.slice(0, 3)`), but real plans have 4–5 meals.
- "sin frutos secos" sits next to "vegano" as the same kind of toggle. The AI recipe prompt gets restrictions and dislikes under one "respeta y evita" instruction, so it can't tell an allergy from a dislike.
- There's no body data, so the app can't suggest targets or recalculate them later.

## Goals
- A household member without a nutritionist gets reasonable daily targets without knowing any nutrition numbers.
- A user with a nutritionist's plan can enter exactly what was prescribed, including a protein range.
- The planner and diary match the meals each user actually eats.
- AI-generated recipes never include a declared allergen.

## Non-goals
- A weight log, measurements history or evolution charts. We store the current weight only.
- Importing a nutritionist's PDF, or the weekly menu from it.
- A shared household profile, or checking recipes against other members' allergies.
- Medical diets (diabetic, renal and so on) and goals beyond lose / maintain / gain.
- Per-meal calorie distribution, meal-time reminders or notifications. Meal times are not stored.
- Imperial units. The app stays metric only.
- Server-side storage. Profiles stay in each user's localStorage.

## Users & key scenarios
Primary users are household members with local accounts on a shared device.

1. **Lucía, no nutritionist:** creates her account, chooses "Calcúlalo por mí", enters her body data, accepts 1750 kcal / 112 P / 200 C / 56 F, and picks 4 meals.
2. **Manuel, with a nutritionist:** chooses "Tengo un plan", enters 1980 kcal and 130–170 g protein, leaves carbs and fat empty, and picks 5 meals including Media mañana and Pre-entreno.
3. **Existing user after the update:** their profile keeps working. Old restrictions are sorted into the new allergy and diet fields, and they aren't forced back through onboarding.
4. **Lucía, a few weeks later:** updates her weight in Perfil and is offered recalculated targets, which she can accept or decline.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | The user picks one goal in onboarding: Perder grasa, Mantenerme or Ganar músculo. | Must |
| R2 | The user chooses how to set targets: "Calcúlalo por mí" or "Tengo un plan de mi nutricionista". | Must |
| R3 | On the calculated path, the user enters sex, birth year, height (cm), weight (kg) and one of 4 activity levels. Values are validated. | Must |
| R4 | The app suggests daily kcal, protein, carbs and fat from R1 + R3 using the formula below. It shows how they were derived, and every value is editable before accepting. | Must |
| R5 | On the prescribed path, the user enters daily kcal and protein as a single value or a min–max range. Carbs, fat and current weight are optional. | Must |
| R6 | Carbs or fat left empty on the prescribed path are filled from the remaining calories using the formula below. | Must |
| R7 | The user picks which meals they eat from a fixed list: Desayuno, Media mañana, Comida, Merienda, Pre-entreno, Cena. At least 1 is required. | Must |
| R8 | The weekly planner and the diary's meal selector show exactly the user's chosen meals, in the order of the fixed list. | Must |
| R9 | The user declares allergies and intolerances from a list (Frutos secos, Gluten, Lactosa, Marisco, Huevo, Soja) plus free-text additions. | Must |
| R10 | AI recipe generation treats allergies as a hard exclusion, stated separately from dislikes and diet. For each preset allergen, the instruction lists its whole ingredient family (see Allergen families). | Must |
| R11 | The user picks one diet type: Como de todo, Pescetariana, Vegetariana or Vegana. | Must |
| R12 | The user can add and remove "No me gusta" ingredients. The AI treats them as a preference to avoid, not a rule. | Must |
| R13 | Every onboarding field is viewable and editable in Perfil. From Perfil the user can also switch target source (calculated ↔ prescribed). | Must |
| R14 | Existing profiles are migrated on first load with no data loss and without re-running onboarding (see Edge cases). | Must |
| R15 | Perfil shows where the targets came from: "Calculado" or "De tu nutricionista". | Should |
| R16 | When a user with calculated targets changes their weight or activity in Perfil, the app offers to recalculate and shows the new values. It never changes targets without the user's confirmation. | Should |
| R17 | When protein is a range, the dashboard shows the protein goal as a band (min–max), and the AI aims at the midpoint. | Should |
| R18 | AI recipes whose ingredients match a declared allergen, or any ingredient in its family, are dropped before being shown. | Must |
| R19 | The user can add one meal slot with a custom name, such as "Recena". | Could |

### Target formula (R4, R6)
- BMR (Mifflin-St Jeor): `10·kg + 6.25·cm − 5·age + 5` (Hombre) or `− 161` (Mujer). Age = current year − birth year.
- Activity factor:

  | Level | Factor |
  |---|---|
  | Poco | 1.2 |
  | Algo | 1.375 |
  | Bastante | 1.55 |
  | Mucho | 1.725 |

- Goal adjustment: Perder −15%, Mantener 0%, Ganar +10%. Round kcal to the nearest 50 (2046 × 0.85 = 1739, which becomes 1750).
- Protein depends on the goal: Perder 1.8 g/kg, Mantener 1.6 g/kg, Ganar 2.0 g/kg. Fat 0.9 g/kg for every goal. Carbs = (kcal − 4·P − 9·F) / 4. Round every gram value to a whole number.
- On the prescribed path (R6), use the protein midpoint and the entered weight. If no weight was entered, fat defaults to 25% of kcal.
- Check with Lucía (Mujer, 34 years, 165 cm, 62 kg, Bastante, Perder): 1750 kcal, 112 P, 56 F, 200 C.

### Allergen families (R10, R18)
Each preset allergen covers the terms below. Matching ignores case and accents and accepts plurals ("Almendras" matches "almendra").

| Allergen | Family terms |
|---|---|
| Frutos secos | almendra, nuez, avellana, anacardo, pistacho, piñón, macadamia, pecana, nuez de Brasil, cacahuete, praliné, mazapán, turrón |
| Gluten | trigo, cebada, centeno, espelta, kamut, avena, sémola, cuscús, bulgur, seitán, harina, pan, pasta, cerveza |
| Lactosa | leche, nata, mantequilla, queso, yogur, requesón, cottage, suero de leche, bechamel |
| Marisco | gamba, langostino, cigala, cangrejo, bogavante, langosta, mejillón, almeja, berberecho, navaja, vieira, calamar, sepia, pulpo |
| Huevo | huevo, clara, yema, mayonesa, merengue, alioli |
| Soja | soja, tofu, tempeh, edamame, miso, tamari |

Custom (free-text) allergens match their own name only.

> Note: the prototype's plan-path note used fat at 0.8 g/kg. This spec uses 0.9 g/kg on both paths so the two agree. With Manuel's numbers that gives 68 F / 192 C, not the prototype's 61 / 208.

## User flows
**Calculated path (scenario 1)**
1. `1 · Nombre y objetivo`: enter name, pick a goal.
2. `2 · ¿Cómo fijamos tus objetivos?`: tap "Calcúlalo por mí".
3. `3a · Calcúlalo: datos corporales`: enter body data and activity, tap "Calcular mis objetivos".
4. `4a · Objetivos sugeridos`: review or edit the values, optionally read "¿De dónde salen estas cifras?", tap "Usar estos objetivos".
5. `5 · Comidas del día`: toggle meals.
6. `6 · Alergias vs. no me gusta`: allergies, diet type, dislikes. Tap "Empezar", which leads to the dashboard.

**Prescribed path (scenario 2):** steps 1–2, tap "Tengo un plan", then `3b · Tengo un plan de mi nutricionista`, then steps 5–6.

**Back navigation:** every step after step 1 has "Atrás", and it keeps what the user entered.

**Later edits (scenario 4):** `7 · Perfil`. Each section has "Editar". The recalculation banner appears after a weight or activity change (R16).

## Acceptance criteria
**R1–R2**
- Given a new account, when onboarding starts, then step 1 asks for name and goal, and "Continuar" is disabled until the name is non-empty. Perder grasa is preselected.
- Given step 2, when the user taps either option, then they land on 3a or 3b respectively.

**R3**
- Given step 3a, when height is outside 120–230 cm, weight outside 30–250 kg, or age (from birth year) outside 14–100, then the offending field shows an inline error and "Calcular" is disabled.
- Weight accepts a comma or a dot as the decimal separator ("62,0" = 62.0).

**R4**
- Given Lucía's inputs, when she taps "Calcular", then 4a shows exactly 1750 kcal / 112 P / 200 C / 56 F, plus the derivation: BMR 1320, × 1.55 = 2046, −15% = 1750.
- Given 4a, when the user edits any value and accepts, then the edited values are saved as their targets.
- Given a calculated kcal below 1200 (Mujer) or 1500 (Hombre), then the app suggests that floor instead and says so in the derivation.

**R5–R6**
- Given step 3b with "Es un rango" on, when min > max, then an inline error shows and "Continuar" is disabled.
- Given 1980 kcal, 130–170 P, 76 kg, and empty carbs and fat, when the user continues, then the saved targets are 1980 kcal, P 130–170, F 68, C 192.
- Given kcal is empty or outside 800–6000, then "Continuar" is disabled.

**R7–R8**
- Given step 5, when the user deselects every meal, then "Continuar" is disabled and a hint says at least one is required.
- Given a user with 5 meals chosen, when they open the planner or add a diary entry, then exactly those 5 meals appear, in list order, and no others.

**R9–R12**
- Given the allergy "Frutos secos", when recipes are generated, then the prompt lists it under a separate hard-exclusion instruction ("nunca uses"), apart from diet and dislikes.
- Given the allergy "Frutos secos", when the AI returns a recipe with "almendras laminadas" or "Nueces", then that recipe is not shown. If every returned recipe is dropped, the user sees "Ninguna receta era segura para tus alergias. Prueba de nuevo." rather than an empty list.
- Given the allergy "Lactosa", when a recipe contains "leche sin lactosa" or "queso sin lactosa", then the recipe is kept (see Edge cases).
- Given the dislike "Hígado", then the prompt lists it as a preference to avoid.
- Given the diet "Vegetariana", then the prompt states it as a rule.
- Adding a dislike that already exists (compared case-insensitively) does nothing.

**R13–R14**
- Given a completed profile, when the user edits any field in Perfil and saves, then the change persists after a reload.
- Given a pre-update profile with `dietaryRestrictions: ["sin frutos secos", "vegetariano"]`, when the app loads, then allergies = [Frutos secos], diet = Vegetariana, and the targets and dislikes are unchanged.
- The migrated profile has target source "prescribed", because the user typed its numbers, and no body data. All 6 meals are selected. The user is not sent to onboarding.

**R16**
- Given calculated targets, when the user saves a new weight in Perfil, then a banner shows the recalculated kcal and protein with "Recalcular" and "Mantener los actuales". Nothing changes until "Recalcular" is tapped.
- Given prescribed targets, then no banner appears.

## Edge cases
- **Diary entries for a meal the user later deselects:** the entries stay visible in the diary's history. The meal just isn't offered for new entries.
- **"Snack" entries from before the update:** these map to "Merienda".
- **Prescribed macros that don't add up:** if 4·P + 4·C + 9·F differs from kcal by more than 10%, show a non-blocking warning. Nutritionists round.
- **An ingredient that is both an allergy and a dislike:** keep it only as an allergy.
- **Legacy restriction strings with no mapping (free text):** they become custom allergy entries rather than being dropped. It's safer to over-exclude.
- **"Sin <allergen>" products:** an ingredient that explicitly says "sin <allergen>" ("leche sin lactosa", "pan sin gluten") doesn't match that allergen.
- **False positives from family matching:** "leche de coco" matches "leche" under Lactosa, so the recipe is dropped. We accept over-exclusion because a missed allergen is worse than a lost recipe.
- **Switching target source in Perfil:** from calculated to prescribed, pre-fill with the current values. From prescribed to calculated, run 3a with the saved body data.

## Success metrics
There's no analytics in the app. These are checked by hand with household members.

| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Time to finish onboarding, calculated path | TBD (current flow is about 1 min, with made-up numbers) | < 2 min | Timed session with a household member |
| Suggested targets kept unchanged after 7 days | TBD, since nobody can get suggestions today | Kept by at least 2 of 3 testers | Compare the Perfil values to the originally suggested ones |
| Users on the 2000 / 120 / 200 / 65 defaults | Likely all users without a nutritionist | 0 | Inspect profiles |
| AI recipes containing a declared allergen | Unknown | 0 in 20 generations | Manual review of generated recipes |

## Risks & dependencies
- **The meal-type change affects saved data.** Stored diary entries and the week plan use the 4-value `MealType`. Growing it to 6 slots needs a data migration (R14) and changes to the dashboard, planner and diary.
- **The AI is probabilistic.** R10 alone can't guarantee allergen-free recipes. R18 filters against allergen families, but a fixed term list can't catch everything, such as a brand name or a dish that hides an ingredient ("romesco"). The family table needs a review by someone who knows the household's allergies.
- **Calculated targets are estimates.** The disclaimer on 4a and the calorie floor in R4 reduce the risk, but this isn't medical advice.
- **Asking for sex is sensitive.** The formula needs it, so the label explains why ("solo para el cálculo").

## Open questions
- [x] ~~Protein g/kg per goal?~~ It varies by goal: 1.8 / 1.6 / 2.0 g/kg. The values could still be reviewed with the nutritionist.
- [x] ~~Default meals for migrated profiles?~~ All 6 for now.
- [x] ~~Allergen matching?~~ Built-in ingredient families (see the table).
- [ ] Should there be a "Prefiero no decirlo" sex option, using the average of the two formula constants? (Manuel)
- [ ] Is the allergen family table complete for this household? For example, should "avena" count as gluten? (Manuel)
- [ ] When protein is a range, should the dashboard's "on target" state count anywhere inside the band as met? (Manuel)
- [ ] Does anyone in the household need a goal beyond lose / maintain / gain, such as recomposition? (household test)
