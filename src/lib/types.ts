export interface UserProfile {
  name: string;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  dietaryRestrictions: string[];
  dislikedIngredients: string[];
  mealsPerDay: number;
  createdAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
  isAIGenerated?: boolean;
}

export type MealType = "Desayuno" | "Comida" | "Cena" | "Snack";

export const MEAL_TYPES: MealType[] = ["Desayuno", "Comida", "Cena", "Snack"];

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  Desayuno: "☕",
  Comida: "🍽️",
  Cena: "🌙",
  Snack: "🥕",
};

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  recipeId?: string;
  customName?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type PantryCategory = "Nevera" | "Despensa" | "Congelador";

export const PANTRY_CATEGORIES: PantryCategory[] = ["Nevera", "Despensa", "Congelador"];

export const PANTRY_CATEGORY_ICONS: Record<PantryCategory, string> = {
  Nevera: "🧊",
  Despensa: "🗄️",
  Congelador: "❄️",
};

export interface PantryItem {
  id: string;
  name: string;
  quantity: string;
  expiryDate?: string; // YYYY-MM-DD
  category: PantryCategory;
}

/** Caduca en menos de 3 días y aún no ha caducado. */
export function isExpiringSoon(item: PantryItem): boolean {
  if (!item.expiryDate) return false;
  const days = daysUntil(item.expiryDate);
  return days >= 0 && days < 3;
}

export function isExpired(item: PantryItem): boolean {
  if (!item.expiryDate) return false;
  return daysUntil(item.expiryDate) < 0;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DayPlanSlot {
  mealType: MealType;
  recipeId: string;
}

/** Plan semanal: clave = fecha YYYY-MM-DD, valor = recetas asignadas. */
export type WeekPlan = Record<string, DayPlanSlot[]>;

// ---------------------------------------------------------------------------
// Perfil v2 (docs/pm/onboarding-profile/tech.md). Conviven con los tipos v1
// hasta la tarea 5, que convierte UserProfileV2 en UserProfile y MealSlot en MealType.
// ---------------------------------------------------------------------------

export type Goal = "lose" | "maintain" | "gain";
export type Sex = "male" | "female" | "unspecified"; // "unspecified" = "Prefiero no decirlo"
export type ActivityLevel = "poco" | "algo" | "bastante" | "mucho";
export type DietType = "omnivore" | "pescetarian" | "vegetarian" | "vegan";
export type TargetSource = "calculated" | "prescribed";
export type PresetAllergen = "frutos_secos" | "gluten" | "lactosa" | "marisco" | "huevo" | "soja";

export type MealSlot = "Desayuno" | "Media mañana" | "Comida" | "Merienda" | "Pre-entreno" | "Cena";

/** Orden canónico: el planner y el diario muestran las comidas en este orden. */
export const MEAL_SLOTS: MealSlot[] = ["Desayuno", "Media mañana", "Comida", "Merienda", "Pre-entreno", "Cena"];

export interface Allergies {
  preset: PresetAllergen[];
  custom: string[];
}

export interface BodyData {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
}

export interface UserProfileV2 {
  schemaVersion: 2;
  name: string;
  goal: Goal;
  targetSource: TargetSource;
  body?: BodyData;
  /** Ruta "plan del nutricionista": peso opcional sin el resto de datos corporales. */
  weightKg?: number;
  calorieGoal: number;
  /** Valor único, o el punto medio cuando hay rango. */
  proteinGoal: number;
  proteinRange?: { min: number; max: number };
  carbsGoal: number;
  fatGoal: number;
  /** >= 1, siempre en el orden de MEAL_SLOTS. */
  meals: MealSlot[];
  allergies: Allergies;
  diet: DietType;
  dislikedIngredients: string[];
  createdAt: string;
}
