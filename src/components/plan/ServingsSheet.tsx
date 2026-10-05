"use client";

// Hoja "Raciones" de una franja del Plan (docs/pm/29-raciones-plan/tech.md › UI, R3, R8): cambia las raciones sin
// reasignar la receta. Usa components/ui/Sheet y el mismo campo que el Diario; el error sale al pulsar "Guardar".
import { useId, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ServingsField } from "@/components/ui/ServingsField";
import { formatServings, parseServings } from "@/lib/diary";
import { setSlotServings } from "@/lib/plan/servings";
import type { SlotRef } from "@/lib/plan/batch";
import { slotServings } from "@/lib/planMacros";
import type { WeekPlan } from "@/lib/types";

const primaryBtn = "flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm";
const secondaryBtn = "flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm";

export function ServingsSheet({
  plan,
  at,
  recipeName,
  onSave,
  onClose,
}: {
  plan: WeekPlan;
  at: SlotRef;
  recipeName: string;
  onSave: (next: WeekPlan) => void;
  onClose: () => void;
}) {
  const id = useId();
  const slot = (plan[at.date] ?? []).find((s) => s.mealType === at.mealType);
  const [text, setText] = useState(formatServings(slot ? slotServings(slot) : 1));
  const [error, setError] = useState(false);

  const submit = () => {
    const n = parseServings(text);
    if (n === null) {
      setError(true);
      return;
    }
    onSave(setSlotServings(plan, at, n));
  };

  return (
    <Sheet title="Raciones" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">{recipeName}</p>
        <ServingsField
          id={`${id}-servings`}
          value={text}
          onChange={(t) => {
            setText(t);
            setError(false);
          }}
          error={error}
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancelar
          </button>
          <button type="button" onClick={submit} className={primaryBtn}>
            Guardar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
