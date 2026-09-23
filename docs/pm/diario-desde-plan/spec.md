# Registrar comidas planificadas desde el Diario: Spec
_Status: Approved (2026-09-23) · Owner: Manuel Cabrera · Updated: 2026-09-23_
_Related: [brief](brief.md) · [issue #6](https://github.com/mancabcar/MealPlan/issues/6) · No prototype (small addition inside the existing Diario cards)_

## TL;DR
Plan and Diario aren't connected: to log a planned meal, the user has to find the same recipe again in the Diario's dropdown. For today and past days, the Diario will show each planned slot that has no entry yet as "pendiente", with a one-tap "Hecho" that logs the planned recipe and its macros. It has worked if most entries of planned recipes come from "Hecho" instead of the manual form.

## Problem
Users plan the week in Plan (`WeekPlan`: date → `{ mealType, recipeId }[]`, at most one recipe per slot). When they eat the meal, they open the Diario, tap "Añadir comida", pick the slot again, switch to "Receta" and find the recipe in a dropdown of every recipe. That's four interactions to repeat information the app already has, for every meal of every day. Yazio and Fitia let the user tick a planned meal as eaten. Without this, the plan is a list to read, not something that feeds the log.

## Goals
- Logging a planned meal takes one tap from the Diario.
- The Diario makes it obvious which planned meals of the day haven't been logged yet.
- Eating something other than the plan remains easy and doesn't leave the app in a confusing state.

## Non-goals
- **Portions or editing macros when logging.** "Hecho" logs the recipe's macros as they are, the same as picking the recipe in the form today.
- **Pending items for future days.** The user can't eat a meal ahead of time (decision 2026-09-23).
- **Changing the plan from the Diario.** Logging something different doesn't touch the plan, and there's no "skip" or "dismiss" for a slot.
- **Remembering that an entry came from the plan.** `MealEntry` doesn't change, and once an entry exists the pending row goes away regardless of its origin.
- **Reminders or notifications** for meals not logged yet.
- **Changes to the Plan screen** (for example, ticks on planned slots that have been logged).

## Users & key scenarios
Primary user: someone who plans their week in Plan and logs what they eat in the Diario.
1. **Followed the plan.** It's lunchtime, "Comida" has a planned recipe. They open the Diario, see it as pending and tap "Hecho".
2. **Ate something else.** The plan said lentils but they had a salad. They add the salad with "Añadir comida" as today. The lentils stop showing as pending, because the slot now has an entry.
3. **Catching up at night or the next day.** They followed the whole plan and log it at the end of the day with "Registrar todo el día", or go back to yesterday and tap "Hecho" on each slot.
4. **Undoing a mistake.** They tapped "Hecho" by accident, delete the entry with the existing ✕, and the slot shows as pending again.

## Requirements
A slot is **pendiente** for the selected date when all of the following hold:
- the date is today or earlier;
- the plan has a recipe for that date and meal type;
- that meal type is one of the user's meals (`profile.meals`);
- the recipe still exists;
- the Diario has **no** entry of that meal type on that date (any entry, planned recipe or not).

| ID | Requirement | Priority |
|---|---|---|
| R1 | For the selected date, the Diario shows every pending slot with its meal type, the recipe name and its calories. | Must |
| R2 | Each pending slot has a "Hecho" action that, in one tap, logs an entry for that date and meal type with the planned recipe and its calories, protein, carbs and fat. | Must |
| R3 | Once a slot has any entry of its meal type on that date, it is no longer shown as pending. This happens immediately, and totals, the ring and the week chart include the new entry. | Must |
| R4 | The user can log something other than the plan (another recipe or a custom meal) through "Añadir comida" as today. That entry clears the pending slot, and the plan is not modified. | Must |
| R5 | No pending slots are shown for dates after today. | Must |
| R6 | Deleting the entry of a planned slot makes it pending again, as long as it has no other entries of that meal type. | Must |
| R7 | Pending slots are clearly distinguished from logged entries: they don't count in the totals, and they read as not yet eaten. | Must |
| R8 | When a date has 2 or more pending slots, a "Registrar todo el día" action logs all of them in one tap, with the same result as tapping "Hecho" on each one. | Should |
| R9 | Pending slots appear in the same meal order as the rest of the Diario (the canonical `MEAL_TYPES` order). | Should |
| R10 | The recipe's allergen warning is shown on the pending slot, as in the recipe dropdown. | Could |

## User flows
**Followed the plan (R1–R3)**
1. The user opens the Diario, which shows today.
2. Under "Comida" they see the planned recipe, e.g. "Lentejas estofadas · 520 kcal", marked as pending, with "Hecho".
3. They tap "Hecho". The row becomes a normal logged entry (with ✕), and the ring and macro bars go up by the recipe's values.

**Ate something else (R4)**
1. "Cena" shows a planned recipe as pending.
2. The user taps "Añadir comida", chooses "Cena" → "Personalizada", and logs "Ensalada".
3. The "Cena" card shows "Ensalada" as the entry, and the planned recipe is no longer shown as pending.

**Catching up (R8)**
1. At night, the Diario shows 3 pending slots for today.
2. The user taps "Registrar todo el día". All three are logged and no pending slots remain.

## Acceptance criteria
**R1**
- Given today's plan has "Lentejas" in "Comida" and today has no "Comida" entries, when the user opens the Diario, then "Comida" shows "Lentejas" with its kcal as pending, with a "Hecho" action.
- Given the plan has no slots for the selected date, then no pending slots are shown and the Diario looks as it does today.
- Given all planned slots of the date already have entries, then no pending slots are shown.

**R2**
- Given "Lentejas" (520 kcal, 30 P, 60 C, 12 G) is pending in "Comida" today, when the user taps "Hecho", then exactly one entry is created with date = today, meal type = Comida, recipe = Lentejas and those four macro values.
- Given the user selected yesterday in the date picker, when they tap "Hecho" on a pending slot, then the entry is created with yesterday's date.

**R3**
- After tapping "Hecho", the slot's pending row is gone, the "Comida" card lists "Lentejas" as an entry with ✕, and the calorie total increases by 520.
- Given the pending state lives in the same data as entries, when the user reloads the page after "Hecho", then the slot still isn't pending.

**R4**
- Given "Lentejas" is pending in "Comida", when the user adds a custom entry "Ensalada" in "Comida", then "Lentejas" is no longer pending, only "Ensalada" is counted, and Plan still shows "Lentejas" for that slot.
- Given "Lentejas" is pending in "Comida", when the user adds an entry in "Cena", then "Lentejas" is still pending.

**R5**
- Given tomorrow's plan has recipes, when the user selects tomorrow in the date picker, then no pending slots or "Hecho" actions are shown.

**R6**
- Given the user tapped "Hecho" on "Comida", when they delete that entry with ✕, then "Comida" shows the planned recipe as pending again.

**R7**
- Given 2 pending slots and no entries, then the calorie ring shows 0 and the pending slots are visually distinct from entries (for example muted styling plus a "Pendiente" label), not counted in any total.

**R8**
- Given 3 pending slots for the selected date, when the user taps "Registrar todo el día", then 3 entries are created (one per slot, with each recipe's macros) and no pending slots remain.
- Given only 1 pending slot, then "Registrar todo el día" isn't shown (the slot's own "Hecho" does the same).
- Given a future date, then "Registrar todo el día" isn't shown.

## Edge cases
- **Planned meal type no longer in `profile.meals`** (the user dropped "Merienda" from their profile after planning it): not shown as pending, consistent with Plan, which already hides those slots. Existing entries of that meal type still show in the history, as today.
- **Planned recipe was deleted:** the slot isn't shown as pending, since there are no macros to log. Plan already shows nothing for it.
- **Several entries of the same meal type:** the slot counts as logged as soon as there is one entry, whatever the recipe.
- **Double tap on "Hecho":** only one entry is created, because the row disappears after the first tap.
- **Midnight:** "today" is `todayStr()`, the device's local date, as elsewhere in the app. If the page stays open past midnight, the previous day remains selected and its slots are still eligible.
- **Days in past weeks:** eligible as long as `weekPlan` still has slots for them.

## Success metrics
There is no analytics in the app (everything lives in localStorage), so this is checked by hand with the owner's own data.

| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Share of entries logged via "Hecho" or "Registrar todo el día" vs. the form, for planned days | 0% (doesn't exist) | Most entries on planned days | Owner's use over 2 weeks. Requires distinguishing the origin, which is a non-goal, so this is a qualitative check. |
| Taps to log a planned meal | 4–5 | 1 | Manual count |

## Risks & dependencies
- **Diario layout after the design refresh (PR #4):** today the per-meal cards only render when they have entries. Pending slots need a card even when the meal type has no entries, so this changes when cards appear. Tech design should decide whether a pending slot lives inside its meal card or in its own "Pendiente" section.
- **Future multi-recipe slots:** the spec assumes one recipe per slot, as `DayPlanSlot` does today. If Plan ever allows several recipes per slot, "any entry clears the slot" will need revisiting.

## Open questions
- [x] Meal types no longer in `profile.meals`: not shown as pending, mirroring Plan. Confirmed by Manuel, 2026-09-23.
- [x] No undo toast after "Hecho": the ✕ on the entry (R6) is enough. Confirmed by Manuel, 2026-09-23.
