"use client";

import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { UserProfile, Recipe, MealEntry, Measurement, PantryItem, WeekPlan } from "./types";
import { userKey } from "./auth";
import type { ShoppingState } from "./shopping/state";
import { writeUserData } from "./backup";
import { LOAD_OPTIONS, type LoadOptions, type UserData } from "./userData";

interface AppState {
  profile: UserProfile | null;
  recipes: Recipe[];
  entries: MealEntry[];
  pantry: PantryItem[];
  weekPlan: WeekPlan;
  shopping: ShoppingState;
  /** Historial de peso y medidas (docs/pm/9-historial-medidas), en el orden en que se añadieron. */
  measurements: Measurement[];
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
  /** Alta, o edición si ya hay una con ese id. */
  saveMeasurement: (m: Measurement) => void;
  removeMeasurement: (id: string) => void;
  /** Sustituye los siete datos del usuario (ya validados con parseBackup). Lanza si falla la escritura (nada cambia). */
  importData: (data: UserData) => void;
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
// reload() vuelve a leer lo guardado (tras importar una copia) sin remontar el árbol.
function usePersisted<T>(key: string, options: LoadOptions<T>): [T, Setter<T>, () => void] {
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
  const reload = () => {
    const next = load(key, options);
    latest.current = next;
    setValue(next);
  };
  return [value, set, reload];
}

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  // Cada usuario tiene sus propias claves: mp_<userId>_<dato>. Migraciones y siembra: LOAD_OPTIONS (userData.ts).
  const k = (key: string) => userKey(userId, key);

  const [profile, setProfile, reloadProfile] = usePersisted(k("profile"), LOAD_OPTIONS.profile);
  const [recipes, setRecipes, reloadRecipes] = usePersisted(k("recipes"), LOAD_OPTIONS.recipes);
  const [entries, setEntries, reloadEntries] = usePersisted(k("entries"), LOAD_OPTIONS.entries);
  const [pantry, setPantry, reloadPantry] = usePersisted(k("pantry"), LOAD_OPTIONS.pantry);
  const [weekPlan, setWeekPlan, reloadWeekPlan] = usePersisted(k("weekplan"), LOAD_OPTIONS.weekplan);
  const [shopping, setShopping, reloadShopping] = usePersisted(k("shopping"), LOAD_OPTIONS.shopping);
  const [measurements, setMeasurements, reloadMeasurements] = usePersisted(k("measurements"), LOAD_OPTIONS.measurements);

  // backup-datos R6/R8: escribe todo o nada y, si ha ido bien, relee las siete claves en el estado. Como `data` ya
  // viene migrado (parseBackup), la relectura no reescribe nada ni crea copias *_v1_backup.
  const importData = (data: UserData) => {
    writeUserData(localStorage, userId, data);
    reloadProfile();
    reloadRecipes();
    reloadEntries();
    reloadPantry();
    reloadWeekPlan();
    reloadShopping();
    reloadMeasurements();
  };

  const value: AppState = {
    profile,
    recipes,
    entries,
    pantry,
    weekPlan,
    shopping,
    measurements,
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
    saveMeasurement: (m) =>
      setMeasurements((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m])),
    removeMeasurement: (id) => setMeasurements((prev) => prev.filter((m) => m.id !== id)),
    importData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
