// Objetivos diarios (spec R3–R6). Funciones puras: sin React ni localStorage.
// STUB: el contrato lo fija tests/unit/nutrition.test.ts; la implementación llega con dev-code.
import type { ActivityLevel, Goal, Sex } from "./types";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  poco: 1.2,
  algo: 1.375,
  bastante: 1.55,
  mucho: 1.725,
};

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
  /** Presente si se aplicó el mínimo de 1200 (Mujer) / 1500 (Hombre). */
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

function notImplemented(fn: string): never {
  throw new Error(`${fn}: not implemented`);
}

export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  void birthYear;
  void now;
  return notImplemented("ageFromBirthYear");
}

export function calculateTargets(input: TargetInput, now: Date = new Date()): Targets {
  void input;
  void now;
  return notImplemented("calculateTargets");
}

/** Rellena carbos y/o grasas vacíos a partir de las calorías restantes. */
export function fillPrescribed(input: PrescribedInput): { carbs: number; fat: number } {
  void input;
  return notImplemented("fillPrescribed");
}

/** Diferencia relativa entre kcal y 4·P + 4·C + 9·F. La UI avisa (sin bloquear) si > 0.10. */
export function macroMismatch(kcal: number, protein: number, carbs: number, fat: number): number {
  void [kcal, protein, carbs, fat];
  return notImplemented("macroMismatch");
}

/** Acepta coma o punto decimal ("62,0" = 62). NaN si no es un número. */
export function parseDecimal(value: string): number {
  void value;
  return notImplemented("parseDecimal");
}

/** R3: errores por campo; objeto vacío = válido. */
export function validateBodyData(
  input: { heightCm: number; weightKg: number; birthYear: number },
  now: Date = new Date(),
): FieldErrors<"heightCm" | "weightKg" | "birthYear"> {
  void input;
  void now;
  return notImplemented("validateBodyData");
}

/** R5: kcal 800–6000; con rango, min <= max. */
export function validatePrescribed(input: {
  kcal?: number;
  protein?: number;
  proteinMin?: number;
  proteinMax?: number;
  isRange: boolean;
}): FieldErrors<"kcal" | "protein" | "proteinRange"> {
  void input;
  return notImplemented("validatePrescribed");
}
