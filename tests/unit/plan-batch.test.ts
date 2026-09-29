// Spec: docs/pm/17-sobras-batch-cooking/spec.md › Acceptance criteria R1, R2, R4, R5, R7, R8, R10.
// Tech: docs/pm/17-sobras-batch-cooking/tech.md › APIs / interfaces (`src/lib/plan/batch.ts`, funciones puras
// WeekPlan → WeekPlan que lanzan `Error` ante entradas inválidas) y Test coverage › contrato de las funciones.
//
// Datos: tests/fixtures/sobras.ts. Hoy = martes 2026-09-22; cocinada = Comida del martes.
// Fallan hasta que exista src/lib/plan/batch.ts (tarea 1 del tech design). R6 vive en plan-sobras-macros.test.ts.
import { describe, expect, it } from "vitest";
import {
  batchOf,
  createBatch,
  deleteOrigin,
  editBatch,
  eligibleLeftoverSlots,
  removeLeftover,
} from "@/lib/plan/batch";
import { MEAL_TYPES, type WeekPlan } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  BATCH_ID,
  BATCH_PLAN,
  CREMA_CALABAZA,
  FRI,
  GUISO,
  LEFTOVER_THU,
  LEFTOVER_WED,
  MON,
  ORIGIN,
  PLAIN_PLAN,
  SAT,
  SUN,
  THU,
  TUE,
  WED,
  allSlots,
  slotAt,
} from "../fixtures/sobras";

const MEALS = lucia.meals; // Desayuno, Comida, Merienda, Cena

