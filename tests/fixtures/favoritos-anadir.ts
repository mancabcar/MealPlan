// Datos de «Favoritos en Añadir comida» (docs/pm/55-mis-alimentos/spec.md › Acceptance criteria).
// Compartidos por tests/unit/mealFavorites*.test.ts, los tests de componentes y tests/e2e/favoritos-anadir.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). Los nombres salen de los ejemplos del spec.
// Las recetas llevan tag de franja: Favoritos solo enseña una receta en las franjas en las que vale (Edge cases).
import type { MealFavorite } from "@/lib/mealFavorites";
import type { MealEntry, MealType, Recipe } from "@/lib/types";

export const TODAY = "2026-09-22";
export const YESTERDAY = "2026-09-21";
export const TWO_DAYS_AGO = "2026-09-20";

function recipe(id: string, name: string, tags: string[], macros: Pick<Recipe, "calories" | "protein" | "carbs" | "fat">): Recipe {
  return { id, name, ingredients: ["Ingrediente"], instructions: ["Preparar."], prepTimeMinutes: 20, tags, ...macros };
}

/** Receta de Comida y Cena (R2: «Pollo al curry»). */
export const POLLO_CURRY = recipe("t-pollo-curry", "Pollo al curry", ["comida", "cena"], { calories: 520, protein: 38, carbs: 45, fat: 18 });
/** Solo de Desayuno: no sale en Favoritos con Cena elegida. */
export const PORRIDGE = recipe("t-porridge", "Porridge de avena", ["desayuno"], { calories: 340, protein: 12, carbs: 52, fat: 9 });
export const FAV_RECIPES: Recipe[] = [POLLO_CURRY, PORRIDGE];

// --- Personalizadas favoritas ------------------------------------------------

export const TORTILLA_FAV: MealFavorite = {
  id: "fav-tortilla",
  kind: "custom",
  name: "Tortilla francesa",
  calories: 190,
  protein: 13,
  carbs: 1,
  fat: 15,
};
/** R4: 11 g de grasa; se corrige a 9 g. */
export const TOSTADA_FAV: MealFavorite = {
  id: "fav-tostada",
  kind: "custom",
  name: "Tostada con aceite",
  calories: 210,
  protein: 5,
  carbs: 28,
  fat: 11,
  fiber: 3,
};
export const CREMA_FAV: MealFavorite = {
  id: "fav-crema",
  kind: "custom",
  name: "Crema de calabacín",
  calories: 120,
  protein: 4,
  carbs: 12,
  fat: 6,
  fiber: 2.5,
};
export const CAFE_FAV: MealFavorite = { id: "fav-cafe", kind: "custom", name: "Café con leche", calories: 90, protein: 6, carbs: 9, fat: 3 };

// --- Alimentos favoritos -----------------------------------------------------

/** R1: «Avena 40 g» → 150 kcal (375 × 0,4). */
export const AVENA_PER100 = { kcal: 375, protein: 13.5, carbs: 59, fat: 7, fiber: 10 };
export const AVENA_FAV: MealFavorite = {
  id: "fav-avena",
  kind: "food",
  foodId: "local:avena-copos",
  name: "Avena",
  grams: 40,
  per100: AVENA_PER100,
};
/** R2: «Yogur griego 125 g». */
export const YOGUR_PER100 = { kcal: 120, protein: 9, carbs: 4, fat: 7.5 };
/** En unidades: 2 ud de 60 g. */
export const HUEVO_PER100 = { kcal: 140, protein: 12.5, carbs: 0.7, fat: 9.8 };
export const HUEVOS_FAV: MealFavorite = {
  id: "fav-huevos",
  kind: "food",
  foodId: "local:huevo",
  name: "Huevo",
  grams: 120,
  units: 2,
  per100: HUEVO_PER100,
};

// --- Entradas del Diario -----------------------------------------------------

let n = 0;
/** Entrada personalizada; por defecto, la de «Tortilla francesa». */
export function customEntry(date: string, mealType: MealType, e: Partial<MealEntry> = {}): MealEntry {
  return { id: `fa-${++n}`, date, mealType, customName: "Tortilla francesa", calories: 190, protein: 13, carbs: 1, fat: 15, ...e };
}

/** Entrada de alimento con sus macros calculados desde per100 (como foodEntry). */
export function foodEntryOf(
  date: string,
  mealType: MealType,
  food: { foodId: string; name: string; per100: { kcal: number; protein: number; carbs: number; fat: number; fiber?: number } },
  grams: number,
  units?: number,
): MealEntry {
  const f = grams / 100;
  const e: MealEntry = {
    id: `fa-${++n}`,
    date,
    mealType,
    customName: food.name,
    foodId: food.foodId,
    grams,
    calories: food.per100.kcal * f,
    protein: food.per100.protein * f,
    carbs: food.per100.carbs * f,
    fat: food.per100.fat * f,
  };
  if (food.per100.fiber !== undefined) e.fiber = food.per100.fiber * f;
  if (units !== undefined) e.units = units;
  return e;
}

export const AVENA = { foodId: "local:avena-copos", name: "Avena", per100: AVENA_PER100 };
export const YOGUR = { foodId: "local:yogur-griego", name: "Yogur griego", per100: YOGUR_PER100 };

/** Entrada de receta (1 ración, o las que se pidan, con los macros multiplicados). */
export function recipeEntryOf(date: string, mealType: MealType, r: Recipe, servings = 1): MealEntry {
  const e: MealEntry = {
    id: `fa-${++n}`,
    date,
    mealType,
    recipeId: r.id,
    calories: r.calories * servings,
    protein: r.protein * servings,
    carbs: r.carbs * servings,
    fat: r.fat * servings,
  };
  if (servings !== 1) e.servings = servings;
  return e;
}

/** R9: 12 personalizadas favoritas («Favorito 1» … «Favorito 12»), sin registrar. */
export const TWELVE_FAVS: MealFavorite[] = Array.from({ length: 12 }, (_, i) => ({
  id: `fav-${i + 1}`,
  kind: "custom" as const,
  name: `Favorito ${i + 1}`,
  calories: 100 + i,
  protein: 5,
  carbs: 10,
  fat: 3,
}));
