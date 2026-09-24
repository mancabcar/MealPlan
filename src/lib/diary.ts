// Diario desde el plan (docs/pm/diario-desde-plan/tech.md › APIs). Puro: sin React ni store.
// "Pendiente" nunca se guarda: se deriva en cada render del plan y de las entradas.
import { parseDecimal } from "./nutrition";
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe, type WeekPlan } from "./types";

// Raciones (docs/pm/raciones/tech.md › APIs): 0,25–4 en pasos de 0,25.
export const SERVINGS = { min: 0.25, max: 4, step: 0.25 } as const;
export const SERVINGS_ERROR = "Entre 0,25 y 4, en pasos de 0,25";

/**
 * Entrada de receta (la del formulario "Receta" y la de "Hecho"). Con servings ≠ 1 multiplica los cuatro
 * macros sin redondear y guarda `servings`; con 1 es la entrada de siempre, sin ese campo.
 */
export function recipeEntry(
  recipe: Recipe,
  date: string,
  mealType: MealType,
  { servings = 1, id = crypto.randomUUID() }: { servings?: number; id?: string } = {},
): MealEntry {
  const entry: MealEntry = {
    id,
    date,
    mealType,
    recipeId: recipe.id,
    calories: recipe.calories * servings,
    protein: recipe.protein * servings,
    carbs: recipe.carbs * servings,
    fat: recipe.fat * servings,
  };
  if (servings !== 1) entry.servings = servings;
  return entry;
}

/** "0,5" / "0.5" → 0.5. null si no es número, está fuera de [0,25, 4] o no va en pasos de 0,25. */
export function parseServings(text: string): number | null {
  const v = parseDecimal(text);
  // v * 4 es exacto para lo que se teclea con dos decimales; "0,1" → 0,4, no entero
  const ok = Number.isFinite(v) && v >= SERVINGS.min && v <= SERVINGS.max && Number.isInteger(v / SERVINGS.step);
  return ok ? v : null;
}

/** Botones − / + (R8): ±0,25 desde el valor válido actual (o desde 1 si no lo es), acotado a [0,25, 4]. */
export function stepServings(text: string, delta: 1 | -1): number {
  const current = parseServings(text) ?? 1;
  return Math.min(SERVINGS.max, Math.max(SERVINGS.min, current + delta * SERVINGS.step));
}

/** 0.5 → "0,5", 1.25 → "1,25", 2 → "2". Coma decimal fija, sin depender de Intl. */
export function formatServings(n: number): string {
  return String(n).replace(".", ",");
}

/** "× 0,5" para la lista del Diario; null si no hay que mostrar nada (ausente, 1 o dato no numérico). */
export function servingsLabel(entry: Pick<MealEntry, "servings">): string | null {
  const s = entry.servings;
  if (typeof s !== "number" || !Number.isFinite(s) || s === 1) return null;
  return `× ${formatServings(s)}`;
}

export interface PendingSlot {
  mealType: MealType;
  recipe: Recipe;
}

/** Franjas planificadas sin ninguna entrada, en orden MEAL_TYPES. Vacío para fechas futuras. */
export function pendingSlots({
  date,
  today,
  weekPlan,
  recipes,
  entries,
  meals,
}: {
  date: string;
  today: string;
  weekPlan: WeekPlan;
  recipes: Recipe[];
  entries: MealEntry[];
  meals: MealType[];
}): PendingSlot[] {
  // R5: solo hoy y días pasados (YYYY-MM-DD se compara bien como string); "" = input de fecha borrado
  if (date === "" || date > today) return [];
  const slots = weekPlan[date] ?? [];
  // R3/R4/R6: cualquier entrada de esa comida ese día la quita (una pasada por el historial, no una por comida)
  const logged = new Set(entries.filter((e) => e.date === date).map((e) => e.mealType));
  const result: PendingSlot[] = [];
  for (const mt of MEAL_TYPES) {
    if (!meals.includes(mt)) continue;
    // La primera franja de esa comida, como Plan (slots.find)
    const slot = slots.find((s) => s.mealType === mt);
    const recipe = slot && recipes.find((r) => r.id === slot.recipeId);
    if (!recipe) continue;
    if (logged.has(mt)) continue;
    result.push({ mealType: mt, recipe });
  }
  return result;
}
