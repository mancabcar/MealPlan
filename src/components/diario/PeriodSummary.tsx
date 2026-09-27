// Medias y adherencia del Diario (docs/pm/11-medias-adherencia/tech.md › UI): tarjeta propia debajo de
// «Calorías esta semana». La gráfica incluye hoy; este resumen solo cuenta días completos (R6), por eso no se fusionan.
import { useId, useMemo } from "react";
import { Check } from "lucide-react";
import { userKey } from "@/lib/auth";
import { formatPeriod, periodStats, statsPeriod, STATS_PERIODS, type StatsPeriod } from "@/lib/diaryStats";
import type { MealEntry, UserProfile } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ChipRadios } from "@/components/ui/ChipRadios";
import { DayMacroSummary } from "@/components/plan/DayMacroSummary";

// R11: preferencia de vista, no un dato del usuario: fuera de USER_DATA_KEYS y del backup
const DAYS_KEY = "diary_stats_days";

export function loadStatsDays(userId: string | undefined): StatsPeriod {
  if (!userId) return 7;
  try {
    return localStorage.getItem(userKey(userId, DAYS_KEY)) === "30" ? 30 : 7;
  } catch {
    return 7;
  }
}

export function saveStatsDays(userId: string | undefined, days: StatsPeriod) {
  if (!userId) return;
  try {
    localStorage.setItem(userKey(userId, DAYS_KEY), String(days));
  } catch {
    // Sin almacenamiento (modo privado): la opción vale solo para esta visita
  }
}

const OPTIONS = STATS_PERIODS.map((d) => ({ value: String(d) as `${StatsPeriod}`, label: `${d} días` }));

export function PeriodSummary({
  days,
  onDaysChange,
  entries,
  profile,
  date,
  today,
}: {
  days: StatsPeriod;
  onDaysChange: (days: StatsPeriod) => void;
  entries: MealEntry[];
  profile: UserProfile;
  /** Fecha seleccionada en el Diario. */
  date: string;
  today: string;
}) {
  const headingId = useId();
  // Solo cambia con estos datos: no recalcular al escribir en el formulario de añadir (review.md › no bloqueante 4)
  const { start, end, stats } = useMemo(() => {
    const { start, end, dates } = statsPeriod(date, today, days);
    return { start, end, stats: periodStats({ entries, profile, dates }) };
  }, [entries, profile, date, today, days]);

  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="font-display text-sm font-semibold">
          Medias y adherencia
        </h2>
        <ChipRadios
          label="Periodo del resumen"
          name={`${headingId}-days`}
          options={OPTIONS}
          value={`${days}`}
          onChange={(v) => onDaysChange(Number(v) as StatsPeriod)}
        />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] -mt-1">
        {/* Sin «Últimos»: con una fecha pasada el periodo no son los últimos días (review.md › no bloqueante 2) */}
        {days} días · {formatPeriod(start, end)}
      </p>
      {stats ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {/* El check es una señal de éxito: solo si cumplen todos los días */}
            {stats.compliantDays === stats.loggedDays && (
              <Check className="w-4 h-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
            )}
            {/* Un solo nodo de texto: el lector lo lee completo (R10) */}
            <span>{`${stats.compliantDays} de ${stats.loggedDays} ${stats.loggedDays === 1 ? "día" : "días"} dentro del objetivo`}</span>
          </p>
          <DayMacroSummary summary={{ totals: stats.averages }} profile={profile} label="Medias del periodo" />
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">Sin registros en estos {days} días</p>
      )}
    </Card>
  );
}
