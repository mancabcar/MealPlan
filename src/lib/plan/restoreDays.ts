// Deshacer de «Copiar semana anterior» y «Rellenar semana» (docs/pm/53-copiar-semana-anterior R5, docs/pm/15 R6, #149).
// Puro: se fotografían las fechas de la semana vista antes del cambio y Deshacer devuelve solo esas a como estaban.
import type { DayPlanSlot, WeekPlan } from "../types";

/** Franjas de cada fecha tal como están; `undefined` = el día no tenía entrada en el plan. */
export type DaysSnapshot = Record<string, DayPlanSlot[] | undefined>;

export function snapshotDays(plan: WeekPlan, dates: readonly string[]): DaysSnapshot {
  return Object.fromEntries(dates.map((d) => [d, plan[d]]));
}

/** Devuelve `dates` a como estaban en `before`; un día sin entrada entonces se borra. El resto del plan no se toca. */
export function restoreDays(plan: WeekPlan, before: DaysSnapshot, dates: readonly string[]): WeekPlan {
  const restored = { ...plan };
  for (const d of dates) {
    const day = before[d];
    if (day === undefined) delete restored[d];
    else restored[d] = day;
  }
  return restored;
}
