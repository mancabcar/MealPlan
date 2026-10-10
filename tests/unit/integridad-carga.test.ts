// Integridad de datos al cargar (docs/pm/integridad-datos/handoff.md › PR C): lo que llega de una copia de seguridad,
// de la sincronización o de un localStorage editado a mano pasa por LOAD_OPTIONS (userData.ts) y no debe romper
// pantallas ni dar NaN. Issues #123 (fibra), #81 (sobras) y #116 (lista de la compra).
import { describe, expect, it } from "vitest";
import { fiberGoal, formatFiber } from "@/lib/fiber";
import { createBatch, editBatch, sanitizeBatches } from "@/lib/plan/batch";
import { collectSources } from "@/lib/shopping/aggregate";
import { loadShoppingState } from "@/lib/shopping/state";
import type { Recipe, WeekPlan } from "@/lib/types";
import { LOAD_OPTIONS } from "@/lib/userData";
import { LENTEJAS_FIBRA } from "../fixtures/fibra";
import { BATCH_PLAN, GUISO, ORPHAN_LEFTOVER_PLAN, SOBRAS_RECIPES, TUE, WEEK } from "../fixtures/sobras";

describe("#123: fibra y objetivo de fibra de fuera", () => {
  it.each([0, -5, 5, 101, 37.5, "40", null, Number.NaN])("objetivo de fibra %s → el de por defecto (38)", (bad) => {
    expect(fiberGoal({ fiberGoal: bad as number })).toBe(38);
  });

  it("un objetivo válido se respeta", () => {
    expect(fiberGoal({ fiberGoal: 10 })).toBe(10);
    expect(fiberGoal({ fiberGoal: 100 })).toBe(100);
  });

  it.each([null, "3", Number.NaN, -1, Infinity])("receta con fibra %s → «sin dato», y la ficha no lanza", (bad) => {
    const [r] = LOAD_OPTIONS.recipes.upgrade([{ ...LENTEJAS_FIBRA, fiber: bad as number }]) as Recipe[];
    expect(r).not.toHaveProperty("fiber");
    // Lo que pinta la ficha de receta (src/app/recetas/page.tsx)
    expect(() => (r.fiber === undefined ? "—" : formatFiber(r.fiber))).not.toThrow();
  });

  it("una receta con fibra válida la conserva", () => {
    const [r] = LOAD_OPTIONS.recipes.upgrade([LENTEJAS_FIBRA]) as Recipe[];
    expect(r.fiber).toBe(LENTEJAS_FIBRA.fiber);
  });
});

