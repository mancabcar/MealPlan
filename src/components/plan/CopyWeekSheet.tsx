"use client";

// Aviso de conflictos de «Copiar semana anterior» (docs/pm/53-copiar-semana-anterior R2): conservar las franjas ocupadas,
// reemplazarlas o cancelar. Mismo formato que BatchWarningSheet (components/plan/BatchSheet.tsx).
import { Sheet } from "@/components/ui/Sheet";
import type { CopyMode } from "@/lib/plan/copyWeek";

const primaryBtn = "flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm";
const secondaryBtn = "flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm";

export function CopyWeekSheet({ conflicts, onChoose }: { conflicts: number; onChoose: (mode: CopyMode | null) => void }) {
  return (
    <Sheet title={conflicts === 1 ? "1 franja ya tiene receta" : `${conflicts} franjas ya tienen receta`} onClose={() => onChoose(null)}>
      <p className="text-sm text-[var(--color-text-muted)]">
        Copiar la semana anterior {conflicts === 1 ? "pisaría esa franja" : "pisaría esas franjas"}. ¿Qué hacemos?
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => onChoose("keep")} className={primaryBtn}>
          Conservar las que hay
        </button>
        <button type="button" onClick={() => onChoose("replace")} className={secondaryBtn}>
          Reemplazarlas
        </button>
        <button type="button" onClick={() => onChoose(null)} className={secondaryBtn}>
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}
