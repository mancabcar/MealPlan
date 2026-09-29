// Datos de sobras y batch cooking (docs/pm/17-sobras-batch-cooking/spec.md › Acceptance criteria).
// Compartidos por los tests unitarios (tests/unit/plan-batch.test.ts, shopping-aggregate.test.ts) y el e2e
// (tests/e2e/sobras.spec.ts).
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts); la semana es lunes 21 → domingo 27.
// La cocinada es la Comida del martes; las sobras van a la Comida del miércoles y la Cena del jueves.
import type { DayPlanSlot, Recipe, WeekPlan } from "@/lib/types";
import { CREMA_CALABAZA, recipe, WEEK } from "./shopping";

export { CREMA_CALABAZA, WEEK };

export const [MON, TUE, WED, THU, FRI, SAT, SUN] = WEEK;

/** 600 kcal · P 40 · C 60 · G 20. Pechuga: 150 g por ración (×3 = 450 g). */
export const GUISO: Recipe = {
  ...recipe("t-guiso-lentejas", "Guiso de lentejas", ["200g lentejas", "150g pechuga de pollo", "1 cebolla"]),
  calories: 600,
  protein: 40,
  carbs: 60,
  fat: 20,
};

export const SOBRAS_RECIPES: Recipe[] = [GUISO, CREMA_CALABAZA];

export const BATCH_ID = "batch-guiso";
export const ORIGIN = { date: TUE, mealType: "Comida" } as const;
export const LEFTOVER_WED = { date: WED, mealType: "Comida" } as const;
export const LEFTOVER_THU = { date: THU, mealType: "Cena" } as const;

/** Cocinada ×3 el martes a la Comida, con sobras el miércoles (Comida) y el jueves (Cena). */
export const BATCH_PLAN: WeekPlan = {
  [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, cookedServings: 3 }],
  [WED]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true }],
  [THU]: [{ mealType: "Cena", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true }],
};

/** Solo el guiso el martes, sin tanda; el miércoles a la Cena ya hay otra receta (franja ocupada, R7). */
export const PLAIN_PLAN: WeekPlan = {
  [TUE]: [{ mealType: "Comida", recipeId: GUISO.id }],
  [WED]: [{ mealType: "Cena", recipeId: CREMA_CALABAZA.id }],
};

/** Cocinada ×2 el lunes (día pasado) con la sobra en la Comida de hoy: "Hecho" registra 1 ración (R6). */
export const PAST_BATCH_PLAN: WeekPlan = {
  [MON]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, cookedServings: 2 }],
  [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true }],
};

/** Una sobra cuya cocinada ya no existe (copia de seguridad editada a mano, R10): se trata como franja normal. */
export const ORPHAN_LEFTOVER_PLAN: WeekPlan = {
  [WED]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "batch-huerfano", leftover: true }],
};

export const slotAt = (plan: WeekPlan, date: string, mealType: string): DayPlanSlot | undefined =>
  (plan[date] ?? []).find((s) => s.mealType === mealType);

/** Todas las franjas del plan, en el orden de las fechas. */
export const allSlots = (plan: WeekPlan): DayPlanSlot[] => Object.values(plan).flat();
