// Alérgenos (spec R10, R18). Puro y compartido: lo usan el route handler de recetas y la UI.
import type { Allergies, PresetAllergen, Recipe } from "./types";

export const ALLERGEN_LABELS: Record<PresetAllergen, string> = {
  frutos_secos: "Frutos secos",
  gluten: "Gluten",
  lactosa: "Lactosa",
  marisco: "Marisco",
  huevo: "Huevo",
  soja: "Soja",
};

export const PRESET_ALLERGENS = Object.keys(ALLERGEN_LABELS) as PresetAllergen[];

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

/** Minúsculas, sin acentos, espacios colapsados. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const tokenize = (value: string) => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);

/** "almendra" ↔ "almendras", "piñón" ↔ "piñones", "nuez" ↔ "nueces". */
function wordMatches(word: string, term: string): boolean {
  return (
    word === term ||
    word === `${term}s` ||
    word === `${term}es` ||
    (term.endsWith("z") && word === `${term.slice(0, -1)}ces`)
  );
}

/** Posiciones donde empieza `term` (una o varias palabras) dentro de `words`. */
function findTerm(words: string[], term: string[]): number[] {
  const hits: number[] = [];
  for (let i = 0; i + term.length <= words.length; i++) {
    if (term.every((t, j) => wordMatches(words[i + j], t))) hits.push(i);
  }
  return hits;
}

/** Una clave preset, o el nombre de una etiqueta preset escrito a mano ("gluten"). */
function asPreset(allergen: string): PresetAllergen | undefined {
  if (allergen in ALLERGEN_FAMILIES) return allergen as PresetAllergen;
  return PRESET_ALLERGENS.find((p) => normalize(ALLERGEN_LABELS[p]) === normalize(allergen));
}

/** Términos que cuentan como el alérgeno, y nombres que anulan la coincidencia tras "sin". */
function termsFor(allergen: string): { terms: string[][]; names: string[][] } {
  const preset = asPreset(allergen);
  if (!preset) {
    const own = [tokenize(allergen)];
    return { terms: own, names: own };
  }
  const terms = ALLERGEN_FAMILIES[preset].map(tokenize);
  return { terms, names: [tokenize(ALLERGEN_LABELS[preset]), ...terms] };
}

/**
 * `allergen` es una clave preset (usa su familia) o el nombre de un alérgeno libre (solo su nombre).
 * Coincide por palabras completas, acepta plurales (-s, -es, z→ces) e ignora "sin <alérgeno>".
 */
export function ingredientMatches(ingredient: string, allergen: PresetAllergen | string): boolean {
  const words = tokenize(ingredient);
  const { terms, names } = termsFor(allergen);
  // "leche sin lactosa", "pan sin gluten": el producto declara no tener ese alérgeno
  const declaredFree = names.some((name) => findTerm(words, ["sin", ...name]).length > 0);
  if (declaredFree) return false;
  return terms.some((term) => findTerm(words, term).length > 0);
}

/** Aviso no bloqueante para recetas del recetario y los selectores: "⚠ contiene Frutos secos". */
export function allergenWarning(
  recipe: Pick<Recipe, "name" | "ingredients">,
  allergies: Allergies | undefined,
): string | null {
  const found = allergies ? recipeViolations(recipe, allergies) : [];
  return found.length ? `⚠ contiene ${found.join(", ")}` : null;
}

/** Alérgenos (por su etiqueta) presentes en el nombre o los ingredientes. Vacío = segura. */
export function recipeViolations(recipe: Pick<Recipe, "name" | "ingredients">, allergies: Allergies): string[] {
  const texts = [recipe.name, ...recipe.ingredients];
  const all = [
    ...allergies.preset.map((p) => ({ key: p as string, label: ALLERGEN_LABELS[p] })),
    ...allergies.custom.map((c) => ({ key: c, label: c })),
  ];
  return all.filter(({ key }) => texts.some((t) => ingredientMatches(t, key))).map(({ label }) => label);
}
