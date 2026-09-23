// Spec: docs/pm/diario-desde-plan/spec.md › Requirements (definición de "pendiente"), R1–R6, R9 y Edge cases.
// Tech: docs/pm/diario-desde-plan/tech.md › APIs / interfaces (`recipeEntry`, `pendingSlots`, reglas 1–4).
import { describe, expect, it } from "vitest";
import { pendingSlots, recipeEntry } from "@/lib/diary";
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe, type WeekPlan } from "@/lib/types";
import { lucia, manuel } from "../fixtures/profiles";
import {
  DIARIO_RECIPES,
  FULL_DAY_PLAN,
  KEFIR,
  LAST_MONTH,
  LENTEJAS,
  MERLUZA,
  TODAY,
  TOMORROW,
  TORTILLA,
  YESTERDAY,
  entry,
  slot,
} from "../fixtures/diario";

function pending({
  date = TODAY,
  weekPlan = FULL_DAY_PLAN,
  entries = [] as MealEntry[],
  recipes = DIARIO_RECIPES as Recipe[],
  meals = MEAL_TYPES as MealType[],
} = {}) {
  return pendingSlots({ date, today: TODAY, weekPlan, recipes, entries, meals });
}

/** Resumen legible: [["Comida", "Lentejas"], ...]. */
const summary = (p: ReturnType<typeof pendingSlots>) => p.map((s) => [s.mealType, s.recipe.name]);

describe("recipeEntry: la entrada de receta que crean 'Hecho' y el formulario", () => {
  it("R2: copia fecha, comida, receta y sus cuatro macros tal cual", () => {
    const e = recipeEntry(LENTEJAS, TODAY, "Comida", "id-1");
    expect(e).toEqual({
      id: "id-1",
      date: TODAY,
      mealType: "Comida",
      recipeId: "t-lentejas",
      calories: 520,
      protein: 30,
      carbs: 60,
      fat: 12,
    });
    expect(e.customName).toBeUndefined();
  });

  it("sin id explícito genera uno distinto cada vez", () => {
    const a = recipeEntry(LENTEJAS, TODAY, "Comida");
    const b = recipeEntry(LENTEJAS, TODAY, "Comida");
    expect(a.id).toEqual(expect.any(String));
    expect(a.id).not.toBe("");
    expect(a.id).not.toBe(b.id);
  });
});

describe("R1: franjas pendientes de la fecha seleccionada", () => {
  it("hoy con 'Lentejas' planificada en Comida y sin entradas → Comida pendiente con la receta", () => {
    const p = pending({ weekPlan: { [TODAY]: [slot("Comida", LENTEJAS)] } });
    expect(p).toEqual([{ mealType: "Comida", recipe: LENTEJAS }]);
  });

  it("sin plan para la fecha → ninguna pendiente", () => {
    expect(pending({ weekPlan: {} })).toEqual([]);
    expect(pending({ weekPlan: { [YESTERDAY]: [slot("Comida", LENTEJAS)] } })).toEqual([]);
    expect(pending({ weekPlan: { [TODAY]: [] } })).toEqual([]);
  });

  it("todas las franjas planificadas ya tienen entrada → ninguna pendiente", () => {
    const entries = [entry(TODAY, "Desayuno"), entry(TODAY, "Comida"), entry(TODAY, "Cena")];
    expect(pending({ entries })).toEqual([]);
  });
});

