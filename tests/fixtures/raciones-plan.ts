// Datos de "Raciones en el Plan" (docs/pm/29-raciones-plan/spec.md › Acceptance criteria).
// Compartidos por tests/unit/plan-servings*.test.ts y tests/e2e/raciones-plan.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts); la semana es lunes 21 → domingo 27.
// Se reutilizan GUISO (600 kcal · P 40 · C 60 · G 20; 200g lentejas, 150g pechuga de pollo, 1 cebolla) y
// CREMA_CALABAZA de tests/fixtures/sobras.ts; POLLO_PEREJIL añade una línea sin cantidad ("perejil fresco").
import type { Recipe, WeekPlan } from "@/lib/types";
import { recipe } from "./shopping";
import { BATCH_ID, CREMA_CALABAZA, GUISO, SOBRAS_RECIPES, THU, TUE, WED } from "./sobras";

export { BATCH_ID, CREMA_CALABAZA, GUISO, THU, TUE, WED };

export const POLLO_PEREJIL: Recipe = recipe("rp-pollo-perejil", "Pollo al perejil", ["200g pechuga de pollo", "perejil fresco"]);

export const RACIONES_PLAN_RECIPES: Recipe[] = [...SOBRAS_RECIPES, POLLO_PEREJIL];

/** Franja de Comida del martes (hoy) con las raciones indicadas; sin `servings` si no se da. */
export const guisoTue = (servings?: number): WeekPlan => ({
  [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, ...(servings === undefined ? {} : { servings }) }],
});

/** Cocinada ×3 el martes (Comida) con sobras el miércoles (Comida) y el jueves (Cena), con raciones en cada una. */
export function batchPlanWith({ cooked, leftover }: { cooked?: number; leftover?: number }): WeekPlan {
  const s = (n?: number) => (n === undefined ? {} : { servings: n });
  return {
    [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, cookedServings: 3, ...s(cooked) }],
    [WED]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true, ...s(leftover) }],
    [THU]: [{ mealType: "Cena", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true, ...s(leftover) }],
  };
}
