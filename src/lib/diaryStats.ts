// Medias y adherencia del Diario (docs/pm/11-medias-adherencia/tech.md › APIs). Puro: sin React ni store.
// Un día se juzga con macroStatus/macroTarget de planMacros, así que el Plan y el Diario no pueden divergir.
import { finiteOr0, macroStatus, macroTarget, type Macros } from "./planMacros";
import { formatShortDate } from "./measurements";
import type { MealEntry, UserProfile } from "./types";
import { addDays } from "./week";

export const STATS_PERIODS = [7, 30] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/**
 * R6: N fechas (YYYY-MM-DD, ascendentes) que acaban en `selected` si es anterior a `today`; si es hoy,
 * posterior o "" (input borrado), acaban ayer. El día en curso nunca entra.
 */
export function statsPeriod(
  selected: string,
  today: string,
  days: StatsPeriod,
): { start: string; end: string; dates: string[] } {
  const end = selected !== "" && selected < today ? selected : addDays(today, -1);
  const dates = Array.from({ length: days }, (_, i) => addDays(end, i - (days - 1)));
  return { start: dates[0], end, dates };
}

/** Totales por fecha, sin redondear, solo de las fechas pedidas que tienen ≥ 1 entrada. Una pasada por `entries`. */
export function dailyTotals(entries: MealEntry[], dates: string[]): Map<string, Macros> {
  const wanted = new Set(dates);
  const totals = new Map<string, Macros>();
  for (const e of entries) {
    if (!wanted.has(e.date)) continue;
    const t = totals.get(e.date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    // Una entrada restaurada de un backup puede traer un macro ausente o no numérico: suma 0, no NaN
    t.calories += finiteOr0(e.calories);
    t.protein += finiteOr0(e.protein);
    t.carbs += finiteOr0(e.carbs);
    t.fat += finiteOr0(e.fat);
    totals.set(e.date, t);
  }
  return totals;
}

/** R4: kcal dentro de calorieGoal Y proteína dentro de su rango u objetivo. Mismo macroStatus que el Plan. */
export function isCompliantDay(totals: Macros, profile: UserProfile): boolean {
  return (
    macroStatus(totals.calories, macroTarget("calories", profile)) === "within" &&
    macroStatus(totals.protein, macroTarget("protein", profile)) === "within"
  );
}

/** R1–R3/R7: null si ningún día del periodo tiene entradas. Medias sin redondear (la UI redondea). */
export function periodStats({
  entries,
  profile,
  dates,
}: {
  entries: MealEntry[];
  profile: UserProfile;
  dates: string[];
}): { loggedDays: number; compliantDays: number; averages: Macros } | null {
  const days = [...dailyTotals(entries, dates).values()];
  if (days.length === 0) return null;
  const sum: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const d of days) {
    sum.calories += d.calories;
    sum.protein += d.protein;
    sum.carbs += d.carbs;
    sum.fat += d.fat;
  }
  const n = days.length;
  return {
    loggedDays: n,
    compliantDays: days.filter((d) => isCompliantDay(d, profile)).length,
    averages: { calories: sum.calories / n, protein: sum.protein / n, carbs: sum.carbs / n, fat: sum.fat / n },
  };
}

/** R8: "19–25 sep"; si cambia el mes, "27 ago–25 sep". Sin año. */
export function formatPeriod(start: string, end: string): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? String(Number(start.slice(8))) : formatShortDate(start);
  return `${from}–${formatShortDate(end)}`;
}
