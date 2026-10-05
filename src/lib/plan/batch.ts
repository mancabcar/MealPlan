// Tandas de batch cooking en el Plan (docs/pm/17-sobras-batch-cooking › R1–R2, R4–R5, R7–R9). Puro: todas las funciones
// devuelven un plan nuevo y lanzan Error ante entradas inválidas (la UI valida antes de llamar).
import { MEAL_TYPES, type DayPlanSlot, type MealType, type WeekPlan } from "../types";
import { weekDates } from "../week";

export const MIN_COOKED_SERVINGS = 2;
export const MAX_COOKED_SERVINGS = 8;

export interface SlotRef {
  date: string;
  mealType: MealType;
}

export interface EligibleSlot extends SlotRef {
  /** false = ya tiene una receta: se muestra deshabilitada (R7). */
  free: boolean;
}

export interface BatchSlot extends SlotRef {
  slot: DayPlanSlot;
}

export interface Batch {
  origin: BatchSlot;
  leftovers: BatchSlot[];
}

const slotAt = (plan: WeekPlan, ref: SlotRef): DayPlanSlot | undefined =>
  (plan[ref.date] ?? []).find((s) => s.mealType === ref.mealType);

const refKey = (r: SlotRef) => `${r.date}|${r.mealType}`;

/** ¿`b` va después de `a`? Por fecha y, dentro del día, por el orden canónico de comidas. */
const isAfter = (a: SlotRef, b: SlotRef) =>
  b.date > a.date || (b.date === a.date && MEAL_TYPES.indexOf(b.mealType) > MEAL_TYPES.indexOf(a.mealType));

/** Devuelve el plan con la franja `ref` sustituida (mismo sitio en el día) o quitada si `next` es null. */
function replaceSlot(plan: WeekPlan, ref: SlotRef, next: DayPlanSlot | null): WeekPlan {
  const day = plan[ref.date] ?? [];
  const exists = day.some((s) => s.mealType === ref.mealType);
  let slots: DayPlanSlot[];
  if (next === null) slots = day.filter((s) => s.mealType !== ref.mealType);
  else if (exists) slots = day.map((s) => (s.mealType === ref.mealType ? next : s));
  else slots = [...day, next];
  return { ...plan, [ref.date]: slots };
}

/** Franjas donde se pueden comer las sobras: desde la comida siguiente a la cocinada hasta el domingo de su semana (R1, R7). */
export function eligibleLeftoverSlots(plan: WeekPlan, origin: SlotRef, meals: MealType[]): EligibleSlot[] {
  const result: EligibleSlot[] = [];
  for (const date of weekDates(origin.date)) {
    for (const mealType of MEAL_TYPES) {
      if (!meals.includes(mealType)) continue;
      const ref = { date, mealType };
      if (!isAfter(origin, ref)) continue;
      result.push({ ...ref, free: slotAt(plan, ref) === undefined });
    }
  }
  return result;
}

/** La tanda con ese id: la cocinada y sus sobras. null si no hay cocinada (una sobra huérfana no forma tanda). */
export function batchOf(plan: WeekPlan, batchId: string): Batch | null {
  let origin: BatchSlot | null = null;
  const leftovers: BatchSlot[] = [];
  for (const [date, slots] of Object.entries(plan)) {
    for (const slot of slots) {
      if (slot.batchId !== batchId) continue;
      if (slot.leftover) leftovers.push({ date, mealType: slot.mealType, slot });
      else if (slot.cookedServings !== undefined) origin = { date, mealType: slot.mealType, slot };
    }
  }
  return origin ? { origin, leftovers } : null;
}

function assertServings(servings: number) {
  if (!Number.isInteger(servings) || servings < MIN_COOKED_SERVINGS || servings > MAX_COOKED_SERVINGS) {
    throw new Error(`Las raciones cocinadas van de ${MIN_COOKED_SERVINGS} a ${MAX_COOKED_SERVINGS}, enteras`);
  }
}