/** Copia profunda: comprueba que las funciones no mutan el plan de entrada. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("R1: crear una tanda (createBatch)", () => {
  it("cocinar 3 raciones con 2 franjas de sobras deja 3 franjas de la misma receta: 1 cocinada y 2 sobras", () => {
    const plan = createBatch(PLAIN_PLAN, ORIGIN, 3, [LEFTOVER_WED, LEFTOVER_THU]);

    const origin = slotAt(plan, TUE, "Comida")!;
    expect(origin).toMatchObject({ recipeId: GUISO.id, cookedServings: 3 });
    expect(origin.leftover).toBeUndefined();
    expect(slotAt(plan, WED, "Comida")).toMatchObject({ recipeId: GUISO.id, leftover: true });
    expect(slotAt(plan, THU, "Cena")).toMatchObject({ recipeId: GUISO.id, leftover: true });
  });

  it("no toca el resto del plan ni muta el plan de entrada", () => {
    const input = clone(PLAIN_PLAN);
    const plan = createBatch(input, ORIGIN, 3, [LEFTOVER_WED]);
    expect(input).toEqual(PLAIN_PLAN);
    expect(slotAt(plan, WED, "Cena")).toEqual({ mealType: "Cena", recipeId: CREMA_CALABAZA.id });
  });

  it("se puede elegir 0, 1 o N−1 franjas de sobras", () => {
    for (const targets of [[], [LEFTOVER_WED], [LEFTOVER_WED, LEFTOVER_THU]]) {
      expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, targets)).not.toThrow();
    }
  });

  it("no se pueden elegir N franjas de sobras (la cocinada ya es una ración)", () => {
    const three = [LEFTOVER_WED, LEFTOVER_THU, { date: FRI, mealType: "Comida" as const }];
    expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, three)).toThrow();
  });

  it("N acepta enteros de 2 a 8: 2 y 8 valen; 1, 9 y 2,5 no", () => {
    for (const n of [2, 8]) expect(() => createBatch(PLAIN_PLAN, ORIGIN, n, [])).not.toThrow();
    for (const n of [1, 9, 2.5, 0, -3, NaN]) expect(() => createBatch(PLAIN_PLAN, ORIGIN, n, [])).toThrow();
  });

  it("la franja de origen debe tener receta", () => {
    expect(() => createBatch({}, ORIGIN, 3, [])).toThrow();
  });

  it("rechaza sobras antes de la cocinada, en otra semana o repetidas", () => {
    expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, [{ date: MON, mealType: "Comida" }])).toThrow();
    expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, [{ date: TUE, mealType: "Desayuno" }])).toThrow(); // antes, el mismo día
    expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, [{ date: "2026-09-28", mealType: "Comida" }])).toThrow(); // lunes siguiente
    expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, [LEFTOVER_WED, LEFTOVER_WED])).toThrow();
  });

  it("acepta una sobra el mismo día en una comida posterior", () => {
    const plan = createBatch(PLAIN_PLAN, ORIGIN, 3, [{ date: TUE, mealType: "Cena" }]);
    expect(slotAt(plan, TUE, "Cena")).toMatchObject({ recipeId: GUISO.id, leftover: true });
  });
});

describe("R2: cada franja guarda su papel y el enlace a la tanda", () => {
  const plan = createBatch(PLAIN_PLAN, ORIGIN, 3, [LEFTOVER_WED, LEFTOVER_THU], { id: BATCH_ID });

  it("la cocinada y las sobras comparten batchId; solo la cocinada guarda cookedServings; solo las sobras, leftover", () => {
    expect(slotAt(plan, TUE, "Comida")).toEqual({
      mealType: "Comida",
      recipeId: GUISO.id,
      batchId: BATCH_ID,
      cookedServings: 3,
    });
    expect(slotAt(plan, WED, "Comida")).toEqual({ mealType: "Comida", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true });
    expect(slotAt(plan, THU, "Cena")).toEqual({ mealType: "Cena", recipeId: GUISO.id, batchId: BATCH_ID, leftover: true });
  });

  it("sin id explícito se genera uno, compartido por las tres franjas", () => {
    const auto = createBatch(PLAIN_PLAN, ORIGIN, 3, [LEFTOVER_WED, LEFTOVER_THU]);
    const ids = [slotAt(auto, TUE, "Comida"), slotAt(auto, WED, "Comida"), slotAt(auto, THU, "Cena")].map((s) => s?.batchId);
    expect(ids[0]).toEqual(expect.any(String));
    expect(new Set(ids).size).toBe(1);
  });

  it("batchOf devuelve la cocinada y sus sobras; un id desconocido devuelve null", () => {
    const found = batchOf(BATCH_PLAN, BATCH_ID)!;
    expect(found.origin).toMatchObject({ date: TUE, mealType: "Comida" });
    expect(found.leftovers.map((l) => `${l.date}|${l.mealType}`).sort()).toEqual([`${WED}|Comida`, `${THU}|Cena`]);
    expect(batchOf(BATCH_PLAN, "no-existe")).toBeNull();
  });
});

describe("R7: franjas que se pueden elegir como sobras (eligibleLeftoverSlots)", () => {
  const slots = eligibleLeftoverSlots(PLAIN_PLAN, ORIGIN, MEALS);
  const at = (date: string, mealType: string) => slots.find((s) => s.date === date && s.mealType === mealType);

  it("ofrece desde la comida siguiente del mismo día hasta el domingo, solo con las comidas del perfil", () => {
    expect(at(TUE, "Merienda")).toBeDefined();
    expect(at(TUE, "Cena")).toBeDefined();
    expect(at(SUN, "Desayuno")).toBeDefined();
    expect(at(SUN, "Cena")).toBeDefined();
    expect(slots).toHaveLength(2 + 4 * 5); // Tue: Merienda, Cena; Wed–Sun: 4 comidas × 5 días
    expect(slots.some((s) => s.mealType === "Media mañana" || s.mealType === "Pre-entreno")).toBe(false);
  });

  it("no ofrece la propia cocinada, comidas anteriores del mismo día, días anteriores ni otra semana", () => {
    expect(at(TUE, "Comida")).toBeUndefined();
    expect(at(TUE, "Desayuno")).toBeUndefined();
    expect(at(MON, "Comida")).toBeUndefined();
    expect(slots.every((s) => s.date >= TUE && s.date <= SUN)).toBe(true);
  });

  it("marca como no libres las franjas que ya tienen receta", () => {
    expect(at(WED, "Cena")).toMatchObject({ free: false });
    expect(at(WED, "Comida")).toMatchObject({ free: true });
    expect(at(THU, "Cena")).toMatchObject({ free: true });
  });

  it("createBatch rechaza una franja ocupada", () => {
    expect(() => createBatch(PLAIN_PLAN, ORIGIN, 3, [{ date: WED, mealType: "Cena" }])).toThrow();
  });

  it("orden de calendario y de MEAL_TYPES", () => {
    const keys = slots.map((s) => `${s.date}|${MEAL_TYPES.indexOf(s.mealType)}`);
    expect(keys).toEqual([...keys].sort());
  });
});

describe("R5: quitar una sobra (removeLeftover)", () => {
  it("quita solo esa franja; la cocinada conserva N y la otra sobra sigue enlazada", () => {
    const plan = removeLeftover(BATCH_PLAN, LEFTOVER_WED);
    expect(slotAt(plan, WED, "Comida")).toBeUndefined();
    expect(slotAt(plan, TUE, "Comida")).toMatchObject({ batchId: BATCH_ID, cookedServings: 3 });
    expect(slotAt(plan, THU, "Cena")).toMatchObject({ batchId: BATCH_ID, leftover: true });
  });

  it("no muta el plan de entrada", () => {
    const input = clone(BATCH_PLAN);
    removeLeftover(input, LEFTOVER_WED);
    expect(input).toEqual(BATCH_PLAN);
  });

  it("no se puede quitar como sobra la franja cocinada ni una franja normal", () => {
    expect(() => removeLeftover(BATCH_PLAN, ORIGIN)).toThrow();
    expect(() => removeLeftover(PLAIN_PLAN, { date: WED, mealType: "Cena" })).toThrow();
  });
});

describe("R4: borrar la franja cocinada (deleteOrigin)", () => {
  it('"all" quita la cocinada y sus sobras', () => {
    const plan = deleteOrigin(BATCH_PLAN, BATCH_ID, "all");
    expect(allSlots(plan)).toHaveLength(0);
  });

  it('"keep" quita la cocinada y deja las sobras como franjas normales de la receta', () => {
    const plan = deleteOrigin(BATCH_PLAN, BATCH_ID, "keep");
    expect(slotAt(plan, TUE, "Comida")).toBeUndefined();
    expect(slotAt(plan, WED, "Comida")).toEqual({ mealType: "Comida", recipeId: GUISO.id });
    expect(slotAt(plan, THU, "Cena")).toEqual({ mealType: "Cena", recipeId: GUISO.id });
  });

  it("no toca otras tandas ni franjas normales", () => {
    const other: WeekPlan = {
      ...BATCH_PLAN,
      [FRI]: [{ mealType: "Comida", recipeId: CREMA_CALABAZA.id, batchId: "otra", cookedServings: 2 }],
      [SAT]: [{ mealType: "Comida", recipeId: CREMA_CALABAZA.id, batchId: "otra", leftover: true }],
    };
    const plan = deleteOrigin(other, BATCH_ID, "all");
    expect(allSlots(plan)).toHaveLength(2);
    expect(slotAt(plan, FRI, "Comida")).toMatchObject({ batchId: "otra", cookedServings: 2 });
    expect(slotAt(plan, SAT, "Comida")).toMatchObject({ batchId: "otra", leftover: true });
  });

  it("no muta el plan de entrada", () => {
    const input = clone(BATCH_PLAN);
    deleteOrigin(input, BATCH_ID, "keep");
    expect(input).toEqual(BATCH_PLAN);
  });

  it("una tanda sin sobras se borra igual, sin dejar nada", () => {
    const solo: WeekPlan = { [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "solo", cookedServings: 3 }] };
    expect(allSlots(deleteOrigin(solo, "solo", "keep"))).toHaveLength(0);
  });
});

describe("R8: editar la tanda (editBatch)", () => {
  it("cambiar N y añadir una sobra desde la cocinada", () => {
    const plan = editBatch(BATCH_PLAN, BATCH_ID, 4, [LEFTOVER_WED, LEFTOVER_THU, { date: FRI, mealType: "Comida" }]);
    expect(slotAt(plan, TUE, "Comida")).toMatchObject({ batchId: BATCH_ID, cookedServings: 4 });
    expect(slotAt(plan, FRI, "Comida")).toMatchObject({ recipeId: GUISO.id, batchId: BATCH_ID, leftover: true });
    expect(allSlots(plan)).toHaveLength(4);
  });

  it("quitar una sobra de la lista de destinos la borra sin cambiar N", () => {
    const plan = editBatch(BATCH_PLAN, BATCH_ID, 3, [LEFTOVER_WED]);
    expect(slotAt(plan, THU, "Cena")).toBeUndefined();
    expect(slotAt(plan, TUE, "Comida")).toMatchObject({ cookedServings: 3 });
  });

  it("N no puede bajar de 1 + las sobras enlazadas: con 2 sobras, 3 vale y 2 no", () => {
    expect(() => editBatch(BATCH_PLAN, BATCH_ID, 3, [LEFTOVER_WED, LEFTOVER_THU])).not.toThrow();
    expect(() => editBatch(BATCH_PLAN, BATCH_ID, 2, [LEFTOVER_WED, LEFTOVER_THU])).toThrow();
  });

  it("con 1 sobra, N puede bajar a 2 pero no a 1", () => {
    const one = removeLeftover(BATCH_PLAN, LEFTOVER_THU);
    expect(() => editBatch(one, BATCH_ID, 2, [LEFTOVER_WED])).not.toThrow();
    expect(() => editBatch(one, BATCH_ID, 1, [LEFTOVER_WED])).toThrow();
  });

  it("no acepta una franja ya ocupada por otra receta ni un id de tanda desconocido", () => {
    const occupied: WeekPlan = { ...BATCH_PLAN, [FRI]: [{ mealType: "Comida", recipeId: CREMA_CALABAZA.id }] };
    expect(() => editBatch(occupied, BATCH_ID, 4, [LEFTOVER_WED, LEFTOVER_THU, { date: FRI, mealType: "Comida" }])).toThrow();
    expect(() => editBatch(BATCH_PLAN, "no-existe", 3, [])).toThrow();
  });

  it("no muta el plan de entrada", () => {
    const input = clone(BATCH_PLAN);
    editBatch(input, BATCH_ID, 4, [LEFTOVER_WED]);
    expect(input).toEqual(BATCH_PLAN);
  });
});

describe("R10: los planes sin campos de tanda son franjas normales", () => {
  it("un plan sin tandas no tiene tanda para ningún id", () => {
    expect(batchOf(PLAIN_PLAN, BATCH_ID)).toBeNull();
  });

  it("deleteOrigin sobre un id que no existe no cambia el plan", () => {
    expect(deleteOrigin(PLAIN_PLAN, "no-existe", "all")).toEqual(PLAIN_PLAN);
  });

  it("las franjas normales no se ven afectadas al crear una tanda en otra", () => {
    const plan = createBatch(PLAIN_PLAN, ORIGIN, 2, [LEFTOVER_WED]);
    expect(slotAt(plan, WED, "Cena")).toEqual({ mealType: "Cena", recipeId: CREMA_CALABAZA.id });
  });
});
