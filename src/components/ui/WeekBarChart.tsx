// Rediseño visual (docs/pm/design-refresh, R7): gráfico de 7 barras (calorías por día) con el
// objetivo marcado, sustituye a la sección "Calorías esta semana" plana del Diario.
// #50: bajo cada barra, un check si el día cumplió el objetivo y, para el lector de pantalla, una frase
// «Lunes, 1850 kcal, cumple el objetivo» (docs/pm/50-marcar-dias-cumplen/spec.md › R1–R4).
import { Check } from "lucide-react";
import type { DayState } from "@/lib/diaryStats";

const STATE_TEXT: Record<DayState, string> = {
  met: "cumple el objetivo",
  missed: "no cumple el objetivo",
  empty: "sin registros",
  today: "día en curso",
};

/** «Lunes, 1850 kcal, cumple el objetivo»; sin registros no hay kcal que decir (también un día futuro con registros). */
function spoken({ name, value, state }: { name: string; value: number; state: DayState }) {
  const kcal = state === "empty" ? "" : `${Math.round(value)} kcal`;
  return [name, kcal, STATE_TEXT[state]].filter(Boolean).join(", ");
}

export function WeekBarChart({
  data,
  goal,
}: {
  data: { label: string; value: number; state: DayState; name: string }[];
  goal: number;
}) {
  const max = Math.max(goal, ...data.map((d) => d.value), 1);
  return (
    <div>
      {/* Solo barras y línea del objetivo: así la línea queda a la altura real de las barras */}
      <div className="relative flex items-end gap-2 h-28">
        <div
          aria-hidden
          className="absolute left-0 right-0 border-t border-dashed border-[var(--color-accent)]/50"
          style={{ bottom: `${(goal / max) * 100}%` }}
        />
        {data.map((d, i) => (
          <div key={i} aria-hidden className="flex-1 flex items-end h-full">
            <div
              className="w-full rounded-t-md bg-[var(--color-accent)] min-h-[2px]"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            {/* El hueco del check se reserva en todos los días para que las letras no salten */}
            <span aria-hidden className="h-3 w-3">
              {d.state === "met" && <Check className="w-3 h-3 text-[var(--color-accent)]" aria-hidden />}
            </span>
            <span aria-hidden className="text-[10px] text-[var(--color-text-muted)]">
              {d.label}
            </span>
            <span className="sr-only">{spoken(d)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
        <Check className="w-3 h-3 shrink-0 text-[var(--color-accent)]" aria-hidden />
        día dentro del objetivo (kcal y proteína)
      </p>
    </div>
  );
}
