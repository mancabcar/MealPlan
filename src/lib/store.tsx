"use client";

import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { UserProfile, Recipe, MealEntry, PantryItem, WeekPlan } from "./types";
import { userKey } from "./auth";
import type { ShoppingState } from "./shopping/state";
import { LOAD_OPTIONS, type LoadOptions } from "./userData";

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
  /** Varios de una vez, en una sola escritura. */
  addPantryItems: (items: PantryItem[]) => void;
  removePantryItems: (ids: string[]) => void;
  setWeekPlan: (p: WeekPlan) => void;
  setShopping: Setter<ShoppingState>;
}

const AppContext = createContext<AppState | null>(null);

/** Valor nuevo, o función del valor más reciente (para encadenar varias escrituras en un mismo evento). */
export type Setter<T> = (v: T | ((prev: T) => T)) => void;

function load<T>(key: string, { fallback, upgrade, backup }: LoadOptions<T>): T {
  let raw: unknown = null;
  try {
    const stored = localStorage.getItem(key);
    raw = stored ? JSON.parse(stored) : null;
  } catch {
    return fallback;
  }

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
function usePersisted<T>(key: string, options: LoadOptions<T>): [T, Setter<T>] {
  const [value, setValue] = useState<T>(() => (typeof window === "undefined" ? options.fallback : load(key, options)));
  // Último valor escrito, no el del render: dos escrituras en el mismo evento se encadenan en vez de
  // pisarse (antes, llamar a addPantryItem dos veces seguidas solo conservaba la última).
  const latest = useRef(value);
  const set: Setter<T> = (v) => {
    const next = typeof v === "function" ? (v as (prev: T) => T)(latest.current) : v;
    latest.current = next;
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return [value, set];
}

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  // Cada usuario tiene sus propias claves: mp_<userId>_<dato>. Migraciones y siembra: LOAD_OPTIONS (userData.ts).
  const k = (key: string) => userKey(userId, key);

  const [profile, setProfile] = usePersisted(k("profile"), LOAD_OPTIONS.profile);
  const [recipes, setRecipes] = usePersisted(k("recipes"), LOAD_OPTIONS.recipes);
  const [entries, setEntries] = usePersisted(k("entries"), LOAD_OPTIONS.entries);
  const [pantry, setPantry] = usePersisted(k("pantry"), LOAD_OPTIONS.pantry);
  const [weekPlan, setWeekPlan] = usePersisted(k("weekplan"), LOAD_OPTIONS.weekplan);
  const [shopping, setShopping] = usePersisted(k("shopping"), LOAD_OPTIONS.shopping);

  const value: AppState = {
    profile,
    recipes,
    entries,
    pantry,
    weekPlan,
    shopping,
    loaded: true,
    setProfile,
    addRecipes: (r) => setRecipes((prev) => [...prev, ...r]),
    addEntry: (e) => setEntries((prev) => [...prev, e]),
    removeEntry: (id) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    addPantryItem: (i) => setPantry((prev) => [...prev, i]),
    removePantryItem: (id) => setPantry((prev) => prev.filter((i) => i.id !== id)),
    addPantryItems: (items) => setPantry((prev) => [...prev, ...items]),
    removePantryItems: (ids) => setPantry((prev) => prev.filter((i) => !ids.includes(i.id))),
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
