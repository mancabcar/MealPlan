// Filtros y orden del recetario (docs/pm/111-recetas-valoracion-filtros). Puro: la página decide cuándo aplicarlos.
import { recipeViolations } from "./allergens";
import type { Allergies, Recipe } from "./types";

export const TIME_STEPS = [15, 30, 45];
export const KCAL_STEPS = [300, 400, 500];
export const PROTEIN_STEPS = [20, 30, 40];

export interface RecipeFilterState {
  maxTime: number | null;
  maxKcal: number | null;
  minProtein: number | null;
  hideAllergens: boolean;
}

export type SortKey = "name" | "protein" | "kcal" | "time" | "rating";

export const NO_FILTERS: RecipeFilterState = { maxTime: null, maxKcal: null, minProtein: null, hideAllergens: false };

/** Un valor ausente (receta propia sin dato) cuenta como 0. */
const num = (n: number | undefined) => n ?? 0;

export function filterRecipes(recipes: Recipe[], state: RecipeFilterState, allergies: Allergies | undefined): Recipe[] {
  const hide = state.hideAllergens && allergies !== undefined && (allergies.preset.length > 0 || allergies.custom.length > 0);
  return recipes.filter(
    (r) =>
      (state.maxTime === null || num(r.prepTimeMinutes) <= state.maxTime) &&
      (state.maxKcal === null || num(r.calories) <= state.maxKcal) &&
      (state.minProtein === null || num(r.protein) >= state.minProtein) &&
      (!hide || recipeViolations(r, allergies).length === 0),
  );
}

const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name, "es");

/** Copia ordenada; el empate se resuelve siempre por nombre A–Z. */
export function sortRecipes(recipes: Recipe[], key: SortKey, ratings: Record<string, number>): Recipe[] {
  const diff: Record<SortKey, (a: Recipe, b: Recipe) => number> = {
    name: () => 0,
    protein: (a, b) => num(b.protein) - num(a.protein),
    kcal: (a, b) => num(a.calories) - num(b.calories),
    time: (a, b) => num(a.prepTimeMinutes) - num(b.prepTimeMinutes),
    // Las sin nota valen 0 y quedan al final
    rating: (a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0),
  };
  return [...recipes].sort((a, b) => diff[key](a, b) || byName(a, b));
}

export function countActiveFilters(state: RecipeFilterState): number {
  return [state.maxTime !== null, state.maxKcal !== null, state.minProtein !== null, state.hideAllergens].filter(Boolean).length;
}
