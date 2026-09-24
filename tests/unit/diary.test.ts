// Spec: docs/pm/diario-desde-plan/spec.md › Requirements (definición de "pendiente"), R1–R6, R9 y Edge cases.
// Tech: docs/pm/diario-desde-plan/tech.md › APIs / interfaces (`recipeEntry`, `pendingSlots`, reglas 1–4).
// Raciones: docs/pm/raciones/spec.md › R2–R8 y docs/pm/raciones/tech.md › APIs / interfaces (`recipeEntry` con
// `{ servings, id }`, `SERVINGS`, `SERVINGS_ERROR`, `parseServings`, `stepServings`, `formatServings`, `servingsLabel`).
import { describe, expect, it } from "vitest";
import {
  SERVINGS,
  SERVINGS_ERROR,
  formatServings,
  parseServings,
  pendingSlots,
  recipeEntry,
  servingsLabel,
  stepServings,
} from "@/lib/diary";
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe, type WeekPlan } from "@/lib/types";
import { lucia, manuel } from "../fixtures/profiles";
import {
  CALDO,
  DIARIO_RECIPES,
  FULL_DAY_PLAN,
  GUISO,
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
    const e = recipeEntry(LENTEJAS, TODAY, "Comida", { id: "id-1" });
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
    const p = pending({ entries: [recipeEntry(LENTEJAS, TODAY, "Comida", { id: "x" })] });
    expect(summary(p)).toEqual([
      ["Desayuno", "Tortilla francesa"],
      ["Cena", "Merluza al horno"],
    ]);
  });

  it("R4: otra receta en esa comida también la quita", () => {
    const p = pending({ entries: [recipeEntry(KEFIR, TODAY, "Comida", { id: "x" })] });
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
    const logged = [recipeEntry(LENTEJAS, TODAY, "Comida", { id: "x" })];
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

// ---------------------------------------------------------------------------
// Raciones al registrar recetas (docs/pm/raciones).

describe("Raciones · recipeEntry con { servings }", () => {
  it("R2/R3: 0,5 raciones de una receta 600/40/60/20 → 300/20/30/10 y guarda servings: 0.5", () => {
    expect(recipeEntry(GUISO, TODAY, "Cena", { servings: 0.5, id: "r-1" })).toEqual({
      id: "r-1",
      date: TODAY,
      mealType: "Cena",
      recipeId: "t-guiso",
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
      servings: 0.5,
    });
  });

  it("R2/R3: 1,5 raciones → 900/60/90/30 y servings: 1.5", () => {
    expect(recipeEntry(GUISO, TODAY, "Comida", { servings: 1.5, id: "r-2" })).toMatchObject({
      calories: 900,
      protein: 60,
      carbs: 90,
      fat: 30,
      servings: 1.5,
    });
  });

  it("R2/R7: sin opciones → los macros exactos de la receta y sin clave servings (la entrada de hoy)", () => {
    const e = recipeEntry(GUISO, TODAY, "Comida");
    expect(e).toMatchObject({ recipeId: "t-guiso", calories: 600, protein: 40, carbs: 60, fat: 20 });
    expect(e).not.toHaveProperty("servings");
  });

  it("R3 (tech › Spec feedback 1): servings: 1 da exactamente la misma entrada que sin opciones, sin clave servings", () => {
    const e = recipeEntry(GUISO, TODAY, "Comida", { servings: 1, id: "r-3" });
    expect(e).toEqual({ id: "r-3", date: TODAY, mealType: "Comida", recipeId: "t-guiso", calories: 600, protein: 40, carbs: 60, fat: 20 });
    expect(e).not.toHaveProperty("servings");
  });

  it("solo { servings } sigue generando un id", () => {
    const e = recipeEntry(GUISO, TODAY, "Comida", { servings: 0.5 });
    expect(e.id).toEqual(expect.any(String));
    expect(e.id).not.toBe("");
  });

  it("R2: los macros se guardan sin redondear (0,25 × 150 = 37,5)", () => {
    expect(recipeEntry(CALDO, TODAY, "Cena", { servings: 0.25 }).calories).toBe(37.5);
  });

  it("R2: el redondeo no acumula error: tres entradas de 0,25 de 150 kcal suman 112,5 (→ 113, no 114)", () => {
    const total = [1, 2, 3]
      .map((i) => recipeEntry(CALDO, TODAY, "Cena", { servings: 0.25, id: `c-${i}` }))
      .reduce((s, e) => s + e.calories, 0);
    expect(total).toBe(112.5);
    expect(Math.round(total)).toBe(113);
  });

  it("R2: cualquier múltiplo de 0,25 entre 0,25 y 4 escala exacto, sin error de coma flotante", () => {
    for (let k = 1; k <= 16; k++) {
      const e = recipeEntry(LENTEJAS, TODAY, "Comida", { servings: k / 4 });
      expect(e.calories).toBe((520 * k) / 4);
      expect(e.fat).toBe((12 * k) / 4);
    }
  });
});

describe("Raciones · SERVINGS y SERVINGS_ERROR", () => {
  it("R1: rango 0,25–4 en pasos de 0,25", () => {
    expect(SERVINGS).toEqual({ min: 0.25, max: 4, step: 0.25 });
  });

  it("R6: el mensaje es el del spec", () => {
    expect(SERVINGS_ERROR).toBe("Entre 0,25 y 4, en pasos de 0,25");
  });
});

describe("R6 · parseServings", () => {
  it('"0,75" y "0.75" se aceptan y dan lo mismo', () => {
    expect(parseServings("0,75")).toBe(0.75);
    expect(parseServings("0.75")).toBe(0.75);
  });

  it.each([
    ["0,25", 0.25],
    ["4", 4],
    ["1", 1],
    ["0,5", 0.5],
    ["1,5", 1.5],
    ["3,75", 3.75],
  ])('"%s" → %s (extremos y valores válidos)', (text, value) => {
    expect(parseServings(text)).toBe(value);
  });

  it.each(["0", "0,1", "4,25", "5", "abc", "", " ", "-1", "0,3", "1,33"])('"%s" → null', (text) => {
    expect(parseServings(text)).toBeNull();
  });

  it('tech › Spec feedback 4: ".5" (sin cero delante) se rechaza, como en parseDecimal', () => {
    expect(parseServings(".5")).toBeNull();
  });
});

describe("R8 · stepServings (botones − / +)", () => {
  it('"1", − → 0,75', () => {
    expect(stepServings("1", -1)).toBe(0.75);
  });

  it('"1", + → 1,25', () => {
    expect(stepServings("1", 1)).toBe(1.25);
  });

  it('acepta coma: "0,5", + → 0,75', () => {
    expect(stepServings("0,5", 1)).toBe(0.75);
  });

  it('no baja del mínimo: "0,25", − → 0,25', () => {
    expect(stepServings("0,25", -1)).toBe(0.25);
  });

  it('no sube del máximo: "4", + → 4', () => {
    expect(stepServings("4", 1)).toBe(4);
  });

  it('tech › Spec feedback 3: con texto no válido parte de 1 ("abc", + → 1,25; "abc", − → 0,75)', () => {
    expect(stepServings("abc", 1)).toBe(1.25);
    expect(stepServings("abc", -1)).toBe(0.75);
    expect(stepServings("", 1)).toBe(1.25);
  });
});

describe("R4 · formatServings", () => {
  it.each([
    [0.25, "0,25"],
    [0.5, "0,5"],
    [0.75, "0,75"],
    [1, "1"],
    [1.25, "1,25"],
    [1.5, "1,5"],
    [2, "2"],
    [4, "4"],
  ])("%s → %s (coma decimal, sin ceros de más)", (n, text) => {
    expect(formatServings(n)).toBe(text);
  });
});

describe("R4 · R5 · servingsLabel", () => {
  it('R4: 0,5 → "× 0,5" y 1,5 → "× 1,5" (signo × U+00D7)', () => {
    expect(servingsLabel({ servings: 0.5 })).toBe("× 0,5");
    expect(servingsLabel({ servings: 1.5 })).toBe("× 1,5");
    expect(servingsLabel({ servings: 0.25 })).toBe("× 0,25");
  });

  it("R4: con 1 ración no se muestra nada", () => {
    expect(servingsLabel({ servings: 1 })).toBeNull();
  });

  it("R5: una entrada sin multiplicador (anterior al cambio) no muestra nada", () => {
    expect(servingsLabel({})).toBeNull();
    expect(servingsLabel(entry(TODAY, "Comida", { recipeId: LENTEJAS.id, customName: undefined }))).toBeNull();
  });

  it("datos raros en localStorage (NaN, Infinity, string) → nada, nunca '× NaN'", () => {
    expect(servingsLabel({ servings: NaN })).toBeNull();
    expect(servingsLabel({ servings: Infinity })).toBeNull();
    expect(servingsLabel({ servings: "0.5" as unknown as number })).toBeNull();
  });
});
