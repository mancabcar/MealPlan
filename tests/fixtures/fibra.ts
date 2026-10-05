// Datos de "Seguimiento de agua y fibra" (docs/pm/23-agua-fibra-micros/spec.md › entrega 1, R1–R9).
// Compartidos por tests/unit/fiber.test.ts, tests/unit/diary-fiber.test.ts y tests/e2e/fibra.spec.ts.
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). Lucía no tiene objetivo de fibra guardado: usa 38 g.
import type { MealEntry, MealType, Recipe } from "@/lib/types";

export const TODAY = "2026-09-22";

function recipe(id: string, name: string, macros: Pick<Recipe, "calories" | "protein" | "carbs" | "fat">, fiber?: number): Recipe {
  return {
    id,
    name,
    ingredients: ["Ingrediente"],
    instructions: ["Preparar."],
    prepTimeMinutes: 20,
    tags: [],
    ...macros,
    ...(fiber !== undefined && { fiber }),
  };
}

/** Con fibra: 14 g por ración. */
export const LENTEJAS_FIBRA = recipe("t-lentejas-f", "Lentejas estofadas del test", { calories: 420, protein: 24, carbs: 58, fat: 9 }, 14);
/** Sin dato de fibra. */
export const POLLO_SIN_FIBRA = recipe("t-pollo-f", "Pollo con arroz del test", { calories: 610, protein: 48, carbs: 62, fat: 14 });

export const FIBRA_RECIPES: Recipe[] = [LENTEJAS_FIBRA, POLLO_SIN_FIBRA];

let n = 0;
export function entry(mealType: MealType, name: string, e: Partial<MealEntry> = {}): MealEntry {
  return { id: `f-${++n}`, date: TODAY, mealType, customName: name, calories: 200, protein: 8, carbs: 20, fat: 8, ...e };
}

/** Día completo: todas las entradas con dato; suman 28 g. */
export const DIA_COMPLETO: MealEntry[] = [
  entry("Desayuno", "Tostada integral con aguacate", { fiber: 20 }),
  entry("Comida", "Ensalada de garbanzos", { fiber: 8 }),
];

/** Día parcial: 5 entradas, 3 sin dato; suman 12 g (9 + 3). Spec R9: «Faltan datos de fibra en 3 de 5 entradas». */
export const DIA_PARCIAL: MealEntry[] = [
  entry("Desayuno", "Tostada integral con aguacate", { fiber: 9 }),
  entry("Desayuno", "Café con leche"),
  entry("Comida", "Pollo a la plancha con arroz"),
  entry("Comida", "Ensalada mixta", { fiber: 3 }),
  entry("Merienda", "Barrita de cereales"),
];

/** Ninguna entrada con dato (R2: 0 / 38 con chip «parcial»). */
export const DIA_SIN_DATOS: MealEntry[] = [entry("Desayuno", "Tostadas con jamón"), entry("Desayuno", "Zumo de naranja")];

/** Fibra explícita 0: es un dato (R8), el día no es parcial. */
export const DIA_FIBRA_CERO: MealEntry[] = [entry("Desayuno", "Zumo de naranja", { fiber: 0 })];

/** Entrada de receta anterior a esta entrega (sin `fiber`): 2 raciones de las lentejas de 14 g → 28 g (tech.md › Data model). */
export const ENTRADA_RECETA_ANTIGUA: MealEntry = {
  id: "f-old",
  date: TODAY,
  mealType: "Comida",
  recipeId: LENTEJAS_FIBRA.id,
  servings: 2,
  calories: 840,
  protein: 48,
  carbs: 116,
  fat: 18,
};
