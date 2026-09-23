"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { UserProfile, Recipe, MealEntry, PantryItem, WeekPlan } from "./types";
import seedData from "@/data/recipes.json";
import { userKey } from "./auth";
import { migrateEntries, migrateProfile, migrateWeekPlan } from "./migrate";
import { EMPTY as EMPTY_SHOPPING, type ShoppingState } from "./shopping/state";

interface AppState {
  profile: UserProfile | null;
  recipes: Recipe[];
  entries: MealEntry[];
  pantry: PantryItem[];
  weekPlan: WeekPlan;
  shopping: ShoppingState;
  loaded: boolean;
  setProfile: (p: UserProfile | null) => void;
  addRecipes: (r: Recipe[]) => void;
  addEntry: (e: MealEntry) => void;
  removeEntry: (id: string) => void;
  addPantryItem: (i: PantryItem) => void;
  removePantryItem: (id: string) => void;
  /** Varios de una vez: una sola escritura (llamar a addPantryItem en bucle solo conserva el último). */
  addPantryItems: (items: PantryItem[]) => void;
  removePantryItems: (ids: string[]) => void;
  setWeekPlan: (p: WeekPlan) => void;
  setShopping: (s: ShoppingState) => void;
}

const AppContext = createContext<AppState | null>(null);

interface LoadOptions<T> {
  /** Transforma lo guardado (migraciones, siembra). Debe ser idempotente. */
  upgrade?: (raw: unknown) => T;
  /** Guarda el valor original en <clave>_v1_backup antes de sobrescribirlo. */
  backup?: boolean;
}

function load<T>(key: string, fallback: T, { upgrade, backup }: LoadOptions<T> = {}): T {
  let raw: unknown = null;
  try {
    const stored = localStorage.getItem(key);
    raw = stored ? JSON.parse(stored) : null;
  } catch {
    return fallback;
  }
  if (!upgrade) return (raw as T) ?? fallback;

  const value = upgrade(raw);
  const json = JSON.stringify(value);
  if (value !== null && json !== JSON.stringify(raw)) {
    if (backup && raw !== null && localStorage.getItem(`${key}_v1_backup`) === null) {
      localStorage.setItem(`${key}_v1_backup`, JSON.stringify(raw));
    }
    localStorage.setItem(key, json);
  }
  return value ?? fallback;
}

// AppProvider solo se monta en el cliente, tras cargar la sesión (ver AppShell), así que se puede
// leer localStorage de forma síncrona: el primer render ya tiene los datos y no hay parpadeo del onboarding.
function usePersisted<T>(key: string, fallback: T, options?: LoadOptions<T>): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => (typeof window === "undefined" ? fallback : load(key, fallback, options)));
  const set = (v: T) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(v));
  };
  return [value, set];
}

/** Siembra idempotente: añade solo las recetas del JSON cuyo id falte. */
function withSeedRecipes(raw: unknown): Recipe[] {
  const stored = (raw as Recipe[] | null) ?? [];
  const existing = new Set(stored.map((r) => r.id));
  const missing = (seedData.recipes as Recipe[]).filter((r) => !existing.has(r.id));
  return missing.length > 0 ? [...stored, ...missing] : stored;
}

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  // Cada usuario tiene sus propias claves: mp_<userId>_<dato>
  const k = (key: string) => userKey(userId, key);

  const [profile, setProfile] = usePersisted<UserProfile | null>(k("profile"), null, {
    upgrade: migrateProfile,
    backup: true,
  });
  const [recipes, setRecipes] = usePersisted<Recipe[]>(k("recipes"), [], { upgrade: withSeedRecipes });
  const [entries, setEntries] = usePersisted<MealEntry[]>(k("entries"), [], {
    upgrade: (raw) => migrateEntries((raw as MealEntry[] | null) ?? []),
    backup: true,
  });
  const [pantry, setPantry] = usePersisted<PantryItem[]>(k("pantry"), []);
  const [weekPlan, setWeekPlan] = usePersisted<WeekPlan>(k("weekplan"), {}, {
    upgrade: (raw) => migrateWeekPlan((raw as WeekPlan | null) ?? {}),
    backup: true,
  });
  // Lista de la compra: solo la intención del usuario; la lista se deriva del plan (lista-compra tech.md)
  const [shopping, setShopping] = usePersisted<ShoppingState>(k("shopping"), EMPTY_SHOPPING);

  const value: AppState = {
    profile,
    recipes,
    entries,
    pantry,
    weekPlan,
    shopping,
    loaded: true,
    setProfile,
    addRecipes: (r) => setRecipes([...recipes, ...r]),
    addEntry: (e) => setEntries([...entries, e]),
    removeEntry: (id) => setEntries(entries.filter((e) => e.id !== id)),
    addPantryItem: (i) => setPantry([...pantry, i]),
    removePantryItem: (id) => setPantry(pantry.filter((i) => i.id !== id)),
    addPantryItems: (items) => setPantry([...pantry, ...items]),
    removePantryItems: (ids) => setPantry(pantry.filter((i) => !ids.includes(i.id))),
    setWeekPlan,
    setShopping,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
