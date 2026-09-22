// Spec: docs/pm/onboarding-profile/spec.md › "Target formula (R4, R6)" y criterios R3–R6.
import { describe, expect, it } from "vitest";
import {
  ageFromBirthYear,
  calculateTargets,
  fillPrescribed,
  macroMismatch,
  parseDecimal,
  validateBodyData,
  validatePrescribed,
  type TargetInput,
} from "@/lib/nutrition";
import { NOW } from "../fixtures/profiles";

const luciaInput: TargetInput = {
  sex: "female",
  birthYear: 1992,
  heightCm: 165,
  weightKg: 62,
  activity: "bastante",
  goal: "lose",
};

describe("R4: objetivos calculados (Mifflin-St Jeor)", () => {
  it("R4: Lucía obtiene exactamente 1750 kcal / 112 P / 200 C / 56 F", () => {
    const t = calculateTargets(luciaInput, NOW);
    expect({ kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }).toEqual({
      kcal: 1750,
      protein: 112,
      carbs: 200,
      fat: 56,
    });
  });

  it("R4: la explicación muestra BMR 1320, × 1.55 = 2046, −15%", () => {
    const { derivation } = calculateTargets(luciaInput, NOW);
    expect(derivation).toMatchObject({ bmr: 1320, factor: 1.55, tdee: 2046, adjustmentPct: -15 });
    expect(derivation.floorApplied).toBeUndefined();
  });

  it("R4: Hombre suma +5 en vez de −161 al BMR", () => {
    const { derivation } = calculateTargets({ ...luciaInput, sex: "male" }, NOW);
    expect(derivation.bmr).toBe(1486); // 1320.25 + 166
  });

  it("R4: Mantenerme no ajusta kcal y usa 1.6 g/kg de proteína", () => {
    const t = calculateTargets({ ...luciaInput, goal: "maintain" }, NOW);
    expect(t.derivation.adjustmentPct).toBe(0);
    expect(t.kcal).toBe(2050); // 2046 redondeado a 50
    expect(t.protein).toBe(99); // 1.6 × 62
  });

  it("R4: Ganar músculo suma +10% y usa 2.0 g/kg de proteína", () => {
    const t = calculateTargets({ ...luciaInput, goal: "gain" }, NOW);
    expect(t.derivation.adjustmentPct).toBe(10);
    expect(t.kcal).toBe(2250);
    expect(t.protein).toBe(124);
  });

  it("R4: los carbos salen de P y F ya redondeados, así que las kcal cuadran", () => {
    for (const goal of ["lose", "maintain", "gain"] as const) {
      const t = calculateTargets({ ...luciaInput, goal }, NOW);
      expect(t.carbs).toBe(Math.round((t.kcal - 4 * t.protein - 9 * t.fat) / 4));
    }
  });

  it("R4: cada factor de actividad es el de la tabla del spec", () => {
    const factors = (["poco", "algo", "bastante", "mucho"] as const).map(
      (activity) => calculateTargets({ ...luciaInput, activity }, NOW).derivation.factor,
    );
    expect(factors).toEqual([1.2, 1.375, 1.55, 1.725]);
  });

  it("R4: por debajo de 1200 kcal (Mujer) se sugiere el mínimo y la explicación lo dice", () => {
    const t = calculateTargets(
      { sex: "female", birthYear: 1966, heightCm: 150, weightKg: 45, activity: "poco", goal: "lose" },
      NOW,
    );
    expect(t.kcal).toBe(1200);
    expect(t.derivation.floorApplied).toBe(1200);
  });

  it("R4: por debajo de 1500 kcal (Hombre) se sugiere el mínimo y la explicación lo dice", () => {
    const t = calculateTargets(
      { sex: "male", birthYear: 1956, heightCm: 155, weightKg: 50, activity: "poco", goal: "lose" },
      NOW,
    );
    expect(t.kcal).toBe(1500);
    expect(t.derivation.floorApplied).toBe(1500);
  });

  it("R4: la edad es año actual − año de nacimiento", () => {
    expect(ageFromBirthYear(1992, NOW)).toBe(34);
  });
});

