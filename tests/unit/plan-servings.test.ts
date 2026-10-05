// Spec: docs/pm/29-raciones-plan/spec.md › R1, R4, R5, R6, R7, R8, R9 y Edge cases.
// Tech: docs/pm/29-raciones-plan/tech.md › APIs / interfaces (`slotServings` en planMacros.ts, `dayPlanSummary` y
// `collectSources` con `slot.servings`, `PendingSlot.servings` en diary.ts, `deleteOrigin("keep")` en plan/batch.ts).
//
// Datos: tests/fixtures/raciones-plan.ts. Hoy = martes 2026-09-22. Fallan hasta que existan `slotServings` y el campo
// `servings` en DayPlanSlot (tech.md › Tasks 1–3, 7).
import { describe, expect, it } from "vitest";
import { pendingSlots } from "@/lib/diary";
import { deleteOrigin } from "@/lib/plan/batch";
import { dayPlanSummary, slotServings } from "@/lib/planMacros";
import { aggregate, amountSignature, collectSources, formatAmount, type ShoppingItem } from "@/lib/shopping/aggregate";
import { normalizeKey } from "@/lib/shopping/parse";
import { MEAL_TYPES, type DayPlanSlot, type WeekPlan } from "@/lib/types";
import { DIARIO_RECIPES, LENTEJAS, TODAY } from "../fixtures/diario";
import { lucia } from "../fixtures/profiles";
import {
  CREMA_CALABAZA,
  GUISO,
  POLLO_PEREJIL,
  RACIONES_PLAN_RECIPES,
  THU,
  TUE,
  WED,
  batchPlanWith,
  guisoTue,
} from "../fixtures/raciones-plan";
import { WEEK } from "../fixtures/shopping";

const MEALS = lucia.meals; // Desayuno, Comida, Merienda, Cena
const asSlot = (extra: Record<string, unknown>) => ({ mealType: "Comida", recipeId: GUISO.id, ...extra }) as DayPlanSlot;

function items(weekPlan: WeekPlan): ShoppingItem[] {
  return aggregate(collectSources({ weekPlan, recipes: RACIONES_PLAN_RECIPES, dates: WEEK, meals: MEAL_TYPES }));
}
const get = (list: ShoppingItem[], name: string): ShoppingItem => {
  const item = list.find((i) => i.key === normalizeKey(name));
  expect(item, `falta "${name}" en la lista`).toBeDefined();
  return item!;
};
const pechuga = (weekPlan: WeekPlan) => formatAmount(get(items(weekPlan), "pechuga de pollo"));

describe("R1 / R7: slotServings", () => {
  it("R7: una franja sin servings vale 1 ración", () => {
    expect(slotServings({})).toBe(1);
  });

  it("R1: devuelve las raciones guardadas", () => {
    expect(slotServings({ servings: 0.5 })).toBe(0.5);
    expect(slotServings({ servings: 4 })).toBe(4);
  });

  it.each([[0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY], ["abc"]])(
    "R7: un valor raro de una copia de seguridad (%s) se trata como 1, sin romper nada",
    (bad) => {
      expect(slotServings({ servings: bad as unknown as number })).toBe(1);
    },
  );
});

