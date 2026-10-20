// Ingredientes base para la coherencia del día al rellenar la semana (docs/pm/15-autocompletar-semana-ia, R8).
// Lista cerrada, buscada solo en el NOMBRE de la receta: un día no lleva dos platos del mismo ingrediente base.
// Cada grupo es un ingrediente; sus sinónimos cuentan como el mismo. El huevo no está a propósito (demasiado estricto).
import { hasWords } from "../allergens";
import type { Recipe } from "../types";

export const BASE_INGREDIENTS: Record<string, string[]> = {
  // Legumbres
  garbanzo: ["garbanzo"],
  lenteja: ["lenteja"],
  alubia: ["alubia", "judía blanca"],
  soja: ["edamame", "soja"],
  // Pescado y marisco
  salmón: ["salmón"],
  atún: ["atún"],
  merluza: ["merluza"],
  bacalao: ["bacalao"],
  dorada: ["dorada"],
  caballa: ["caballa"],
  gamba: ["gamba", "langostino"],
  // Carnes
  pollo: ["pollo"],
  pavo: ["pavo"],
  ternera: ["ternera"],
  cerdo: ["cerdo", "lomo"],
  jamón: ["jamón"],
  // Cereales
  arroz: ["arroz"],
  pasta: ["pasta"],
  quinoa: ["quinoa"],
  avena: ["avena"],
};

/** Ingredientes base (las claves de BASE_INGREDIENTS) que menciona el nombre de la receta. */
export function baseIngredientsOf(recipe: Pick<Recipe, "name">): string[] {
  return Object.entries(BASE_INGREDIENTS)
    .filter(([, terms]) => terms.some((t) => hasWords(recipe.name, t)))
    .map(([base]) => base);
}
