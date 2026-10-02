// Datos de recetas propias (docs/pm/18-recetas-propias/spec.md › Acceptance criteria R1–R10).
// Compartidos por los tests unitarios (tests/unit/recipe-edit.test.ts, store-recipes.test.tsx, RecipeForm.test.tsx) y
// el e2e (tests/e2e/recetas-propias.spec.ts).
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts); la semana es lunes 21 → domingo 27.
import type { MealEntry, Recipe, WeekPlan } from "@/lib/types";
import { WEEK } from "./shopping";

export { WEEK };
export const [MON, TUE, WED, THU, FRI, SAT, SUN] = WEEK;

/** Receta propia del spec (scenario 1: "la receta de mi madre"). 480 kcal · P 32 · C 45 · G 18. Lleva queso (lactosa). */
export const MACARRONES_MAMA: Recipe = {
  id: "custom_macarrones-mama",
  name: "Macarrones de mamá",
  ingredients: ["80g macarrones", "100g carne picada", "40g queso rallado", "sal"],
  instructions: ["Cocer la pasta.", "Sofreír la carne.", "Mezclar y gratinar."],
  prepTimeMinutes: 25,
  calories: 480,
  protein: 32,
  carbs: 45,
  fat: 18,
  tags: ["pasta", "comida"],
  isCustom: true,
};

/** Otra propia, sin alérgenos, con tags que se repiten para las etiquetas sugeridas. */
export const BOWL_POLLO: Recipe = {
  id: "custom_bowl-pollo",
  name: "Bowl de pollo y arroz",
  ingredients: ["150g pechuga de pollo", "60g arroz (en seco)", "1 aguacate"],
  instructions: ["Cocer el arroz.", "Plancha el pollo."],
  prepTimeMinutes: 20,
  calories: 520,
  protein: 40,
  carbs: 50,
  fat: 16,
  tags: ["bowl", "comida", "alto proteína"],
  isCustom: true,
};

/** Semilla (solo lectura): se copia con "Duplicar y editar". Mismo formato que src/data/recipes.json. */
export const SEMILLA_TORTILLA: Recipe = {
  id: "recipe_001",
  name: "Tortilla de claras con verduras",
  ingredients: ["4 claras de huevo", "1/2 pimiento rojo", "1/2 calabacín", "sal y pimienta"],
  instructions: ["Cortar las verduras.", "Saltear.", "Añadir las claras y cuajar."],
  prepTimeMinutes: 15,
  calories: 180,
  protein: 22,
  carbs: 8,
  fat: 5,
  tags: ["alto proteína", "vegetariano", "desayuno"],
};

/** Receta generada por IA: se edita y borra como una propia y conserva su marca. */
export const IA_WRAP: Recipe = {
  id: "ai_001",
  name: "Wrap de atún",
  ingredients: ["1 tortilla de trigo", "1 lata de atún"],
  instructions: ["Rellenar y enrollar."],
  prepTimeMinutes: 10,
  calories: 350,
  protein: 28,
  carbs: 30,
  fat: 12,
  tags: ["rápido"],
  isAIGenerated: true,
};

export const RECETAS_PROPIAS: Recipe[] = [SEMILLA_TORTILLA, IA_WRAP, MACARRONES_MAMA, BOWL_POLLO];

let n = 0;
export function entry(date: string, mealType: MealEntry["mealType"], e: Partial<MealEntry> = {}): MealEntry {
  return { id: `pe-${++n}`, date, mealType, calories: 0, protein: 0, carbs: 0, fat: 0, ...e };
}

/** Entrada del Diario con la receta registrada tal como estaba (macros propios, 1 ración). */
export const ENTRY_MACARRONES: MealEntry = entry(TUE, "Comida", {
  recipeId: MACARRONES_MAMA.id,
  calories: 480,
  protein: 32,
  carbs: 45,
  fat: 18,
});

/** Media ración de la misma receta: los macros ya vienen multiplicados. */
export const ENTRY_MACARRONES_MEDIA: MealEntry = entry(MON, "Cena", {
  recipeId: MACARRONES_MAMA.id,
  servings: 0.5,
  calories: 240,
  protein: 16,
  carbs: 22.5,
  fat: 9,
});

/** Una entrada de otra receta: no se toca al borrar los macarrones. */
export const ENTRY_BOWL: MealEntry = entry(TUE, "Cena", {
  recipeId: BOWL_POLLO.id,
  calories: 520,
  protein: 40,
  carbs: 50,
  fat: 16,
});

/** Una comida suelta, sin receta. */
export const ENTRY_SUELTA: MealEntry = entry(WED, "Desayuno", { customName: "Tostada", calories: 200, protein: 6, carbs: 30, fat: 5 });

export const ENTRADAS: MealEntry[] = [ENTRY_MACARRONES, ENTRY_MACARRONES_MEDIA, ENTRY_BOWL, ENTRY_SUELTA];

/**
 * Plan con los macarrones en tres sitios: una cocinada ×3 el martes (Comida) con sobras el jueves (Cena) y una franja
 * suelta el sábado (Comida) en otra fecha de la semana; el bowl el miércoles (Comida) no se toca.
 */
export const BATCH_ID = "batch-macarrones";
export const PLAN_CON_MACARRONES: WeekPlan = {
  [TUE]: [{ mealType: "Comida", recipeId: MACARRONES_MAMA.id, batchId: BATCH_ID, cookedServings: 3 }],
  [WED]: [{ mealType: "Comida", recipeId: BOWL_POLLO.id }],
  [THU]: [{ mealType: "Cena", recipeId: MACARRONES_MAMA.id, batchId: BATCH_ID, leftover: true }],
  [SAT]: [{ mealType: "Comida", recipeId: MACARRONES_MAMA.id }],
};

/** Plan sin macarrones: borrar la receta no avisa del Plan. */
export const PLAN_SIN_MACARRONES: WeekPlan = {
  [WED]: [{ mealType: "Comida", recipeId: BOWL_POLLO.id }],
};
