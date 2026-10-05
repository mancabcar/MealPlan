// Registro de los datos de cada usuario (mp_<userId>_<clave>) y de cómo se cargan. Lo usan AppProvider al montar y
// la importación de copias (backup.ts), así una copia pasa exactamente por las mismas migraciones (backup-datos R7).
import seedData from "@/data/recipes.json";
import { sanitizeMeasurements } from "./measurements";
import { migrateEntries, migrateProfile, migrateWeekPlan, RETIRED_RECIPE_IDS } from "./migrate";
import { sanitizeWater } from "./water";
import { EMPTY as EMPTY_SHOPPING, loadShoppingState, type ShoppingState } from "./shopping/state";
import type { MealEntry, Measurement, PantryItem, Recipe, UserProfile, WeekPlan } from "./types";

export const USER_DATA_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping", "measurements", "favorites", "water"] as const;
export type UserDataKey = (typeof USER_DATA_KEYS)[number];

export interface UserData {
  profile: UserProfile | null;
  recipes: Recipe[];
  entries: MealEntry[];
  pantry: PantryItem[];
  weekplan: WeekPlan;
  shopping: ShoppingState;
  measurements: Measurement[];
  /** Ids de las recetas favoritas (docs/pm/20-recetas-filtros), sin duplicados. */
  favorites: string[];
  /** Agua bebida por día en ml, clave YYYY-MM-DD (docs/pm/23-agua-fibra-micros). */
  water: Record<string, number>;
}

export const EMPTY_USER_DATA: UserData = {
  profile: null,
  recipes: [],
  entries: [],
  pantry: [],
  weekplan: {},
  shopping: EMPTY_SHOPPING,
  measurements: [],
  favorites: [],
  water: {},
};

export interface LoadOptions<T> {
  /** Valor si no hay nada guardado o no se puede leer. */
  fallback: T;
  /** Transforma lo guardado (migraciones, siembra). Debe ser idempotente. */
  upgrade: (raw: unknown) => T;
  /** Guarda el valor original en <clave>_v1_backup antes de sobrescribirlo. */
  backup?: boolean;
}

/** Siembra idempotente: quita las recetas semilla retiradas, añade las del JSON cuyo id falte y rellena la fibra (#23) de las semilla guardadas sin ella. */
export function withSeedRecipes(raw: unknown): Recipe[] {
  const saved = (raw as Recipe[] | null) ?? [];
  const stored = saved.some((r) => Object.hasOwn(RETIRED_RECIPE_IDS, r.id))
    ? saved.filter((r) => !Object.hasOwn(RETIRED_RECIPE_IDS, r.id))
    : saved;
  // Quien ya tenía las semilla guardadas antes de que el catálogo trajera fibra no las recibiría con la siembra por id (#23, R4)
  const seedFiber = new Map((seedData.recipes as Recipe[]).flatMap((r) => (r.fiber === undefined ? [] : [[r.id, r.fiber] as const])));
  const needsFiber = (r: Recipe) => r.fiber === undefined && seedFiber.has(r.id);
  const filled = stored.some(needsFiber) ? stored.map((r) => (needsFiber(r) ? { ...r, fiber: seedFiber.get(r.id) } : r)) : stored;
  const existing = new Set(filled.map((r) => r.id));
  const missing = (seedData.recipes as Recipe[]).filter((r) => !existing.has(r.id));
  return missing.length > 0 ? [...filled, ...missing] : filled;
}

/** Lista de ids sin duplicados ni basura. Los ids de recetas que ya no existen se descartan al guardar (store). */
export function sanitizeFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && id !== ""))];
}

/** Mismas opciones que usa AppProvider al cargar: única fuente de las migraciones (R7). */
export const LOAD_OPTIONS: { [K in UserDataKey]: LoadOptions<UserData[K]> } = {
  profile: { fallback: null, upgrade: migrateProfile, backup: true },
  recipes: { fallback: [], upgrade: withSeedRecipes },
  entries: {
    fallback: [],
    upgrade: (raw) => migrateEntries((raw as MealEntry[] | null) ?? []),
    backup: true,
  },
  pantry: { fallback: [], upgrade: (raw) => (raw as PantryItem[] | null) ?? [] },
  weekplan: {
    fallback: {},
    upgrade: (raw) => migrateWeekPlan((raw as WeekPlan | null) ?? {}),
    backup: true,
  },
  // Lista de la compra: solo la intención del usuario; la lista se deriva del plan (lista-compra tech.md)
  shopping: { fallback: EMPTY_SHOPPING, upgrade: loadShoppingState },
  // Historial de medidas (docs/pm/9-historial-medidas): descarta lo mal formado; sin copia *_v1_backup
  measurements: { fallback: [], upgrade: sanitizeMeasurements },
  // Favoritas (docs/pm/20-recetas-filtros): lista de ids, sin copia *_v1_backup
  favorites: { fallback: [], upgrade: sanitizeFavorites },
  // Agua (docs/pm/23-agua-fibra-micros): descarta lo mal formado; sin copia *_v1_backup
  water: { fallback: {}, upgrade: sanitizeWater },
};
