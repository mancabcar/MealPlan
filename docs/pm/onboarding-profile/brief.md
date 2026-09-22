# Better onboarding profile
_Status: tech design · Updated: 2026-09-22 · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problem
**A household member setting up MealPlanner needs a way to get daily targets and food constraints they trust, because the current onboarding makes them type calories and macros from nothing. Today they accept the defaults (2000 kcal / 120 P / 200 C / 65 F) or copy numbers from their nutritionist's PDF by hand.**

The request was "the form is missing fields", but that is a symptom. The real gaps are:
- **Targets aren't derived from anything.** We never ask sex, age, height, weight, activity level or goal, so we can't suggest numbers. Only someone who already has a nutritionist (Manuel: 1980 kcal, 130–170 g protein) knows what to type. Other household members don't.
- **Meal structure is wrong.** `mealsPerDay` is hard-coded to `3` and nothing reads it. The real plan has 5 meals a day (desayuno, media mañana, comida, pre-gym, cena), but `MealType` only has 4 slots.
- **Safety and taste are mixed together.** "sin frutos secos" is a toggle alongside "vegano", and dislikes are free text. The AI prompt (`api/recipes/route.ts`) can't tell a hard allergy from a mild dislike.
- **Some targets are ranges.** The nutritionist gives protein as 130–170 g, but the model stores one number.

Useful constraint: the only consumers of profile data are the dashboard (`calorieGoal`, macros) and the AI recipe prompt (calories, restrictions, dislikes). **A new field is only worth adding if one of these reads it.**

## Success looks like
- A household member without a nutritionist finishes onboarding in under 2 minutes with targets they didn't have to invent, and doesn't edit them in Perfil in the first week.
- Manuel can enter his prescribed plan (1980 kcal, 130–170 g P, 5 meals/day) and the app's targets match it.
- The AI never suggests a recipe containing a declared allergen.

## Constraints & assumptions
- Accounts are local (localStorage, no backend), and each household member has their own account and profile.
- Spanish UI, mobile-first. The same fields must be editable later in `/perfil`.
- Assumed: household members won't know their macros but will know their height, weight and rough activity level.
- Assumed: the only goals are lose, maintain and gain. There are no medical diets (renal, diabetic) in scope.
- Existing profiles must keep working, so new fields need defaults or a migration.

## Directions considered

### A. Just add the fields: extend the current form
Add sex, birth year, height, weight, activity, goal, meals per day and a separate allergies field to the existing steps. Macros stay manual. **Risk:** the form gets longer while the user still has to invent numbers, and several fields would be stored but never read.

### B. Two-path targets: "I have a plan" / "Calculate for me"
Step 2 becomes a fork. **Calculate** asks sex, age, height, weight, activity and goal, then suggests kcal from Mifflin-St Jeor + activity factor ± deficit and splits macros with protein in g/kg. The suggestions are pre-filled and editable, with a one-line "why". **Prescribed** lets the user type kcal plus a protein *range*, taken from their nutritionist. Both paths then ask for meal structure (which slots they eat) and split allergies (hard) from dislikes (soft). **Risk:** calculated targets may feel generic, or wrong for people with unusual body composition.

### C. Import the nutritionist's plan with AI
Upload the plan PDF. Claude extracts targets, meal slots, supplements and even the weekly menu into the planner. **Risk:** it only helps people with a nutritionist (one person in this household), the PDF formats vary, and it's a big build for a one-off action.

### D. Ask less, later: progressive profile
Cut onboarding to name + goal and start on defaults. Ask for the other details where they matter: allergies the first time the user taps "generate recipe", weight when they open the dashboard, meal slots when they plan a week. **Risk:** targets stay wrong for days, and it's harder to build because every screen needs a "missing info" state.

### E. Household-first: shared kitchen profile
Onboarding asks about the *kitchen*, not the person: who eats here, shared allergies, and dislikes across the household. Each person then gets their own short targets step. Recipes are checked against everyone's allergies. **Risk:** it changes the data model (a household entity above accounts) for a problem nobody has reported yet.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Add fields | Low | Low | Med | That more fields = better, even if nothing uses them |
| B. Two-path targets | High | Med | High | Non-nutritionist users will trust and keep a calculated target |
| C. PDF import | Med | High | Low | Plans are parseable, and enough users have one |
| D. Progressive | Med | High | Med | Users tolerate wrong defaults until asked |
| E. Household | Med | High | Low | Shared cooking is a real pain today |

