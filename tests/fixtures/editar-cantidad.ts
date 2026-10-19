// Datos de "Diario: editar la cantidad de una entrada ya registrada" (docs/pm/57-editar-gramos-diario/spec.md).
// Compartidos por tests/unit/diary-rescale.test.ts, tests/unit/DiaryEntryRow.test.tsx, tests/unit/store-entries.test.tsx
// y tests/e2e/diario-editar-cantidad.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). Lucía hace Desayuno, Comida, Merienda y Cena.
// Alimentos de tests/fixtures/foods.ts y receta de tests/fixtures/diario.ts; la fibra del arroz se pone a mano.
import type { MealEntry } from "@/lib/types";
import { foodEntry, recipeEntry } from "@/lib/diary";
import { GUISO, TODAY } from "./diario";
import { ARROZ_COCIDO, HUEVO } from "./foods";

export { GUISO, TODAY, YESTERDAY } from "./diario";

const per100 = (f: typeof ARROZ_COCIDO) => ({ kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat });

/** Escenario 1: «Arroz blanco, cocido 150 g» = 195 kcal, 4,05 P, 42 C, 0,45 G y 2 g de fibra. A 100 g: 130 / 2,7 / 28 / 0,3, fibra 1,33. */
export const ARROZ_ENTRY: MealEntry = {
  ...foodEntry({ foodId: `local:${ARROZ_COCIDO.id}`, name: ARROZ_COCIDO.name, per100: per100(ARROZ_COCIDO) }, TODAY, "Comida", {
    grams: 150,
    id: "e-arroz",
  }),
  fiber: 2,
};

/** Escenario 2: «Huevo 2 ud · 120 g» = 168 kcal, sin fibra. A 3 ud: 180 g, 252 kcal, 22,5 P, 1,26 C, 17,64 G. */
export const HUEVO_ENTRY: MealEntry = foodEntry(
  { foodId: `local:${HUEVO.id}`, name: HUEVO.name, per100: per100(HUEVO) },
  TODAY,
  "Desayuno",
  { grams: 120, units: 2, id: "e-huevo" },
);

/** Escenario 3: Guiso a 1 ración (sin campo servings) = 600 / 40 / 60 / 20. A 0,5: 300 / 20 / 30 / 10 y «× 0,5». */
export const GUISO_ENTRY: MealEntry = recipeEntry(GUISO, TODAY, "Cena", { id: "e-guiso" });

/** R5: personalizada, no editable. */
export const YOGUR_ENTRY: MealEntry = {
  id: "e-yogur",
  date: TODAY,
  mealType: "Merienda",
  customName: "Yogur con nueces",
  calories: 220,
  protein: 10,
  carbs: 12,
  fat: 14,
};

export const DAY_ENTRIES: MealEntry[] = [HUEVO_ENTRY, ARROZ_ENTRY, YOGUR_ENTRY, GUISO_ENTRY];
export const DAY_KCAL = 168 + 195 + 220 + 600; // 1183

// ---------------------------------------------------------------------------
// Datos raros (copias de seguridad, ediciones a mano): tech.md › State & edge cases.

/** Alimento con gramos NaN: no editable. */
export const GRAMS_NAN: MealEntry = { ...ARROZ_ENTRY, id: "r-grams-nan", grams: NaN };
/** Alimento con 0 g: no editable. */
export const GRAMS_ZERO: MealEntry = { ...ARROZ_ENTRY, id: "r-grams-zero", grams: 0 };
/** Receta con servings no numérico: no editable. */
export const SERVINGS_TEXT: MealEntry = { ...GUISO_ENTRY, id: "r-servings-text", servings: "abc" as unknown as number };
/** Receta con servings 0: no editable. */
export const SERVINGS_ZERO: MealEntry = { ...GUISO_ENTRY, id: "r-servings-zero", servings: 0 };
/** Alimento con units inválido y 80 g válidos: se edita en gramos. */
export const UNITS_NAN: MealEntry = { ...HUEVO_ENTRY, id: "r-units-nan", grams: 80, units: NaN, calories: 112 };
/** Alimento de un backup sin kcal: siguen sin dato tras escalar. */
export const NO_KCAL: MealEntry = { ...ARROZ_ENTRY, id: "r-no-kcal", calories: undefined as unknown as number };
