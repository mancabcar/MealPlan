// Datos de "Diario: copiar un día completo a otra fecha" (docs/pm/54-copiar-diario/spec.md › Acceptance criteria).
// Compartidos por tests/unit/diary-copy.test.ts, tests/unit/CopyDaySheet.test.tsx y tests/e2e/diario-copiar-dia.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts); el día de origen es ayer, lunes 21.
// Lucía hace Desayuno, Comida, Merienda y Cena: la entrada de «Pre-entreno» es una franja que su perfil no muestra
// (el Diario enseña todas las del historial) y tiene que copiarse igualmente.
import type { MealEntry } from "@/lib/types";
import { foodEntry, recipeEntry } from "@/lib/diary";
import { GUISO, LENTEJAS, TODAY, YESTERDAY } from "./diario";
import { HUEVO } from "./foods";

export { TODAY, YESTERDAY, TOMORROW, LAST_MONTH } from "./diario";

const huevo = {
  foodId: `local:${HUEVO.id}`,
  name: HUEVO.name,
  per100: { kcal: HUEVO.kcal, protein: HUEVO.protein, carbs: HUEVO.carbs, fat: HUEVO.fat },
};

/** El lunes 21: cinco entradas de las tres clases (receta con raciones, alimento en unidades, personalizadas). */
export const ORIGEN_ENTRIES: MealEntry[] = [
  // Guiso 600 kcal × 0,5 = 300 kcal, «Guiso × 0,5»
  recipeEntry(GUISO, YESTERDAY, "Desayuno", { servings: 0.5, id: "o1" }),
  // 2 huevos = 120 g = 168 kcal, «Huevo 2 ud · 120 g»
  foodEntry(huevo, YESTERDAY, "Desayuno", { grams: 120, units: 2, id: "o2" }),
  // Lentejas 520 kcal, una ración (sin campo servings)
  recipeEntry(LENTEJAS, YESTERDAY, "Comida", { id: "o3" }),
  // Personalizada con fibra
  { id: "o4", date: YESTERDAY, mealType: "Cena", customName: "Ensalada de la casa", calories: 250, protein: 8, carbs: 20, fat: 14, fiber: 4.5 },
  // Personalizada sin fibra y en una franja que el perfil de Lucía no muestra
  { id: "o5", date: YESTERDAY, mealType: "Pre-entreno", customName: "Barrita de avena", calories: 190, protein: 5, carbs: 30, fat: 6 },
];

export const ORIGEN_COUNT = ORIGEN_ENTRIES.length; // 5
export const ORIGEN_KCAL = 300 + 168 + 520 + 250 + 190; // 1428

/** Hoy ya tiene dos entradas: copiar el lunes a hoy provoca el aviso de conflicto. */
export const DESTINO_ENTRIES: MealEntry[] = [
  { id: "d1", date: TODAY, mealType: "Desayuno", customName: "Tostadas con aguacate", calories: 290, protein: 8, carbs: 30, fat: 15 },
  { id: "d2", date: TODAY, mealType: "Comida", customName: "Ensalada mixta", calories: 210, protein: 6, carbs: 18, fat: 12 },
];
