// Registro de los datos de cada usuario (mp_<userId>_<clave>) y de cómo se cargan. Lo usan AppProvider al montar y
// la importación de copias (backup.ts), así una copia pasa exactamente por las mismas migraciones (backup-datos R7).
import { CATALOG_IDS } from "./catalog";
import { sanitizeRecipeFiber } from "./fiber";
import { sanitizeMeasurements } from "./measurements";
import { sanitizeBatches } from "./plan/batch";
import { migrateEntries, migrateProfile, migrateWeekPlan, RETIRED_RECIPE_IDS } from "./migrate";
import { sanitizeMealFavorites, type MealFavorite } from "./mealFavorites";
import { sanitizeWater } from "./water";
import { EMPTY as EMPTY_SHOPPING, loadShoppingState, type ShoppingState } from "./shopping/state";
import type { MealEntry, Measurement, PantryItem, Recipe, UserProfile, WeekPlan } from "./types";

export const USER_DATA_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping", "measurements", "favorites", "water", "ratings", "mealFavorites"] as const;
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
  /** Valoración 1–5 por id de receta (docs/pm/111-recetas-valoracion-filtros). */
  ratings: Record<string, number>;
  /** Personalizadas y alimentos favoritos de «Añadir comida» (docs/pm/55-mis-alimentos); las recetas siguen en `favorites`. */
  mealFavorites: MealFavorite[];
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
  ratings: {},
  mealFavorites: [],
};

export interface LoadOptions<T> {
  /** Valor si no hay nada guardado o no se puede leer. */
  fallback: T;
  /** Transforma lo guardado (migraciones, siembra). Debe ser idempotente. */
  upgrade: (raw: unknown) => T;
  /** Guarda el valor original en <clave>_v1_backup antes de sobrescribirlo. */
  backup?: boolean;
}

/**
 * Recetas del usuario (IA y propias): quita las del catálogo, que viven en el bundle (src/lib/catalog.ts) y no se guardan,
 * y las retiradas. Idempotente: también limpia lo que dejó la siembra anterior y las copias de seguridad antiguas.
 * Una fibra no válida se quita (#123): la ficha de la receta no puede pintarla.
 */
export function userRecipes(raw: unknown): Recipe[] {
  const saved = Array.isArray(raw) ? (raw as Recipe[]) : [];
  const isCatalog = (r: Recipe) => CATALOG_IDS.has(r.id) || Object.hasOwn(RETIRED_RECIPE_IDS, r.id);
  const own = saved.some(isCatalog) ? saved.filter((r) => !isCatalog(r)) : saved;
  const clean = own.map(sanitizeRecipeFiber);
  return clean.some((r, i) => r !== own[i]) ? clean : own;
}

/** Plan con forma de plan: cada día, una lista de franjas (objetos); lo demás se descarta para que la carga no lance (#81). */
function planShape(raw: unknown): WeekPlan {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter((e): e is [string, unknown[]] => Array.isArray(e[1]))
      .map(([date, slots]) => [date, slots.filter((s) => typeof s === "object" && s !== null && !Array.isArray(s))]),
  ) as WeekPlan;
}

/** Lista de ids sin duplicados ni basura. Los ids de recetas que ya no existen se descartan al guardar (store). */
export function sanitizeFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && id !== ""))];
}

/** Notas enteras de 1 a 5 por id de receta; descarta lo demás. Los ids de recetas que ya no existen se limpian al guardar (store). */
export function sanitizeRatings(raw: unknown): Record<string, number> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(raw)) {
    if (id !== "" && typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5) out[id] = n;
  }
  return out;
}

/** Mismas opciones que usa AppProvider al cargar: única fuente de las migraciones (R7). */
export const LOAD_OPTIONS: { [K in UserDataKey]: LoadOptions<UserData[K]> } = {
  profile: { fallback: null, upgrade: migrateProfile, backup: true },
  recipes: { fallback: [], upgrade: userRecipes },
  entries: {
    fallback: [],
    upgrade: (raw) => migrateEntries((raw as MealEntry[] | null) ?? []),
    backup: true,
  },
  pantry: { fallback: [], upgrade: (raw) => (raw as PantryItem[] | null) ?? [] },
  weekplan: {
    fallback: {},
    // Días que no son listas de franjas, tandas con raciones no válidas o sobras huérfanas (#81): se corrigen al cargar
    upgrade: (raw) => sanitizeBatches(migrateWeekPlan(planShape(raw))),
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
  // Valoraciones (docs/pm/111-recetas-valoracion-filtros): sin copia *_v1_backup
  ratings: { fallback: {}, upgrade: sanitizeRatings },
  // Favoritos de «Añadir comida» (docs/pm/55-mis-alimentos): descarta lo mal formado; sin copia *_v1_backup
  mealFavorites: { fallback: [], upgrade: sanitizeMealFavorites },
};
