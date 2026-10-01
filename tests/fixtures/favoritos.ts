// Datos de "Recetas: favoritos y selector por franja" (docs/pm/20-recetas-filtros/spec.md › Acceptance criteria).
// Compartidos por tests/unit/recipe-slots.test.ts, tests/unit/favorites.test.ts y tests/e2e/favoritos-franja.spec.ts.
//
// Mezcla de recetas reales del catálogo (por id) y propias inventadas. El store siempre añade las recetas semilla,
// así que las inventadas llevan nombres que no existen en src/data/recipes.json y los tests las localizan por nombre.
import type { Recipe } from "@/lib/types";

export function favRecipe(id: string, name: string, tags: string[], extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name,
    ingredients: ["Ingrediente"],
    instructions: ["Preparar."],
    prepTimeMinutes: 20,
    calories: 300,
    protein: 20,
    carbs: 30,
    fat: 10,
    tags,
    ...extra,
  };
}

// Cenas (tag "cena")
export const CENA_ZARZUELA = favRecipe("f-zarzuela", "Zarzuela de pescado", ["cena", "pescado"]);
export const CENA_PUERROS = favRecipe("f-puerros", "Crema fina de puerros", ["cena", "vegetariano"]);
export const CENA_ALCACHOFAS = favRecipe("f-alcachofas", "Alcachofas al horno", ["cena"]);
/** Con alergia a la lactosa en el perfil: "⚠ contiene Lactosa" (el selector actual ya lo avisa). */
export const CENA_QUESO = favRecipe("f-cena-queso", "Cena de macarrones con queso", ["cena"], {
  ingredients: ["100g macarrones", "50g queso rallado"],
});
/** Receta de IA con el tag capitalizado, como guarda `src/lib/recipePrompt.ts`: la franja se compara sin mayúsculas. */
export const CENA_IA = favRecipe("f-ia-cena", "Cena IA de salmón al papillote", ["Cena", "Alto en proteína"], { isAIGenerated: true });

// Comida, desayuno y snack
export const COMIDA_LENTEJAS = favRecipe("f-lentejas", "Lentejas estofadas de la casa", ["comida", "legumbres"]);
export const DESAYUNO_TOSTADA = favRecipe("f-tostada", "Tostada de tomate y aceite", ["desayuno", "rápido"]);
export const SNACK_YOGUR = favRecipe("f-yogur", "Yogur con nueces y miel", ["snack", "rápido"]);
export const SNACK_PUDIN = favRecipe("f-pudin", "Pudin de chía", ["snack"]);
/** Tiene dos tags de franja: aparece en las dos. */
export const DOBLE_COMIDA_CENA = favRecipe("f-doble", "Ensalada de garbanzos y atún", ["comida", "cena"]);
/** Propia o importada (#18/#19) sin ninguna franja: solo sale en «Ver todas». */
export const SIN_FRANJA = favRecipe("f-sin-franja", "Bizcocho de la abuela", ["postre"]);
/** Con tilde: «pure» debe encontrar «puré». */
export const CENA_PURE = favRecipe("f-pure", "Puré de calabaza asada", ["cena"]);

export const FAV_RECIPES: Recipe[] = [
  CENA_ZARZUELA,
  CENA_PUERROS,
  CENA_ALCACHOFAS,
  CENA_QUESO,
  CENA_IA,
  CENA_PURE,
  COMIDA_LENTEJAS,
  DESAYUNO_TOSTADA,
  SNACK_YOGUR,
  SNACK_PUDIN,
  DOBLE_COMIDA_CENA,
  SIN_FRANJA,
];

/** Cuenta B del mismo navegador para el aislamiento entre usuarios (R4). */
export const OTHER_USER = { id: "e2e-otra", username: "otra" } as const;