describe("#81: sobras y raciones cocinadas de fuera", () => {
  const load = (plan: unknown) => LOAD_OPTIONS.weekplan.upgrade(plan) as WeekPlan;
  const sources = (plan: WeekPlan) =>
    collectSources({ weekPlan: plan, recipes: SOBRAS_RECIPES, dates: WEEK, meals: ["Desayuno", "Comida", "Cena"] });

  it("una sobra huérfana pasa a franja normal con su receta y se puede convertir en cocinada sin que createBatch lance", () => {
    const plan = load(ORPHAN_LEFTOVER_PLAN);
    const [date] = Object.keys(ORPHAN_LEFTOVER_PLAN);
    expect(plan[date]).toEqual([{ mealType: "Comida", recipeId: GUISO.id }]);
    expect(() => createBatch(plan, { date, mealType: "Comida" }, 2, [])).not.toThrow();
  });

  it("un batchId suelto (sin cocinada ni sobra) también se quita", () => {
    const plan = load({ [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "suelto" }] });
    expect(plan[TUE]).toEqual([{ mealType: "Comida", recipeId: GUISO.id }]);
  });

  it.each([
    [0, 2],
    [-2, 2],
    ["3", 3],
    [2.5, 3],
    [9, 8],
    [null, 2],
    ["muchas", 2],
  ])("cookedServings %s se ajusta a %s y la tanda conserva sus sobras", (bad, fixed) => {
    const plan = load({
      [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "b1", cookedServings: bad }],
      [WEEK[2]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "b1", leftover: true }],
    });
    expect(plan[TUE][0].cookedServings).toBe(fixed);
    expect(plan[WEEK[2]][0]).toMatchObject({ batchId: "b1", leftover: true });
  });

  it("las raciones cocinadas nunca quedan por debajo de sobras + 1 (review: editBatch no lanza)", () => {
    const leftover = { mealType: "Comida" as const, recipeId: GUISO.id, batchId: "b1", leftover: true as const };
    const plan = load({
      [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "b1", cookedServings: 0 }],
      [WEEK[2]]: [leftover, { ...leftover, mealType: "Cena" }],
      [WEEK[3]]: [leftover],
    });
    expect(plan[TUE][0].cookedServings).toBe(4);
    const targets = [WEEK[2], WEEK[2], WEEK[3]].map((date, i) => ({ date, mealType: i === 1 ? ("Cena" as const) : ("Comida" as const) }));
    expect(() => editBatch(plan, "b1", 4, targets)).not.toThrow();
  });

  it("con más de 7 sobras, las últimas pasan a franja normal y la tanda queda en 8", () => {
    const meals = ["Desayuno", "Comida", "Cena"] as const;
    const plan = load({
      [WEEK[0]]: [{ mealType: "Desayuno", recipeId: GUISO.id, batchId: "b1", cookedServings: 8 }],
      ...Object.fromEntries(
        [1, 2, 3].map((d) => [WEEK[d], meals.map((mealType) => ({ mealType, recipeId: GUISO.id, batchId: "b1", leftover: true }))]),
      ),
    });
    expect(plan[WEEK[0]][0].cookedServings).toBe(8);
    const all = [1, 2, 3].flatMap((d) => plan[WEEK[d]]);
    expect(all.filter((s) => s.leftover)).toHaveLength(7);
    expect(plan[WEEK[3]].slice(1)).toEqual([
      { mealType: "Comida", recipeId: GUISO.id },
      { mealType: "Cena", recipeId: GUISO.id },
    ]);
  });

  it("un día que no es una lista, o una franja que no es un objeto, se descarta sin romper la carga", () => {
    const plan = load({ [TUE]: null, [WEEK[2]]: "x", [WEEK[3]]: [null, 3, { mealType: "Comida", recipeId: GUISO.id }] });
    expect(plan).toEqual({ [WEEK[3]]: [{ mealType: "Comida", recipeId: GUISO.id }] });
  });

  it("un plan válido no cambia (sanitizeBatches devuelve el mismo objeto)", () => {
    expect(sanitizeBatches(BATCH_PLAN)).toBe(BATCH_PLAN);
    expect(load(BATCH_PLAN)).toEqual(BATCH_PLAN);
  });

  it.each([0, -2, "3", 2.5, 9, null])("cookedServings %s no da cantidades NaN ni negativas en la compra", (bad) => {
    const plan = load({ [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "b1", cookedServings: bad }] });
    for (const s of sources(plan)) {
      if (s.qty !== null) {
        expect(Number.isFinite(s.qty)).toBe(true);
        expect(s.qty).toBeGreaterThan(0);
      }
    }
  });
});

describe("#116: claves de semanas de la lista de la compra", () => {
  const week = { bought: {}, overrides: [], moved: {} };

  it("descarta las semanas cuya clave no es un lunes YYYY-MM-DD", () => {
    const state = loadShoppingState({ weeks: { "2026-10-05": week, foo: week, "2026-10-08": week, "": week } });
    expect(Object.keys(state.weeks)).toEqual(["2026-10-05"]);
  });

  it("descarta el último movimiento si su semana no es un lunes válido", () => {
    const lastMove = { at: "2026-10-05T10:00:00Z", pantryIds: ["p1"], entries: {}, week: "jueves" };
    expect(loadShoppingState({ weeks: {}, lastMove }).lastMove).toBeUndefined();
  });
});
