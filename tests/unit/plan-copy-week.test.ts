// Spec: docs/pm/53-copiar-semana-anterior/spec.md › Acceptance criteria R1–R4 y Edge cases.
// Tech: docs/pm/53-copiar-semana-anterior/tech.md › APIs / interfaces (`src/lib/plan/copyWeek.ts`) y State & edge cases.
// Contrato: `planCopy(plan, monday, recipeIds, meals)` → { conflicts, sourceEmpty, apply(mode) → { plan, copied } }, con
// `monday` = lunes de la semana DESTINO, origen = la semana anterior y `meals` = las comidas que muestra el perfil (solo
// esas se copian y cuentan, #150). Funciones puras: no mutan el plan de entrada.
//
// Datos: tests/fixtures/copiar-semana.ts. Hoy = martes 2026-09-22; destino 21–27 sept, origen 14–20 sept.
// Fallan hasta que exista src/lib/plan/copyWeek.ts (tarea 1 del tech design). R5 (aviso y Deshacer) es UI: e2e.
import { describe, expect, it } from "vitest";
import { isSourceEmpty, planCopy, type CopyMode } from "@/lib/plan/copyWeek";
import { batchOf } from "@/lib/plan/batch";
import { MEAL_TYPES, type MealType, type WeekPlan } from "@/lib/types";
import {
  BATIDO_KEFIR,
  CREMA_CALABAZA,
  DATILES,
  DST,
  DST_BATCH,
  DST_BATCH_ID,
  DST_MONDAY,
  GUISO,
  POLLO_BROCOLI,
  RECIPE_IDS,
  SRC,
  SRC_BATCH_ID,
  SRC_BATCH_ONLY,
  SRC_PLAN,
  SRC_SIMPLE,
  allSlots,
  flat,
  slotAt,
} from "../fixtures/copiar-semana";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const merge = (...plans: WeekPlan[]): WeekPlan => Object.assign({}, ...plans);
// Por defecto, un perfil que hace todas las comidas
const copy = (plan: WeekPlan, monday: string, ids: ReadonlySet<string>, meals: MealType[] = MEAL_TYPES) =>
  planCopy(plan, monday, ids, meals);
const apply = (plan: WeekPlan, monday: string, ids: ReadonlySet<string>, mode: CopyMode, meals: MealType[] = MEAL_TYPES) =>
  copy(plan, monday, ids, meals).apply(mode);
// Comidas de lucia (fixture): no hace Pre-entreno
const NO_PRE = MEAL_TYPES.filter((m) => m !== "Pre-entreno");

