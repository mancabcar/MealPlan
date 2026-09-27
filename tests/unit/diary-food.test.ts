// Spec: docs/pm/13-base-alimentos/spec.md › R8 (la entrada de alimento) y R9 (la cantidad en el Diario).
// Tech: tech.md › Data model (`MealEntry.foodId/grams/units`) y APIs (`foodEntry`, `quantityLabel` en src/lib/diary.ts).
// En archivo aparte de diary.test.ts para que esos tests sigan en verde mientras no exista foodEntry.
import { describe, expect, it } from "vitest";
import { foodEntry, quantityLabel, recentMeals, repeatEntry } from "@/lib/diary";
import { ARROZ_COCIDO, HUEVO, YOGUR_GRIEGO, YOGUR_LIGERO } from "../fixtures/foods";
import { TODAY, YESTERDAY, entry } from "../fixtures/diario";

const per100 = (f: { kcal: number; protein: number; carbs: number; fat: number }) => ({
  kcal: f.kcal,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
});

const arroz = { foodId: `local:${ARROZ_COCIDO.id}`, name: ARROZ_COCIDO.name, per100: per100(ARROZ_COCIDO) };
const huevo = { foodId: `local:${HUEVO.id}`, name: HUEVO.name, per100: per100(HUEVO) };

describe("R8: entrada de alimento", () => {
  it("150 g guarda nombre, alimento de origen, gramos y macros sin redondear en la fecha y franja dadas", () => {
    const e = foodEntry(arroz, TODAY, "Comida", { grams: 150, id: "e1" });
    expect(e).toMatchObject({
      id: "e1",
      date: TODAY,
      mealType: "Comida",
      customName: "Arroz blanco, cocido",
      foodId: "local:arroz-blanco-cocido",
      grams: 150,
    });
    expect(e.calories).toBeCloseTo(195, 6);
    expect(e.protein).toBeCloseTo(4.05, 6);
    expect(e.carbs).toBeCloseTo(42, 6);
    expect(e.fat).toBeCloseTo(0.45, 6);
  });

  it("en gramos no guarda units ni recipeId ni servings", () => {
    const e = foodEntry(arroz, TODAY, "Comida", { grams: 150 });
    expect(e).not.toHaveProperty("units");
    expect(e).not.toHaveProperty("recipeId");
    expect(e).not.toHaveProperty("servings");
  });

  it("en unidades guarda las unidades y los gramos equivalentes (2 ud × 60 g = 120 g)", () => {
    const e = foodEntry(huevo, TODAY, "Desayuno", { grams: 120, units: 2 });
    expect(e).toMatchObject({ customName: "Huevo", foodId: "local:huevo", grams: 120, units: 2 });
    expect(e.calories).toBeCloseTo(168, 6);
  });

  it("sin id genera uno nuevo cada vez", () => {
    const a = foodEntry(arroz, TODAY, "Comida", { grams: 100 });
    const b = foodEntry(arroz, TODAY, "Comida", { grams: 100 });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it("un producto de OFF se guarda como «Producto · Marca» con foodId off:<código>", () => {
    const off = {
      foodId: `off:${YOGUR_GRIEGO.code}`,
      name: `${YOGUR_GRIEGO.name} · ${YOGUR_GRIEGO.brand}`,
      per100: per100(YOGUR_GRIEGO),
    };
    const e = foodEntry(off, TODAY, "Merienda", { grams: 125 });
    expect(e.customName).toBe("Yogur griego natural · Lácteos Sierra Alta");
    expect(e.foodId).toBe("off:8400000000011");
    expect(e.calories).toBeCloseTo(152.5, 6);
  });

  it("los macros de un producto de OFF salen de sus valores por 100 g", () => {
    const off = { foodId: `off:${YOGUR_LIGERO.code}`, name: YOGUR_LIGERO.name, per100: per100(YOGUR_LIGERO) };
    const e = foodEntry(off, TODAY, "Merienda", { grams: 200 });
    expect(e.protein).toBeCloseTo(10.4, 6);
    expect(e.fat).toBeCloseTo(8, 6);
  });
});

describe("R9: cantidad junto al nombre en el Diario", () => {
  it("una entrada de 150 g → «150 g»", () => {
    expect(quantityLabel({ grams: 150 })).toBe("150 g");
  });

  it("2 ud de 60 g → «2 ud · 120 g»", () => {
    expect(quantityLabel({ grams: 120, units: 2 })).toBe("2 ud · 120 g");
  });

  it("1,5 ud → coma decimal, y los gramos redondeados a entero", () => {
    expect(quantityLabel({ grams: 82.5, units: 1.5 })).toBe("1,5 ud · 83 g");
  });

  it("las entradas de receta y personalizadas (sin gramos) no muestran nada", () => {
    expect(quantityLabel({})).toBeNull();
    expect(quantityLabel(entry(TODAY, "Comida", { customName: "Yogur con nueces" }))).toBeNull();
  });

  it("datos raros en localStorage (NaN, string) → nada", () => {
    expect(quantityLabel({ grams: NaN })).toBeNull();
    expect(quantityLabel({ grams: "150" as unknown as number })).toBeNull();
  });
});

describe("R13: entradas de alimento en Recientes (#12)", () => {
  const recents = (entries: ReturnType<typeof foodEntry>[]) =>
    recentMeals({ entries, recipes: [], mealType: "Comida" }).map((r) => [r.name, quantityLabel(r.entry)]);

  it("150 g de arroz cocido registrados dos veces salen una sola vez", () => {
    const a = foodEntry(arroz, YESTERDAY, "Comida", { grams: 150 });
    const b = foodEntry(arroz, TODAY, "Comida", { grams: 150 });
    expect(recents([a, b])).toEqual([["Arroz blanco, cocido", "150 g"]]);
  });

  it("100 g y 150 g de arroz cocido son dos filas", () => {
    const a = foodEntry(arroz, YESTERDAY, "Comida", { grams: 100 });
    const b = foodEntry(arroz, TODAY, "Comida", { grams: 150 });
    expect(recents([a, b])).toEqual([
      ["Arroz blanco, cocido", "150 g"],
      ["Arroz blanco, cocido", "100 g"],
    ]);
  });

  it("2 ud y 120 g del mismo alimento son dos filas (la cantidad cuenta en unidades o en gramos)", () => {
    const a = foodEntry(huevo, YESTERDAY, "Desayuno", { grams: 120, units: 2 });
    const b = foodEntry(huevo, TODAY, "Desayuno", { grams: 120 });
    expect(recents([a, b])).toEqual([
      ["Huevo", "120 g"],
      ["Huevo", "2 ud · 120 g"],
    ]);
  });

  it("dos productos de OFF con el mismo nombre y macros pero distinto código son dos filas", () => {
    const off = (code: string) => ({ foodId: `off:${code}`, name: YOGUR_LIGERO.name, per100: per100(YOGUR_LIGERO) });
    const a = foodEntry(off("1"), TODAY, "Merienda", { grams: 125 });
    const b = foodEntry(off("2"), TODAY, "Merienda", { grams: 125 });
    expect(recents([a, b])).toHaveLength(2);
  });

  it("repetir una reciente de OFF copia gramos, alimento de origen y macros, sin red", () => {
    const off = { foodId: `off:${YOGUR_LIGERO.code}`, name: YOGUR_LIGERO.name, per100: per100(YOGUR_LIGERO) };
    const original = foodEntry(off, YESTERDAY, "Merienda", { grams: 200 });
    const copy = repeatEntry(original, TODAY, "Comida", "e2");
    expect(copy).toEqual({ ...original, id: "e2", date: TODAY, mealType: "Comida" });
  });
});
