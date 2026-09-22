// Personas del spec (docs/pm/onboarding-profile/spec.md, "Users & key scenarios").
import type { UserProfile } from "@/lib/types";

/** Fecha fija de los tests: la edad sale de "año actual − año de nacimiento". */
export const NOW = new Date("2026-09-22T10:00:00");

/** Escenario 1: sin nutricionista, ruta "Calcúlalo por mí". */
export const lucia: UserProfile = {
  schemaVersion: 2,
  name: "Lucía",
  goal: "lose",
  targetSource: "calculated",
  body: { sex: "female", birthYear: 1992, heightCm: 165, weightKg: 62, activity: "bastante" },
  calorieGoal: 1750,
  proteinGoal: 112,
  carbsGoal: 200,
  fatGoal: 56,
  meals: ["Desayuno", "Comida", "Merienda", "Cena"],
  allergies: { preset: [], custom: [] },
  diet: "omnivore",
  dislikedIngredients: [],
  createdAt: "2026-09-01T09:00:00.000Z",
};

/** Escenario 2: plan del nutricionista de agosto, proteína en rango. */
export const manuel: UserProfile = {
  schemaVersion: 2,
  name: "Manuel",
  goal: "lose",
  targetSource: "prescribed",
  weightKg: 76,
  calorieGoal: 1980,
  proteinGoal: 150,
  proteinRange: { min: 130, max: 170 },
  carbsGoal: 192,
  fatGoal: 68,
  meals: ["Desayuno", "Media mañana", "Comida", "Pre-entreno", "Cena"],
  allergies: { preset: [], custom: [] },
  diet: "omnivore",
  dislikedIngredients: [],
  createdAt: "2026-09-01T09:00:00.000Z",
};

/** Escenario 3: perfil guardado antes de la actualización (forma v1). */
export const legacyProfile = {
  name: "Manuel",
  calorieGoal: 1980,
  proteinGoal: 150,
  carbsGoal: 192,
  fatGoal: 68,
  dietaryRestrictions: ["sin frutos secos", "vegetariano"],
  dislikedIngredients: ["Hígado"],
  mealsPerDay: 3,
  createdAt: "2026-06-11T09:00:00.000Z",
};
