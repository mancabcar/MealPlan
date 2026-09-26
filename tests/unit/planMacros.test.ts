// Spec: docs/pm/10-macros-plan/spec.md › R1, R3, R4, R7, R9, Acceptance criteria y Edge cases ("Decimales").
// Tech: docs/pm/10-macros-plan/tech.md › APIs / interfaces (`slotMacros`, `dayPlanSummary`, `macroStatus` y sus reglas 1–3)
// y Spec feedback 1 (opción a: `macroStatus` redondea siempre, también con rango).
// Falla hasta que exista src/lib/planMacros.ts (tech.md › Tasks, tarea 2).
import { describe, expect, it } from "vitest";
import { dayPlanSummary, macroStatus, slotMacros } from "@/lib/planMacros";
import type { DayPlanSlot, MealType, Recipe } from "@/lib/types";
import {
  BATIDO_ENORME,
  CENA_PAVO,
  COMIDA_BONIATO,
  DELETED_RECIPE_ID,
  DESAYUNO_CLARAS,
  MERIENDA_NUECES,
  PLAN_RECIPES,
  planProfile,
  slot,
} from "../fixtures/plan-macros";

const MEALS = planProfile.meals; // Desayuno, Comida, Merienda, Cena

function summary(slots: DayPlanSlot[], { recipes = PLAN_RECIPES as Recipe[], meals = MEALS as MealType[] } = {}) {
  return dayPlanSummary({ slots, recipes, meals });
}

describe("R3: proteína con rango 130–160", () => {
  const range = { min: 130, max: 160 };
  it.each([
    [129, "below"],
    [130, "within"],
    [160, "within"],
    [161, "above"],
  ] as const)("R3: %d g → %s", (value, expected) => {
    expect(macroStatus(value, range)).toBe(expected);
  });

  // Decisión (a): lo que se ve es lo que se juzga. 129,6 se muestra "130" → Dentro.
  it("R3: redondea antes de comparar: 129,6 → 130 → dentro; 129,4 → 129 → por debajo", () => {
    expect(macroStatus(129.6, range)).toBe("within");
    expect(macroStatus(129.4, range)).toBe("below");
  });

  it("R3: redondea antes de comparar en el máximo: 160,4 → dentro; 160,5 → 161 → por encima", () => {
    expect(macroStatus(160.4, range)).toBe("within");
    expect(macroStatus(160.5, range)).toBe("above");
  });
});

describe("R4: objetivos sin rango, ±10 %", () => {
  it.each([
    [1799, "below"],
    [1800, "within"],
    [2200, "within"],
    [2201, "above"],
  ] as const)("R4: %d kcal con objetivo 2000 → %s", (value, expected) => {
    expect(macroStatus(value, 2000)).toBe(expected);
  });

  // 230 × 0,9 y 230 × 1,1 no son exactos en coma flotante: los límites 207 y 253 deben ser "dentro".
  it.each([
    [206, "below"],
    [207, "within"],
    [253, "within"],
    [254, "above"],
  ] as const)("R4: %d g de hidratos con objetivo 230 → %s", (value, expected) => {
    expect(macroStatus(value, 230)).toBe(expected);
  });

  it("R4: redondea antes de comparar: 206,5 → 207 → dentro; 206,4 → por debajo", () => {
    expect(macroStatus(206.5, 230)).toBe("within");
    expect(macroStatus(206.4, 230)).toBe("below");
  });

  it("R4: grasas 80 con objetivo 69 → por encima (ejemplo de R5)", () => {
    expect(macroStatus(80, 69)).toBe("above");
  });

  it("R4: con objetivo 0, 0 está dentro y cualquier valor mayor que 0 por encima", () => {
    expect(macroStatus(0, 0)).toBe("within");
    expect(macroStatus(1, 0)).toBe("above");
  });

  it("R4: la proteína sin rango usa proteinGoal con la misma banda (145 → 131–159)", () => {
    expect(macroStatus(130, 145)).toBe("below");
    expect(macroStatus(131, 145)).toBe("within");
    expect(macroStatus(159, 145)).toBe("within");
    expect(macroStatus(160, 145)).toBe("above");
  });
});

