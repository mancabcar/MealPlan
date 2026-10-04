"use client";

// Navegación entre semanas de Plan y de la lista de la compra (docs/pm/78-plan-navegar-semanas › R1, R6).
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftWeek, weekHref } from "@/lib/useWeekParam";
import { addDays, mondayOf } from "@/lib/week";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** "28 sept – 4 oct", o "21 – 27 sept" dentro del mismo mes. */
function rangeLabel(monday: string): string {
  const [start, end] = [new Date(monday + "T00:00:00"), new Date(addDays(monday, 6) + "T00:00:00")];
  const month = (d: Date) => MONTHS[d.getMonth()];
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

/** Etiqueta solo para la semana actual y sus vecinas; más lejos basta el rango. */
function relativeLabel(monday: string, today: string): string | null {
  const diff = Math.round((new Date(monday + "T00:00:00").getTime() - new Date(mondayOf(today) + "T00:00:00").getTime()) / (7 * 86_400_000));
  return { 0: "Esta semana", 1: "Semana siguiente", [-1]: "Semana pasada" }[diff] ?? null;
}

export function WeekNav({ monday, today, path }: { monday: string; today: string; path: string }) {
  const router = useRouter();
  // Semana a la que se ha ido ya, aunque la URL aún no se haya actualizado: dos toques seguidos en › saltan dos
  // semanas en vez de perder el segundo (el router es asíncrono)
  const target = useRef(monday);
  useEffect(() => {
    target.current = monday;
  }, [monday]);
  // replace: cambiar de semana no llena el historial, «Atrás» sale de la pantalla (tech.md)
  const go = (week: string) => {
    target.current = week;
    router.replace(weekHref(path, week, today));
  };
  const label = relativeLabel(monday, today);
  const isCurrent = monday === mondayOf(today);
  const arrow = "min-w-11 min-h-11 flex items-center justify-center rounded-full text-[var(--color-text-muted)]";
  return (
    <nav aria-label="Semana" className="flex items-center gap-1">
      <button type="button" aria-label="Semana anterior" onClick={() => go(shiftWeek(target.current, -1))} className={arrow}>
        <ChevronLeft className="w-5 h-5" aria-hidden />
      </button>
      <div className="flex-1 flex flex-col items-center leading-tight">
        <span className="font-semibold text-sm">{rangeLabel(monday)}</span>
        {label && <span className="text-xs text-[var(--color-text-muted)]">{label}</span>}
      </div>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => go(mondayOf(today))}
          className="min-h-11 px-3 rounded-full text-sm font-medium text-[var(--color-accent)]"
        >
          Hoy
        </button>
      )}
      <button type="button" aria-label="Semana siguiente" onClick={() => go(shiftWeek(target.current, 1))} className={arrow}>
        <ChevronRight className="w-5 h-5" aria-hidden />
      </button>
    </nav>
  );
}
