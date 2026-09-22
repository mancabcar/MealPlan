// Objetivos diarios (spec R3–R6). Funciones puras: sin React ni localStorage.
import type { ActivityLevel, Goal, Sex } from "./types";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  poco: 1.2,
  algo: 1.375,
  bastante: 1.55,
  mucho: 1.725,
};

/** Mifflin-St Jeor: +5 hombre, −161 mujer; "Prefiero no decirlo" usa la media. */
const SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 };
const KCAL_FLOOR: Record<Sex, number> = { male: 1500, female: 1200, unspecified: 1350 };
const GOAL_ADJUSTMENT_PCT: Record<Goal, number> = { lose: -15, maintain: 0, gain: 10 };
export const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 1.8, maintain: 1.6, gain: 2.0 };
const FAT_G_PER_KG = 0.9;
/** Ruta del nutricionista sin peso: la grasa es este % de las kcal. */
const FAT_SHARE_WITHOUT_WEIGHT = 0.25;

export const LIMITS = {
  heightCm: [120, 230],
  weightKg: [30, 250],
  age: [14, 100],
  kcal: [800, 6000],
} as const;

export interface TargetInput {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}

/** Valores redondeados para "¿De dónde salen estas cifras?". */
export interface Derivation {
  bmr: number;
  factor: number;
  tdee: number;
  adjustmentPct: number; // -15, 0 o 10
  /** Presente si se aplicó el mínimo de 1200 (Mujer) / 1500 (Hombre) / 1350 (sin especificar). */
  floorApplied?: number;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  derivation: Derivation;
}

export interface PrescribedInput {
  kcal: number;
  protein: number | { min: number; max: number };
  carbs?: number;
  fat?: number;
  weightKg?: number;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Carbos = lo que queda de las kcal tras P y F (ya redondeados, para que cuadre con lo mostrado). */
const carbsFrom = (kcal: number, protein: number, fat: number) => Math.round((kcal - 4 * protein - 9 * fat) / 4);

const inRange = (v: number, [min, max]: readonly [number, number]) => Number.isFinite(v) && v >= min && v <= max;

export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear;
}

export function calculateTargets(input: TargetInput, now: Date = new Date()): Targets {
  const { sex, birthYear, heightCm, weightKg, activity, goal } = input;
  const age = ageFromBirthYear(birthYear, now);
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANT[sex];
  const factor = ACTIVITY_FACTORS[activity];
  const tdee = bmr * factor;
  const adjustmentPct = GOAL_ADJUSTMENT_PCT[goal];

  let kcal = Math.round((tdee * (1 + adjustmentPct / 100)) / 50) * 50;
  let floorApplied: number | undefined;
  if (kcal < KCAL_FLOOR[sex]) {
    kcal = KCAL_FLOOR[sex];
    floorApplied = kcal;
  }

  const protein = Math.round(PROTEIN_G_PER_KG[goal] * weightKg);
  const fat = Math.round(FAT_G_PER_KG * weightKg);
  return {
    kcal,
    protein,
    carbs: carbsFrom(kcal, protein, fat),
    fat,
    derivation: { bmr: Math.round(bmr), factor, tdee: Math.round(tdee), adjustmentPct, floorApplied },
  };
}

/** Punto medio si es rango; la IA y los cálculos apuntan ahí. */
export function proteinTarget(protein: number | { min: number; max: number }): number {
  return typeof protein === "number" ? protein : Math.round((protein.min + protein.max) / 2);
}

/** Rellena carbos y/o grasas vacíos a partir de las calorías restantes. */
export function fillPrescribed(input: PrescribedInput): { carbs: number; fat: number } {
  const { kcal, carbs, weightKg } = input;
  const protein = proteinTarget(input.protein);
  const fat =
    input.fat ?? (weightKg ? Math.round(FAT_G_PER_KG * weightKg) : Math.round((FAT_SHARE_WITHOUT_WEIGHT * kcal) / 9));
  return { carbs: carbs ?? carbsFrom(kcal, protein, fat), fat };
}

/** Diferencia relativa entre kcal y 4·P + 4·C + 9·F. La UI avisa (sin bloquear) si > 0.10. */
export function macroMismatch(kcal: number, protein: number, carbs: number, fat: number): number {
  if (kcal <= 0) return 0;
  return Math.abs(4 * protein + 4 * carbs + 9 * fat - kcal) / kcal;
}

/** Acepta coma o punto decimal ("62,0" = 62). NaN si no es un número. */
export function parseDecimal(value: string): number {
  const v = value.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

/** R3: errores por campo; objeto vacío = válido. */
export function validateBodyData(
  input: { heightCm: number; weightKg: number; birthYear: number },
  now: Date = new Date(),
): FieldErrors<"heightCm" | "weightKg" | "birthYear"> {
  const errors: FieldErrors<"heightCm" | "weightKg" | "birthYear"> = {};
  if (!inRange(input.heightCm, LIMITS.heightCm)) errors.heightCm = "Entre 120 y 230 cm";
  if (!inRange(input.weightKg, LIMITS.weightKg)) errors.weightKg = "Entre 30 y 250 kg";
  if (!Number.isFinite(input.birthYear) || !inRange(ageFromBirthYear(input.birthYear, now), LIMITS.age)) {
    errors.birthYear = "Debes tener entre 14 y 100 años";
  }
  return errors;
}

/** R5: kcal 800–6000; con rango, min <= max. */
export function validatePrescribed(input: {
  kcal?: number;
  protein?: number;
  proteinMin?: number;
  proteinMax?: number;
  isRange: boolean;
}): FieldErrors<"kcal" | "protein" | "proteinRange"> {
  const errors: FieldErrors<"kcal" | "protein" | "proteinRange"> = {};
  if (input.kcal === undefined || !inRange(input.kcal, LIMITS.kcal)) errors.kcal = "Entre 800 y 6000 kcal";
  if (input.isRange) {
    const { proteinMin: min, proteinMax: max } = input;
    if (!(min && max && min > 0 && max > 0)) errors.proteinRange = "Indica la proteína mínima y máxima";
    else if (min > max) errors.proteinRange = "La mínima no puede ser mayor que la máxima";
  } else if (!(input.protein && input.protein > 0)) {
    errors.protein = "Indica los gramos de proteína";
  }
  return errors;
}
