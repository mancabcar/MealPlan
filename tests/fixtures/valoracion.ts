// Datos de "Recetas: valoración, filtros y orden" (docs/pm/111-recetas-valoracion-filtros/spec.md › Acceptance criteria).
// Compartidos por tests/unit/recipe-filters.test.ts y tests/e2e/valoracion-filtros.spec.ts.
//
// Recetas propias inventadas, con tiempo, kcal y proteína conocidos para que cada tramo dé un resultado exacto. El store
// siempre añade las recetas semilla, así que los nombres no existen en src/data/recipes.json y los e2e las localizan por
// nombre (con la búsqueda de texto o mirando solo las propias).
import type { Allergies, Recipe } from "@/lib/types";

export function valRecipe(id: string, name: string, time: number, kcal: number, protein: number, extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name,
    ingredients: ["Ingrediente"],
    instructions: ["Preparar."],
    prepTimeMinutes: time,
    calories: kcal,
    protein,
    carbs: 30,
    fat: 10,
    tags: ["comida"],
    ...extra,
  };
}

// Nombre = «Vx <rasgo>», para ordenar A–Z de forma predecible (V1 < V2 < …).
/** Rápida, ligera y con poca proteína: 10 min, 250 kcal, 15 g. */
export const V1_TOSTA = valRecipe("v-tosta", "V1 Tosta ligera", 10, 250, 15);
/** 15 min, 300 kcal, 20 g: justo en el borde de los tramos más bajos. */
export const V2_BOWL = valRecipe("v-bowl", "V2 Bowl de yogur", 15, 300, 20);
/** 30 min, 400 kcal, 30 g: en el borde de los tramos medios. */
/** Con quinoa y tamarindo: dos coincidencias con la Despensa de los e2e («Usa lo que tengo»). */
export const V3_POLLO = valRecipe("v-pollo", "V3 Pollo a la plancha", 30, 400, 30, {
  ingredients: ["150g pollo", "80g quinoa", "1 cucharada tamarindo"],
});
/** 30 min, 450 kcal, 35 g: rápida y con proteína, pero con frutos secos. */
export const V4_SALMON = valRecipe("v-salmon", "V4 Salmón con almendras", 30, 450, 35, {
  ingredients: ["150g salmón", "20g almendras"],
});
/** 45 min, 500 kcal, 40 g. */
/** Con quinoa: una sola coincidencia con la Despensa de los e2e. */
export const V5_TERNERA = valRecipe("v-ternera", "V5 Ternera guisada", 45, 500, 40, {
  ingredients: ["200g ternera", "80g quinoa"],
});
/** 60 min, 700 kcal, 10 g: fuera de todos los tramos. */
export const V6_ESTOFADO = valRecipe("v-estofado", "V6 Estofado largo", 60, 700, 10);
/** Sin tiempo, sin kcal y sin proteína guardados (propia a medio rellenar): cuentan como 0. */
export const V7_VACIA = { ...valRecipe("v-vacia", "V7 Receta a medias", 0, 0, 0) } as Recipe;
/** Misma proteína que V3 y V4 para comprobar el empate por nombre. */
export const V8_EMPATE = valRecipe("v-empate", "V8 Empate de macros", 20, 420, 30);

export const VAL_RECIPES: Recipe[] = [V6_ESTOFADO, V3_POLLO, V8_EMPATE, V1_TOSTA, V5_TERNERA, V7_VACIA, V2_BOWL, V4_SALMON];

/** Notas: V5=5, V3=4, V1=4, V2=2; el resto sin valorar. */
export const VAL_RATINGS: Record<string, number> = {
  [V5_TERNERA.id]: 5,
  [V3_POLLO.id]: 4,
  [V1_TOSTA.id]: 4,
  [V2_BOWL.id]: 2,
};

export const NO_ALLERGIES: Allergies = { preset: [], custom: [] };
export const NUTS_ALLERGY: Allergies = { preset: ["frutos_secos"], custom: [] };
