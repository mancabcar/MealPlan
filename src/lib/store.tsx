"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { UserProfile, Recipe, MealEntry, Measurement, PantryItem, WeekPlan } from "./types";
import { userKey } from "./auth";
import type { ShoppingState } from "./shopping/state";
import { writeUserData } from "./backup";
import { CATALOG } from "./catalog";
import { withoutRecipe } from "./recipeEdit";
import { useSync } from "./syncContext";
import { withWater } from "./water";
import { upsertCustom, type MealFavorite } from "./mealFavorites";
import { LOAD_OPTIONS, USER_DATA_KEYS, type LoadOptions, type UserData, type UserDataKey } from "./userData";

interface AppState {
  profile: UserProfile | null;
  /** Catálogo del bundle + recetas del usuario (IA y propias). Solo estas últimas se guardan (docs/pm/recetas-almacenamiento). */
  recipes: Recipe[];
  entries: MealEntry[];
  pantry: PantryItem[];
  weekPlan: WeekPlan;
  shopping: ShoppingState;
  /** Historial de peso y medidas (docs/pm/9-historial-medidas), en el orden en que se añadieron. */
  measurements: Measurement[];
  /** Ids de las recetas favoritas (docs/pm/20-recetas-filtros). */
  favorites: string[];
  /** Agua bebida por día en ml (docs/pm/23-agua-fibra-micros). */
  water: Record<string, number>;
  /** Personalizadas y alimentos favoritos de «Añadir comida» (docs/pm/55-mis-alimentos). */
  mealFavorites: MealFavorite[];
  loaded: boolean;
  /** Id del ítem de la Despensa por el que Recetas filtra ("Recetas con esto"). Efímero: no se persiste ni entra en el backup. */
  recipeFocus: string | null;
  setRecipeFocus: (id: string | null) => void;
  setProfile: (p: UserProfile | null) => void;
  addRecipes: (r: Recipe[]) => void;
  /** Alta, o edición si ya hay una con ese id. */
  saveRecipe: (r: Recipe) => void;
  /** Borra la receta: sus entradas del Diario pasan a comida suelta y sus franjas del Plan se vacían. */
  removeRecipe: (id: string) => void;
  addEntry: (e: MealEntry) => void;
  /** Varias de una vez, en una sola escritura (copiar un día del Diario, docs/pm/54-copiar-diario). */
  addEntries: (es: MealEntry[]) => void;
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
  /** Marca o desmarca una receta como favorita; al guardar descarta los ids de recetas que ya no existen. */
  toggleFavorite: (id: string) => void;
  /** Sustituye la lista de recetas favoritas (Deshacer en Favoritos de «Añadir comida», docs/pm/55-mis-alimentos R5). */
  setFavorites: (ids: string[]) => void;
  /** Fija los ml bebidos de un día (docs/pm/23-agua-fibra-micros); 0 quita el día. */
  setWaterDay: (date: string, ml: number) => void;
  /** Edición si ya hay uno con ese id; si no, una personalizada con el mismo nombre se actualiza (R2) y lo demás se añade. */
  saveMealFavorite: (fav: MealFavorite) => void;
  removeMealFavorite: (id: string) => void;
  /** Sustituye la lista entera (Deshacer restaura la instantánea, R5/R11). */
  setMealFavorites: (list: MealFavorite[]) => void;
  /** Sustituye los datos del usuario (ya validados con parseBackup). Lanza si falla la escritura (nada cambia). */
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
function usePersisted<T>(
  key: string,
  options: LoadOptions<T>,
  onWrite: () => void,
): [T, Setter<T>, () => void] {
  const [value, setValue] = useState<T>(() => (typeof window === "undefined" ? options.fallback : load(key, options)));
  // Último valor escrito, no el del render: dos escrituras en el mismo evento se encadenan en vez de
  // pisarse (antes, llamar a addPantryItem dos veces seguidas solo conservaba la última).
  const latest = useRef(value);
  const set: Setter<T> = (v) => {
    const next = typeof v === "function" ? (v as (prev: T) => T)(latest.current) : v;
    latest.current = next;
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
    onWrite(); // sincronización (#22): la clave queda pendiente de subir
  };
  const reload = () => {
    const next = load(key, options);
    latest.current = next;
    setValue(next);
  };
  return [value, set, reload];
}

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  // Cada usuario tiene sus propias claves: mp_<userId>_<dato>. Migraciones: LOAD_OPTIONS (userData.ts).
  const k = (key: string) => userKey(userId, key);
  const { markDirty, subscribeRemote } = useSync();
  const dirty = (key: UserDataKey) => () => markDirty(key);

