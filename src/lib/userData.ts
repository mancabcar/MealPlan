// Registro de los datos de cada usuario (mp_<userId>_<clave>) y de cómo se cargan. Lo usan AppProvider al montar y
// la importación de copias (backup.ts), así una copia pasa exactamente por las mismas migraciones (backup-datos R7).
import seedData from "@/data/recipes.json";
import { migrateEntries, migrateProfile, migrateWeekPlan } from "./migrate";
import { EMPTY as EMPTY_SHOPPING, loadShoppingState, type ShoppingState } from "./shopping/state";
import type { MealEntry, PantryItem, Recipe, UserProfile, WeekPlan } from "./types";

export const USER_DATA_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping"] as const;
export type UserDataKey = (typeof USER_DATA_KEYS)[number];

export interface UserData {
  profile: UserProfile | null;
  recipes: Recipe[];
  entries: MealEntry[];
  pantry: PantryItem[];
  weekplan: WeekPlan;
  shopping: ShoppingState;
}

export const EMPTY_USER_DATA: UserData = {
  profile: null,
  recipes: [],
  entries: [],
  pantry: [],
  weekplan: {},
  shopping: EMPTY_SHOPPING,
};

export interface LoadOptions<T> {
  /** Valor si no hay nada guardado o no se puede leer. */
  fallback: T;
  /** Transforma lo guardado (migraciones, siembra). Debe ser idempotente. */
  upgrade: (raw: unknown) => T;
  /** Guarda el valor original en <clave>_v1_backup antes de sobrescribirlo. */
  backup?: boolean;
}

/** Siembra idempotente: añade solo las recetas del JSON cuyo id falte. */
export function withSeedRecipes(raw: unknown): Recipe[] {
  const stored = (raw as Recipe[] | null) ?? [];
  const existing = new Set(stored.map((r) => r.id));
  const missing = (seedData.recipes as Recipe[]).filter((r) => !existing.has(r.id));
  return missing.length > 0 ? [...stored, ...missing] : stored;
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
};
