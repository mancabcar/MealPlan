// Franjas del Plan frente a los tags de las recetas, y cómo se agrupa el selector de recetas
// (docs/pm/20-recetas-filtros/tech.md › APIs / interfaces). Lógica pura: la UI vive en RecipePicker.
import { normalize } from "./text";
import type { MealType, Recipe } from "./types";

export type SlotTag = "desayuno" | "comida" | "cena" | "snack";

const SLOT_LABEL: Record<SlotTag, string> = { desayuno: "Desayuno", comida: "Comida", cena: "Cena", snack: "Snack" };

/** Las tres franjas de picoteo comparten las recetas con tag snack. */
const SLOT_TAG: Record<MealType, SlotTag> = {
  Desayuno: "desayuno",
  "Media mañana": "snack",
  Comida: "comida",
  Merienda: "snack",
  "Pre-entreno": "snack",
  Cena: "cena",
};

/** Con menos recetas que esto en la franja, el selector se completa con las de otras franjas. */
export const MIN_SLOT_RECIPES = 5;

export function slotTag(mealType: MealType): SlotTag {
  return SLOT_TAG[mealType];
}

/** Tags de franja de una receta; la IA guarda «Cena» con mayúscula, así que no se distingue. */
function slotTagsOf(recipe: Recipe): SlotTag[] {
  return recipe.tags.map((t) => t.toLowerCase()).filter((t): t is SlotTag => t in SLOT_LABEL);
}

/** «Desayuno», «Comida», «Cena» o «Snack» (el primero que lleve); null si la receta no tiene ninguna franja. */
export function slotLabel(recipe: Recipe): string | null {
  const [first] = slotTagsOf(recipe);
  return first ? SLOT_LABEL[first] : null;
}

const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name, "es");

export interface RecipeGroups {
  /** ★ Favoritas: las de la franja, o todas con «Ver todas». */
  favorites: Recipe[];
  /** El resto de la franja (sin las favoritas, que ya salen arriba). */
  slot: Recipe[];
  /** Otras franjas: con «Ver todas», o si la franja tiene pocas recetas. */
  others: Recipe[];
}

export function groupRecipes({
  recipes,
  favorites,
  mealType,
  query,
  showAll,
}: {
  recipes: Recipe[];
  favorites: string[];
  mealType: MealType;
  query: string;
  showAll: boolean;
}): RecipeGroups {
  const tag = slotTag(mealType);
  const inSlot = (r: Recipe) => slotTagsOf(r).includes(tag);
  const q = normalize(query);
  const matches = (r: Recipe) => !q || normalize(r.name).includes(q) || r.tags.some((t) => normalize(t).includes(q));
  const favs = new Set(favorites);

  const found = recipes.filter(matches).sort(byName);
  // Cuántas hay en la franja, sin el buscador: que una búsqueda sin resultados no active «completar con otras»
  const fewInSlot = recipes.filter(inSlot).length < MIN_SLOT_RECIPES;

  const starred = found.filter((r) => favs.has(r.id) && (showAll || inSlot(r)));
  const starredIds = new Set(starred.map((r) => r.id));
  return {
    favorites: starred,
    slot: found.filter((r) => inSlot(r) && !starredIds.has(r.id)),
    // Una favorita de otra franja que no sale en ★ (franja sin «Ver todas») sigue saliendo aquí
    others: showAll || fewInSlot ? found.filter((r) => !inSlot(r) && !starredIds.has(r.id)) : [],
  };
}
