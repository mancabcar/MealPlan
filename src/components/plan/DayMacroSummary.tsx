// Macros por día en el Plan semanal (docs/pm/10-macros-plan/tech.md › UI): rejilla 2 × 2 dentro de la
// tarjeta del día. Cada celda muestra "N / objetivo" y su estado con icono + texto (R5, no solo color);
// la parte visual va aria-hidden y una frase sr-only la resume ("Grasas 80 de 69, por encima").
import { ArrowDown, ArrowUp, Check, type LucideIcon } from "lucide-react";
import { macroStatus, type DayPlanSummary, type MacroStatus, type MacroTarget, type Macros } from "@/lib/planMacros";
import type { UserProfile } from "@/lib/types";

const CELLS: { key: keyof Macros; label: string; unit: string; tone: string }[] = [
  { key: "calories", label: "Calorías", unit: "kcal", tone: "--color-accent" },
  { key: "protein", label: "Proteínas", unit: "g", tone: "--color-protein" },
  { key: "carbs", label: "Carbohidratos", unit: "g", tone: "--color-carbs" },
  { key: "fat", label: "Grasas", unit: "g", tone: "--color-fat" },
];

// Por debajo en gris, no en ámbar: en un día a medias todo está por debajo y no debe parecer un error
const STATUS: Record<MacroStatus, { Icon: LucideIcon; text: string; color: string }> = {
  within: { Icon: Check, text: "Dentro", color: "--color-accent" },
  below: { Icon: ArrowDown, text: "Por debajo", color: "--color-text-muted" },
  above: { Icon: ArrowUp, text: "Por encima", color: "--color-expiring" },
};

function targetFor(key: keyof Macros, profile: UserProfile): MacroTarget {
  switch (key) {
    case "calories":
      return profile.calorieGoal;
    case "protein":
      return profile.proteinRange ?? profile.proteinGoal;
    case "carbs":
      return profile.carbsGoal;
    case "fat":
      return profile.fatGoal;
  }
}

const formatTarget = (target: MacroTarget, sep: string) =>
  typeof target === "number" ? `${target}` : `${target.min}${sep}${target.max}`;

export function DayMacroSummary({ summary, profile }: { summary: DayPlanSummary; profile: UserProfile | null }) {
  const { totals, planned, total } = summary;
  return (
    <div className="flex flex-col gap-1.5 mb-2">
      <ul aria-label="Macros del día" className="grid grid-cols-2 gap-2">
        {CELLS.map(({ key, label, unit, tone }) => {
          const value = Math.round(totals[key]);
          const target = profile ? targetFor(key, profile) : null;
          const status = target === null ? null : STATUS[macroStatus(totals[key], target)];
          // El lector oye "de 130 a 160"; sin los gramos, pero con las kcal ("2030 de 2000" solo sería ambiguo)
          const spoken =
            target === null
              ? `${label} ${value} ${unit}`
              : `${label} ${value} de ${formatTarget(target, " a ")}${key === "calories" ? " kcal" : ""}, ${status!.text.toLowerCase()}`;
          return (
            <li key={key} className="rounded-xl bg-[var(--color-surface-2)] px-2.5 py-2">
              <div aria-hidden className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--color-text)]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `var(${tone})` }} />
                    {label}
                  </span>
                  {status && (
                    <span className="flex items-center gap-0.5 font-medium" style={{ color: `var(${status.color})` }}>
                      <status.Icon className="w-3.5 h-3.5" />
                      {status.text}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold">
                  {target === null ? `${value} ${unit}` : `${value} / ${formatTarget(target, "–")}`}
                </span>
              </div>
              <span className="sr-only">{spoken}</span>
            </li>
          );
        })}
      </ul>
      {planned < total && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {planned} de {total} comidas planificadas
        </p>
      )}
    </div>
  );
}
