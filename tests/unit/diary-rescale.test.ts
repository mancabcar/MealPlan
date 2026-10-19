// Spec: docs/pm/57-editar-gramos-diario/spec.md › R2, R3, R5, R7, R8 y Edge cases.
// Tech: tech.md › APIs / interfaces y State & edge cases. Contrato (src/lib/diary.ts, exports nombrados):
//   entryQuantity(entry) → { kind: "grams", grams } | { kind: "units", units, grams } | { kind: "servings", servings } | null
//   rescaleEntry(entry, { grams, units? } | { servings }) → MealEntry (kcal, P, H, G y fibra × nueva / vieja, sin redondear)
//   undoEdit(entries, { before, after }) → before si la entrada actual con esa id es igual campo a campo a after; si no, null
// Fallan hasta la tarea 1 del tech design.
import { describe, expect, it } from "vitest";
import { entryQuantity, rescaleEntry, undoEdit } from "@/lib/diary";
import type { MealEntry } from "@/lib/types";
import {
  ARROZ_ENTRY,
  GRAMS_NAN,
  GRAMS_ZERO,
  GUISO_ENTRY,
  HUEVO_ENTRY,
  NO_KCAL,
  SERVINGS_TEXT,
  SERVINGS_ZERO,
  UNITS_NAN,
  YOGUR_ENTRY,
} from "../fixtures/editar-cantidad";

describe("entryQuantity: qué se edita y en qué modo (R2, R5, R8)", () => {
  it("R2: alimento en gramos → gramos", () => {
    expect(entryQuantity(ARROZ_ENTRY)).toEqual({ kind: "grams", grams: 150 });
  });

  it("R2: alimento en unidades → unidades, con sus gramos", () => {
    expect(entryQuantity(HUEVO_ENTRY)).toEqual({ kind: "units", units: 2, grams: 120 });
  });

  it("R8: receta sin servings → 1 ración", () => {
    expect(entryQuantity(GUISO_ENTRY)).toEqual({ kind: "servings", servings: 1 });
  });

  it("R8: receta con 0,5 raciones → 0,5", () => {
    expect(entryQuantity({ ...GUISO_ENTRY, servings: 0.5 })).toEqual({ kind: "servings", servings: 0.5 });
  });

  it("R5: personalizada → no editable", () => {
    expect(entryQuantity(YOGUR_ENTRY)).toBeNull();
  });

  it.each([
    ["gramos NaN", GRAMS_NAN],
    ["0 g", GRAMS_ZERO],
    ["servings no numérico", SERVINGS_TEXT],
    ["0 raciones", SERVINGS_ZERO],
  ])("R5: %s → no editable", (_, entry) => {
    expect(entryQuantity(entry)).toBeNull();
  });

  it("Edge: units no válido con gramos válidos → se edita en gramos", () => {
    expect(entryQuantity(UNITS_NAN)).toEqual({ kind: "grams", grams: 80 });
  });
});

