// Diario desde el plan (docs/pm/diario-desde-plan/tech.md › APIs). Puro: sin React ni store.
// "Pendiente" nunca se guarda: se deriva en cada render del plan y de las entradas.
import { scaleMacros, type Per100 } from "./foods";
import { parseDecimal } from "./nutrition";
import { slotMacros, slotServings } from "./planMacros";
import { addDays, dayName, toDateStr } from "./week";
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
    // Mismo escalado que el Plan (docs/pm/10-macros-plan, R9): un único punto receta × raciones
    ...slotMacros(recipe, servings),
  };
  if (servings !== 1) entry.servings = servings;
  return entry;
}

/** "0,5" / "0.5" → 0.5. null si no es número, está fuera de [0,25, 4] o no va en pasos de 0,25. */
export function parseServings(text: string): number | null {
  const v = parseDecimal(text);
  // v / 0,25 es exacto en coma flotante (0,25 es potencia de 2): "0,75" → 3, "0,1" → 0,4, no entero.
  // Con un paso que no sea potencia de 2 (p. ej. 0,1) habría que comparar con tolerancia.
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

/**
 * Entrada de alimento (docs/pm/13-base-alimentos, R8): el nombre va en customName, así el Diario, las medias y las
 * copias de seguridad la tratan como una personalizada. Macros sin redondear; `units` solo si se registró en unidades.
 */
export function foodEntry(
  food: { foodId: string; name: string; per100: Per100 },
  date: string,
  mealType: MealType,
  { grams, units, id = crypto.randomUUID() }: { grams: number; units?: number; id?: string },
): MealEntry {
  const entry: MealEntry = {
    id,
    date,
    mealType,
    customName: food.name,
    foodId: food.foodId,
    grams,
    ...scaleMacros(food.per100, grams),
  };
  if (units !== undefined) entry.units = units;
  return entry;
}

/** R9: «150 g», o «2 ud · 120 g» si se registró en unidades; null sin gramos (recetas, personalizadas, datos raros). */
export function quantityLabel(entry: Pick<MealEntry, "grams" | "units">): string | null {
  const g = entry.grams;
  if (typeof g !== "number" || !Number.isFinite(g)) return null;
  const grams = `${Math.round(g)} g`;
  const u = entry.units;
  return typeof u === "number" && Number.isFinite(u) ? `${formatServings(u)} ud · ${grams}` : grams;
}

export interface PendingSlot {
  mealType: MealType;
  recipe: Recipe;
  /** Raciones planificadas (docs/pm/29-raciones-plan, R6): las que registra "Hecho". 1 si la franja no las tiene. */
  servings: number;
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
    result.push({ mealType: mt, recipe, servings: slotServings(slot) });
  }
  return result;
}

// Recientes (docs/pm/12-registro-rapido/tech.md › APIs): derivado de `entries` en cada render, nunca se guarda (R7).
export const RECENT_LIMIT = 5;

export interface RecentMeal {
  /** Clave de duplicado (R2). También sirve de React key. */
  key: string;
  /** Nombre a mostrar: el de la receta o el customName de la entrada más reciente del grupo. */
  name: string;
  /** La entrada más reciente del grupo (de cualquier franja): la que se copia. */
  entry: MealEntry;
}

/**
 * R2: misma receta y raciones, o mismo nombre (sin mayúsculas ni espacios extra) y mismos macros.
 * Alimentos (docs/pm/13-base-alimentos, R13): mismo alimento de origen y misma cantidad (gramos, o unidades).
 */
function recentKey(e: MealEntry): string {
  if (e.recipeId) return `r|${e.recipeId}|${e.servings ?? 1}`;
  if (e.foodId) return e.units !== undefined ? `f|${e.foodId}|${e.units}ud` : `f|${e.foodId}|${e.grams}g`;
  const name = (e.customName ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return `c|${name}|${e.calories}|${e.protein}|${e.carbs}|${e.fat}`;
}

/** Recientes (R2, R3, R7): hasta `limit` comidas distintas, primero las registradas alguna vez en `mealType`. */
export function recentMeals({
  entries,
  recipes,
  mealType,
  limit = RECENT_LIMIT,
}: {
  entries: MealEntry[];
  recipes: Recipe[];
  mealType: MealType;
  limit?: number;
}): RecentMeal[] {
  // R3: el orden del array es el orden de registro (addEntry añade al final), así que se recorre desde el final
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const byKey = new Map<string, RecentMeal>();
  const franja: string[] = [];
  const seenInFranja = new Set<string>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    let name = e.customName ?? "";
    if (e.recipeId) {
      // R7: sin receta no hay nombre fiable
      const recipe = recipeById.get(e.recipeId);
      if (!recipe) continue;
      name = recipe.name;
    }
    const key = recentKey(e);
    // La primera vez que sale una clave es su entrada más reciente: de ella salen el nombre y lo que se copia
    if (!byKey.has(key)) byKey.set(key, { key, name, entry: e });
    // Cuenta como "de esa franja" si alguna de sus entradas es de ella, por la última de esas entradas
    if (e.mealType === mealType && !seenInFranja.has(key)) {
      seenInFranja.add(key);
      franja.push(key);
    }
  }
  const rest = [...byKey.keys()].filter((k) => !seenInFranja.has(k));
  return [...franja, ...rest].slice(0, limit).map((k) => byKey.get(k)!);
}

/** Copia de una entrada con id, fecha y franja nuevos (R4): conserva macros, recipeId, customName y servings. */
export function repeatEntry(entry: MealEntry, date: string, mealType: MealType, id = crypto.randomUUID()): MealEntry {
  return { ...entry, id, date, mealType };
}

// Copiar un día del Diario (docs/pm/54-copiar-diario/tech.md › APIs). Puro: la hoja y el Diario solo lo cablean.

/** R2: las entradas de `from` duplicadas en `to`, con id nuevo y todo lo demás intacto, en su orden de registro. */
export function copyDay(entries: MealEntry[], from: string, to: string, newId: () => string = () => crypto.randomUUID()): MealEntry[] {
  return entries.filter((e) => e.date === from).map((e) => repeatEntry(e, to, e.mealType, newId()));
}

/** R6: fecha de calendario YYYY-MM-DD válida y distinta del día de origen ("" = input borrado). */
export function canCopyTo(origin: string, target: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target) || target === origin) return false;
  // 2026-02-30 pasa el patrón pero Date lo desplaza a marzo: no vuelve a ser la misma fecha
  return toDateStr(new Date(target + "T00:00:00")) === target;
}

const COPY_TARGETS = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "En 7 días", days: 7 },
];

/** R7: atajos de la hoja, contados desde hoy y sin el que coincide con el día de origen. */
export function copyTargets(origin: string, today: string): { label: string; date: string }[] {
  return COPY_TARGETS.map(({ label, days }) => ({ label, date: addDays(today, days) })).filter((t) => t.date !== origin);
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-05" → "lun 5 oct". Coma fija, sin depender de Intl (como formatServings). */
export function formatDayShort(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const name = dayName(date);
  if (!name || !MONTHS_SHORT[month - 1]) return date;
  return `${name.slice(0, 3).toLowerCase()} ${day} ${MONTHS_SHORT[month - 1]}`;
}

/** Nombre de la entrada en el Diario y en el aviso de conflicto: el propio, el de su receta o «Receta». */
export function entryName(entry: Pick<MealEntry, "customName" | "recipeId">, recipes: Recipe[]): string {
  return entry.customName ?? recipes.find((r) => r.id === entry.recipeId)?.name ?? "Receta";
}