describe("R4: el total del día multiplica por las raciones", () => {
  const day = (slots: DayPlanSlot[]) => dayPlanSummary({ slots, recipes: RACIONES_PLAN_RECIPES, meals: MEALS });

  it("0,5 raciones de Guiso (600/40/60/20) suma 300 / 20 / 30 / 10", () => {
    expect(day([asSlot({ servings: 0.5 })])?.totals).toEqual({ calories: 300, protein: 20, carbs: 30, fat: 10 });
  });

  it("1,5 raciones suma 900 / 60 / 90 / 30", () => {
    expect(day([asSlot({ servings: 1.5 })])?.totals).toEqual({ calories: 900, protein: 60, carbs: 90, fat: 30 });
  });

  it("R7: sin servings suma 1 ración, como antes", () => {
    expect(day([asSlot({})])?.totals).toEqual({ calories: 600, protein: 40, carbs: 60, fat: 20 });
  });

  it("suma franjas con raciones distintas: Comida 0,5 + Cena 3 de la misma receta = 3,5 raciones", () => {
    const summary = day([asSlot({ servings: 0.5 }), asSlot({ mealType: "Cena", servings: 3 })]);
    expect(summary?.totals).toEqual({ calories: 2100, protein: 140, carbs: 210, fat: 70 });
  });

  it('"N de M comidas planificadas" no cambia con las raciones', () => {
    const summary = day([asSlot({ servings: 0.5 }), asSlot({ mealType: "Cena", servings: 3 })]);
    expect(summary).toMatchObject({ planned: 2, total: 4 });
  });

  it("un valor raro de servings cuenta como 1 ración, no como 0 ni NaN", () => {
    expect(day([asSlot({ servings: Number.NaN })])?.totals.calories).toBe(600);
    expect(day([asSlot({ servings: 0 })])?.totals.calories).toBe(600);
  });

  it("con dos franjas de la misma comida, cuenta la primera con sus raciones (como #10)", () => {
    const summary = day([asSlot({ servings: 0.5 }), asSlot({ servings: 3 })]);
    expect(summary?.totals.calories).toBe(300);
  });

  it("R8: una sobra de 0,5 raciones cuenta 0,5; las raciones cocinadas de la cocinada no multiplican", () => {
    const plan = batchPlanWith({ cooked: 2, leftover: 0.5 });
    // La cocinada del martes tiene cookedServings 3 y servings 2: se come 2, no 3 ni 6
    expect(day(plan[TUE])?.totals.calories).toBe(1200);
    expect(day(plan[WED])?.totals.calories).toBe(300);
  });
});

describe("R5: la lista de la compra escala por las raciones de franjas normales", () => {
  it("Guiso con 0,5 raciones: 75 g de pechuga (150 g por ración) y 100 g de lentejas", () => {
    const list = items(guisoTue(0.5));
    expect(formatAmount(get(list, "pechuga de pollo"))).toBe("75 g");
    expect(formatAmount(get(list, "lentejas"))).toBe("100 g");
  });

  it("con 1,5 raciones: 225 g de pechuga", () => {
    expect(pechuga(guisoTue(1.5))).toBe("225 g");
  });

  it("dos franjas de la misma receta (0,5 y 1) suman sus cantidades escaladas: 225 g", () => {
    const plan: WeekPlan = {
      [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }],
      [WED]: [{ mealType: "Cena", recipeId: GUISO.id }],
    };
    expect(pechuga(plan)).toBe("225 g");
  });

  it('"1 cebolla" con 0,5 raciones → 0,5 (escala lineal, sin redondear)', () => {
    expect(formatAmount(get(items(guisoTue(0.5)), "cebolla"))).toBe("0,5");
  });

  it('una línea sin cantidad ("perejil fresco") sigue siendo "al gusto" con cualquier número de raciones', () => {
    const plan: WeekPlan = { [TUE]: [{ mealType: "Comida", recipeId: POLLO_PEREJIL.id, servings: 0.5 }] };
    expect(formatAmount(get(items(plan), "perejil fresco"))).toBe("al gusto");
    expect(pechuga(plan)).toBe("100 g");
  });

  it("R7: sin servings la lista es exactamente la de antes", () => {
    expect(items(guisoTue())).toEqual(items(guisoTue(1)));
    expect(pechuga(guisoTue())).toBe("150 g");
  });

  it("el detalle de cada fuente lleva la cantidad ya escalada", () => {
    const sources = collectSources({ weekPlan: guisoTue(0.5), recipes: RACIONES_PLAN_RECIPES, dates: WEEK, meals: MEAL_TYPES });
    expect(sources).toContainEqual(expect.objectContaining({ raw: "150g pechuga de pollo", qty: 75, unit: "g" }));
  });

  it("cambiar las raciones cambia la firma de cantidad (un ítem comprado deja de estarlo, regla de #5)", () => {
    const at = (n?: number) => amountSignature(get(items(guisoTue(n)), "pechuga de pollo"));
    expect(at(0.5)).not.toBe(at(1));
    expect(at(1)).toBe(at(undefined));
  });

  it("una franja con receta borrada sigue sin contar, tenga las raciones que tenga", () => {
    const plan: WeekPlan = { [TUE]: [{ mealType: "Comida", recipeId: "no-existe", servings: 2 }] };
    expect(items(plan)).toEqual([]);
  });
});

