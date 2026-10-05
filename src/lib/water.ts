// Agua (docs/pm/23-agua-fibra-micros/tech.md › APIs). Puro: sin React ni store.
// El consumo se guarda en ml por día (`Record<YYYY-MM-DD, ml>`): cambiar el tamaño del vaso no altera lo ya bebido.
import type { UserProfile } from "./types";

export const WATER_GOAL_DEFAULT_ML = 2000;
export const WATER_GOAL_MIN_ML = 500;
/** Tope diario de lo registrado (6 L) y objetivo máximo. */
export const WATER_MAX_ML = 6000;
export const GLASS_DEFAULT_ML = 250;
export const GLASS_OPTIONS = [200, 250, 330, 500] as const;
export const WATER_GOAL_ERROR = "Entre 0,5 y 6 L, con hasta 2 decimales";

export function waterGoalMl(profile: Pick<UserProfile, "waterGoalMl">): number {
  const g = profile.waterGoalMl;
  return typeof g === "number" && Number.isFinite(g) && g >= WATER_GOAL_MIN_ML && g <= WATER_MAX_ML ? g : WATER_GOAL_DEFAULT_ML;
}

/** Un tamaño que no es una de las cuatro opciones vuelve al de por defecto. */
export function glassMl(profile: Pick<UserProfile, "glassMl">): number {
  const g = profile.glassMl;
  return GLASS_OPTIONS.some((o) => o === g) ? (g as number) : GLASS_DEFAULT_ML;
}

/** Vasos del objetivo: hacia arriba (2 L con vasos de 330 ml = 7). */
export const glassesFor = (goalMl: number, glass: number) => Math.ceil(goalMl / glass);

/** Vasos llenos: hacia abajo. */
export const glassesDrunk = (ml: number, glass: number) => Math.floor(ml / glass);

export const addGlass = (ml: number, glass: number) => Math.min(ml + glass, WATER_MAX_ML);

export const removeGlass = (ml: number, glass: number) => Math.max(ml - glass, 0);

/** Tocar el vaso `n` fija el total en n vasos; si ya hay exactamente n llenos, queda en n − 1. */
export function tapGlass(ml: number, glass: number, n: number): number {
  const target = glassesDrunk(ml, glass) === n ? n - 1 : n;
  return Math.min(target * glass, WATER_MAX_ML);
}

export const goalReached = (ml: number, goalMl: number) => ml >= goalMl;

/** Litros que escribe el usuario («2», «1,5», «1.25») → ml. null si no vale: fuera de 0,5–6 L, más de 2 decimales o texto. */
export function parseWaterGoal(text: string): number | null {
  const t = text.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return null;
  const ml = Math.round(Number(t.replace(",", ".")) * 1000);
  return ml >= WATER_GOAL_MIN_ML && ml <= WATER_MAX_ML ? ml : null;
}

/** Litros con coma, hasta 2 decimales y sin ceros sobrantes: 1250 → «1,25», 2000 → «2». */
export function formatLiters(ml: number): string {
  return String(Math.round(ml / 10) / 100).replace(".", ",");
}

/** Copia con el día fijado; 0 ml quita la clave. */
export function withWater(water: Record<string, number>, date: string, ml: number): Record<string, number> {
  const { [date]: _old, ...rest } = water;
  void _old;
  return ml > 0 ? { ...rest, [date]: ml } : rest;
}

/** Lo guardado puede venir de una copia o de otro dispositivo: solo días YYYY-MM-DD con ml > 0, recortados a 6 L. */
export function sanitizeWater(raw: unknown): Record<string, number> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [date, ml] of Object.entries(raw)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && typeof ml === "number" && Number.isFinite(ml) && ml > 0) out[date] = Math.min(ml, WATER_MAX_ML);
  }
  return out;
}
