// Datos de "Macros por día en el Plan semanal" (docs/pm/10-macros-plan/spec.md › Acceptance criteria).
// Compartidos por tests/unit/planMacros.test.ts, tests/e2e/macros-plan.spec.ts y tests/e2e/accessibility.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts); el lunes de esa semana es el 21.
// Objetivos: los del plan vigente de la nutricionista (septiembre 2026, docs/referencia/): 2000 kcal,
// proteína 130–160 g, hidratos 230 g, grasas 69 g. Los nombres de receta no coinciden (ni como subcadena)
// con ninguna receta de src/data/recipes.json, que el store añade siempre.
import type { MealType, Recipe, UserProfile, WeekPlan } from "@/lib/types";
import { lucia } from "./profiles";

export const MONDAY = "2026-09-21";
export const TUESDAY = "2026-09-22"; // hoy
export const WEDNESDAY = "2026-09-23";
export const THURSDAY = "2026-09-24";

/** Plan de septiembre con proteína en rango; 4 comidas (sin Media mañana ni Pre-entreno). */
export const planProfile: UserProfile = {
  ...lucia,
  name: "Manuel",
  targetSource: "prescribed",
  calorieGoal: 2000,
  proteinGoal: 145,
  proteinRange: { min: 130, max: 160 },
  carbsGoal: 230,
  fatGoal: 69,
  meals: ["Desayuno", "Comida", "Merienda", "Cena"],
};

/** El mismo perfil sin rango de proteína: se compara con proteinGoal (145) y ±10 %. */
export const planProfileNoRange: UserProfile = { ...planProfile, proteinRange: undefined };

function recipe(id: string, name: string, macros: Pick<Recipe, "calories" | "protein" | "carbs" | "fat">): Recipe {
  return { id, name, ingredients: ["Ingrediente"], instructions: ["Preparar."], prepTimeMinutes: 20, tags: [], ...macros };
}

// Escenario 1 del spec: desayuno P 30, comida P 50, cena P 40 → proteínas 120.
export const DESAYUNO_CLARAS = recipe("pm-desayuno", "Gachas de claras y cacao", { calories: 450, protein: 30, carbs: 55, fat: 15 });
export const COMIDA_BONIATO = recipe("pm-comida", "Pollo con boniato asado", { calories: 700, protein: 50, carbs: 80, fat: 22 });
export const CENA_PAVO = recipe("pm-cena", "Pavo con cuscús", { calories: 550, protein: 40, carbs: 45, fat: 20 });
/** La cena "más proteica" del flujo: 142 g con desayuno y comida → Dentro de 130–160. */
export const CENA_SEPIA = recipe("pm-cena-proteica", "Sepia con judías verdes", { calories: 620, protein: 62, carbs: 50, fat: 30 });
/** Merienda grasa: con el día completo, grasas 80 de 69 → Por encima (ejemplo de R5). */
export const MERIENDA_NUECES = recipe("pm-merienda", "Pan de centeno con nueces", { calories: 330, protein: 8, carbs: 25, fat: 23 });
/** Asignada a Media mañana, que el perfil no incluye: no debe sumar nunca (R1). */
export const BATIDO_ENORME = recipe("pm-batido", "Batido de masa muscular", { calories: 900, protein: 80, carbs: 100, fat: 30 });

export const PLAN_RECIPES: Recipe[] = [DESAYUNO_CLARAS, COMIDA_BONIATO, CENA_PAVO, CENA_SEPIA, MERIENDA_NUECES, BATIDO_ENORME];

/** Id de una receta que ya no existe (borrada). */
export const DELETED_RECIPE_ID = "pm-borrada";

export const slot = (mealType: MealType, r: Pick<Recipe, "id">) => ({ mealType, recipeId: r.id });

/**
 * - Martes (hoy): desayuno + comida + cena (P 30 + 50 + 40 = 120), Merienda sin asignar y un batido en Media mañana
 *   (comida desmarcada, no suma). Totales 1700 / 120 / 180 / 57, todo Por debajo, "3 de 4 comidas planificadas".
 * - Lunes: día completo con la merienda grasa. Totales 2030 / 128 / 205 / 80: Calorías Dentro, Proteínas y
 *   Carbohidratos Por debajo, Grasas Por encima. Sin aviso de comidas.
 * - Miércoles: solo la comida, y una cena cuya receta se borró. Totales 700 / 50 / 80 / 22, "1 de 4".
 * - Jueves: sin recetas → sin resumen.
 */
export const PLAN_WEEK: WeekPlan = {
  [TUESDAY]: [
    slot("Desayuno", DESAYUNO_CLARAS),
    slot("Media mañana", BATIDO_ENORME),
    slot("Comida", COMIDA_BONIATO),
    slot("Cena", CENA_PAVO),
  ],
  [MONDAY]: [
    slot("Desayuno", DESAYUNO_CLARAS),
    slot("Comida", COMIDA_BONIATO),
    slot("Merienda", MERIENDA_NUECES),
    slot("Cena", CENA_PAVO),
  ],
  [WEDNESDAY]: [slot("Comida", COMIDA_BONIATO), { mealType: "Cena", recipeId: DELETED_RECIPE_ID }],
};

/** Datos para signIn(): perfil, recetas y plan de la semana. */
export const PLAN_SEED = { profile: planProfile, recipes: PLAN_RECIPES, weekplan: PLAN_WEEK };
