// Rellenar la semana según los objetivos de macros (docs/pm/15-autocompletar-semana-ia, tech.md › Design). Puro, como
// copyWeek: devuelve un plan nuevo y no muta el de entrada. Búsqueda aleatoria del spike (spike.md), endurecida con
// filtros (franja, dieta, alérgenos, «no me gusta») y reglas de coherencia y variedad. `random` se inyecta: la app pasa
// Math.random (cada relleno es distinto) y los tests una semilla.
import { ingredientMatches, recipeViolations } from "../allergens";
import { safeAllergies } from "../recipePrompt";
import { fitsSlot } from "../recipeSlots";
import type { DietType, MealType, Recipe, UserProfile } from "../types";
import { baseIngredientsOf } from "./baseIngredients";

const NUTRI_TAG = "plan nutricionista";
const PRE_GYM_TAG = "pre-gym";

/** Tags que admite cada dieta (R3); omnívora no filtra. */
const DIET_TAGS: Record<DietType, string[] | null> = {
  omnivore: null,
  vegetarian: ["vegetariano", "vegano"],
  vegan: ["vegano"],
  pescetarian: ["vegetariano", "vegano", "pescado", "marisco"],
};

/** Receta candidata, con lo que la búsqueda consulta muchas veces ya calculado. */
interface Candidate {
  recipe: Recipe;
  bases: string[];
  nutri: boolean;
  preGym: boolean;
  /** Peso de muestreo sin la penalización por usos (R10, R14). */
  weight: number;
  /** Bonificación de coste a igualdad de ajuste (R10, R14). */
  bonus: number;
}

const tagsOf = (r: Recipe) => r.tags.map((t) => t.toLowerCase());

const hasFiniteMacros = (r: Recipe) =>
  [r.calories, r.protein, r.carbs, r.fat].every((n) => typeof n === "number" && Number.isFinite(n));

/** Filtros duros que no dependen de la franja: macros válidos, alérgenos, dieta, «no me gusta» y 1 estrella. */
function allowed(r: Recipe, profile: UserProfile, ratings: Record<string, number>): boolean {
  if (!hasFiniteMacros(r)) return false;
  if (ratings[r.id] === 1) return false; // R14
  if (recipeViolations(r, safeAllergies(profile.allergies)).length > 0) return false; // R3
  const dietTags = DIET_TAGS[profile.diet] ?? null;
  if (dietTags) {
    const tags = tagsOf(r);
    if (!dietTags.some((t) => tags.includes(t))) return false; // R3
  }
  const texts = [r.name, ...r.ingredients];
  const dislikes = (profile.dislikedIngredients ?? []).filter((d) => typeof d === "string" && d.trim() !== "");
  return !dislikes.some((d) => texts.some((t) => ingredientMatches(t, d))); // R12
}

/** Recetas que pasan los filtros duros, ya preparadas para la búsqueda. */
function candidates(recipes: Recipe[], profile: UserProfile, favorites: string[], ratings: Record<string, number>): Candidate[] {
  const favs = new Set(favorites);
  return recipes
    .filter((r) => allowed(r, profile, ratings))
    .map((recipe) => {
      const tags = tagsOf(recipe);
      const nutri = tags.includes(NUTRI_TAG);
      const fav = favs.has(recipe.id);
      const good = (ratings[recipe.id] ?? 0) >= 4;
      return {
        recipe,
        bases: baseIngredientsOf(recipe),
        nutri,
        preGym: tags.includes(PRE_GYM_TAG),
        weight: (nutri ? 2.5 : 1) * (fav ? 1.5 : 1) * (good ? 1.3 : 1),
        bonus: (nutri ? 0.04 : 0) + (fav ? 0.03 : 0) + (good ? 0.02 : 0),
      };
    });
}

/** Candidatas de cada comida por franja (fitsSlot; Media mañana, Merienda y Pre-entreno = «snack»). */
function bySlot(all: Candidate[], meals: MealType[]): Map<MealType, Candidate[]> {
  return new Map(meals.map((m) => [m, all.filter((c) => fitsSlot(c.recipe, m))]));
}
