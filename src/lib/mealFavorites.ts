// Favoritos en «Añadir comida» (docs/pm/55-mis-alimentos/tech.md › Data model y APIs). Puro: sin React ni store.
// Personalizadas y alimentos viven en la clave `mealFavorites`; las recetas favoritas siguen en `favorites` (#20).
import { foodEntry, quantityLabel } from "./diary";
import type { Per100 } from "./foods";
import { fitsSlot } from "./recipeSlots";
import type { MealEntry, MealType, Recipe } from "./types";

export type MealFavorite =
  | { id: string; kind: "custom"; name: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number }
  | { id: string; kind: "food"; foodId: string; name: string; grams: number; units?: number; per100: Per100 };

/** Una fila de la sección Favoritos: lo que pinta y de dónde sale (un mealFavorite o una receta favorita). */
export interface RankedFavorite {
  /** Única en la lista; también sirve de React key. */
  key: string;
  name: string;
  /** Sin redondear: se redondea al mostrar. */
  calories: number;
  /** «40 g» o «2 ud · 120 g» en alimentos; null en personalizadas y recetas. */
  label: string | null;
  fav?: MealFavorite;
  recipe?: Recipe;
}

/** R2, R7, R8: identidad de una personalizada por nombre, sin mayúsculas ni espacios extra (como Recientes). */
export function customNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const optNum = (v: unknown) => v === undefined || isNum(v);

function isPer100(v: unknown): v is Per100 {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return isNum(p.kcal) && isNum(p.protein) && isNum(p.carbs) && isNum(p.fat) && optNum(p.fiber);
}

function isMealFavorite(v: unknown): v is MealFavorite {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  if (!isText(f.id) || !isText(f.name)) return false;
  if (f.kind === "custom") return isNum(f.calories) && isNum(f.protein) && isNum(f.carbs) && isNum(f.fat) && optNum(f.fiber);
  if (f.kind === "food") {
    return isText(f.foodId) && isNum(f.grams) && f.grams > 0 && (f.units === undefined || (isNum(f.units) && f.units > 0)) && isPer100(f.per100);
  }
  return false;
}

/** `upgrade` de LOAD_OPTIONS: lo que no es una lista → []; descarta los elementos mal formados. */
export function sanitizeMealFavorites(raw: unknown): MealFavorite[] {
  return Array.isArray(raw) ? raw.filter(isMealFavorite) : [];
}

/**
 * R2: el favorito de una fila de Recientes. Personalizada: nombre, macros y fibra. Alimento: su alimento de origen,
 * su cantidad y los valores por 100 g sacados de la entrada. null para recetas (van en `favorites`) o sin gramos válidos.
 */
export function favoriteFromEntry(e: MealEntry, id: string = crypto.randomUUID()): MealFavorite | null {
  if (e.recipeId) return null;
  if (e.foodId) {
    const g = e.grams;
    if (!isNum(g) || g <= 0) return null;
    const per = (v: number) => (v * 100) / g;
    const per100: Per100 = { kcal: per(e.calories), protein: per(e.protein), carbs: per(e.carbs), fat: per(e.fat) };
    if (isNum(e.fiber)) per100.fiber = per(e.fiber);
    const fav: MealFavorite = { id, kind: "food", foodId: e.foodId, name: e.customName ?? "", grams: g, per100 };
    if (e.units !== undefined) fav.units = e.units;
    return fav;
  }
  if (!isText(e.customName)) return null;
  const fav: MealFavorite = { id, kind: "custom", name: e.customName, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat };
  if (e.fiber !== undefined) fav.fiber = e.fiber;
  return fav;
}

/** R1: la entrada que registra un favorito. Un alimento se calcula como en el buscador (foodEntry). */
export function favoriteEntry(fav: MealFavorite, date: string, mealType: MealType, id: string = crypto.randomUUID()): MealEntry {
  if (fav.kind === "food") {
    return foodEntry({ foodId: fav.foodId, name: fav.name, per100: fav.per100 }, date, mealType, { grams: fav.grams, units: fav.units, id });
  }
  const entry: MealEntry = { id, date, mealType, customName: fav.name, calories: fav.calories, protein: fav.protein, carbs: fav.carbs, fat: fav.fat };
  if (fav.fiber !== undefined) entry.fiber = fav.fiber;
  return entry;
}

