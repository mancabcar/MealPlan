import { FIBER_ERROR, parseFiber } from "./fiber";
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe, type WeekPlan } from "./types";

/** Lo que escribe el usuario en el formulario: todo texto salvo las etiquetas. Ingredientes y pasos, uno por línea. */
export interface RecipeDraft {
  name: string;
  ingredients: string;
  instructions: string;
  prepTimeMinutes: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  /** Fibra por ración (#23). Opcional: vacío o ausente = sin dato. */
  fiber?: string;
  tags: string[];
}

export type RecipeFields = Omit<Recipe, "id" | "isCustom" | "isAIGenerated">;

export type RecipeValidation =
  | { ok: true; recipe: RecipeFields }
  | { ok: false; errors: Partial<Record<keyof RecipeDraft, string>> };

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Número ≥ 0 con coma o punto decimal; null si no lo es. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!/^(\d+([.,]\d+)?|[.,]\d+)$/.test(t)) return null;
  return Number(t.replace(",", "."));
}

export function validateRecipeDraft(draft: RecipeDraft): RecipeValidation {
  const errors: Partial<Record<keyof RecipeDraft, string>> = {};
  const name = draft.name.trim();
  const ingredients = lines(draft.ingredients);
  if (!name) errors.name = "Falta el nombre";
  if (ingredients.length === 0) errors.ingredients = "Añade al menos un ingrediente";

  const amount = (field: "prepTimeMinutes" | "calories" | "protein" | "carbs" | "fat", required: boolean) => {
    if (!draft[field].trim()) {
      if (required) errors[field] = "Falta este dato";
      return 0;
    }
    const n = parseAmount(draft[field]);
    if (n === null) {
      errors[field] = "Escribe un número igual o mayor que 0";
      return 0;
    }
    return n;
  };
  const calories = amount("calories", true);
  const protein = amount("protein", false);
  const carbs = amount("carbs", false);
  const fat = amount("fat", false);
  const prepTimeMinutes = amount("prepTimeMinutes", false);
  // Fibra (#23, R8): vacía = sin dato (no 0); 0 escrito es un dato
  const fiber = parseFiber(draft.fiber ?? "");
  if (fiber === null) errors.fiber = FIBER_ERROR;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    recipe: {
      name,
      ingredients,
      instructions: lines(draft.instructions),
      prepTimeMinutes,
      calories,
      protein,
      carbs,
      fat,
      ...(typeof fiber === "number" && { fiber }),
      tags: draft.tags,
    },
  };
}

/** kcal a partir de los macros: 4·P + 4·C + 9·G. */
export function suggestCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(4 * protein + 4 * carbs + 9 * fat);
}

/** Copia propia editable de una receta (semilla, IA o propia). */
export function duplicateRecipe(recipe: Recipe, id: string): Recipe {
  const { isAIGenerated: _ai, ...rest } = recipe;
  void _ai;
  return {
    ...rest,
    id,
    name: `${recipe.name} (copia)`,
    ingredients: [...recipe.ingredients],
    instructions: [...recipe.instructions],
    tags: [...recipe.tags],
    isCustom: true,
  };
}

/** Franjas del Plan que usan la receta (cocinada, sobras y sueltas), por fecha y en orden canónico de comidas. */
export function slotsUsingRecipe(plan: WeekPlan, recipeId: string): { date: string; mealType: MealType }[] {
  return Object.keys(plan)
    .sort()
    .flatMap((date) =>
      plan[date]
        .filter((s) => s.recipeId === recipeId)
        .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType))
        .map((s) => ({ date, mealType: s.mealType })),
    );
}

/** Efecto de borrar una receta: sus entradas del Diario pasan a comida suelta (nombre y macros intactos) y el Plan pierde sus franjas. */
export function withoutRecipe({
  entries,
  plan,
  recipe,
}: {
  entries: MealEntry[];
  plan: WeekPlan;
  recipe: Recipe;
}): { entries: MealEntry[]; plan: WeekPlan } {
  const nextEntries = entries.map((e) => {
    if (e.recipeId !== recipe.id) return e;
    const { recipeId: _id, ...rest } = e;
    void _id;
    return { ...rest, customName: recipe.name };
  });
  const nextPlan: WeekPlan = {};
  for (const [date, slots] of Object.entries(plan)) {
    const kept = slots.filter((s) => s.recipeId !== recipe.id);
    if (kept.length > 0) nextPlan[date] = kept;
  }
  return { entries: nextEntries, plan: nextPlan };
}

/** Etiquetas ya usadas, sin repetir: las más usadas primero y los empates por orden alfabético. */
export function suggestedTags(recipes: Recipe[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b, "es"));
}
