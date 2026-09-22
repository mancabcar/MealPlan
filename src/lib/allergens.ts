// Alérgenos (spec R10, R18). Puro y compartido: lo usa el route handler de recetas.
// STUB: el contrato lo fija tests/unit/allergens.test.ts; la implementación llega con dev-code.
import type { Allergies, PresetAllergen, Recipe } from "./types";

export const ALLERGEN_LABELS: Record<PresetAllergen, string> = {
  frutos_secos: "Frutos secos",
  gluten: "Gluten",
  lactosa: "Lactosa",
  marisco: "Marisco",
  huevo: "Huevo",
  soja: "Soja",
};

/** Tabla "Allergen families" del spec. */
export const ALLERGEN_FAMILIES: Record<PresetAllergen, string[]> = {
  frutos_secos: [
    "almendra", "nuez", "avellana", "anacardo", "pistacho", "piñón", "macadamia",
    "pecana", "nuez de Brasil", "cacahuete", "praliné", "mazapán", "turrón",
  ],
  gluten: [
    "trigo", "cebada", "centeno", "espelta", "kamut", "avena", "sémola", "cuscús",
    "bulgur", "seitán", "harina", "pan", "pasta", "cerveza",
  ],
  lactosa: ["leche", "nata", "mantequilla", "queso", "yogur", "requesón", "cottage", "suero de leche", "bechamel"],
  marisco: [
    "gamba", "langostino", "cigala", "cangrejo", "bogavante", "langosta", "mejillón",
    "almeja", "berberecho", "navaja", "vieira", "calamar", "sepia", "pulpo",
  ],
  huevo: ["huevo", "clara", "yema", "mayonesa", "merengue", "alioli"],
  soja: ["soja", "tofu", "tempeh", "edamame", "miso", "tamari"],
};

function notImplemented(fn: string): never {
  throw new Error(`${fn}: not implemented`);
}

/** Minúsculas, sin acentos, espacios colapsados. */
export function normalize(value: string): string {
  void value;
  return notImplemented("normalize");
}

/**
 * `allergen` es una clave preset (usa su familia) o el nombre de un alérgeno libre (solo su nombre).
 * Coincide por palabras completas, acepta plurales (-s, -es, z→ces) e ignora "sin <alérgeno>".
 */
export function ingredientMatches(ingredient: string, allergen: PresetAllergen | string): boolean {
  void ingredient;
  void allergen;
  return notImplemented("ingredientMatches");
}

/** Términos que coinciden en el nombre o los ingredientes. Vacío = segura. */
export function recipeViolations(recipe: Pick<Recipe, "name" | "ingredients">, allergies: Allergies): string[] {
  void recipe;
  void allergies;
  return notImplemented("recipeViolations");
}
