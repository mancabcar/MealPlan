// Borradores de formulario compartidos por onboarding y Perfil (R3–R6).
import { describe, expect, it } from "vitest";
import { bodyDraftFrom, parseBody, parseMacros, parsePrescribed, prescribedDraftFrom } from "@/lib/profileDraft";
import { lucia, manuel, NOW } from "../fixtures/profiles";

const manuelDraft = {
  kcal: "1980",
  isRange: true,
  protein: "",
  proteinMin: "130",
  proteinMax: "170",
  carbs: "",
  fat: "",
  weightKg: "76",
};

describe("parseBody (R3)", () => {
  it("datos de Lucía con coma decimal → BodyData", () => {
    const { value, errors } = parseBody({ ...bodyDraftFrom(lucia.body), weightKg: "62,0" }, NOW);
    expect(errors).toEqual({});
    expect(value).toEqual(lucia.body);
  });

  it("campos vacíos no muestran error, pero no hay valor", () => {
    const { value, errors } = parseBody(bodyDraftFrom(), NOW);
    expect(errors).toEqual({});
    expect(value).toBeUndefined();
  });

  it("sin sexo o actividad elegidos no hay valor", () => {
    expect(parseBody({ ...bodyDraftFrom(lucia.body), sex: "" }, NOW).value).toBeUndefined();
    expect(parseBody({ ...bodyDraftFrom(lucia.body), activity: "" }, NOW).value).toBeUndefined();
  });

  it("altura fuera de rango → error solo en altura", () => {
    const { value, errors } = parseBody({ ...bodyDraftFrom(lucia.body), heightCm: "110" }, NOW);
    expect(Object.keys(errors)).toEqual(["heightCm"]);
    expect(value).toBeUndefined();
  });
});

describe("parseMacros (R4)", () => {
  it("acepta los valores sugeridos y rechaza kcal fuera de rango o vacías", () => {
    expect(parseMacros({ kcal: "1750", protein: "112", carbs: "200", fat: "56" })).toEqual({
      kcal: 1750,
      protein: 112,
      carbs: 200,
      fat: 56,
    });
    expect(parseMacros({ kcal: "", protein: "112", carbs: "200", fat: "56" })).toBeNull();
    expect(parseMacros({ kcal: "700", protein: "112", carbs: "200", fat: "56" })).toBeNull();
  });
});

describe("parsePrescribed (R5, R6)", () => {
  it("R6: Manuel → 1980, P 130–170 (150), F 68, C 192", () => {
    expect(parsePrescribed(manuelDraft).value).toEqual({
      calorieGoal: 1980,
      proteinGoal: 150,
      proteinRange: { min: 130, max: 170 },
      carbsGoal: 192,
      fatGoal: 68,
      weightKg: 76,
    });
  });

  it("R5: min > max → error de rango y sin valor", () => {
    const r = parsePrescribed({ ...manuelDraft, proteinMin: "170", proteinMax: "130" });
    expect(r.errors).toHaveProperty("proteinRange");
    expect(r.value).toBeUndefined();
  });

  it("R5: kcal vacías no muestran error pero bloquean", () => {
    const r = parsePrescribed({ ...manuelDraft, kcal: "" });
    expect(r.errors).toEqual({});
    expect(r.value).toBeUndefined();
  });

  it("edge case: macros que no cuadran → mismatch > 10% (aviso, no bloquea)", () => {
    const r = parsePrescribed({ ...manuelDraft, isRange: false, protein: "150", carbs: "300", fat: "68" });
    expect(r.value).toBeDefined();
    expect(r.mismatch).toBeGreaterThan(0.1);
  });

  it("prescribedDraftFrom ↔ parsePrescribed es estable con el perfil de Manuel", () => {
    const { weightKg, ...targets } = parsePrescribed(prescribedDraftFrom(manuel)).value!;
    expect(weightKg).toBe(76);
    expect(targets).toEqual({
      calorieGoal: manuel.calorieGoal,
      proteinGoal: manuel.proteinGoal,
      proteinRange: manuel.proteinRange,
      carbsGoal: manuel.carbsGoal,
      fatGoal: manuel.fatGoal,
    });
  });
});