describe("R1: copiar cada franja a su mismo día y comida", () => {
  it("R1: copia receta y raciones día a día a la semana destino", () => {
    const { plan, copied } = apply(SRC_SIMPLE, DST_MONDAY, RECIPE_IDS, "keep");
    expect(copied).toBe(3);
    expect(slotAt(plan, DST[0], "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id });
    expect(slotAt(plan, DST[1], "Cena")).toMatchObject({ recipeId: CREMA_CALABAZA.id, servings: 1.5 });
    expect(slotAt(plan, DST[4], "Desayuno")).toMatchObject({ recipeId: BATIDO_KEFIR.id });
  });

  it("R1: una franja sin raciones sigue sin `servings` tras copiarse", () => {
    const { plan } = apply(SRC_SIMPLE, DST_MONDAY, RECIPE_IDS, "keep");
    expect(slotAt(plan, DST[0], "Comida")).not.toHaveProperty("servings");
  });

  it("R1: no toca la semana origen ni otras semanas, y no muta el plan de entrada", () => {
    const other = "2026-09-28"; // semana siguiente
    const input = merge(SRC_SIMPLE, { [other]: [{ mealType: "Comida", recipeId: DATILES.id }] });
    const before = clone(input);
    const { plan } = apply(input, DST_MONDAY, RECIPE_IDS, "keep");
    expect(input).toEqual(before);
    expect(flat(plan, SRC)).toEqual(flat(SRC_SIMPLE, SRC));
    expect(flat(plan, [other])).toEqual(flat(input, [other]));
  });

  it("R1: funciona en cualquier semana vista: la origen es siempre la anterior a ella", () => {
    const nextMonday = "2026-09-28";
    const input = merge(SRC_SIMPLE, { [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }] });
    const { plan, copied } = apply(input, nextMonday, RECIPE_IDS, "keep");
    expect(copied).toBe(1);
    expect(slotAt(plan, "2026-09-28", "Comida")).toMatchObject({ recipeId: DATILES.id });
    expect(allSlots(plan)).toHaveLength(allSlots(input).length + 1);
  });

  it("R1: cruza el cambio de año (28 dic 2026 → 4 ene 2027)", () => {
    const input: WeekPlan = { "2026-12-30": [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }] };
    const { plan } = apply(input, "2027-01-04", RECIPE_IDS, "keep");
    expect(slotAt(plan, "2027-01-06", "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id });
  });

  it("R1: planCopy calcula conflictos sin tocar el plan; solo `apply` escribe, sin mutar la entrada", () => {
    const before = clone(SRC_SIMPLE);
    const result = copy(SRC_SIMPLE, DST_MONDAY, RECIPE_IDS);
    expect(result.conflicts).toBe(0);
    expect(SRC_SIMPLE).toEqual(before);
    expect(result.apply("keep").copied).toBe(3);
    expect(SRC_SIMPLE).toEqual(before);
  });
});

describe("R2: conflictos con franjas ya ocupadas", () => {
  const busy = merge(SRC_SIMPLE, {
    [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }], // pisaría la Comida del lunes
    [DST[1]]: [{ mealType: "Cena", recipeId: GUISO.id }], // pisaría la Cena del martes
    [DST[2]]: [{ mealType: "Cena", recipeId: DATILES.id }], // el origen no tiene nada ahí: no es conflicto
  });

  it("R2: cuenta exactamente las franjas ocupadas que la copia pisaría", () => {
    expect(copy(busy, DST_MONDAY, RECIPE_IDS).conflicts).toBe(2);
  });

  it("R2: sin franjas ocupadas, no hay conflictos", () => {
    expect(copy(SRC_SIMPLE, DST_MONDAY, RECIPE_IDS).conflicts).toBe(0);
  });

  it("R2: conservar deja intactas las ocupadas y rellena solo las vacías", () => {
    const { plan, copied } = apply(busy, DST_MONDAY, RECIPE_IDS, "keep");
    expect(copied).toBe(1);
    expect(slotAt(plan, DST[0], "Comida")).toMatchObject({ recipeId: DATILES.id });
    expect(slotAt(plan, DST[1], "Cena")).toMatchObject({ recipeId: GUISO.id });
    expect(slotAt(plan, DST[4], "Desayuno")).toMatchObject({ recipeId: BATIDO_KEFIR.id });
  });

  it("R2: reemplazar sustituye las ocupadas por receta y raciones de origen y respeta el resto", () => {
    const { plan, copied } = apply(busy, DST_MONDAY, RECIPE_IDS, "replace");
    expect(copied).toBe(3);
    expect(slotAt(plan, DST[0], "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id });
    expect(slotAt(plan, DST[1], "Cena")).toMatchObject({ recipeId: CREMA_CALABAZA.id, servings: 1.5 });
    expect(slotAt(plan, DST[2], "Cena")).toMatchObject({ recipeId: DATILES.id }); // fuera del origen: se conserva
  });

  it("R2: una franja de destino idéntica (misma receta y raciones) no es conflicto ni cuenta como copiada", () => {
    const input = merge(SRC_SIMPLE, { [DST[0]]: [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }] });
    expect(copy(input, DST_MONDAY, RECIPE_IDS).conflicts).toBe(0);
    const { plan, copied } = apply(input, DST_MONDAY, RECIPE_IDS, "replace");
    expect(copied).toBe(2);
    expect(slotAt(plan, DST[0], "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id });
  });

  it("R2: la misma receta con otras raciones sí es conflicto", () => {
    const input = merge(SRC_SIMPLE, { [DST[1]]: [{ mealType: "Cena", recipeId: CREMA_CALABAZA.id, servings: 2 }] });
    expect(copy(input, DST_MONDAY, RECIPE_IDS).conflicts).toBe(1);
  });

  it("R2: copiar dos veces seguidas no cuenta nada la segunda (todo idéntico)", () => {
    const once = apply(SRC_SIMPLE, DST_MONDAY, RECIPE_IDS, "keep").plan;
    const twice = apply(once, DST_MONDAY, RECIPE_IDS, "keep");
    expect(twice.copied).toBe(0);
    expect(twice.plan).toEqual(once);
    expect(copy(once, DST_MONDAY, RECIPE_IDS).conflicts).toBe(0);
  });
});

describe("R3: tandas con sobras", () => {
  it("R3: la tanda se copia entera, desplazada una semana, con `batchId` nuevo", () => {
    const { plan, copied } = apply(SRC_BATCH_ONLY, DST_MONDAY, RECIPE_IDS, "keep");
    expect(copied).toBe(3);
    const origin = slotAt(plan, DST[1], "Comida")!;
    const wed = slotAt(plan, DST[2], "Comida")!;
    const thu = slotAt(plan, DST[3], "Cena")!;
    expect(origin).toMatchObject({ recipeId: GUISO.id, cookedServings: 3 });
    expect(origin.leftover).toBeUndefined();
    expect(wed).toMatchObject({ recipeId: GUISO.id, leftover: true });
    expect(thu).toMatchObject({ recipeId: GUISO.id, leftover: true });
    expect(origin.batchId).toBeTruthy();
    expect(origin.batchId).not.toBe(SRC_BATCH_ID);
    expect(wed.batchId).toBe(origin.batchId);
    expect(thu.batchId).toBe(origin.batchId);
    const batch = batchOf(plan, origin.batchId!)!;
    expect(batch.leftovers).toHaveLength(2);
  });

  it("R3: la tanda de origen sigue intacta con su `batchId`", () => {
    const { plan } = apply(SRC_BATCH_ONLY, DST_MONDAY, RECIPE_IDS, "keep");
    expect(batchOf(plan, SRC_BATCH_ID)!.leftovers).toHaveLength(2);
  });

  it("R3: una cocinada sin sobras en la semana origen se copia como franja normal", () => {
    const input: WeekPlan = {
      [SRC[1]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: SRC_BATCH_ID, cookedServings: 3 }],
    };
    const slot = slotAt(apply(input, DST_MONDAY, RECIPE_IDS, "keep").plan, DST[1], "Comida")!;
    expect(slot.recipeId).toBe(GUISO.id);
    expect(slot.batchId).toBeUndefined();
    expect(slot.cookedServings).toBeUndefined();
    expect(slot.leftover).toBeUndefined();
  });

  it("R3: unas sobras sin su cocinada en la semana origen se copian como franja normal", () => {
    const input: WeekPlan = {
      [SRC[2]]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "batch-huerfano", leftover: true }],
    };
    const slot = slotAt(apply(input, DST_MONDAY, RECIPE_IDS, "keep").plan, DST[2], "Comida")!;
    expect(slot.recipeId).toBe(GUISO.id);
    expect(slot.batchId).toBeUndefined();
    expect(slot.leftover).toBeUndefined();
  });

  it("R3: «conservar» omite la tanda entera si alguno de sus miembros entra en conflicto", () => {
    const input = merge(SRC_PLAN, { [DST[2]]: [{ mealType: "Comida", recipeId: DATILES.id }] }); // choca con una sobra
    const { plan } = apply(input, DST_MONDAY, RECIPE_IDS, "keep");
    expect(slotAt(plan, DST[1], "Comida")).toBeUndefined(); // cocinada no copiada
    expect(slotAt(plan, DST[3], "Cena")).toBeUndefined(); // sobra no copiada
    expect(slotAt(plan, DST[2], "Comida")).toMatchObject({ recipeId: DATILES.id }); // la ocupada, intacta
    expect(slotAt(plan, DST[0], "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id }); // el resto sí se copia
  });

  it("R3: «reemplazar» una cocinada existente deja sus sobras como franjas normales", () => {
    const input = merge(DST_BATCH, { [SRC[0]]: [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }] });
    const { plan } = apply(input, DST_MONDAY, RECIPE_IDS, "replace");
    expect(slotAt(plan, DST[0], "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id });
    expect(slotAt(plan, DST[0], "Comida")!.batchId).toBeUndefined();
    for (const [date, meal] of [[DST[1], "Comida"], [DST[2], "Cena"]] as const) {
      const slot = slotAt(plan, date, meal)!;
      expect(slot.recipeId).toBe(GUISO.id);
      expect(slot.batchId).toBeUndefined();
      expect(slot.leftover).toBeUndefined();
    }
    expect(batchOf(plan, DST_BATCH_ID)).toBeNull();
  });

  it("R3: «reemplazar» una sobra suelta la sustituye y la tanda sigue con las demás y las mismas raciones cocinadas", () => {
    const input = merge(DST_BATCH, { [SRC[1]]: [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }] }); // pisa la sobra del martes
    const { plan } = apply(input, DST_MONDAY, RECIPE_IDS, "replace");
    expect(slotAt(plan, DST[1], "Comida")).toMatchObject({ recipeId: POLLO_BROCOLI.id });
    expect(slotAt(plan, DST[1], "Comida")!.leftover).toBeUndefined();
    const batch = batchOf(plan, DST_BATCH_ID)!;
    expect(batch.origin.slot.cookedServings).toBe(3);
    expect(batch.leftovers).toHaveLength(1);
  });
});

describe("R4: semana origen vacía", () => {
  it("R4: sin ninguna franja en la semana origen, `sourceEmpty` es true y no se copia nada", () => {
    const input: WeekPlan = { [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }] };
    expect(copy(input, DST_MONDAY, RECIPE_IDS).sourceEmpty).toBe(true);
    const { plan, copied } = apply(input, DST_MONDAY, RECIPE_IDS, "replace");
    expect(copied).toBe(0);
    expect(plan).toEqual(input);
  });

  it("R4: días del origen con lista vacía cuentan como vacío", () => {
    expect(copy({ [SRC[0]]: [], [SRC[3]]: [] }, DST_MONDAY, RECIPE_IDS).sourceEmpty).toBe(true);
  });

  it("R4: franjas solo en otras semanas no cuentan como origen", () => {
    const input: WeekPlan = { "2026-09-07": [{ mealType: "Comida", recipeId: DATILES.id }] };
    expect(copy(input, DST_MONDAY, RECIPE_IDS).sourceEmpty).toBe(true);
  });

  it("R4: con alguna franja en el origen, `sourceEmpty` es false", () => {
    expect(copy(SRC_SIMPLE, DST_MONDAY, RECIPE_IDS).sourceEmpty).toBe(false);
  });
});

describe("Edge cases: recetas borradas y recuentos", () => {
  const without = (id: string) => new Set([...RECIPE_IDS].filter((r) => r !== id));

  it("una franja de origen cuya receta ya no existe se omite y no cuenta", () => {
    const { plan, copied } = apply(SRC_SIMPLE, DST_MONDAY, without(CREMA_CALABAZA.id), "keep");
    expect(copied).toBe(2);
    expect(slotAt(plan, DST[1], "Cena")).toBeUndefined();
  });

  it("una receta borrada en el origen no genera conflicto con una franja de destino ocupada", () => {
    const input = merge(SRC_SIMPLE, { [DST[1]]: [{ mealType: "Cena", recipeId: GUISO.id }] });
    expect(copy(input, DST_MONDAY, without(CREMA_CALABAZA.id)).conflicts).toBe(0);
  });

  it("origen con solo recetas borradas: hay origen (`sourceEmpty` false) pero no se copia nada", () => {
    const only: WeekPlan = { [SRC[0]]: [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }] };
    const ids = without(POLLO_BROCOLI.id);
    expect(copy(only, DST_MONDAY, ids).sourceEmpty).toBe(false);
    const { plan, copied } = apply(only, DST_MONDAY, ids, "keep");
    expect(copied).toBe(0);
    expect(plan).toEqual(only);
  });

  it("el plan completo (con tanda) copia 8 franjas", () => {
    expect(apply(SRC_PLAN, DST_MONDAY, RECIPE_IDS, "keep").copied).toBe(8);
  });
});

// #150: solo se copian y cuentan las comidas que el perfil muestra; el aviso cuadra con lo que se ve
describe("#150: comidas que el perfil no muestra", () => {
  it("no copia una comida que el usuario no hace y la deja fuera del recuento", () => {
    const { plan, copied } = apply(SRC_PLAN, DST_MONDAY, RECIPE_IDS, "keep", NO_PRE);
    expect(copied).toBe(7);
    expect(slotAt(plan, DST[5], "Pre-entreno")).toBeUndefined();
  });

  it("con todas las comidas en el perfil, sí la copia", () => {
    const { plan } = apply(SRC_PLAN, DST_MONDAY, RECIPE_IDS, "keep");
    expect(slotAt(plan, DST[5], "Pre-entreno")).toMatchObject({ recipeId: DATILES.id });
  });

  it("una franja oculta del destino no cuenta como conflicto ni se pisa al reemplazar", () => {
    const input = merge(SRC_PLAN, { [DST[5]]: [{ mealType: "Pre-entreno", recipeId: BATIDO_KEFIR.id }] });
    expect(copy(input, DST_MONDAY, RECIPE_IDS, NO_PRE).conflicts).toBe(0);
    const { plan } = apply(input, DST_MONDAY, RECIPE_IDS, "replace", NO_PRE);
    expect(slotAt(plan, DST[5], "Pre-entreno")).toMatchObject({ recipeId: BATIDO_KEFIR.id });
  });

  it("un origen con solo comidas ocultas cuenta como vacío (R4)", () => {
    const input: WeekPlan = { [SRC[5]]: [{ mealType: "Pre-entreno", recipeId: DATILES.id }] };
    expect(copy(input, DST_MONDAY, RECIPE_IDS, NO_PRE).sourceEmpty).toBe(true);
    expect(isSourceEmpty(input, DST_MONDAY, NO_PRE)).toBe(true);
    expect(isSourceEmpty(input, DST_MONDAY, MEAL_TYPES)).toBe(false);
  });
});
