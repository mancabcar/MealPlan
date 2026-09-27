// Datos de "Medias y adherencia en el Diario" (docs/pm/11-medias-adherencia/spec.md › Acceptance criteria).
// Compartidos por tests/unit/diaryStats.test.ts, tests/e2e/medias-adherencia.spec.ts y accessibility.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts): con la fecha de hoy, el periodo de
// 7 días es 15–21 sep y el de 30 días 23 ago–21 sep (R6: el día en curso nunca cuenta).
import type { MealEntry, UserProfile } from "@/lib/types";
import { lucia } from "./profiles";
import { entry } from "./diario";

export { TODAY, YESTERDAY, TOMORROW } from "./diario";

/** El perfil del spec: 2000 kcal y proteína en rango 130–160. */
export const statsProfile: UserProfile = {
  ...lucia,
  calorieGoal: 2000,
  proteinGoal: 145,
  proteinRange: { min: 130, max: 160 },
  carbsGoal: 230,
  fatGoal: 69,
};

/** Mismo perfil sin rango: proteína 140 ± 10 % (126–154). */
export const statsProfileNoRange: UserProfile = { ...statsProfile, proteinGoal: 140, proteinRange: undefined };

/**
 * Semana 15–21 sep con registros en 3 días (los otros 4 vacíos):
 * - 16 sep: 1800 kcal, P 135 → cumple (límite inferior de kcal).
 * - 18 sep: dos entradas, 1200 + 1000 = 2200 kcal, P 80 + 60 = 140 → cumple (límite superior).
 * - 20 sep: 2000 kcal, P 120 → no cumple (proteína por debajo del rango).
 * Medias: 2000 kcal, P 131,67 → 132, C 223,3 → 223, G 68,3 → 68. Adherencia: 2 de 3.
 */
export const WEEK_ENTRIES: MealEntry[] = [
  entry("2026-09-16", "Comida", { customName: "Día 16", calories: 1800, protein: 135, carbs: 200, fat: 60 }),
  entry("2026-09-18", "Comida", { customName: "Comida 18", calories: 1200, protein: 80, carbs: 120, fat: 40 }),
  entry("2026-09-18", "Cena", { customName: "Cena 18", calories: 1000, protein: 60, carbs: 110, fat: 35 }),
  entry("2026-09-20", "Comida", { customName: "Día 20", calories: 2000, protein: 120, carbs: 240, fat: 70 }),
];

/** Hoy (22 sep): no debe cambiar ni medias ni adherencia (R6). */
export const TODAY_ENTRY = entry("2026-09-22", "Comida", { customName: "Hoy", calories: 900, protein: 20, carbs: 90, fat: 40 });

/**
 * Antes de la semana, dentro de los 30 días (23 ago–21 sep):
 * - 10 sep: 2600 kcal, P 150 → no cumple (kcal por encima).
 * - 1 sep: 2000 kcal, P 150 → cumple.
 * Con 30 días: 5 días registrados, kcal (1800 + 2200 + 2000 + 2600 + 2000) / 5 = 2120, 3 de 5 cumplen.
 * Con la fecha del Diario en 14 sep (8–14 sep): solo el 10 → 2600 kcal, 0 de 1 día.
 */
export const MONTH_ENTRIES: MealEntry[] = [
  entry("2026-09-10", "Comida", { customName: "Día 10", calories: 2600, protein: 150, carbs: 300, fat: 90 }),
  entry("2026-09-01", "Comida", { customName: "Día 1", calories: 2000, protein: 150, carbs: 220, fat: 65 }),
];

/** Fuera de los 30 días (22 ago): nunca cuenta. */
export const TOO_OLD_ENTRY = entry("2026-08-22", "Comida", { customName: "Antiguo", calories: 5000, protein: 10, carbs: 10, fat: 10 });

export const ALL_ENTRIES: MealEntry[] = [...WEEK_ENTRIES, ...MONTH_ENTRIES, TODAY_ENTRY, TOO_OLD_ENTRY];
