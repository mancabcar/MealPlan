// Mediciones de docs/pm/9-historial-medidas (spec.md › Acceptance criteria y Edge cases).
// Las tres tomas de la nutricionista salen de docs/referencia/evolucion-agosto-2026.md, con el "9,7" truncado de la
// pierna derecha del 31/07 corregido a 49,7 (escenario 3 de la spec). Compartidas por tests/unit/measurements.test.ts,
// tests/unit/store.test.tsx, tests/unit/backup.test.ts y tests/e2e/evolucion.spec.ts.
//
// "Hoy" en e2e es el martes 2026-09-22 (tests/e2e/helpers.ts › TODAY).
import type { Measurement, MetricKey } from "@/lib/types";

export const TODAY = "2026-09-22";

export const measurement = (
  id: string,
  date: string,
  values: Partial<Record<MetricKey, number>>,
  source: Measurement["source"] = "home",
  savedAt = `${date}T08:00:00.000Z`,
): Measurement => ({ id, date, source, values, savedAt });

export const NUTRI_MAY = measurement(
  "nutri-may",
  "2026-05-05",
  {
    weightKg: 85.0, muscleKg: 34.3, fatKg: 24.5, bmi: 27.1, fatPct: 28.8, visceralFat: 10,
    bicepsL: 34.6, bicepsR: 34.0, waist: 99.4, hip: 101.4, legL: 53.9, legR: 54.6, calfL: 40.6, calfR: 40.8,
    chestBack: 99.4, glutes: 93.6,
    skinBiceps: 12, skinTriceps: 9.5, skinAbdominal: 26, skinSuprailiac: 21, skinQuadriceps: 13.0, skinCalf: 5.5,
  },
  "nutritionist",
);

export const NUTRI_JUNE = measurement(
  "nutri-jun",
  "2026-06-19",
  {
    weightKg: 80.7, muscleKg: 34.7, fatKg: 19.0, bmi: 25.5, fatPct: 23.8, visceralFat: 8,
    bicepsL: 31.9, bicepsR: 31.3, waist: 93.0, hip: 96.4, legL: 52, legR: 50.4, calfL: 36.2, calfR: 38.2,
    chestBack: 95.6, glutes: 92.1,
    skinBiceps: 6.5, skinTriceps: 10.0, skinAbdominal: 21.5, skinSuprailiac: 19, skinQuadriceps: 12.0, skinCalf: 5,
  },
  "nutritionist",
);

export const NUTRI_JULY = measurement(
  "nutri-jul",
  "2026-07-31",
  {
    weightKg: 76.0, muscleKg: 26.9, fatKg: 27.7, bmi: 29.3, fatPct: 36.4, visceralFat: 13,
    bicepsL: 30.1, bicepsR: 30.1, waist: 84.5, hip: 87.6, legL: 49.6, legR: 49.7, calfL: 35.1, calfR: 37.1,
    chestBack: 93.5, glutes: 93.6,
    skinBiceps: 4.5, skinTriceps: 8.5, skinAbdominal: 18.5, skinSuprailiac: 13, skinQuadriceps: 8.0, skinCalf: 3.5,
  },
  "nutritionist",
);

export const NUTRI_REPORTS = [NUTRI_MAY, NUTRI_JUNE, NUTRI_JULY];

/** Suma de pliegues de cada toma, según el informe (87, 74, 56). */
export const SKIN_SUMS = { may: 87, june: 74, july: 56 };

/**
 * La toma del 31/07 tal como se teclea copiando el informe (coma decimal, ceros a la derecha).
 * Clave → texto del campo.
 */
export const NUTRI_JULY_TYPED: Record<MetricKey, string> = {
  weightKg: "76,0", muscleKg: "26,9", fatKg: "27,7", fatPct: "36,4", bmi: "29,3", visceralFat: "13",
  bicepsL: "30,1", bicepsR: "30,1", waist: "84,5", hip: "87,6", legL: "49,6", legR: "49,7", calfL: "35,1", calfR: "37,1",
  chestBack: "93,5", glutes: "93,6",
  skinBiceps: "4,5", skinTriceps: "8,5", skinAbdominal: "18,5", skinSuprailiac: "13", skinQuadriceps: "8,0", skinCalf: "3,5",
};

/**
 * Pesadas en casa de agosto y septiembre (hasta hoy, 22/09).
 * Tendencia (media de los 7 días anteriores, ese día incluido): el 23/08 = 76,1; el 22/09 = (75,1 + 74,9 + 75,0) / 3 = 75,0.
 * Cambio en 30 días a 22/09: 75,0 − 76,1 = −1,1 kg.
 */
export const HOME_WEIGHTS: Measurement[] = [
  measurement("home-0823", "2026-08-23", { weightKg: 76.1 }),
  measurement("home-0830", "2026-08-30", { weightKg: 75.8 }),
  measurement("home-0906", "2026-09-06", { weightKg: 75.7 }),
  measurement("home-0913", "2026-09-13", { weightKg: 75.3 }),
  measurement("home-0918", "2026-09-18", { weightKg: 75.1 }),
  measurement("home-0920", "2026-09-20", { weightKg: 74.9 }),
  measurement("home-0922", "2026-09-22", { weightKg: 75.0 }),
];

/** Etiqueta de cada campo del formulario (tech.md › UI test contract): el nombre accesible exacto. */
export const FIELD_LABELS: Record<MetricKey, string> = {
  weightKg: "Peso (kg)",
  muscleKg: "Masa muscular (kg)",
  fatKg: "Grasa corporal (kg)",
  fatPct: "% grasa",
  bmi: "IMC",
  visceralFat: "Grasa visceral",
  bicepsL: "Bíceps izq. (cm)",
  bicepsR: "Bíceps der. (cm)",
  waist: "Cintura (cm)",
  hip: "Cadera (cm)",
  legL: "Pierna izq. (cm)",
  legR: "Pierna der. (cm)",
  calfL: "Gemelo izq. (cm)",
  calfR: "Gemelo der. (cm)",
  chestBack: "Pecho-espalda (cm)",
  glutes: "Glúteos (cm)",
  skinBiceps: "Pliegue bicipital (mm)",
  skinTriceps: "Pliegue tricipital (mm)",
  skinAbdominal: "Pliegue abdominal (mm)",
  skinSuprailiac: "Pliegue suprailíaco (mm)",
  skinQuadriceps: "Pliegue cuadricipital (mm)",
  skinCalf: "Pliegue gemelo (mm)",
};
