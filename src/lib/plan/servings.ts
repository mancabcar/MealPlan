// Raciones por franja del Plan (docs/pm/29-raciones-plan › R1, R3). Pura: devuelve un plan nuevo y lanza Error si la
// franja no existe (la UI valida el valor con parseServings antes de llamar).
import type { WeekPlan } from "../types";
import type { SlotRef } from "./batch";

/** Fija las raciones de una franja. Con 1 se quita el campo: ausente = 1 (R1). El resto de la franja no cambia. */
export function setSlotServings(plan: WeekPlan, ref: SlotRef, servings: number): WeekPlan {
  const day = plan[ref.date] ?? [];
  if (!day.some((s) => s.mealType === ref.mealType)) throw new Error("La franja no existe");
  return {
    ...plan,
    [ref.date]: day.map((s) => {
      if (s.mealType !== ref.mealType) return s;
      const next = { ...s, servings };
      if (servings === 1) delete next.servings;
      return next;
    }),
  };
}