/** R2: si ya hay una personalizada con ese nombre, actualiza sus datos y conserva su id; si no, la añade al final. */
export function upsertCustom(list: MealFavorite[], fav: MealFavorite): MealFavorite[] {
  const key = customNameKey(fav.name);
  const i = list.findIndex((f) => f.kind === "custom" && customNameKey(f.name) === key);
  if (i === -1) return [...list, fav];
  return list.map((f, j) => (j === i ? { ...fav, id: f.id } : f));
}

// Identidad para ocultar en Recientes (R7) y contar frecuencia (R8): personalizada por nombre, alimento por alimento y
// cantidad (como recentKey), receta por receta.
const foodKey = (foodId: string, grams: number | undefined, units: number | undefined) =>
  units !== undefined ? `f|${foodId}|${units}ud` : `f|${foodId}|${grams}g`;

function entryIdentity(e: MealEntry): string {
  if (e.recipeId) return `r|${e.recipeId}`;
  if (e.foodId) return foodKey(e.foodId, e.grams, e.units);
  return `c|${customNameKey(e.customName ?? "")}`;
}

function favIdentity(fav: MealFavorite): string {
  return fav.kind === "food" ? foodKey(fav.foodId, fav.grams, fav.units) : `c|${customNameKey(fav.name)}`;
}

/** R7: oculta en Recientes lo que ya es favorito. Las recetas, solo con 1 ración (el favorito registra 1). */
export function hiddenInRecents(items: MealFavorite[], recipeIds: string[]): (e: MealEntry) => boolean {
  const keys = new Set(items.map(favIdentity));
  const recipes = new Set(recipeIds);
  return (e) => {
    if (e.recipeId) return recipes.has(e.recipeId) && (e.servings ?? 1) === 1;
    return keys.has(entryIdentity(e));
  };
}

/**
 * R8: los favoritos de la franja, ordenados por número de entradas en ella; a igualdad, la última entrada en la
 * franja; luego los que no tienen ninguna en la franja, por su última entrada en cualquiera; al final, los nunca
 * registrados, del último guardado al primero (primero mealFavorites, luego recetas). Las recetas borradas o que no
 * valen para la franja no salen.
 */
export function rankFavorites({
  items,
  recipeIds,
  recipes,
  entries,
  mealType,
}: {
  items: MealFavorite[];
  recipeIds: string[];
  recipes: Recipe[];
  entries: MealEntry[];
  mealType: MealType;
}): RankedFavorite[] {
  // Una pasada: el orden del array es el orden de registro, así que el índice dice qué entrada es más reciente
  const stats = new Map<string, { count: number; lastInSlot: number; lastAny: number }>();
  entries.forEach((e, i) => {
    const k = entryIdentity(e);
    const s = stats.get(k) ?? { count: 0, lastInSlot: -1, lastAny: -1 };
    s.lastAny = i;
    if (e.mealType === mealType) {
      s.count++;
      s.lastInSlot = i;
    }
    stats.set(k, s);
  });

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const rows: { row: RankedFavorite; identity: string }[] = [];
  for (const fav of [...items].reverse()) {
    rows.push({
      identity: favIdentity(fav),
      row:
        fav.kind === "food"
          ? { key: `m|${fav.id}`, name: fav.name, calories: (fav.per100.kcal * fav.grams) / 100, label: quantityLabel(fav), fav }
          : { key: `m|${fav.id}`, name: fav.name, calories: fav.calories, label: null, fav },
    });
  }
  for (const id of [...new Set(recipeIds)].reverse()) {
    const recipe = recipeById.get(id);
    if (!recipe || !fitsSlot(recipe, mealType)) continue;
    rows.push({ identity: `r|${id}`, row: { key: `r|${id}`, name: recipe.name, calories: recipe.calories, label: null, recipe } });
  }

  const none = { count: 0, lastInSlot: -1, lastAny: -1 };
  // sort es estable: los empates totales (nunca registrados) conservan el orden de guardado invertido
  return rows
    .map((r) => ({ ...r, s: stats.get(r.identity) ?? none }))
    .sort((a, b) => b.s.count - a.s.count || b.s.lastInSlot - a.s.lastInSlot || b.s.lastAny - a.s.lastAny)
    .map((r) => r.row);
}
