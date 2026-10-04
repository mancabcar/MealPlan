"use client";

// Semana vista en Plan y lista de la compra (docs/pm/78-plan-navegar-semanas › R1, R2): va en `?semana=<lunes>`,
// así se puede recargar o enlazar. Sin parámetro, o con uno no válido, es la semana actual.
import { useSearchParams } from "next/navigation";
import { todayStr } from "./types";
import { addDays, mondayOf, toDateStr, weekDates } from "./week";

const WEEK_PARAM = "semana";

/** Lunes de la semana vista; `raw` es el valor de `?semana=`. Una fecha que no es lunes se normaliza a su lunes. */
export function parseWeekParam(raw: string | null | undefined, today: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + "T00:00:00");
    if (!Number.isNaN(d.getTime()) && toDateStr(d) === raw) return mondayOf(raw);
  }
  return mondayOf(today);
}

/** Lunes de la semana `n` posiciones después (negativo = antes). Sin límite. */
export function shiftWeek(monday: string, n: number): string {
  return addDays(monday, 7 * n);
}

/** `path` apuntando a la semana `monday`; la semana actual no lleva parámetro. */
export function weekHref(path: string, monday: string, today: string): string {
  return monday === mondayOf(today) ? path : `${path}?${WEEK_PARAM}=${monday}`;
}

/** Semana vista en la URL. Debe usarse dentro de un <Suspense> (export estático). */
export function useWeekParam() {
  const raw = useSearchParams().get(WEEK_PARAM);
  const today = todayStr();
  const monday = parseWeekParam(raw, today);
  return { monday, dates: weekDates(monday), today, isCurrent: monday === mondayOf(today) };
}
