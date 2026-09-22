// Borradores de formulario (texto tal como lo escribe el usuario) ↔ datos del perfil.
// Puro: lo comparten onboarding y Perfil.
import {
  LIMITS,
  fillPrescribed,
  macroMismatch,
  parseDecimal,
  validateBodyData,
  validatePrescribed,
  type FieldErrors,
} from "./nutrition";
import type { ActivityLevel, BodyData, Sex, UserProfile } from "./types";

const str = (n: number | undefined) => (n === undefined ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? undefined : parseDecimal(s));

// ---------------------------------------------------------------- datos corporales (R3)

export interface BodyDraft {
  sex: Sex | "";
  birthYear: string;
  heightCm: string;
  weightKg: string;
  activity: ActivityLevel | "";
}

export function bodyDraftFrom(b?: BodyData): BodyDraft {
  if (!b) return { sex: "", birthYear: "", heightCm: "", weightKg: "", activity: "" };
  return { sex: b.sex, birthYear: str(b.birthYear), heightCm: str(b.heightCm), weightKg: str(b.weightKg), activity: b.activity };
}

/** Errores solo de los campos ya escritos; `value` solo si todo está completo y es válido. */
export function parseBody(d: BodyDraft, now: Date = new Date()) {
  const heightCm = num(d.heightCm);
  const weightKg = num(d.weightKg);
  const birthYear = num(d.birthYear);
  const all = validateBodyData(
    { heightCm: heightCm ?? NaN, weightKg: weightKg ?? NaN, birthYear: birthYear ?? NaN },
    now,
  );
  const errors: FieldErrors<"heightCm" | "weightKg" | "birthYear"> = {};
  if (heightCm !== undefined && all.heightCm) errors.heightCm = all.heightCm;
  if (weightKg !== undefined && all.weightKg) errors.weightKg = all.weightKg;
  if (birthYear !== undefined && all.birthYear) errors.birthYear = all.birthYear;

  const valid = Object.keys(all).length === 0 && d.sex !== "" && d.activity !== "";
  const value: BodyData | undefined = valid
    ? { sex: d.sex as Sex, birthYear: birthYear!, heightCm: heightCm!, weightKg: weightKg!, activity: d.activity as ActivityLevel }
    : undefined;
  return { value, errors };
}

// ---------------------------------------------------------------- objetivos editables (R4)

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroDraft {
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

export const macroDraftFrom = (m: Macros): MacroDraft => ({
  kcal: str(m.kcal),
  protein: str(m.protein),
  carbs: str(m.carbs),
  fat: str(m.fat),
});

/** null si falta algo o las kcal están fuera de 800–6000. */
export function parseMacros(d: MacroDraft): Macros | null {
  const m = { kcal: num(d.kcal), protein: num(d.protein), carbs: num(d.carbs), fat: num(d.fat) };
  if (Object.values(m).some((v) => v === undefined || !Number.isFinite(v) || v < 0)) return null;
  const [min, max] = LIMITS.kcal;
  if (m.kcal! < min || m.kcal! > max) return null;
  return m as Macros;
}

// ---------------------------------------------------------------- plan del nutricionista (R5, R6)

export interface PrescribedDraft {
  kcal: string;
  isRange: boolean;
  protein: string;
  proteinMin: string;
  proteinMax: string;
  carbs: string;
  fat: string;
  weightKg: string;
}

export type PrescribedTargets = Pick<
  UserProfile,
  "calorieGoal" | "proteinGoal" | "proteinRange" | "carbsGoal" | "fatGoal" | "weightKg"
>;

export function prescribedDraftFrom(p?: Partial<UserProfile>): PrescribedDraft {
  return {
    kcal: str(p?.calorieGoal),
    isRange: !!p?.proteinRange,
    protein: p?.proteinRange ? "" : str(p?.proteinGoal),
    proteinMin: str(p?.proteinRange?.min),
    proteinMax: str(p?.proteinRange?.max),
    carbs: str(p?.carbsGoal),
    fat: str(p?.fatGoal),
    weightKg: str(p?.weightKg ?? p?.body?.weightKg),
  };
}

export function parsePrescribed(d: PrescribedDraft) {
  const kcal = num(d.kcal);
  const protein = num(d.protein);
  const proteinMin = num(d.proteinMin);
  const proteinMax = num(d.proteinMax);
  const carbs = num(d.carbs);
  const fat = num(d.fat);
  const weightKg = num(d.weightKg);

  const all = validatePrescribed({ kcal, protein, proteinMin, proteinMax, isRange: d.isRange });
  const [wMin, wMax] = LIMITS.weightKg;
  const weightError =
    weightKg !== undefined && !(Number.isFinite(weightKg) && weightKg >= wMin && weightKg <= wMax)
      ? "Entre 30 y 250 kg"
      : undefined;
  const badOptional = [carbs, fat].some((v) => v !== undefined && !Number.isFinite(v));

  // Se muestran solo los errores de lo ya escrito
  const errors: FieldErrors<"kcal" | "protein" | "proteinRange" | "weightKg"> = {};
  if (kcal !== undefined && all.kcal) errors.kcal = all.kcal;
  if (!d.isRange && protein !== undefined && all.protein) errors.protein = all.protein;
  if (d.isRange && proteinMin !== undefined && proteinMax !== undefined && all.proteinRange) {
    errors.proteinRange = all.proteinRange;
  }
  if (weightError) errors.weightKg = weightError;

  if (Object.keys(all).length > 0 || weightError || badOptional) return { errors };

  const proteinInput = d.isRange ? { min: proteinMin!, max: proteinMax! } : protein!;
  const filled = fillPrescribed({ kcal: kcal!, protein: proteinInput, carbs, fat, weightKg });
  const value: PrescribedTargets = {
    calorieGoal: kcal!,
    proteinGoal: d.isRange ? Math.round((proteinMin! + proteinMax!) / 2) : protein!,
    proteinRange: d.isRange ? { min: proteinMin!, max: proteinMax! } : undefined,
    carbsGoal: filled.carbs,
    fatGoal: filled.fat,
    weightKg,
  };
  const mismatch = macroMismatch(value.calorieGoal, value.proteinGoal, value.carbsGoal, value.fatGoal);
  return { errors, value, mismatch };
}
