import { Apple, Archive, Carrot, Coffee, Dumbbell, type LucideIcon, Moon, Refrigerator, Snowflake, UtensilsCrossed } from "lucide-react";

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

// Rediseño visual (docs/pm/design-refresh): único consumidor es despensa/page.tsx (pantalla en
// alcance), sin ruta de Onboarding/Login por medio — se convierte a iconos Lucide en el sitio.
export const PANTRY_CATEGORY_ICONS: Record<PantryCategory, LucideIcon> = {
  Nevera: Refrigerator,
  Despensa: Archive,
  Congelador: Snowflake,
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

// Perfil (schemaVersion 2). Los perfiles v1 se migran al cargar: ver lib/migrate.ts.

export type Goal = "lose" | "maintain" | "gain";
export type Sex = "male" | "female" | "unspecified"; // "unspecified" = "Prefiero no decirlo"
export type ActivityLevel = "poco" | "algo" | "bastante" | "mucho";
export type DietType = "omnivore" | "pescetarian" | "vegetarian" | "vegan";
export type TargetSource = "calculated" | "prescribed";
export type PresetAllergen = "frutos_secos" | "gluten" | "lactosa" | "marisco" | "huevo" | "soja";

export type MealType = "Desayuno" | "Media mañana" | "Comida" | "Merienda" | "Pre-entreno" | "Cena";

/** Orden canónico: el planner y el diario muestran las comidas en este orden. */
export const MEAL_TYPES: MealType[] = ["Desayuno", "Media mañana", "Comida", "Merienda", "Pre-entreno", "Cena"];

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  Desayuno: "☕",
  "Media mañana": "🍎",
  Comida: "🍽️",
  Merienda: "🥕",
  "Pre-entreno": "💪",
  Cena: "🌙",
};

// Rediseño visual (docs/pm/design-refresh, ver tech.md § Spec feedback): NO tocar MEAL_TYPE_ICONS
// de arriba — profile/steps.tsx (Onboarding) lo interpola como string y no puede consumir un
// componente. Este mapa hermano es solo para las pantallas rediseñadas (Diario, Plan, Perfil y el
// fork components/perfil/steps.tsx), que sí pueden renderizar <Icon />.
export const MEAL_TYPE_ICON_COMPONENTS: Record<MealType, LucideIcon> = {
  Desayuno: Coffee,
  "Media mañana": Apple,
  Comida: UtensilsCrossed,
  Merienda: Carrot,
  "Pre-entreno": Dumbbell,
  Cena: Moon,
};

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

export interface UserProfile {
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
  /** >= 1, siempre en el orden de MEAL_TYPES. */
  meals: MealType[];
  allergies: Allergies;
  diet: DietType;
  dislikedIngredients: string[];
  createdAt: string;
}
