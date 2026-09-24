// Datos de "Registrar comidas planificadas desde el Diario" (docs/pm/diario-desde-plan/spec.md › Acceptance criteria).
// Compartidos por tests/unit/diary.test.ts y tests/e2e/diario-desde-plan.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). Los nombres no coinciden con
// ninguna receta de src/data/recipes.json (el store siempre añade las recetas semilla).
import type { MealEntry, MealType, Recipe, WeekPlan } from "@/lib/types";

export const TODAY = "2026-09-22";
export const YESTERDAY = "2026-09-21";
export const TOMORROW = "2026-09-23";
export const LAST_MONTH = "2026-08-18";

function recipe(
  id: string,
  name: string,
  macros: Pick<Recipe, "calories" | "protein" | "carbs" | "fat">,
  ingredients: string[] = ["Ingrediente"],
): Recipe {
  return { id, name, ingredients, instructions: ["Preparar."], prepTimeMinutes: 20, tags: [], ...macros };
}

/** La receta del spec: "Lentejas" (520 kcal, 30 P, 60 C, 12 G). */
export const LENTEJAS = recipe("t-lentejas", "Lentejas", { calories: 520, protein: 30, carbs: 60, fat: 12 }, [
  "200g lentejas",
  "1 zanahoria",
]);
export const TORTILLA = recipe("t-tortilla", "Tortilla francesa", { calories: 300, protein: 20, carbs: 2, fat: 22 }, ["2 huevos"]);
export const MERLUZA = recipe("t-merluza", "Merluza al horno", { calories: 410, protein: 35, carbs: 20, fat: 18 }, ["200g merluza"]);
export const KEFIR = recipe("t-kefir", "Batido de kéfir", { calories: 180, protein: 10, carbs: 22, fat: 5 }, ["250ml kéfir"]);
/** Lleva queso: con alergia a la lactosa, "⚠ contiene Lactosa" (R10). */
export const MACARRONES = recipe("t-macarrones", "Macarrones con queso", { calories: 640, protein: 25, carbs: 80, fat: 22 }, [
  "100g macarrones",
  "50g queso rallado",
]);

export const DIARIO_RECIPES: Recipe[] = [LENTEJAS, TORTILLA, MERLUZA, KEFIR, MACARRONES];

export const slot = (mealType: MealType, r: Pick<Recipe, "id">) => ({ mealType, recipeId: r.id });

/** Hoy: Desayuno, Comida y Cena planificados (3 pendientes con Lucía). */
export const FULL_DAY_PLAN: WeekPlan = {
  [TODAY]: [slot("Desayuno", TORTILLA), slot("Comida", LENTEJAS), slot("Cena", MERLUZA)],
};

let n = 0;
export function entry(date: string, mealType: MealType, e: Partial<MealEntry> = {}): MealEntry {
  return { id: `e-${++n}`, date, mealType, customName: "Ensalada", calories: 250, protein: 8, carbs: 20, fat: 14, ...e };
}

// ---------------------------------------------------------------------------
// Raciones al registrar recetas (docs/pm/raciones/spec.md › Criterios de aceptación).
// Compartidos por tests/unit/diary.test.ts y tests/e2e/raciones.spec.ts.

/** La receta del spec: 600 kcal, 40 P, 60 C, 20 G. 0,5 raciones → 300 / 20 / 30 / 10. */
export const GUISO = recipe("t-guiso", "Guiso", { calories: 600, protein: 40, carbs: 60, fat: 20 }, ["200g ternera", "1 patata"]);
/** 150 kcal: 0,25 raciones = 37,5 kcal (no entero). Tres → 112,5 → "113", no 3 × 38 = 114 (sin error acumulado). */
export const CALDO = recipe("t-caldo", "Caldo", { calories: 150, protein: 8, carbs: 12, fat: 6 }, ["500ml caldo"]);

export const RACIONES_RECIPES: Recipe[] = [GUISO, CALDO, LENTEJAS];