describe("rescaleEntry: macros y fibra en proporción (R3, R8)", () => {
  it("R3: arroz de 150 a 100 g → 130 kcal, 2,7 P, 28 H, 0,3 G y fibra 2 × 100/150", () => {
    const e = rescaleEntry(ARROZ_ENTRY, { grams: 100 });
    expect(e.grams).toBe(100);
    expect(e.calories).toBeCloseTo(130, 9);
    expect(e.protein).toBeCloseTo(2.7, 9);
    expect(e.carbs).toBeCloseTo(28, 9);
    expect(e.fat).toBeCloseTo(0.3, 9);
    expect(e.fiber).toBeCloseTo(4 / 3, 9);
    expect(e.units).toBeUndefined();
  });

  it("R3: no redondea (de 150 a 77 g)", () => {
    expect(rescaleEntry(ARROZ_ENTRY, { grams: 77 }).calories).toBeCloseTo((195 * 77) / 150, 9);
  });

  it("R2: huevo de 2 a 3 ud (180 g) → 252 kcal y units 3", () => {
    const e = rescaleEntry(HUEVO_ENTRY, { grams: 180, units: 3 });
    expect(e.units).toBe(3);
    expect(e.grams).toBe(180);
    expect(e.calories).toBeCloseTo(252, 9);
    expect(e.protein).toBeCloseTo(22.5, 9);
    expect(e.fat).toBeCloseTo(HUEVO_ENTRY.fat * 1.5, 9);
  });

  it("Edge: units no válido editado en gramos → se guardan los gramos y desaparece units", () => {
    const e = rescaleEntry(UNITS_NAN, { grams: 160 });
    expect(e.grams).toBe(160);
    expect("units" in e).toBe(false);
    expect(e.calories).toBeCloseTo(224, 9);
  });

  it("R8: Guiso de 1 a 0,5 raciones → 300 / 20 / 30 / 10 y servings 0,5", () => {
    const e = rescaleEntry(GUISO_ENTRY, { servings: 0.5 });
    expect(e.servings).toBe(0.5);
    expect([e.calories, e.protein, e.carbs, e.fat]).toEqual([300, 20, 30, 10]);
  });

  it("R8: volver a 1 ración quita servings, como una receta registrada a 1", () => {
    const half = rescaleEntry(GUISO_ENTRY, { servings: 0.5 });
    const back = rescaleEntry(half, { servings: 1 });
    expect("servings" in back).toBe(false);
    expect(back.calories).toBeCloseTo(600, 9);
  });

  it("R3: conserva id, fecha, franja, nombre y alimento de origen", () => {
    const e = rescaleEntry(ARROZ_ENTRY, { grams: 100 });
    expect(e).toMatchObject({
      id: ARROZ_ENTRY.id,
      date: ARROZ_ENTRY.date,
      mealType: ARROZ_ENTRY.mealType,
      customName: ARROZ_ENTRY.customName,
      foodId: ARROZ_ENTRY.foodId,
    });
    const g = rescaleEntry(GUISO_ENTRY, { servings: 2 });
    expect(g).toMatchObject({ id: GUISO_ENTRY.id, recipeId: GUISO_ENTRY.recipeId, mealType: "Cena" });
  });

  it("R3: sin dato de fibra sigue sin dato (no pasa a 0)", () => {
    const sinFibra: MealEntry = { ...ARROZ_ENTRY };
    delete sinFibra.fiber;
    expect("fiber" in rescaleEntry(sinFibra, { grams: 100 })).toBe(false);
    expect("fiber" in rescaleEntry(GUISO_ENTRY, { servings: 0.5 })).toBe(false);
  });

  it("Edge: kcal ausentes en un backup siguen sin dato tras escalar (no 0)", () => {
    const e = rescaleEntry(NO_KCAL, { grams: 100 });
    expect(e.calories === 0).toBe(false);
    expect(Number.isFinite(e.calories)).toBe(false);
  });

  it("no modifica la entrada original", () => {
    const copy = structuredClone(ARROZ_ENTRY);
    rescaleEntry(ARROZ_ENTRY, { grams: 100 });
    expect(ARROZ_ENTRY).toEqual(copy);
  });
});

describe("undoEdit: Deshacer nunca pisa un cambio más nuevo (R7)", () => {
  // Se calculan dentro de cada test: así cada uno falla por su cuenta mientras rescaleEntry no exista
  const setup = () => {
    const after = rescaleEntry(ARROZ_ENTRY, { grams: 100 });
    return { after, edit: { before: ARROZ_ENTRY, after } };
  };

  it("R7: la entrada sigue como se guardó → devuelve la anterior", () => {
    const { after, edit } = setup();
    expect(undoEdit([HUEVO_ENTRY, after], edit)).toEqual(ARROZ_ENTRY);
  });

  it("R7: la entrada cambió después (otra edición o sync) → null", () => {
    const { after, edit } = setup();
    const newer = rescaleEntry(after, { grams: 120 });
    expect(undoEdit([HUEVO_ENTRY, newer], edit)).toBeNull();
  });

  it("R7: la entrada ya no existe → null", () => {
    const { edit } = setup();
    expect(undoEdit([HUEVO_ENTRY], edit)).toBeNull();
  });

  it("R7: un campo añadido después también cuenta como cambio → null", () => {
    const { after, edit } = setup();
    expect(undoEdit([{ ...after, fiber: 9 }], edit)).toBeNull();
  });
});
