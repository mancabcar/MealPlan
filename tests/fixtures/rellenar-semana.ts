// Datos de «Rellenar semana» (docs/pm/15-autocompletar-semana-ia/spec.md › Acceptance criteria).
// Compartidos por tests/unit/plan-fill-week.test.ts y tests/e2e/rellenar-semana.spec.ts.
//
// "Hoy" es el martes 2026-09-22 (TODAY de tests/e2e/helpers.ts). Semana actual = 21–27 sept (WEEK).
// Las recetas de prueba son inventadas; la métrica y los e2e usan el recetario real (src/data/recipes.json).
// Los nombres evitan los ingredientes base de R8 (tech.md › Ingredientes base) salvo donde el test los busca.
import type { DayPlanSlot, MealType, Recipe, UserProfile, WeekPlan } from "@/lib/types";
import { manuel } from "./profiles";
import { WEEK } from "./shopping";

export { WEEK };
export const TODAY = WEEK[1];
/** De hoy (martes) a domingo: lo que la página pasa a `fillWeek` en la semana actual. */
export const FROM_TODAY = WEEK.slice(1);

/** Generador con semilla (mulberry32): el `random` de los tests. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Slot = "desayuno" | "comida" | "cena" | "snack";

function recipe(
  id: string,
  name: string,
  slot: Slot,
  calories: number,
  protein: number,
  { tags = [], ingredients = [] }: { tags?: string[]; ingredients?: string[] } = {},
): Recipe {
  // HC y grasa coherentes con las kcal (≈ 50 % HC, resto grasa); no condicionan «cumple»
  const carbs = Math.round((calories * 0.5) / 4);
  const fat = Math.round((calories - protein * 4 - carbs * 4) / 9);
  return {
    id,
    name,
    ingredients: ingredients.length ? ingredients : [name.toLowerCase()],
    instructions: ["Preparar."],
    prepTimeMinutes: 15,
    calories,
    protein,
    carbs,
    fat,
    tags: [slot, ...tags],
  };
}

// Perfil base de los unit: 3 comidas, 1500 kcal y proteína 90–120. Cada día cuadra exacto con 1 ración de cada
// franja (500 + 550 + 450 kcal; 30 + 40 + 35 g).
export const FILL_PROFILE: UserProfile = {
  ...manuel,
  name: "Prueba",
  calorieGoal: 1500,
  proteinGoal: 105,
  proteinRange: { min: 90, max: 120 },
  carbsGoal: 190,
  fatGoal: 50,
  meals: ["Desayuno", "Comida", "Cena"],
  tolerancePct: 10,
};

const VEG = { tags: ["vegetariano"] };
const VEGAN = { tags: ["vegetariano", "vegano"] };

export const DESAYUNOS: Recipe[] = [
  recipe("f-yogur-frutos", "Yogur con frutos rojos", "desayuno", 500, 30, VEG),
  recipe("f-tostada-queso", "Tostada con tomate y queso", "desayuno", 500, 30, { tags: ["vegetariano"], ingredients: ["pan", "tomate", "queso fresco"] }),
  recipe("f-crepes-requeson", "Crepes de requesón", "desayuno", 500, 30, VEG),
  recipe("f-kefir-kiwi", "Bol de kéfir con kiwi", "desayuno", 500, 30, { tags: ["vegetariano"], ingredients: ["kéfir", "kiwi"] }),
  recipe("f-tortitas-platano", "Tortitas de plátano", "desayuno", 500, 30, VEGAN),
  recipe("f-muesli", "Muesli con bebida de almendra", "desayuno", 500, 30, VEGAN),
  recipe("f-centeno-fresco", "Pan de centeno con queso fresco", "desayuno", 500, 30, VEG),
  recipe("f-skyr-mango", "Skyr con mango", "desayuno", 500, 30, VEG),
];

export const COMIDAS: Recipe[] = [
  recipe("f-lasana-verduras", "Lasaña de verduras", "comida", 550, 40, VEG),
  recipe("f-cocido-verduras", "Cocido de verduras", "comida", 550, 40, VEGAN),
  recipe("f-estofado-setas", "Estofado de setas", "comida", 550, 40, { tags: ["vegetariano", "vegano"], ingredients: ["setas", "patata"] }),
  recipe("f-paella-verduras", "Paella de verduras", "comida", 550, 40, VEGAN),
  recipe("f-wok-tofu", "Wok de tofu", "comida", 550, 40, VEG),
  recipe("f-hamburguesa-seitan", "Hamburguesa de seitán", "comida", 550, 40, VEG),
  recipe("f-pisto-queso", "Pisto con queso", "comida", 550, 40, VEG),
  recipe("f-berenjenas", "Berenjenas rellenas", "comida", 550, 40, VEG),
];

export const CENAS: Recipe[] = [
  recipe("f-crema-calabacin", "Crema de calabacín con queso", "cena", 450, 35, { tags: ["vegetariano"], ingredients: ["calabacín", "queso"] }),
  recipe("f-ensalada-cabra", "Ensalada de queso de cabra", "cena", 450, 35, VEG),
  recipe("f-revuelto-setas", "Revuelto de setas", "cena", 450, 35, { tags: ["vegetariano"], ingredients: ["setas", "ajo"] }),
  recipe("f-tofu-plancha", "Tofu a la plancha", "cena", 450, 35, VEGAN),
  recipe("f-pizza-verduras", "Pizza de verduras", "cena", 450, 35, VEG),
  recipe("f-sopa-miso", "Sopa de miso", "cena", 450, 35, VEGAN),
  recipe("f-brochetas-seitan", "Brochetas de seitán", "cena", 450, 35, VEGAN),
  recipe("f-calabacin-relleno", "Calabacín relleno", "cena", 450, 35, VEG),
];

// Carne y pescado (para las dietas): mismos macros que su franja, así que encajan igual de bien
export const CARNE_COMIDA = recipe("f-ternera-guisada", "Ternera guisada", "comida", 550, 40);
export const CARNE_CENA = recipe("f-lomo-plancha", "Lomo a la plancha", "cena", 450, 35);
export const PESCADO_CENA = recipe("f-merluza-verde", "Merluza en salsa verde", "cena", 450, 35, { tags: ["pescado"] });
export const MARISCO_COMIDA = recipe("f-gambas-ajillo", "Gambas al ajillo", "comida", 550, 40, { tags: ["marisco"] });

export const FILL_RECIPES: Recipe[] = [...DESAYUNOS, ...COMIDAS, ...CENAS];
export const WITH_ANIMAL: Recipe[] = [...FILL_RECIPES, CARNE_COMIDA, CARNE_CENA, PESCADO_CENA, MARISCO_COMIDA];

/** Comida que por sí sola casi llena el día: 1100 kcal y 60 g (R4: lo asignado cuenta). */
export const COMIDA_GRANDE = recipe("f-cocido-completo", "Cocido completo", "comida", 1100, 60);
/** Comida que ya supera el objetivo del día (R5). */
export const COMIDA_ENORME = recipe("f-mariscada", "Mariscada familiar", "comida", 2500, 150);

