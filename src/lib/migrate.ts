// Migración v1 → v2 del perfil y de las comidas guardadas (spec R14). Pura e idempotente.
import { ingredientMatches, normalize } from "./allergens";
import { MEAL_TYPES, type Allergies, type DietType, type MealType, type PresetAllergen, type UserProfile } from "./types";

type WithSlot<T> = Omit<T, "mealType"> & { mealType: MealType };

/** Opciones fijas del onboarding v1 (texto libre en Perfil v1, de ahí normalize). */
const LEGACY_DIETS: Record<string, DietType> = {
  vegetariano: "vegetarian",
  vegano: "vegan",
  pescetariano: "pescetarian",
};
const LEGACY_ALLERGIES: Record<string, PresetAllergen> = {
  "sin gluten": "gluten",
  "sin lactosa": "lactosa",
  "sin frutos secos": "frutos_secos",
};
/** Si hay varias dietas, gana la más estricta. */
const DIET_STRICTNESS: DietType[] = ["omnivore", "pescetarian", "vegetarian", "vegan"];

interface LegacyProfile {
  name?: string;
  calorieGoal?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
  dietaryRestrictions?: string[];
  dislikedIngredients?: string[];
  createdAt?: string;
}

/** Quita de "no me gusta" lo que ya es alergia (se queda solo como alergia). */
export function withoutAllergies(dislikes: string[], allergies: Allergies): string[] {
  const keys = [...allergies.preset, ...allergies.custom];
  return dislikes.filter((d) => !keys.some((k) => ingredientMatches(d, k) || normalize(d) === normalize(k)));
}

/** Versión actual del perfil. La comparten la carga y la importación de copias (backup.ts). */
export const PROFILE_SCHEMA_VERSION = 2;

/** null → null. v1 (sin schemaVersion) → v2. v2 → sin cambios. */
export function migrateProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  if ((raw as { schemaVersion?: number }).schemaVersion === PROFILE_SCHEMA_VERSION) return raw as UserProfile;

  const v1 = raw as LegacyProfile;
  const allergies: Allergies = { preset: [], custom: [] };
  let diet: DietType = "omnivore";
  for (const restriction of v1.dietaryRestrictions ?? []) {
    const key = normalize(restriction);
    if (!key) continue;
    const legacyDiet = LEGACY_DIETS[key];
    const preset = LEGACY_ALLERGIES[key];
    if (legacyDiet) {
      if (DIET_STRICTNESS.indexOf(legacyDiet) > DIET_STRICTNESS.indexOf(diet)) diet = legacyDiet;
    } else if (preset) {
      if (!allergies.preset.includes(preset)) allergies.preset.push(preset);
    } else {
      // Sin equivalencia: mejor excluir de más que perder una alergia
      allergies.custom.push(restriction.trim());
    }
  }

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    name: v1.name ?? "",
    goal: "maintain",
    targetSource: "prescribed", // los números los escribió el usuario
    calorieGoal: v1.calorieGoal ?? 2000,
    proteinGoal: v1.proteinGoal ?? 120,
    carbsGoal: v1.carbsGoal ?? 200,
    fatGoal: v1.fatGoal ?? 65,
    meals: [...MEAL_TYPES],
    allergies,
    diet,
    dislikedIngredients: withoutAllergies(v1.dislikedIngredients ?? [], allergies),
    createdAt: v1.createdAt ?? new Date().toISOString(),
  };
}

const toSlot = (mealType: string): MealType => (mealType === "Snack" ? "Merienda" : (mealType as MealType));

/** "Snack" → "Merienda"; el resto de campos se conserva. */
export function migrateEntries<T extends { mealType: string }>(entries: T[]): WithSlot<T>[] {
  return entries.map((e) => ({ ...e, mealType: toSlot(e.mealType) }));
}

export function migrateWeekPlan<T extends { mealType: string }>(
  plan: Record<string, T[]>,
): Record<string, WithSlot<T>[]> {
  return Object.fromEntries(Object.entries(plan).map(([date, slots]) => [date, migrateEntries(slots)]));
}
