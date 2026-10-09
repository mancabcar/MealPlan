// Copiar la semana anterior en el Plan (docs/pm/53-copiar-semana-anterior › R1–R4). Puro: devuelve un plan nuevo y no
// muta el de entrada. `monday` es el lunes de la semana DESTINO; el origen es siempre la semana anterior.
import type { DayPlanSlot, MealType, WeekPlan } from "../types";
import { slotServings } from "../planMacros";
import { addDays, weekDates } from "../week";
import { deleteOrigin } from "./batch";

/** «conserve»: solo se rellenan las vacías. «replace»: las ocupadas se sustituyen (R2). */
export type CopyMode = "keep" | "replace";

export interface CopySlot {
  /** Fecha de destino. */
  date: string;
  mealType: MealType;
  /** La franja tal como quedará en el destino (con `batchId` nuevo si es de una tanda). */
  slot: DayPlanSlot;
}

interface Entry extends CopySlot {
  /** El destino ya tiene una franja distinta en ese sitio. */
  conflict: boolean;
  /** `batchId` nuevo si la franja es de una tanda: o entra entera o no entra («conservar»). */
  group?: string;
}

const slotAt = (plan: WeekPlan, date: string, mealType: MealType): DayPlanSlot | undefined =>
  (plan[date] ?? []).find((s) => s.mealType === mealType);

/** Pone `slot` en su sitio del día (sustituye la de esa comida o la añade). */
function put(plan: WeekPlan, date: string, slot: DayPlanSlot): WeekPlan {
  const day = (plan[date] ?? []).filter((s) => s.mealType !== slot.mealType);
  return { ...plan, [date]: [...day, slot] };
}

/** ¿La semana anterior a la de `monday` no tiene ninguna franja? (R4) */
export function isSourceEmpty(plan: WeekPlan, monday: string): boolean {
  return weekDates(addDays(monday, -7)).every((d) => (plan[d] ?? []).length === 0);
}

/** Franjas a copiar y sus conflictos; las idénticas a lo que ya hay (receta y raciones, sin tanda) no cuentan. */
function build(plan: WeekPlan, monday: string, recipeIds: ReadonlySet<string>) {
  const sourceDates = weekDates(addDays(monday, -7));

  const source = sourceDates.flatMap((date) =>
    (plan[date] ?? []).filter((s) => recipeIds.has(s.recipeId)).map((slot) => ({ date, slot })),
  );

  // Una tanda solo se copia como tal si su cocinada y alguna sobra caen en la semana origen (R3); si no, queda en franjas normales
  const newBatchIds = new Map<string, string>();
  for (const { slot } of source) {
    if (!slot.batchId || newBatchIds.has(slot.batchId)) continue;
    const members = source.filter((e) => e.slot.batchId === slot.batchId);
    if (members.some((e) => !e.slot.leftover && e.slot.cookedServings !== undefined) && members.some((e) => e.slot.leftover)) {
      newBatchIds.set(slot.batchId, crypto.randomUUID());
    }
  }

  const entries: Entry[] = [];
  for (const { date, slot } of source) {
    const { batchId, cookedServings, leftover, ...rest } = slot;
    const group = batchId ? newBatchIds.get(batchId) : undefined;
    const copy: DayPlanSlot = group
      ? { ...rest, batchId: group, ...(cookedServings === undefined ? {} : { cookedServings }), ...(leftover ? { leftover } : {}) }
      : rest;
    const target = addDays(date, 7);
    const existing = slotAt(plan, target, slot.mealType);
    const identical =
      existing !== undefined &&
      !existing.batchId &&
      !copy.batchId &&
      existing.recipeId === copy.recipeId &&
      slotServings(existing) === slotServings(copy);
    if (identical) continue;
    entries.push({ date: target, mealType: slot.mealType, slot: copy, conflict: existing !== undefined, group });
  }
  return { entries, sourceEmpty: isSourceEmpty(plan, monday) };
}

/** Qué copiaría «Copiar semana anterior» sobre la semana de `monday`: franjas, conflictos y si el origen está vacío (R4). */
export function planCopy(
  plan: WeekPlan,
  monday: string,
  recipeIds: ReadonlySet<string>,
): { slots: CopySlot[]; conflicts: number; sourceEmpty: boolean } {
  const { entries, sourceEmpty } = build(plan, monday, recipeIds);
  return {
    slots: entries.map(({ date, mealType, slot }) => ({ date, mealType, slot })),
    conflicts: entries.filter((e) => e.conflict).length,
    sourceEmpty,
  };
}

/** Copia la semana anterior sobre la de `monday` (R1–R3). `copied` cuenta las franjas realmente escritas. */
export function applyCopy(
  plan: WeekPlan,
  monday: string,
  recipeIds: ReadonlySet<string>,
  mode: CopyMode,
): { plan: WeekPlan; copied: number } {
  let entries = build(plan, monday, recipeIds).entries;
  if (mode === "keep") {
    // Una tanda con algún miembro en conflicto se omite entera
    const blocked = new Set(entries.filter((e) => e.conflict && e.group).map((e) => e.group));
    entries = entries.filter((e) => !e.conflict && !(e.group && blocked.has(e.group)));
  }
  if (entries.length === 0) return { plan, copied: 0 };

  let next = plan;
  for (const e of entries) {
    const existing = slotAt(next, e.date, e.mealType);
    // Pisar una cocinada deja sus sobras como franjas normales; pisar una sobra solo la sustituye
    if (existing?.batchId && existing.cookedServings !== undefined && !existing.leftover) {
      next = deleteOrigin(next, existing.batchId, "keep");
    }
    next = put(next, e.date, e.slot);
  }
  return { plan: next, copied: entries.length };
}
