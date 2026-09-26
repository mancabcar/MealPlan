// Macros por día en el Plan semanal (docs/pm/10-macros-plan/tech.md › APIs). Puro: sin React ni store.
// El resumen nunca se guarda: se deriva en cada render del plan, las recetas y las comidas del perfil.
import { MEAL_TYPES, type DayPlanSlot, type MealType, type Recipe } from "./types";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Objetivo de un macro: un número (se juzga con ±10 %) o un rango prescrito (min ≤ v ≤ max). */
export type MacroTarget = number | { min: number; max: number };
export type MacroStatus = "below" | "within" | "above";

/** ±10 % para los objetivos sin rango (R4). */
export const PLAN_TOLERANCE = 0.1;

/** R9: macros de una franja = receta × raciones, sin redondear. Único punto de escalado; #29 pasará slot.servings. */
export function slotMacros(recipe: Recipe, servings = 1): Macros {
  return {
    calories: recipe.calories * servings,
    protein: recipe.protein * servings,
    carbs: recipe.carbs * servings,
    fat: recipe.fat * servings,
  };
}

const finiteOr0 = (n: number) => (Number.isFinite(n) ? n : 0);

export interface DayPlanSummary {
  totals: Macros;
  /** Comidas del perfil con una receta que existe (R7). */
  planned: number;
  /** Comidas del perfil (R7). */
  total: number;
}

/**
 * R1/R7: suma, sin redondear, la primera franja de cada comida de `meals` (como la lista del Plan y
 * pendingSlots) cuya receta existe. null si ninguna suma: un día sin recetas no muestra resumen.
 */
export function dayPlanSummary({
  slots,
  recipes,
  meals,
}: {
  slots: DayPlanSlot[];
  recipes: Recipe[];
  meals: MealType[];
}): DayPlanSummary | null {
  const totals: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let planned = 0;
  for (const mealType of MEAL_TYPES) {
    if (!meals.includes(mealType)) continue;
    const slot = slots.find((s) => s.mealType === mealType);
    const recipe = slot && recipes.find((r) => r.id === slot.recipeId);
    if (!recipe) continue;
    const m = slotMacros(recipe);
    // Una receta restaurada de un backup solo se valida por id: un macro ausente o no numérico suma 0, no NaN
    totals.calories += finiteOr0(m.calories);
    totals.protein += finiteOr0(m.protein);
    totals.carbs += finiteOr0(m.carbs);
    totals.fat += finiteOr0(m.fat);
    planned++;
  }
  return planned > 0 ? { totals, planned, total: meals.length } : null;
}

/**
 * R3/R4: se juzga el valor redondeado (lo que se ve). Rango: min ≤ v ≤ max. Número g: banda ±10 %,
 * comparada en aritmética entera (10·v frente a 9·g y 11·g) porque 230 × 0,9 no es exacto en coma flotante.
 */
export function macroStatus(value: number, target: MacroTarget): MacroStatus {
  // Con NaN todas las comparaciones son falsas y caería en "within": un valor que no es número nunca cumple
  if (!Number.isFinite(value)) return "below";
  const v = Math.round(value);
  if (typeof target !== "number") {
    if (v < target.min) return "below";
    if (v > target.max) return "above";
    return "within";
  }
  const scale = Math.round(1 / PLAN_TOLERANCE); // 10
  if (scale * v < (scale - 1) * target) return "below";
  if (scale * v > (scale + 1) * target) return "above";
  return "within";
}