  const [profile, setProfile, reloadProfile] = usePersisted(k("profile"), LOAD_OPTIONS.profile, dirty("profile"));
  const [ownRecipes, setRecipes, reloadRecipes] = usePersisted(k("recipes"), LOAD_OPTIONS.recipes, dirty("recipes"));
  const recipes = useMemo(() => [...CATALOG, ...ownRecipes], [ownRecipes]);
  const [entries, setEntries, reloadEntries] = usePersisted(k("entries"), LOAD_OPTIONS.entries, dirty("entries"));
  const [pantry, setPantry, reloadPantry] = usePersisted(k("pantry"), LOAD_OPTIONS.pantry, dirty("pantry"));
  const [weekPlan, setWeekPlan, reloadWeekPlan] = usePersisted(k("weekplan"), LOAD_OPTIONS.weekplan, dirty("weekplan"));
  const [shopping, setShopping, reloadShopping] = usePersisted(k("shopping"), LOAD_OPTIONS.shopping, dirty("shopping"));
  const [measurements, setMeasurements, reloadMeasurements] = usePersisted(k("measurements"), LOAD_OPTIONS.measurements, dirty("measurements"));

  const [favorites, setFavorites, reloadFavorites] = usePersisted(k("favorites"), LOAD_OPTIONS.favorites, dirty("favorites"));
  const [water, setWater, reloadWater] = usePersisted(k("water"), LOAD_OPTIONS.water, dirty("water"));
  const [mealFavorites, setMealFavorites, reloadMealFavorites] = usePersisted(
    k("mealFavorites"),
    LOAD_OPTIONS.mealFavorites,
    dirty("mealFavorites"),
  );

  const [recipeFocus, setRecipeFocus] = useState<string | null>(null);

  // backup-datos R6/R8: escribe todo o nada y, si ha ido bien, relee todas las claves en el estado. Como `data` ya
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
    reloadFavorites();
    reloadWater();
    reloadMealFavorites();
    // #22 R11: lo importado se sube entero
    for (const key of USER_DATA_KEYS) markDirty(key);
  };

  // Cambios traídos del servidor: ya están en localStorage, solo hay que releerlos en el estado (#22 R5)
  const reloaders: Record<UserDataKey, () => void> = {
    profile: reloadProfile,
    recipes: reloadRecipes,
    entries: reloadEntries,
    pantry: reloadPantry,
    weekplan: reloadWeekPlan,
    shopping: reloadShopping,
    measurements: reloadMeasurements,
    favorites: reloadFavorites,
    water: reloadWater,
    mealFavorites: reloadMealFavorites,
  };
  const latestReloaders = useRef(reloaders);
  useEffect(() => {
    latestReloaders.current = reloaders;
  });
  useEffect(() => subscribeRemote((key) => latestReloaders.current[key]()), [subscribeRemote]);

  const value: AppState = {
    profile,
    recipes,
    entries,
    pantry,
    weekPlan,
    shopping,
    measurements,
    favorites,
    water,
    mealFavorites,
    loaded: true,
    recipeFocus,
    setRecipeFocus,
    setProfile,
    addRecipes: (r) => setRecipes((prev) => [...prev, ...r]),
    saveRecipe: (r) => setRecipes((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r])),
    removeRecipe: (id) => {
      // Solo las del usuario: el catálogo es de solo lectura
      const recipe = ownRecipes.find((r) => r.id === id);
      if (!recipe) return;
      // Orden seguro: entradas → plan → receta; si algo falla antes, no se pierde nada y se puede repetir.
      // Cada setter parte del último valor escrito, no del render (como el resto de acciones)
      setEntries((prev) => withoutRecipe({ entries: prev, plan: {}, recipe }).entries);
      setWeekPlan((prev) => withoutRecipe({ entries: [], plan: prev, recipe }).plan);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      setFavorites((prev) => prev.filter((f) => f !== id));
    },
    addEntry: (e) => setEntries((prev) => [...prev, e]),
    addEntries: (es) => setEntries((prev) => [...prev, ...es]),
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
    toggleFavorite: (id) =>
      setFavorites((prev) => {
        const known = new Set(recipes.map((r) => r.id));
        const kept = prev.filter((f) => known.has(f));
        return kept.includes(id) ? kept.filter((f) => f !== id) : [...kept, id];
      }),
    setFavorites,
    setWaterDay: (date, ml) => setWater((prev) => withWater(prev, date, ml)),
    saveMealFavorite: (fav) =>
      setMealFavorites((prev) => {
        if (prev.some((f) => f.id === fav.id)) return prev.map((f) => (f.id === fav.id ? fav : f));
        return fav.kind === "custom" ? upsertCustom(prev, fav) : [...prev, fav];
      }),
    removeMealFavorite: (id) => setMealFavorites((prev) => prev.filter((f) => f.id !== id)),
    setMealFavorites,
    importData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
