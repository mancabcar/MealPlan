"use client";

// Contador de agua del día (docs/pm/23-agua-fibra-micros, R10–R12): vasos tocables y botones − / +.
// Puro de presentación: la lógica (redondeos, tope de 6 L) vive en lib/water.ts y el guardado lo decide quien lo monta.
import { useId } from "react";
import { GlassWater, Minus, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { addGlass, formatLiters, glassesDrunk, glassesFor, goalReached, removeGlass, tapGlass } from "@/lib/water";

const stepBtnCls =
  "shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] disabled:opacity-40";

export function WaterCard({
  ml,
  goalMl,
  glass,
  onChange,
}: {
  /** ml bebidos en el día elegido. */
  ml: number;
  goalMl: number;
  /** Tamaño del vaso en ml. */
  glass: number;
  /** Nuevo total del día en ml. */
  onChange: (ml: number) => void;
}) {
  const id = useId();
  const goalGlasses = Math.max(1, glassesFor(goalMl, glass));
  const drunk = glassesDrunk(ml, glass);
  const done = goalReached(ml, goalMl);
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="font-display text-sm font-semibold">
          Agua
        </h2>
        <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          {done && <span className="font-semibold text-[var(--color-accent)]">Objetivo cumplido</span>}
          <span>{`${formatLiters(ml)} / ${formatLiters(goalMl)} L`}</span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: goalGlasses }, (_, i) => {
          const n = i + 1;
          const full = n <= drunk;
          return (
            <button
              key={n}
              type="button"
              aria-label={`Vaso ${n}`}
              aria-pressed={full}
              onClick={() => onChange(tapGlass(ml, glass, n))}
              className="h-12 flex items-center justify-center rounded-xl border"
              style={{
                borderColor: full ? "var(--color-water)" : "var(--color-border)",
                backgroundColor: full ? "color-mix(in oklab, var(--color-water) 14%, var(--color-surface))" : "var(--color-surface-2)",
                color: full ? "var(--color-water)" : "var(--color-text-muted)",
              }}
            >
              <GlassWater className="w-5 h-5" aria-hidden />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">{`${drunk} de ${goalGlasses} vasos · vaso de ${glass} ml`}</span>
        <span className="flex gap-2">
          <button type="button" aria-label="Quitar un vaso" onClick={() => onChange(removeGlass(ml, glass))} className={stepBtnCls}>
            <Minus className="w-4 h-4" aria-hidden />
          </button>
          <button type="button" aria-label="Sumar un vaso" onClick={() => onChange(addGlass(ml, glass))} className={stepBtnCls}>
            <Plus className="w-4 h-4" aria-hidden />
          </button>
        </span>
      </div>
    </Card>
  );
}