## Recommended bet
**B. Two-path targets**, plus the two structural fixes it pulls in:
1. **allergies separate from dislikes**, with allergies fed to the AI as a hard exclusion;
2. **meal slots** replacing the unused `mealsPerDay`, so a 5-meal plan fits.

Why: B targets the real pain (inventing numbers) for both user types in this household. Every field it adds has a consumer: body data feeds the calculator, slots feed the planner, and allergies feed the AI. A still makes people guess. C only helps Manuel. D and E are real ideas, but they're larger bets for later. Storing weight at onboarding also sets up a future weight/measurements log (see `docs/referencia/evolucion-agosto-2026.md`) at no extra cost.

What would change our mind:
- If household members say they don't care about macros and only want recipes, cut targets entirely and go D.
- If more people using the app turn out to have nutritionists, C becomes worth building.

## What to prototype
Onboarding flow on mobile, 4 steps:
1. Name + goal (lose/maintain/gain)
2. Fork: **"Tengo un plan de mi nutricionista"** vs **"Calcúlalo por mí"**
   - Calculate path: body data form, then a results screen with suggested kcal/P/C/F, a "¿de dónde sale esto?" explanation, and editable values
   - Prescribed path: kcal + protein range (min–max) + optional C/F
3. Meal slots: toggle chips (Desayuno, Media mañana, Comida, Merienda/Pre-gym, Cena)
4. Allergies (hard, highlighted) vs "No me gusta" (soft), both as chip inputs

Also mock the matching `/perfil` edit screen.

**Question it must answer:** does a household member without a nutritionist accept the calculated targets as-is, or do they immediately want to change them? Test it by walking one household member through the prototype.

## Prototype
_Design: https://claude.ai/artifact/LrZVe1J6ozWvYm5BgFYozD · 2026-09-22_

- **Screens (clickable, 390×844):**
  - 1 Nombre y objetivo
  - 2 Elegir ruta (fork)
  - 3a Calcúlalo: datos corporales
  - 4a Objetivos sugeridos, with "¿De dónde salen estas cifras?"
  - 3b Plan del nutricionista (protein range)
  - 5 Comidas del día
  - 6 Alergias vs. no me gusta
  - 7 Perfil a few days later, with a "¿recalculamos?" banner after a weight change
- **Personas:**
  - Lucía (calc path): 34 years, 165 cm, 62 kg, active 3–5 days a week, goal: lose fat. She gets 1750 kcal, 112 P / 200 C / 56 F.
  - Manuel (plan path): the real August plan, 1980 kcal, 130–170 g P, 76 kg.
- **Decisions made while prototyping (ASSUMPTIONs):**
  - Only 3 goals (lose / maintain / gain), asked first because the goal sets the deficit or surplus.
  - No "skip" on the fork. Anyone unsure should pick "Calcúlalo".
  - Birth year, not a full date. Sex is asked, labelled "solo para el cálculo".
  - Activity is described in plain words (Poco / Algo / Bastante / Mucho), not as multipliers.
  - Formula: Mifflin-St Jeor × activity factor, −15% to lose / +10% to gain. Protein 1.8 g/kg, fat 0.9 g/kg, carbs are the rest.
  - The explanation is open by default. The "no sustituye a un profesional" disclaimer doesn't block anything.
  - Protein can be a range on the plan path. The dashboard shows it as a band, and the AI aims for the midpoint.
  - Empty carbs/fat on the plan path are filled from the remaining calories (fat 0.8 g/kg).
  - 6 fixed meal slots (Desayuno, Media mañana, Comida, Merienda, Pre-entreno, Cena), plus one custom slot. Times are display-only.
  - Allergies and intolerances are a hard exclusion (red). Diet type is single-choice. "No me gusta" is a soft preference.
  - Targets never recalculate on their own. A weight change in Perfil offers a recalculation, and a badge shows where the targets came from ("Calculado" / "De tu nutricionista").
- **What to learn from testing it:** walk one household member without a nutritionist through 1 → 2 → 3a → 4a.
  - Do they pick the right path without help?
  - On 4a, do they accept the numbers or start editing them? Do they open or read the explanation?
  - Also check that the plan path takes Manuel under 30 seconds with his PDF open.

## Open questions
- Store age as birth date (so it stays correct) or as age (simpler)? Leaning toward birth year.
- Do meal slots need custom names ("Pre-gym"), or is a fixed list of 5–6 enough?
- Should protein be a range everywhere (dashboard bar shows a band), or only as input, collapsed to the midpoint?
- Does changing weight in Perfil re-suggest targets, or only when asked?
- How to migrate existing profiles: default slots from the current 4 `MealType`s, allergies empty, and "sin frutos secos" moved to allergies?
