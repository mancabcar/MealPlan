// Datos de la copia de seguridad (docs/pm/backup-datos/spec.md › Criterios de aceptación).
// Compartidos por tests/unit/backup.test.ts, tests/unit/store.test.tsx y tests/e2e/backup-datos.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). La cuenta A es la de Lucía: el nombre del
// perfil ("Lucía") es distinto del nombre de usuario ("lucia") para poder comprobar R4 (tech.md › Spec feedback 1).
// Las credenciales usan cadenas llamativas que no pueden aparecer por casualidad en el fichero.
import type { MealEntry, PantryItem, Recipe, UserProfile, WeekPlan } from "@/lib/types";
import { lucia, manuel } from "./profiles";
import { MONDAY, POLLO_BROCOLI, TODAY } from "./shopping";

export { TODAY, MONDAY };

/** Cuenta A: la que exporta. */
export const ACCOUNT_A = { id: "acc-9d41e7", username: "lucia", salt: "5a1t5a1t5a1t", hash: "h45h0f7h3p455w0rd" } as const;
/** Cuenta B: la que importa (otro navegador u otro perfil del mismo). */
export const ACCOUNT_B = { id: "acc-b2c8f0", username: "manuel", salt: "b5a1tb5a1t", hash: "bh45hbh45h" } as const;
/** Otra cuenta del mismo navegador que A: sus datos no deben aparecer en la copia ni tocarse al importar. */
export const OTHER_ACCOUNT = { id: "acc-0th3r", username: "otra-cuenta", salt: "0s4lt0s4lt", hash: "0h45h0h45h" } as const;
export const OTHER_MARKER = "Dato de otra cuenta";

/** Receta generada con IA: solo existe en los datos del usuario, no en src/data/recipes.json. */
export const AI_RECIPE: Recipe = {
  id: "ai-salmon-papillote",
  name: "Salmón al papillote con verduras",
  ingredients: ["150g salmón", "1 calabacín", "1 zanahoria", "1 cucharada de aceite de oliva"],
  instructions: ["Envolver en papel de horno.", "Hornear 15 minutos a 200 ºC."],
  prepTimeMinutes: 25,
  calories: 450,
  protein: 35,
  carbs: 12,
  fat: 28,
  tags: ["Cena", "Alto en proteína"],
  isAIGenerated: true,
};

export const BACKUP_RECIPES: Recipe[] = [AI_RECIPE, POLLO_BROCOLI];

export const TOSTADA: MealEntry = {
  id: "bk-e1",
  date: TODAY,
  mealType: "Desayuno",
  customName: "Tostada con aguacate",
  calories: 320,
  protein: 10,
  carbs: 30,
  fat: 18,
};
export const SALMON_ENTRY: MealEntry = {
  id: "bk-e2",
  date: TODAY,
  mealType: "Cena",
  recipeId: AI_RECIPE.id,
  calories: 225,
  protein: 17.5,
  carbs: 6,
  fat: 14,
  servings: 0.5,
};
export const BACKUP_ENTRIES: MealEntry[] = [TOSTADA, SALMON_ENTRY];
/** 320 + 225: lo que suma el Diario de hoy con estas entradas. */
export const BACKUP_TODAY_KCAL = 545;

export const BACKUP_PANTRY: PantryItem[] = [
  { id: "bk-p1", name: "Yogur natural", quantity: "4 uds", category: "Nevera", expiryDate: "2026-09-30" },
  { id: "bk-p2", name: "Lentejas pardinas", quantity: "1 kg", category: "Despensa" },
];

/** Hoy, "Comida" = Pollo al horno con brócoli: la lista de la compra de la semana tiene "Brócoli". */
export const BACKUP_PLAN: WeekPlan = {
  [TODAY]: [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }],
  "2026-09-24": [{ mealType: "Cena", recipeId: AI_RECIPE.id }],
};

export const BACKUP_PROFILE: UserProfile = lucia;

/** Datos de la cuenta A tal como se siembran (las recetas de ejemplo las añade la carga). */
export const ACCOUNT_A_DATA = {
  profile: BACKUP_PROFILE,
  recipes: BACKUP_RECIPES,
  entries: BACKUP_ENTRIES,
  pantry: BACKUP_PANTRY,
  weekplan: BACKUP_PLAN,
};

/** Datos previos de la cuenta B: todo distinto de A, para ver que la importación los sustituye. */
export const B_PANTRY_ITEM = "Leche de avena";
export const B_ENTRY_NAME = "Cena de la cuenta B";
export const ACCOUNT_B_DATA = {
  profile: manuel,
  recipes: [],
  entries: [
    { id: "b-e1", date: TODAY, mealType: "Cena", customName: B_ENTRY_NAME, calories: 700, protein: 40, carbs: 60, fat: 25 },
  ] satisfies MealEntry[],
  pantry: [{ id: "b-p1", name: B_PANTRY_ITEM, quantity: "1 l", category: "Nevera" }] satisfies PantryItem[],
  weekplan: {},
};

/** Perfil v1 del criterio de aceptación de R7. */
export const LEGACY_V1_PROFILE = {
  name: "Manuel",
  calorieGoal: 1980,
  proteinGoal: 150,
  carbsGoal: 192,
  fatGoal: 68,
  dietaryRestrictions: ["Vegetariano", "Sin gluten"],
  dislikedIngredients: [],
  createdAt: "2026-06-11T09:00:00.000Z",
};
export const SNACK_ENTRY = {
  id: "old-e1",
  date: TODAY,
  mealType: "Snack",
  customName: "Manzana",
  calories: 80,
  protein: 0,
  carbs: 20,
  fat: 0,
};

/** Momento de exportación de los ficheros hechos a mano: 24/09/2026 en cualquier zona horaria razonable. */
export const EXPORTED_AT = "2026-09-24T12:00:00.000Z";

/** Fichero de copia con el formato de tech.md › Data model (app, schemaVersion, exportedAt, data). */
export function backupFile(data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { app: "mealplan", schemaVersion: 1, exportedAt: EXPORTED_AT, data, ...extra };
}

export const backupText = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify(backupFile(data, extra));
