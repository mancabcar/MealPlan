// Datos de la lista de la compra (docs/pm/lista-compra/spec.md › Acceptance criteria).
// Compartidos por los tests unitarios (tests/unit/shopping-*.test.ts) y el e2e (tests/e2e/shopping-list.spec.ts).
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts), así que la semana es
// lunes 2026-09-21 → domingo 2026-09-27.
import type { PantryItem, Recipe, WeekPlan } from "@/lib/types";

export const TODAY = "2026-09-22";
export const MONDAY = "2026-09-21";
export const WEEK = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
export const LAST_WEEK_MONDAY = "2026-09-14";
export const NEXT_MONDAY = "2026-09-28";

export function recipe(id: string, name: string, ingredients: string[]): Recipe {
  return {
    id,
    name,
    ingredients,
    instructions: ["Preparar."],
    prepTimeMinutes: 20,
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 12,
    tags: [],
  };
}

// Pechuga de pollo: 150 + 120 + 150 = 420 g en tres comidas (R6).
// Brócoli: 150 g en dos recetas (R4, R9). Huevos: 2 + 1 + 1 = 4 (R4).
export const POLLO_BROCOLI = recipe("t-pollo-brocoli", "Pollo al horno con brócoli", [
  "150g pechuga de pollo",
  "150g brócoli",
  "60g arroz (en seco)",
  "1 cucharada de aceite de oliva",
  "sal, pimienta y orégano",
]);
export const TORTILLA_ESPARRAGOS = recipe("t-tortilla-esparragos", "Tortilla de espárragos", [
  "2 huevos",
  "100g espárragos verdes",
  "1/2 cebolla",
  "sal",
]);
export const SALTEADO_POLLO = recipe("t-salteado-pollo", "Salteado de pollo y brócoli", [
  "120g pechuga de pollo",
  "150g brócoli",
  "1 huevo",
]);
export const ENSALADA_POLLO = recipe("t-ensalada-pollo", "Ensalada de pollo y garbanzos", [
  "150g pechuga de pollo",
  "1 huevo",
  "1/4 cebolla morada",
  "1 tomate",
  "1 bote pequeño de garbanzos cocidos (240g)",
  "aceite de oliva y vinagre",
]);
/** Solo se planifica en Merienda: Lucía la hace, Manuel no (R2). */
export const BATIDO_KEFIR = recipe("t-batido-kefir", "Batido de kéfir", ["200ml kéfir", "1 plátano"]);
/** Solo se planifica fuera de la semana actual (R2). */
export const DATILES = recipe("t-datiles", "Dátiles rellenos", ["4 dátiles", "15g nueces"]);
/** Receta sin nada en común con las demás, para cambios de plan "no relacionados" (R9). */
export const CREMA_CALABAZA = recipe("t-crema-calabaza", "Crema de calabaza", ["300g calabaza", "1/2 puerro"]);

export const SHOPPING_RECIPES: Recipe[] = [
  POLLO_BROCOLI,
  TORTILLA_ESPARRAGOS,
  SALTEADO_POLLO,
  ENSALADA_POLLO,
  BATIDO_KEFIR,
  DATILES,
  CREMA_CALABAZA,
];

export const SHOPPING_PLAN: WeekPlan = {
  [LAST_WEEK_MONDAY]: [{ mealType: "Comida", recipeId: DATILES.id }],
  "2026-09-21": [
    { mealType: "Comida", recipeId: POLLO_BROCOLI.id },
    { mealType: "Cena", recipeId: TORTILLA_ESPARRAGOS.id },
  ],
  "2026-09-22": [
    { mealType: "Comida", recipeId: SALTEADO_POLLO.id },
    { mealType: "Merienda", recipeId: BATIDO_KEFIR.id },
  ],
  "2026-09-23": [{ mealType: "Cena", recipeId: ENSALADA_POLLO.id }],
  [NEXT_MONDAY]: [{ mealType: "Comida", recipeId: DATILES.id }],
};

export const SHOPPING_PANTRY: PantryItem[] = [
  { id: "p-arroz", name: "Arroz integral", quantity: "1 kg", category: "Despensa" },
  { id: "p-pollo", name: "Pechuga de pollo", quantity: "3 filetes", category: "Congelador" },
  // Caducado antes de hoy (R5)
  { id: "p-esparragos", name: "Espárragos verdes", quantity: "1 manojo", category: "Nevera", expiryDate: "2026-09-20" },
  { id: "p-sal", name: "Sal", quantity: "1 paquete", category: "Despensa" },
];

/**
 * Lo que la lista debe mostrar con Lucía (Desayuno, Comida, Merienda, Cena), SHOPPING_PLAN y SHOPPING_PANTRY.
 * Por comprar (N = 10): Brócoli, Aceite de oliva, Huevos, Espárragos verdes, Cebolla, Cebolla morada,
 *   Tomate, Garbanzos cocidos, Kéfir, Plátano.
 * Ya lo tienes (M = 2): Pechuga de pollo, Arroz.
 * Especias y básicos (no cuentan): Sal, Pimienta, Orégano, Vinagre.
 */
export const LUCIA_EXPECTED = { pending: 10, haveIt: 2 };