describe("R3 · R4 · R6: cualquier entrada de esa comida en esa fecha la quita de pendientes", () => {
  it("R3: una entrada con la receta planificada la quita", () => {
    const p = pending({ entries: [recipeEntry(LENTEJAS, TODAY, "Comida", "x")] });
    expect(summary(p)).toEqual([
      ["Desayuno", "Tortilla francesa"],
      ["Cena", "Merluza al horno"],
    ]);
  });

  it("R4: otra receta en esa comida también la quita", () => {
    const p = pending({ entries: [recipeEntry(KEFIR, TODAY, "Comida", "x")] });
    expect(p.map((s) => s.mealType)).not.toContain("Comida");
  });

  it("R4: una entrada personalizada ('Ensalada') también la quita", () => {
    const p = pending({ entries: [entry(TODAY, "Comida", { customName: "Ensalada" })] });
    expect(p.map((s) => s.mealType)).not.toContain("Comida");
  });

  it("R4: una entrada en otra comida (Cena) no quita la de Comida", () => {
    const p = pending({ weekPlan: { [TODAY]: [slot("Comida", LENTEJAS)] }, entries: [entry(TODAY, "Cena")] });
    expect(summary(p)).toEqual([["Comida", "Lentejas"]]);
  });

  it("una entrada de Comida de otro día no cuenta para hoy", () => {
    const p = pending({ weekPlan: { [TODAY]: [slot("Comida", LENTEJAS)] }, entries: [entry(YESTERDAY, "Comida")] });
    expect(summary(p)).toEqual([["Comida", "Lentejas"]]);
  });

  it("varias entradas de la misma comida: basta con una, sea cual sea la receta", () => {
    const entries = [entry(TODAY, "Comida"), entry(TODAY, "Comida", { customName: "Pan" })];
    expect(pending({ entries }).map((s) => s.mealType)).not.toContain("Comida");
  });

  it("R6: sin la entrada (borrada), la franja vuelve a estar pendiente", () => {
    const logged = [recipeEntry(LENTEJAS, TODAY, "Comida", "x")];
    expect(pending({ entries: logged }).map((s) => s.mealType)).not.toContain("Comida");
    expect(pending({ entries: [] }).map((s) => s.mealType)).toContain("Comida");
  });
});

describe("R5: solo hoy y días pasados", () => {
  it("mañana con plan → ninguna pendiente", () => {
    expect(pending({ date: TOMORROW, weekPlan: { [TOMORROW]: [slot("Comida", LENTEJAS)] } })).toEqual([]);
  });

  it("ayer con plan y sin entradas → pendiente", () => {
    const p = pending({ date: YESTERDAY, weekPlan: { [YESTERDAY]: [slot("Comida", LENTEJAS)] } });
    expect(summary(p)).toEqual([["Comida", "Lentejas"]]);
  });

  it("Edge case: un día de hace semanas sigue siendo elegible si el plan aún lo tiene", () => {
    const p = pending({ date: LAST_MONTH, weekPlan: { [LAST_MONTH]: [slot("Cena", MERLUZA)] } });
    expect(summary(p)).toEqual([["Cena", "Merluza al horno"]]);
  });

  it("fecha vacía (input de fecha borrado) → ninguna pendiente", () => {
    expect(pending({ date: "", weekPlan: { "": [slot("Comida", LENTEJAS)] } })).toEqual([]);
  });
});

describe("R9: orden canónico de comidas", () => {
  it("sale en el orden de MEAL_TYPES aunque el plan liste las franjas desordenadas", () => {
    const weekPlan: WeekPlan = {
      [TODAY]: [slot("Cena", MERLUZA), slot("Merienda", KEFIR), slot("Desayuno", TORTILLA), slot("Comida", LENTEJAS)],
    };
    expect(pending({ weekPlan }).map((s) => s.mealType)).toEqual(["Desayuno", "Comida", "Merienda", "Cena"]);
  });
});

describe("Edge cases", () => {
  it("una comida que ya no está en profile.meals no sale como pendiente (Manuel no hace Merienda)", () => {
    const weekPlan: WeekPlan = { [TODAY]: [slot("Merienda", KEFIR), slot("Comida", LENTEJAS)] };
    expect(summary(pending({ weekPlan, meals: manuel.meals }))).toEqual([["Comida", "Lentejas"]]);
    expect(summary(pending({ weekPlan, meals: lucia.meals }))).toEqual([
      ["Comida", "Lentejas"],
      ["Merienda", "Batido de kéfir"],
    ]);
  });

  it("una receta borrada (recipeId desconocido) no sale como pendiente", () => {
    const weekPlan: WeekPlan = { [TODAY]: [{ mealType: "Comida", recipeId: "t-borrada" }, slot("Cena", MERLUZA)] };
    expect(summary(pending({ weekPlan }))).toEqual([["Cena", "Merluza al horno"]]);
  });

  it("franjas duplicadas para la misma comida: gana la primera, como en Plan", () => {
    const weekPlan: WeekPlan = { [TODAY]: [slot("Comida", LENTEJAS), slot("Comida", MERLUZA)] };
    expect(summary(pending({ weekPlan }))).toEqual([["Comida", "Lentejas"]]);
  });
});
