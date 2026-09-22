// Spec: docs/pm/onboarding-profile/spec.md › R14 y edge cases; tech.md › "Data model / Migration".
import { describe, expect, it } from "vitest";
import { migrateEntries, migrateProfile, migrateWeekPlan } from "@/lib/migrate";
import { MEAL_TYPES } from "@/lib/types";
import { legacyProfile, lucia } from "../fixtures/profiles";

describe("R14: migración del perfil v1", () => {
  it("R14: ['sin frutos secos', 'vegetariano'] → alergia Frutos secos + dieta Vegetariana", () => {
    const p = migrateProfile(legacyProfile)!;
    expect(p.allergies).toEqual({ preset: ["frutos_secos"], custom: [] });
    expect(p.diet).toBe("vegetarian");
  });

  it("R14: objetivos y 'no me gusta' no cambian", () => {
    const p = migrateProfile(legacyProfile)!;
    expect(p).toMatchObject({
      name: "Manuel",
      calorieGoal: 1980,
      proteinGoal: 150,
      carbsGoal: 192,
      fatGoal: 68,
      dislikedIngredients: ["Hígado"],
      createdAt: legacyProfile.createdAt,
    });
  });

  it("R14: queda como 'prescribed', sin datos corporales, con las 6 comidas y schemaVersion 2", () => {
    const p = migrateProfile(legacyProfile)!;
    expect(p.schemaVersion).toBe(2);
    expect(p.targetSource).toBe("prescribed");
    expect(p.body).toBeUndefined();
    expect(p.proteinRange).toBeUndefined();
    expect(p.meals).toEqual(MEAL_TYPES);
  });

  it("R14: desaparecen los campos v1 que ya no se usan", () => {
    const p = migrateProfile(legacyProfile)!;
    expect(p).not.toHaveProperty("mealsPerDay");
    expect(p).not.toHaveProperty("dietaryRestrictions");
  });

  it.each([
    ["sin gluten", "gluten"],
    ["sin lactosa", "lactosa"],
    ["Sin Gluten ", "gluten"], // Perfil v1 era texto libre
  ])("R14: '%s' → alergia %s", (restriction, allergen) => {
    const p = migrateProfile({ ...legacyProfile, dietaryRestrictions: [restriction] })!;
    expect(p.allergies.preset).toEqual([allergen]);
    expect(p.diet).toBe("omnivore");
  });

  it("R14: 'vegano' + 'vegetariano' → gana la más estricta (Vegana)", () => {
    const p = migrateProfile({ ...legacyProfile, dietaryRestrictions: ["vegetariano", "vegano"] })!;
    expect(p.diet).toBe("vegan");
  });

  it("Edge case: una restricción libre sin equivalencia pasa a alergia libre, no se pierde", () => {
    const p = migrateProfile({ ...legacyProfile, dietaryRestrictions: ["kiwi"] })!;
    expect(p.allergies).toEqual({ preset: [], custom: ["kiwi"] });
  });

  it("Edge case: si algo es alergia y 'no me gusta', queda solo como alergia", () => {
    const p = migrateProfile({
      ...legacyProfile,
      dietaryRestrictions: ["kiwi"],
      dislikedIngredients: ["Kiwi", "Hígado"],
    })!;
    expect(p.dislikedIngredients).toEqual(["Hígado"]);
  });

  it("R14: es idempotente y no toca perfiles v2", () => {
    const once = migrateProfile(legacyProfile);
    expect(migrateProfile(once)).toEqual(once);
    expect(migrateProfile(lucia)).toEqual(lucia);
  });

  it("sin perfil guardado → null (irá a onboarding)", () => {
    expect(migrateProfile(null)).toBeNull();
  });
});

describe("Edge case: comidas 'Snack' anteriores → 'Merienda'", () => {
  it("diario: Snack pasa a Merienda y el resto se conserva", () => {
    const entries = [
      { id: "a", date: "2026-09-20", mealType: "Snack", customName: "Manzana", calories: 80, protein: 0, carbs: 20, fat: 0 },
      { id: "b", date: "2026-09-20", mealType: "Comida", recipeId: "r1", calories: 600, protein: 40, carbs: 60, fat: 20 },
    ];
    expect(migrateEntries(entries)).toEqual([
      { ...entries[0], mealType: "Merienda" },
      entries[1],
    ]);
  });

  it("plan semanal: Snack pasa a Merienda en cada día", () => {
    const plan = {
      "2026-09-21": [
        { mealType: "Desayuno", recipeId: "r1" },
        { mealType: "Snack", recipeId: "r2" },
      ],
    };
    expect(migrateWeekPlan(plan)).toEqual({
      "2026-09-21": [
        { mealType: "Desayuno", recipeId: "r1" },
        { mealType: "Merienda", recipeId: "r2" },
      ],
    });
  });

  it("es idempotente", () => {
    const entries = [{ id: "a", mealType: "Snack" }];
    expect(migrateEntries(migrateEntries(entries))).toEqual([{ id: "a", mealType: "Merienda" }]);
  });
});
