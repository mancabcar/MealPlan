// Fibra (docs/pm/23-agua-fibra-micros/tech.md › APIs). Puro: sin React ni store.
// La fibra es un dato opcional: ausente = «sin dato», nunca 0. Un 0 escrito o heredado de la fuente sí es un dato.
import { parseDecimal } from "./nutrition";
import type { MealEntry, Recipe, UserProfile } from "./types";

/** Objetivo de fibra de quien no ha guardado uno (g/día). */
export const FIBER_GOAL_DEFAULT = 38;
export const FIBER_GOAL_MIN = 10;
export const FIBER_GOAL_MAX = 100;
/** Tope de la fibra de una receta o entrada (g). */
export const FIBER_MAX = 200;
export const FIBER_ERROR = "Entre 0 y 200 g";
export const FIBER_GOAL_ERROR = "Un número entero entre 10 y 100 g";

/** Un objetivo que no es un entero de 10 a 100 (p. ej. de una copia editada a mano) vuelve al de por defecto (#123). */
export function fiberGoal(profile: Pick<UserProfile, "fiberGoal">): number {
  const g = profile.fiberGoal;
  return typeof g === "number" && Number.isInteger(g) && g >= FIBER_GOAL_MIN && g <= FIBER_GOAL_MAX ? g : FIBER_GOAL_DEFAULT;
}

/** Fibra de una receta cargada de fuera: si no es un número de 0 a 200 g se quita y queda «sin dato» (#123). */
export function sanitizeRecipeFiber<T extends { fiber?: number }>(recipe: T): T {
  const f = recipe.fiber;
  if (f === undefined || (typeof f === "number" && Number.isFinite(f) && f >= 0 && f <= FIBER_MAX)) return recipe;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fiber: _bad, ...rest } = recipe;
  return rest as T;
}

/** «37», «100» → número; fuera de 10–100, con decimales o no numérico → null. */
export function parseFiberGoal(text: string): number | null {
  const v = parseDecimal(text);
  return Number.isInteger(v) && v >= FIBER_GOAL_MIN && v <= FIBER_GOAL_MAX ? v : null;
}

/** Campo opcional de fibra (g): vacío → undefined (sin dato); 0–200 con coma o punto → número; lo demás → null. */
export function parseFiber(text: string): number | undefined | null {
  if (text.trim() === "") return undefined;
  const v = parseDecimal(text);
  return Number.isFinite(v) && v >= 0 && v <= FIBER_MAX ? v : null;
}

/**
 * Fibra de una entrada: la suya; si falta y es de receta (anterior a esta entrega), la de la receta × raciones.
 * undefined = sin dato.
 */
export function entryFiber(entry: MealEntry, recipes: Recipe[]): number | undefined {
  if (typeof entry.fiber === "number" && Number.isFinite(entry.fiber)) return entry.fiber;
  if (!entry.recipeId) return undefined;
  const fiber = recipes.find((r) => r.id === entry.recipeId)?.fiber;
  return typeof fiber === "number" && Number.isFinite(fiber) ? fiber * (entry.servings ?? 1) : undefined;
}

export interface DayFiber {
  /** Suma de las entradas con dato. */
  total: number;
  /** Entradas sin dato de fibra. */
  missing: number;
  /** Entradas del día. */
  count: number;
}

export function dayFiber(entries: MealEntry[], recipes: Recipe[]): DayFiber {
  let total = 0;
  let missing = 0;
  for (const e of entries) {
    const f = entryFiber(e, recipes);
    if (f === undefined) missing++;
    else total += f;
  }
  return { total, missing, count: entries.length };
}

/** Fibra de `grams` gramos de un alimento con `fiberPer100` g por 100 g, sin redondear. undefined = sin dato. */
export function scaleFiber(fiberPer100: number | undefined, grams: number): number | undefined {
  return fiberPer100 === undefined ? undefined : (fiberPer100 * grams) / 100;
}

/** 1 decimal con coma, sin «,0»: 28 → «28», 9.5 → «9,5», 3.75 → «3,8». */
export function formatFiber(n: number): string {
  return n.toFixed(1).replace(/,?\.0$/, "").replace(".", ",");
}
