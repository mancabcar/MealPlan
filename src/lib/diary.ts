// Diario desde el plan (docs/pm/diario-desde-plan/tech.md › APIs). Puro: sin React ni store.
// "Pendiente" nunca se guarda: se deriva en cada render del plan y de las entradas.
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe, type WeekPlan } from "./types";

/** Entrada de receta con sus macros tal cual (la misma que el formulario "Receta"). */
export function recipeEntry(recipe: Recipe, date: string, mealType: MealType, id: string = crypto.randomUUID()): MealEntry {
  return {
    id,
    date,
    mealType,
    recipeId: recipe.id,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
  };
}

export interface PendingSlot {
  mealType: MealType;
  recipe: Recipe;
}

/** Franjas planificadas sin ninguna entrada, en orden MEAL_TYPES. Vacío para fechas futuras. */
export function pendingSlots({
  date,
  today,
  weekPlan,
  recipes,
  entries,
  meals,
}: {
  date: string;
  today: string;
  weekPlan: WeekPlan;
  recipes: Recipe[];
  entries: MealEntry[];
  meals: MealType[];
}): PendingSlot[] {
  // R5: solo hoy y días pasados (YYYY-MM-DD se compara bien como string); "" = input de fecha borrado
  if (date === "" || date > today) return [];
  const slots = weekPlan[date] ?? [];
  // R3/R4/R6: cualquier entrada de esa comida ese día la quita (una pasada por el historial, no una por comida)
  const logged = new Set(entries.filter((e) => e.date === date).map((e) => e.mealType));
  const result: PendingSlot[] = [];
  for (const mt of MEAL_TYPES) {
    if (!meals.includes(mt)) continue;
    // La primera franja de esa comida, como Plan (slots.find)
    const slot = slots.find((s) => s.mealType === mt);
    const recipe = slot && recipes.find((r) => r.id === slot.recipeId);
    if (!recipe) continue;
    if (logged.has(mt)) continue;
    result.push({ mealType: mt, recipe });
  }
  return result;
}
