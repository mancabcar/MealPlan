// Datos de «Copiar la semana anterior» (docs/pm/53-copiar-semana-anterior/spec.md › Acceptance criteria).
// Compartidos por tests/unit/plan-copy-week.test.ts y tests/e2e/copiar-semana.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). Semana destino = la actual (21–27 sept);
// semana origen = la anterior (14–20 sept).
import type { DayPlanSlot, Recipe, WeekPlan } from "@/lib/types";
import {
  BATIDO_KEFIR,
  CREMA_CALABAZA,
  DATILES,
  POLLO_BROCOLI,
  TORTILLA_ESPARRAGOS,
  WEEK,
} from "./shopping";
import { GUISO } from "./sobras";
import { addDays } from "@/lib/week";

export { BATIDO_KEFIR, CREMA_CALABAZA, DATILES, GUISO, POLLO_BROCOLI, TORTILLA_ESPARRAGOS };

/** Semana origen: lunes 14 → domingo 20 sept. */
export const SRC = WEEK.map((d) => addDays(d, -7));
/** Semana destino: lunes 21 → domingo 27 sept. */
export const DST = WEEK;
export const DST_MONDAY = DST[0];

export const COPY_RECIPES: Recipe[] = [POLLO_BROCOLI, TORTILLA_ESPARRAGOS, BATIDO_KEFIR, DATILES, CREMA_CALABAZA, GUISO];
export const RECIPE_IDS = new Set(COPY_RECIPES.map((r) => r.id));

export const SRC_BATCH_ID = "batch-origen";

/**
 * Semana origen completa: 7 franjas sueltas/con raciones y una tanda de guiso ×3 (cocinada el martes, sobras el
 * miércoles a la Comida y el jueves a la Cena). La Pre-entreno del sábado es una comida que lucia no hace (se copia igual).
 */
export const SRC_PLAN: WeekPlan = {
  [SRC[0]]: [
    { mealType: "Comida", recipeId: POLLO_BROCOLI.id },
    { mealType: "Cena", recipeId: CREMA_CALABAZA.id, servings: 0.5 },
  ],
  [SRC[1]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: SRC_BATCH_ID, cookedServings: 3 }],
  [SRC[2]]: [
    { mealType: "Desayuno", recipeId: BATIDO_KEFIR.id },
    { mealType: "Comida", recipeId: GUISO.id, batchId: SRC_BATCH_ID, leftover: true },
  ],
  [SRC[3]]: [{ mealType: "Cena", recipeId: GUISO.id, batchId: SRC_BATCH_ID, leftover: true }],
  [SRC[5]]: [
    { mealType: "Cena", recipeId: TORTILLA_ESPARRAGOS.id, servings: 2 },
    { mealType: "Pre-entreno", recipeId: DATILES.id },
  ],
};

/** Origen sin tandas: tres franjas, una con raciones. */
export const SRC_SIMPLE: WeekPlan = {
  [SRC[0]]: [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }],
  [SRC[1]]: [{ mealType: "Cena", recipeId: CREMA_CALABAZA.id, servings: 1.5 }],
  [SRC[4]]: [{ mealType: "Desayuno", recipeId: BATIDO_KEFIR.id }],
};

/** Una tanda aislada en el origen (martes → miércoles y jueves). */
export const SRC_BATCH_ONLY: WeekPlan = {
  [SRC[1]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: SRC_BATCH_ID, cookedServings: 3 }],
  [SRC[2]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: SRC_BATCH_ID, leftover: true }],
  [SRC[3]]: [{ mealType: "Cena", recipeId: GUISO.id, batchId: SRC_BATCH_ID, leftover: true }],
};

/** Tanda en el destino: cocinada el lunes 21, sobras el martes 22 (Comida) y el miércoles 23 (Cena). */
export const DST_BATCH_ID = "batch-destino";
export const DST_BATCH: WeekPlan = {
  [DST[0]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: DST_BATCH_ID, cookedServings: 3 }],
  [DST[1]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: DST_BATCH_ID, leftover: true }],
  [DST[2]]: [{ mealType: "Cena", recipeId: GUISO.id, batchId: DST_BATCH_ID, leftover: true }],
};

export const slotAt = (plan: WeekPlan, date: string, mealType: string): DayPlanSlot | undefined =>
  (plan[date] ?? []).find((s) => s.mealType === mealType);

/** Todas las franjas del plan. */
export const allSlots = (plan: WeekPlan): DayPlanSlot[] => Object.values(plan).flat();

/** Las franjas de las fechas dadas, como "fecha|comida|receta" ordenadas: para comparar sin ruido de orden. */
export const flat = (plan: WeekPlan, dates: string[]): string[] =>
  dates
    .flatMap((d) => (plan[d] ?? []).map((s) => `${d}|${s.mealType}|${s.recipeId}${s.servings ? `|x${s.servings}` : ""}`))
    .sort();