describe("R8: en un batch la compra sigue siendo cookedServings", () => {
  it("cocinada ×3 y 0,5 raciones en cocinada y sobras: la lista sigue en 450 g de pechuga (3 × 150 g)", () => {
    expect(pechuga(batchPlanWith({ cooked: 0.5, leftover: 0.5 }))).toBe("450 g");
  });

  it("cocinada ×3 con 2 raciones: sigue en 450 g (servings no escala la compra de una cocinada)", () => {
    expect(pechuga(batchPlanWith({ cooked: 2 }))).toBe("450 g");
  });
});

describe("R9: 'Dejar como normales' conserva las raciones de cada sobra", () => {
  it("deleteOrigin keep: las sobras de 0,5 pasan a franjas normales con servings 0,5", () => {
    const plan = deleteOrigin(batchPlanWith({ cooked: 2, leftover: 0.5 }), "batch-guiso", "keep");
    expect(plan[TUE]).toEqual([]);
    expect(plan[WED]).toEqual([{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }]);
    expect(plan[THU]).toEqual([{ mealType: "Cena", recipeId: GUISO.id, servings: 0.5 }]);
  });

  it("deleteOrigin keep: una sobra sin raciones sigue sin campo servings", () => {
    const plan = deleteOrigin(batchPlanWith({}), "batch-guiso", "keep");
    expect(plan[WED]).toEqual([{ mealType: "Comida", recipeId: GUISO.id }]);
  });

  it("al ser normales, esas franjas suman a la compra escaladas: 2 × 0,5 × 150 g = 150 g", () => {
    const plan = deleteOrigin(batchPlanWith({ cooked: 2, leftover: 0.5 }), "batch-guiso", "keep");
    expect(pechuga(plan)).toBe("150 g");
  });
});

describe("R6: pendingSlots lleva las raciones planificadas", () => {
  const pending = (weekPlan: WeekPlan) =>
    pendingSlots({ date: TODAY, today: TODAY, weekPlan, recipes: DIARIO_RECIPES, entries: [], meals: MEALS });
  const lentejas = (extra: Record<string, unknown>): WeekPlan => ({
    [TODAY]: [{ mealType: "Comida", recipeId: LENTEJAS.id, ...extra }],
  });

  it("una franja de 0,5 raciones es un pendiente con servings 0,5", () => {
    expect(pending(lentejas({ servings: 0.5 }))).toEqual([{ mealType: "Comida", recipe: LENTEJAS, servings: 0.5 }]);
  });

  it("una franja sin servings es un pendiente con servings 1", () => {
    expect(pending(lentejas({}))).toEqual([{ mealType: "Comida", recipe: LENTEJAS, servings: 1 }]);
  });

  it("un valor raro cuenta como 1", () => {
    expect(pending(lentejas({ servings: 0 }))[0].servings).toBe(1);
  });

  it("R8: la sobra de hoy con 0,5 raciones también es un pendiente de 0,5", () => {
    const plan: WeekPlan = {
      [TODAY]: [{ mealType: "Comida", recipeId: LENTEJAS.id, batchId: "b", leftover: true, servings: 0.5 }],
    };
    expect(pending(plan)[0].servings).toBe(0.5);
  });
});

// El resto de franjas de la semana no se toca: reutiliza CREMA_CALABAZA para asegurar que otras recetas no se ven afectadas
describe("R5: las raciones de una franja no afectan a otras", () => {
  it("Guiso 0,5 el martes y Crema 1 el miércoles: la calabaza sigue en 300 g", () => {
    const plan: WeekPlan = {
      [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }],
      [WED]: [{ mealType: "Comida", recipeId: CREMA_CALABAZA.id }],
    };
    expect(formatAmount(get(items(plan), "calabaza"))).toBe("300 g");
  });
});