describe("R6: plan del nutricionista con carbos/grasas vacíos", () => {
  it("R6: Manuel (1980 kcal, P 130–170, 76 kg) queda en F 68 / C 192", () => {
    expect(fillPrescribed({ kcal: 1980, protein: { min: 130, max: 170 }, weightKg: 76 })).toEqual({
      carbs: 192,
      fat: 68,
    });
  });

  it("R6: sin peso, la grasa es el 25% de las kcal", () => {
    // F = round(500 / 9) = 56; C = (2000 − 600 − 504) / 4 = 224
    expect(fillPrescribed({ kcal: 2000, protein: 150 })).toEqual({ carbs: 224, fat: 56 });
  });

  it("R6: si el usuario escribe los carbos, solo se rellena la grasa", () => {
    expect(fillPrescribed({ kcal: 1980, protein: 150, carbs: 200, weightKg: 76 })).toEqual({ carbs: 200, fat: 68 });
  });

  it("R6: si el usuario escribe la grasa, solo se rellenan los carbos", () => {
    expect(fillPrescribed({ kcal: 1980, protein: 150, fat: 60, weightKg: 76 })).toEqual({ carbs: 210, fat: 60 });
  });
});

describe("Edge case: macros prescritos que no cuadran", () => {
  it("avisa si 4·P + 4·C + 9·F se aleja más de un 10% de las kcal", () => {
    expect(macroMismatch(1980, 150, 192, 68)).toBeLessThanOrEqual(0.1);
    expect(macroMismatch(1980, 150, 300, 68)).toBeGreaterThan(0.1);
  });
});

describe("R3: validación de datos corporales", () => {
  const valid = { heightCm: 165, weightKg: 62, birthYear: 1992 };

  it("R3: datos de Lucía son válidos", () => {
    expect(validateBodyData(valid, NOW)).toEqual({});
  });

  it.each([
    ["heightCm", { heightCm: 119 }],
    ["heightCm", { heightCm: 231 }],
    ["weightKg", { weightKg: 29 }],
    ["weightKg", { weightKg: 251 }],
    ["birthYear", { birthYear: 2013 }], // 13 años
    ["birthYear", { birthYear: 1925 }], // 101 años
  ])("R3: %s fuera de rango da error en ese campo (%o)", (field, patch) => {
    const errors = validateBodyData({ ...valid, ...patch }, NOW);
    expect(Object.keys(errors)).toEqual([field]);
  });

  it("R3: los extremos del rango son válidos", () => {
    expect(validateBodyData({ heightCm: 120, weightKg: 30, birthYear: 2012 }, NOW)).toEqual({});
    expect(validateBodyData({ heightCm: 230, weightKg: 250, birthYear: 1926 }, NOW)).toEqual({});
  });

  it("R3: el peso acepta coma o punto decimal", () => {
    expect(parseDecimal("62,0")).toBe(62);
    expect(parseDecimal("62.5")).toBe(62.5);
    expect(parseDecimal(" 58,3 ")).toBe(58.3);
    expect(parseDecimal("")).toBeNaN();
    expect(parseDecimal("abc")).toBeNaN();
  });
});

describe("R5: validación del plan del nutricionista", () => {
  it("R5: kcal vacías o fuera de 800–6000 no son válidas", () => {
    expect(validatePrescribed({ protein: 150, isRange: false })).toHaveProperty("kcal");
    expect(validatePrescribed({ kcal: 799, protein: 150, isRange: false })).toHaveProperty("kcal");
    expect(validatePrescribed({ kcal: 6001, protein: 150, isRange: false })).toHaveProperty("kcal");
    expect(validatePrescribed({ kcal: 1980, protein: 150, isRange: false })).toEqual({});
  });

  it("R5: con rango, min > max da error", () => {
    expect(validatePrescribed({ kcal: 1980, proteinMin: 170, proteinMax: 130, isRange: true })).toHaveProperty(
      "proteinRange",
    );
    expect(validatePrescribed({ kcal: 1980, proteinMin: 130, proteinMax: 170, isRange: true })).toEqual({});
  });
});