describe("R9: slotMacros, único punto de escalado (receta × raciones)", () => {
  it("R9: por defecto 1 ración → los macros de la receta", () => {
    expect(slotMacros(CENA_PAVO)).toEqual({ calories: 550, protein: 40, carbs: 45, fat: 20 });
  });

  it("R9: multiplica los cuatro macros por las raciones, sin redondear", () => {
    expect(slotMacros(CENA_PAVO, 0.5)).toEqual({ calories: 275, protein: 20, carbs: 22.5, fat: 10 });
    expect(slotMacros(CENA_PAVO, 2)).toEqual({ calories: 1100, protein: 80, carbs: 90, fat: 40 });
  });
});

describe("R1: dayPlanSummary suma las comidas del perfil", () => {
  it("R1: desayuno P 30 + comida P 50 + cena P 40 → proteínas 120, y cada macro con su suma", () => {
    const s = summary([slot("Desayuno", DESAYUNO_CLARAS), slot("Comida", COMIDA_BONIATO), slot("Cena", CENA_PAVO)]);
    expect(s?.totals).toEqual({ calories: 1700, protein: 120, carbs: 180, fat: 57 });
  });

  it("R1: una receta en una comida desmarcada en el perfil no suma", () => {
    const s = summary([slot("Desayuno", DESAYUNO_CLARAS), slot("Media mañana", BATIDO_ENORME)]);
    expect(s?.totals).toEqual({ calories: 450, protein: 30, carbs: 55, fat: 15 });
    expect(s?.total).toBe(4);
  });

  it("R1: una franja cuya receta se borró no suma ni cuenta como planificada", () => {
    const s = summary([slot("Comida", COMIDA_BONIATO), { mealType: "Cena", recipeId: DELETED_RECIPE_ID }]);
    expect(s?.totals).toEqual({ calories: 700, protein: 50, carbs: 80, fat: 22 });
    expect(s?.planned).toBe(1);
  });

  it("R1: un día sin recetas → null (no se muestra el resumen)", () => {
    expect(summary([])).toBeNull();
  });

  it("R1: un día cuyas únicas franjas no suman (comida desmarcada o receta borrada) → null", () => {
    expect(summary([slot("Media mañana", BATIDO_ENORME), { mealType: "Cena", recipeId: DELETED_RECIPE_ID }])).toBeNull();
  });

  it("R1: dos franjas de la misma comida (datos importados) → solo cuenta la primera, como la lista", () => {
    const s = summary([slot("Cena", CENA_PAVO), slot("Cena", MERIENDA_NUECES)]);
    expect(s?.totals).toEqual({ calories: 550, protein: 40, carbs: 45, fat: 20 });
    expect(s?.planned).toBe(1);
  });

  it("Edge case (decimales): se suma sin redondear", () => {
    const a: Recipe = { ...DESAYUNO_CLARAS, id: "dec-a", protein: 30.4, calories: 450.3 };
    const b: Recipe = { ...CENA_PAVO, id: "dec-b", protein: 40.4, calories: 550.3 };
    const s = summary([slot("Desayuno", a), slot("Cena", b)], { recipes: [a, b] });
    expect(s?.totals.protein).toBeCloseTo(70.8, 10);
    expect(s?.totals.calories).toBeCloseTo(1000.6, 10);
  });
});

describe("R7: comidas planificadas de las del perfil", () => {
  it("R7: 2 de 4 comidas asignadas → planned 2, total 4", () => {
    const s = summary([slot("Desayuno", DESAYUNO_CLARAS), slot("Cena", CENA_PAVO)]);
    expect(s).toMatchObject({ planned: 2, total: 4 });
  });

  it("R7: con todas asignadas → planned = total", () => {
    const s = summary([
      slot("Desayuno", DESAYUNO_CLARAS),
      slot("Comida", COMIDA_BONIATO),
      slot("Merienda", MERIENDA_NUECES),
      slot("Cena", CENA_PAVO),
    ]);
    expect(s).toMatchObject({ planned: 4, total: 4 });
    expect(s?.totals).toEqual({ calories: 2030, protein: 128, carbs: 205, fat: 80 });
  });

  it("R7: total = número de comidas del perfil (5 con Manuel de agosto)", () => {
    const meals: MealType[] = ["Desayuno", "Media mañana", "Comida", "Pre-entreno", "Cena"];
    expect(summary([slot("Comida", COMIDA_BONIATO)], { meals })).toMatchObject({ planned: 1, total: 5 });
  });
});