// R8: ingredientes base
export const PUCHERO_GARBANZOS = recipe("f-puchero-garbanzos", "Puchero de garbanzos", "comida", 550, 40);
export const HUMMUS_GARBANZO = recipe("f-hummus-garbanzo", "Hummus de garbanzo con verduras", "cena", 450, 35);
export const CREMA_CALABAZA = recipe("f-crema-calabaza", "Crema de calabaza", "cena", 450, 35);
export const TOSTADA_SALMON = recipe("f-tostada-salmon", "Tostada con salmón ahumado", "desayuno", 500, 30);
export const MERLUZA_HORNO = recipe("f-merluza-horno", "Merluza al horno", "cena", 450, 35);
export const HUEVOS_REVUELTOS = recipe("f-huevos-revueltos", "Huevos revueltos", "desayuno", 500, 30);
export const HUEVOS_RELLENOS = recipe("f-huevos-rellenos", "Huevos rellenos", "cena", 450, 35);

// R11: Pre-entreno. Mismos macros: solo cambia el tag «pre-gym»
export const PRE_GYM = recipe("f-batido-pregym", "Batido pre-gym de plátano", "snack", 200, 15, { tags: ["pre-gym"] });
export const SNACKS: Recipe[] = [
  recipe("f-fruta-requeson", "Fruta con requesón", "snack", 200, 15),
  recipe("f-barrita", "Barrita casera de dátiles", "snack", 200, 15),
  recipe("f-yogur-bebible", "Yogur bebible", "snack", 200, 15),
];

// R10/R14: dos cenas idénticas en macros (solo cambia su nombre/tag)
export const CENA_A = recipe("f-cena-a", "Ensalada templada de lombarda", "cena", 450, 35);
export const CENA_B = recipe("f-cena-b", "Ensalada templada de remolacha", "cena", 450, 35);
export const CENA_B_NUTRI: Recipe = { ...CENA_B, tags: [...CENA_B.tags, "plan nutricionista"] };

/** Receta propia con macros vacíos (importada a medias): nunca entra. */
export const SIN_MACROS: Recipe = { ...recipe("f-sin-macros", "Merienda sin datos", "snack", 200, 15), calories: NaN, protein: NaN };

export const slotAt = (plan: WeekPlan, date: string, mealType: MealType): DayPlanSlot | undefined =>
  (plan[date] ?? []).find((s) => s.mealType === mealType);

/** Todas las franjas de unos días, con su fecha. */
export const slotsOf = (plan: WeekPlan, dates: string[]) =>
  dates.flatMap((date) => (plan[date] ?? []).map((slot) => ({ date, ...slot })));
