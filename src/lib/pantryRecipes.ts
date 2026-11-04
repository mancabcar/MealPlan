// Recetas que aprovechan la Despensa (docs/pm/16-despensa-recetas). Puro: reutiliza el parser y el matcher de la compra.
import type { PantryItem, Recipe } from "@/lib/types";
import { parseIngredientLine } from "@/lib/shopping/parse";
import { classify } from "@/lib/shopping/classify";
import { indexPantry, matchingItems, type PantryIndex } from "@/lib/shopping/pantryMatch";

export type RecipeUsage = { matched: number; total: number; soonest?: string };

/** Ingredientes que cuentan: ni básicos (sal, agua…) ni opcionales. */
function countedKeys(recipe: Recipe): string[] {
  return recipe.ingredients
    .flatMap(parseIngredientLine)
    .filter((ing) => !ing.optional && !classify(ing.key).basic)
    .map((ing) => ing.key);
}

export function recipeUsage(recipe: Recipe, index: PantryIndex, today: string): RecipeUsage {
  const keys = countedKeys(recipe);
  let matched = 0;
  let soonest: string | undefined;
  for (const key of keys) {
    const items = matchingItems(key, index, today);
    if (items.length === 0) continue;
    matched++;
    for (const { expiryDate } of items) if (expiryDate && (!soonest || expiryDate < soonest)) soonest = expiryDate;
  }
  return { matched, total: keys.length, ...(soonest ? { soonest } : {}) };
}

export function recipesUsingItem(recipes: Recipe[], item: PantryItem, today: string): Recipe[] {
  const index = indexPantry([item]);
  return recipes.filter((r) => countedKeys(r).some((key) => matchingItems(key, index, today).length > 0));
}

export function rankByPantry(recipes: Recipe[], pantry: PantryItem[], today: string): { recipe: Recipe; usage: RecipeUsage }[] {
  const index = indexPantry(pantry);
  return recipes
    .map((recipe) => ({ recipe, usage: recipeUsage(recipe, index, today) }))
    .filter((x) => x.usage.matched >= 1)
    .sort((a, b) => {
      if (b.usage.matched !== a.usage.matched) return b.usage.matched - a.usage.matched;
      const [sa, sb] = [a.usage.soonest, b.usage.soonest];
      if (sa === sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sa < sb ? -1 : 1;
    });
}