/** N ≥ 1 + sobras; destinos sin repetir, posteriores a la cocinada, de su semana y libres (o ya sobras de esta tanda). */
function assertTargets(plan: WeekPlan, origin: SlotRef, servings: number, targets: SlotRef[], batchId: string) {
  if (targets.length > servings - 1) throw new Error("Hay más franjas de sobras que raciones cocinadas menos una");
  const week = weekDates(origin.date);
  const seen = new Set<string>();
  for (const t of targets) {
    if (seen.has(refKey(t))) throw new Error("Franja de sobras repetida");
    seen.add(refKey(t));
    if (!week.includes(t.date) || !isAfter(origin, t)) throw new Error("La sobra debe ir después de la cocinada, en su semana");
    const existing = slotAt(plan, t);
    if (existing && !(existing.leftover && existing.batchId === batchId)) throw new Error("La franja de sobras ya tiene receta");
  }
}

/** Convierte la franja `origin` (ya con receta) en una cocinada ×`servings` y rellena `targets` con sobras (R1, R2). */
export function createBatch(
  plan: WeekPlan,
  origin: SlotRef,
  servings: number,
  targets: SlotRef[],
  { id = crypto.randomUUID() }: { id?: string } = {},
): WeekPlan {
  assertServings(servings);
  const slot = slotAt(plan, origin);
  if (!slot) throw new Error("La franja cocinada no tiene receta");
  if (slot.batchId !== undefined) throw new Error("La franja ya forma parte de una tanda");
  assertTargets(plan, origin, servings, targets, id);

  let next = replaceSlot(plan, origin, { ...slot, batchId: id, cookedServings: servings });
  for (const t of targets) {
    next = replaceSlot(next, t, { mealType: t.mealType, recipeId: slot.recipeId, batchId: id, leftover: true });
  }
  return next;
}

/** Cambia N y deja exactamente `targets` como sobras: añade las nuevas y quita las que ya no están (R8). */
export function editBatch(plan: WeekPlan, batchId: string, servings: number, targets: SlotRef[]): WeekPlan {
  const batch = batchOf(plan, batchId);
  if (!batch) throw new Error("La tanda no existe");
  assertServings(servings);
  assertTargets(plan, batch.origin, servings, targets, batchId);

  const wanted = new Set(targets.map(refKey));
  let next = replaceSlot(plan, batch.origin, { ...batch.origin.slot, cookedServings: servings });
  for (const l of batch.leftovers) if (!wanted.has(refKey(l))) next = replaceSlot(next, l, null);
  const kept = new Set(batch.leftovers.map(refKey));
  for (const t of targets) {
    if (!kept.has(refKey(t))) {
      next = replaceSlot(next, t, { mealType: t.mealType, recipeId: batch.origin.slot.recipeId, batchId, leftover: true });
    }
  }
  return next;
}

/** Quita una sobra; las raciones cocinadas no cambian (R5). */
export function removeLeftover(plan: WeekPlan, ref: SlotRef): WeekPlan {
  if (!slotAt(plan, ref)?.leftover) throw new Error("La franja no es una sobra");
  return replaceSlot(plan, ref, null);
}

/**
 * Quita la cocinada de la tanda (R4, R9). "all" borra también las sobras; "keep" las deja como franjas normales de la
 * receta. Un id sin cocinada no cambia el plan.
 */
export function deleteOrigin(plan: WeekPlan, batchId: string, mode: "all" | "keep"): WeekPlan {
  const batch = batchOf(plan, batchId);
  if (!batch) return plan;
  let next = replaceSlot(plan, batch.origin, null);
  for (const l of batch.leftovers) {
    next = replaceSlot(next, l, mode === "all" ? null : { mealType: l.mealType, recipeId: l.slot.recipeId, ...(l.slot.servings === undefined ? {} : { servings: l.slot.servings }) });
  }
  return next;
}
