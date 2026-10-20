// Rellenar la semana según los objetivos de macros (docs/pm/15-autocompletar-semana-ia, tech.md › Design). Puro, como
// copyWeek: devuelve un plan nuevo y no muta el de entrada. Búsqueda aleatoria del spike (spike.md), endurecida con
// filtros (franja, dieta, alérgenos, «no me gusta») y reglas de coherencia y variedad. `random` se inyecta: la app pasa
// Math.random (cada relleno es distinto) y los tests una semilla.
import { ingredientMatches, recipeViolations } from "../allergens";
import { macroStatus, macroTarget, type MacroTarget, type Macros } from "../planMacros";
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

// ── Búsqueda de un día (tech.md › Algoritmo, pasos 4–6) ──────────────────────────────────────────────────────────────

/** Raciones posibles (R9): 0,5–2 en pasos de 0,25. */
const SERVINGS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** Combinaciones probadas por día. El spike usó 400; el test de presupuesto (R13) vigila que siga por debajo de 300 ms. */
const ATTEMPTS = 400;
/** Pasadas del ajuste de raciones por descenso coordenado. */
const PASSES = 3;

interface Pick {
  meal: MealType;
  c: Candidate;
  servings: number;
}

interface DayInput {
  /** Macros de lo ya asignado en el día (misma suma que el resumen del día). */
  fixed: Macros;
  fixedIds: ReadonlySet<string>;
  fixedBases: ReadonlySet<string>;
  /** Comidas sin franja, en el orden del perfil. */
  holes: MealType[];
  pool: Map<MealType, Candidate[]>;
  /** Veces que cada receta sale ya en la semana (lo puesto a mano y lo rellenado). */
  uses: ReadonlyMap<string, number>;
  profile: UserProfile;
  tol: number;
  random: () => number;
}

/**
 * Coste de quedarse fuera del objetivo: 0 si el resumen del día lo daría por cumplido (misma regla, macroStatus); si no,
 * 1 más la distancia al borde ×4. El 1 hace que cualquier día que cumple gane a cualquiera que no.
 */
function miss(value: number, target: MacroTarget, tol: number): number {
  if (macroStatus(value, target, tol) === "within") return 0;
  const [lo, hi, scale] =
    typeof target === "number"
      ? [(target * (100 - tol)) / 100, (target * (100 + tol)) / 100, target]
      : [target.min, target.max, (target.min + target.max) / 2];
  const gap = value < lo ? lo - value : Math.max(0, value - hi);
  return 1 + (4 * gap) / Math.max(scale, 1);
}

const deviation = (value: number, goal: number) => (goal > 0 ? Math.abs(value - goal) / goal : 0);

/** Coste del día (menor gana): cumplir kcal y proteína, acercar HC y grasa, variar, preferencias y raciones enteras. */
function dayCost(day: DayInput, picks: Pick[]): number {
  const t = { ...day.fixed };
  for (const { c, servings } of picks) {
    t.calories += c.recipe.calories * servings;
    t.protein += c.recipe.protein * servings;
    t.carbs += c.recipe.carbs * servings;
    t.fat += c.recipe.fat * servings;
  }
  const { profile, tol } = day;
  let cost =
    miss(t.calories, macroTarget("calories", profile), tol) +
    miss(t.protein, macroTarget("protein", profile), tol) +
    deviation(t.calories, profile.calorieGoal) +
    0.4 * deviation(t.carbs, profile.carbsGoal) +
    0.4 * deviation(t.fat, profile.fatGoal);
  for (const { c, servings } of picks) {
    cost += 0.12 * (day.uses.get(c.recipe.id) ?? 0) - c.bonus + 0.03 * Math.abs(servings - 1);
  }
  return cost;
}

/** Muestreo ponderado: preferencias (R10, R14) y menos peso cuantas más veces sale ya en la semana (R7). */
function weightedPick(choices: Candidate[], uses: ReadonlyMap<string, number>, random: () => number): Candidate {
  const w = choices.map((c) => c.weight / (1 + 2 * (uses.get(c.recipe.id) ?? 0)));
  let x = random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < choices.length; i++) if ((x -= w[i]) <= 0) return choices[i];
  return choices[choices.length - 1];
}

/**
 * Una combinación al azar para los huecos. Sin repetir receta ni ingrediente base en el día, contando lo fijo (R8).
 * Lo ya usado en la semana solo entra si el hueco no tiene otra opción (R7); Pre-entreno, «pre-gym» primero (R11).
 * Un hueco sin ninguna candidata queda fuera (vacío).
 */
function sample(day: DayInput): Pick[] {
  const ids = new Set(day.fixedIds);
  const bases = new Set(day.fixedBases);
  const picks: Pick[] = [];
  for (const meal of day.holes) {
    const avail = (day.pool.get(meal) ?? []).filter((c) => !ids.has(c.recipe.id) && c.bases.every((b) => !bases.has(b)));
    const fresh = avail.filter((c) => !day.uses.get(c.recipe.id));
    const preGym = meal === "Pre-entreno" ? fresh.filter((c) => c.preGym) : [];
    const choices = preGym.length > 0 ? preGym : fresh.length > 0 ? fresh : avail;
    if (choices.length === 0) continue;
    const c = weightedPick(choices, day.uses, day.random);
    ids.add(c.recipe.id);
    for (const b of c.bases) bases.add(b);
    picks.push({ meal, c, servings: 1 });
  }
  return picks;
}

/** Ajusta las raciones de una combinación por descenso coordenado (R9). Muta `picks`. */
function tuneServings(day: DayInput, picks: Pick[]): number {
  let cost = dayCost(day, picks);
  for (let pass = 0; pass < PASSES; pass++) {
    for (const p of picks) {
      let best = p.servings;
      for (const s of SERVINGS) {
        p.servings = s;
        const c = dayCost(day, picks);
        if (c < cost) [cost, best] = [c, s];
      }
      p.servings = best;
    }
  }
  return cost;
}

/** La mejor combinación de ATTEMPTS para los huecos del día. */
function searchDay(day: DayInput): Pick[] {
  let best: { picks: Pick[]; cost: number } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const picks = sample(day);
    if (picks.length === 0) return []; // ningún hueco tiene candidatas: no cambia entre intentos
    const cost = tuneServings(day, picks);
    // Más huecos cubiertos gana siempre; a igualdad, menor coste
    if (!best || picks.length > best.picks.length || (picks.length === best.picks.length && cost < best.cost)) {
      best = { picks, cost };
    }
  }
  return best?.picks ?? [];
}
