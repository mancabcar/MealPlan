// Macros por día en el Plan semanal (docs/pm/10-macros-plan/tech.md › APIs). Puro: sin React ni store.
// El resumen nunca se guarda: se deriva en cada render del plan, las recetas y las comidas del perfil.
import { MEAL_TYPES, type DayPlanSlot, type MealType, type Recipe, type UserProfile } from "./types";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Macros de una receta o entrada con su fibra (#23), que no tiene dato en todas: ausente = sin dato. El Plan no la suma. */
export interface MacrosWithFiber extends Macros {
  fiber?: number;
}

/** Objetivo de un macro: un número (se juzga con ±10 %) o un rango prescrito (min ≤ v ≤ max). */
export type MacroTarget = number | { min: number; max: number };
export type MacroStatus = "below" | "within" | "above";

/** R9: macros de una franja = receta × raciones, sin redondear. Único punto de escalado (`dayPlanSummary` pasa slotServings). */
export function slotMacros(recipe: Recipe, servings = 1): MacrosWithFiber {
  return {
    calories: recipe.calories * servings,
    protein: recipe.protein * servings,
    carbs: recipe.carbs * servings,
    fat: recipe.fat * servings,
    // Sin dato de fibra no se inventa un 0 (#23, R1)
    ...(recipe.fiber !== undefined && { fiber: recipe.fiber * servings }),
  };
}

/**
 * Raciones que se comen en una franja (docs/pm/29-raciones-plan › R7): ausente = 1. Una copia de seguridad con un valor
 * que no es un número positivo se trata como 1, no como 0 ni NaN.
 */
export function slotServings(slot: Pick<DayPlanSlot, "servings">): number {
  const s = slot.servings;
  return typeof s === "number" && Number.isFinite(s) && s > 0 ? s : 1;
}

export const finiteOr0 = (n: number) => (Number.isFinite(n) ? n : 0);

/** Objetivo de un macro desde el perfil: proteína = proteinRange ?? proteinGoal. Único mapeo, lo usan Plan y Diario. */
export function macroTarget(key: keyof Macros, profile: UserProfile): MacroTarget {
  switch (key) {
    case "calories":
      return profile.calorieGoal;
    case "protein":
      return profile.proteinRange ?? profile.proteinGoal;
    case "carbs":
      return profile.carbsGoal;
    case "fat":
      return profile.fatGoal;
  }
}

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
    const m = slotMacros(recipe, slotServings(slot));
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
 * R3/R4: se juzga el valor redondeado (lo que se ve). Rango: min ≤ v ≤ max, sin tolerancia. Número g: banda
 * ±tolerancePct (#49: la del perfil, entero 5–20; lib/tolerance.ts › tolerancePct), comparada en centésimas enteras
 * (100·v frente a (100 ∓ pct)·g) porque 230 × 0,9 no es exacto en coma flotante.
 * Los límites se redondean a la centésima para que un objetivo con decimales (Perfil admite «69,5») no
 * reintroduzca el error: 69,3 × 90 = 6236,999… → 6237.
 */
export function macroStatus(value: number, target: MacroTarget, tolerancePct: number): MacroStatus {
  // Con NaN todas las comparaciones son falsas y caería en "within": un valor que no es número nunca cumple
  if (!Number.isFinite(value)) return "below";
  const v = Math.round(value);
  if (typeof target !== "number") {
    if (v < target.min) return "below";
    if (v > target.max) return "above";
    return "within";
  }
  if (100 * v < Math.round((100 - tolerancePct) * target)) return "below";
  if (100 * v > Math.round((100 + tolerancePct) * target)) return "above";
  return "within";
}
