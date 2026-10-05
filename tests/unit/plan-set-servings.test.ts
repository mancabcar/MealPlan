// Spec: docs/pm/29-raciones-plan/spec.md › R1 (con 1 no se guarda `servings`), R3 (cambiar sin reasignar la receta) y R9.
// Tech: docs/pm/29-raciones-plan/tech.md › APIs / interfaces: `setSlotServings(plan, ref, n)` en
// src/lib/plan/servings.ts — pura (devuelve un plan nuevo), omite el campo si n = 1 y lanza si la franja no existe.
//
// Falla hasta que exista src/lib/plan/servings.ts (tech.md › Tasks 3).
import { describe, expect, it } from "vitest";
import { setSlotServings } from "@/lib/plan/servings";
import type { WeekPlan } from "@/lib/types";
import { BATCH_ID, GUISO, THU, TUE, WED, batchPlanWith, guisoTue } from "../fixtures/raciones-plan";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const COMIDA = { date: TUE, mealType: "Comida" } as const;
const slotOf = (plan: WeekPlan, date: string, mealType: string) => (plan[date] ?? []).find((s) => s.mealType === mealType);

describe("R1: setSlotServings guarda las raciones de la franja", () => {
  it("0,5 → la franja queda con servings 0,5 y la misma receta", () => {
    const plan = setSlotServings(guisoTue(), COMIDA, 0.5);
    expect(plan[TUE]).toEqual([{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }]);
  });

  it("R1: con 1 ración no se guarda el campo", () => {
    const plan = setSlotServings(guisoTue(), COMIDA, 1);
    expect(plan[TUE]).toEqual([{ mealType: "Comida", recipeId: GUISO.id }]);
    expect("servings" in plan[TUE][0]).toBe(false);
  });

  it("volver de 0,5 a 1 quita el campo", () => {
    const plan = setSlotServings(guisoTue(0.5), COMIDA, 1);
    expect("servings" in plan[TUE][0]).toBe(false);
  });

  it("R3: cambiar 0,5 → 0,75 no altera la receta ni el resto de la franja", () => {
    const plan = setSlotServings(batchPlanWith({ cooked: 0.5 }), COMIDA, 0.75);
    expect(slotOf(plan, TUE, "Comida")).toEqual({
      mealType: "Comida",
      recipeId: GUISO.id,
      batchId: BATCH_ID,
      cookedServings: 3,
      servings: 0.75,
    });
  });

  it("R8: funciona en una sobra y no toca la cocinada ni las demás sobras", () => {
    const plan = setSlotServings(batchPlanWith({}), { date: WED, mealType: "Comida" }, 0.5);
    expect(slotOf(plan, WED, "Comida")?.servings).toBe(0.5);
    expect(slotOf(plan, WED, "Comida")?.leftover).toBe(true);
    expect(slotOf(plan, TUE, "Comida")).toEqual(slotOf(batchPlanWith({}), TUE, "Comida"));
    expect(slotOf(plan, THU, "Cena")).toEqual(slotOf(batchPlanWith({}), THU, "Cena"));
  });

  it("no cambia las franjas de otras comidas del mismo día", () => {
    const plan: WeekPlan = {
      [TUE]: [
        { mealType: "Comida", recipeId: GUISO.id },
        { mealType: "Cena", recipeId: GUISO.id, servings: 2 },
      ],
    };
    const next = setSlotServings(plan, COMIDA, 0.5);
    expect(slotOf(next, TUE, "Cena")).toEqual({ mealType: "Cena", recipeId: GUISO.id, servings: 2 });
  });

  it("no muta el plan de entrada", () => {
    const plan = guisoTue();
    const before = clone(plan);
    setSlotServings(plan, COMIDA, 2);
    expect(plan).toEqual(before);
  });

  it("lanza si la franja no existe", () => {
    expect(() => setSlotServings(guisoTue(), { date: TUE, mealType: "Cena" }, 2)).toThrow();
    expect(() => setSlotServings(guisoTue(), { date: WED, mealType: "Comida" }, 2)).toThrow();
  });
});
