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
