// Spec: docs/pm/17-sobras-batch-cooking/spec.md › R6.
// Tech: docs/pm/17-sobras-batch-cooking/tech.md › Spec coverage R6: `planMacros` y `diary` no cambian, cada franja
// vale 1 ración. Estos tests pasan ya (los campos nuevos se ignoran): protegen que siga siendo así.
import { describe, expect, it } from "vitest";
import { pendingSlots } from "@/lib/diary";
import { dayPlanSummary } from "@/lib/planMacros";
import { lucia } from "../fixtures/profiles";
import { BATCH_PLAN, GUISO, TUE, WED } from "../fixtures/sobras";

const MEALS = lucia.meals;

describe("R6: el Plan y el Diario tratan cada franja (cocinada o sobra) como 1 ración", () => {
  it("el total del día del Plan suma 600 kcal en la cocinada y 600 kcal en la sobra", () => {
    const recipes = [GUISO];
    const tue = dayPlanSummary({ slots: BATCH_PLAN[TUE], recipes, meals: MEALS })!;
    const wed = dayPlanSummary({ slots: BATCH_PLAN[WED], recipes, meals: MEALS })!;
    expect(tue.totals).toEqual({ calories: 600, protein: 40, carbs: 60, fat: 20 });
    expect(wed.totals).toEqual({ calories: 600, protein: 40, carbs: 60, fat: 20 });
  });

  it('la sobra de hoy aparece como pendiente de "Hecho" con la receta completa', () => {
    const pending = pendingSlots({
      date: WED,
      today: WED,
      weekPlan: BATCH_PLAN,
      recipes: [GUISO],
      entries: [],
      meals: MEALS,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ mealType: "Comida", recipe: { id: GUISO.id, calories: 600 } });
  });
});

