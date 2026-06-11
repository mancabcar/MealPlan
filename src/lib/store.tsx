"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserProfile, Recipe, MealEntry, PantryItem, WeekPlan } from "./types";
import seedData from "@/data/recipes.json";

interface AppState {
  profile: UserProfile | null;
  recipes: Recipe[];
  entries: MealEntry[];
  pantry: PantryItem[];
  weekPlan: WeekPlan;
  loaded: boolean;
  setProfile: (p: UserProfile | null) => void;
  addRecipes: (r: Recipe[]) => void;
  addEntry: (e: MealEntry) => void;
  removeEntry: (id: string) => void;
  addPantryItem: (i: PantryItem) => void;
  removePantryItem: (id: string) => void;
  setWeekPlan: (p: WeekPlan) => void;
}

const AppContext = createContext<AppState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function usePersisted<T>(key: string, initial: T, ready: boolean): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    if (ready) setValue(load(key, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const set = (v: T) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(v));
  };
  return [value, set];
}

export function AppProvider({ children }: { children: ReactNode }) {
  // "ready" evita leer localStorage durante el render de servidor/hidratación
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [profile, setProfile] = usePersisted<UserProfile | null>("mp_profile", null, ready);
  const [recipes, setRecipes] = usePersisted<Recipe[]>("mp_recipes", [], ready);
  const [entries, setEntries] = usePersisted<MealEntry[]>("mp_entries", [], ready);
  const [pantry, setPantry] = usePersisted<PantryItem[]>("mp_pantry", [], ready);
  const [weekPlan, setWeekPlan] = usePersisted<WeekPlan>("mp_weekplan", {}, ready);

  // Siembra idempotente: añade solo las recetas del JSON cuyo id falte
  useEffect(() => {
    if (!ready) return;
    const existing = new Set(load<Recipe[]>("mp_recipes", []).map((r) => r.id));
    const missing = (seedData.recipes as Recipe[]).filter((r) => !existing.has(r.id));
    if (missing.length > 0) {
      const merged = [...load<Recipe[]>("mp_recipes", []), ...missing];
      setRecipes(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const value: AppState = {
    profile,
    recipes,
    entries,
    pantry,
    weekPlan,
    loaded: ready,
    setProfile,
    addRecipes: (r) => setRecipes([...recipes, ...r]),
    addEntry: (e) => setEntries([...entries, e]),
    removeEntry: (id) => setEntries(entries.filter((e) => e.id !== id)),
    addPantryItem: (i) => setPantry([...pantry, i]),
    removePantryItem: (id) => setPantry(pantry.filter((i) => i.id !== id)),
    setWeekPlan,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
