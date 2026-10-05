// Frutas y verduras de temporada (docs/pm/34-temporada). Puro: el calendario es un dato estático
// (src/data/seasonal.json) y todo se calcula al vuelo con el mes; nada se guarda en las recetas (R6).
// Casa los ingredientes como la lista de la compra: parser y clave normalizada, por palabra completa.
import seasonalJson from "@/data/seasonal.json";
import { parseIngredientLine } from "@/lib/shopping/parse";
import { todayStr, type Recipe } from "@/lib/types";

export interface SeasonalProduct {
  /** Slug para la URL: ?producto=<id>. */
  id: string;
  name: string;
  kind: "verdura" | "fruta";
  /** Meses de temporada plena, 1–12. */
  months: number[];
  /** Palabras clave ya normalizadas con normalizeKey. */
  keywords: string[];
  /** Básico de todo el año (cebolla, ajo…): no cuenta para destacar y solo sale en el calendario completo. */
  basic?: true;
}

export const SEASONAL_PRODUCTS = seasonalJson as SeasonalProduct[];

export type SeasonMark = "empieza" | "últimas";

/** Mes (1–12) de la fecha del dispositivo: la misma que usa todayStr(), para que el reloj de los tests lo controle. */
export function currentMonth(): number {
  return Number(todayStr().slice(5, 7));
}

/** «empieza» en el primer mes de la ventana y «últimas» en el último; la ventana es circular (nov–feb).
 * Un producto de un solo mes, o de los 12, no lleva marca. */
export function monthMark(product: SeasonalProduct, month: number): SeasonMark | null {
  const months = new Set(product.months);
  if (!months.has(month) || months.size === 1 || months.size === 12) return null;
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  if (!months.has(prev)) return "empieza";
  if (!months.has(next)) return "últimas";
  return null;
}

/** Productos del mes para la franja: separados por tipo y sin los básicos. */
export function seasonalProducts(
  month: number,
  products: SeasonalProduct[] = SEASONAL_PRODUCTS,
): { verduras: SeasonalProduct[]; frutas: SeasonalProduct[] } {
  const inSeason = products.filter((p) => !p.basic && p.months.includes(month));
  return {
    verduras: inSeason.filter((p) => p.kind === "verdura"),
    frutas: inSeason.filter((p) => p.kind === "fruta"),
  };
}

// Las claves de una receta no dependen del mes ni del calendario: se calculan una vez por receta
const keysCache = new WeakMap<Recipe, string[]>();

/** Claves normalizadas de los ingredientes de la receta, sin los opcionales. */
function ingredientKeys(recipe: Recipe): string[] {
  let keys = keysCache.get(recipe);
  if (!keys) {
    keys = recipe.ingredients.flatMap(parseIngredientLine).filter((ing) => !ing.optional).map((ing) => ing.key);
    keysCache.set(recipe, keys);
  }
  return keys;
}

/** Palabra completa, no subcadena: «col» no casa con «colorante» ni con «coliflor». */
function mentions(keys: string[], product: SeasonalProduct): boolean {
  return product.keywords.some((kw) => keys.some((key) => ` ${key} `.includes(` ${kw} `)));
}

/** Productos de temporada del mes que lleva la receta (sin básicos), cada uno una sola vez. */
export function seasonalIn(recipe: Recipe, month: number, products: SeasonalProduct[] = SEASONAL_PRODUCTS): SeasonalProduct[] {
  const keys = ingredientKeys(recipe);
  return products.filter((p) => !p.basic && p.months.includes(month) && mentions(keys, p));
}

/** Las `limit` recetas con más productos de temporada: de más a menos; empate, favoritas y luego A–Z. */
export function featuredRecipes(
  recipes: Recipe[],
  favorites: string[],
  month: number,
  limit = 10,
  products: SeasonalProduct[] = SEASONAL_PRODUCTS,
): Recipe[] {
  const fav = new Set(favorites);
  return recipes
    .map((recipe) => ({ recipe, count: seasonalIn(recipe, month, products).length }))
    .filter((x) => x.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(fav.has(b.recipe.id)) - Number(fav.has(a.recipe.id)) ||
        a.recipe.name.localeCompare(b.recipe.name, "es"),
    )
    .slice(0, limit)
    .map((x) => x.recipe);
}

/** Recetas que llevan el producto, en cualquier mes. */
export function recipesWithProduct(recipes: Recipe[], product: SeasonalProduct): Recipe[] {
  return recipes.filter((r) => mentions(ingredientKeys(r), product));
}

/** Productos de temporada del mes que lleva una línea de ingrediente (para marcarla en el detalle de la receta). */
export function seasonalInLine(line: string, month: number, products: SeasonalProduct[] = SEASONAL_PRODUCTS): SeasonalProduct[] {
  const keys = parseIngredientLine(line).filter((ing) => !ing.optional).map((ing) => ing.key);
  return products.filter((p) => !p.basic && p.months.includes(month) && mentions(keys, p));
}

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
/** Tres letras: cabeceras del calendario y de la barra de 12 meses. */
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
