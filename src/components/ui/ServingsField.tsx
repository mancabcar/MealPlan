"use client";

// Campo "Raciones" (docs/pm/raciones R1/R8, docs/pm/29-raciones-plan): − / valor / +, compartido por el Diario y el Plan.
// Solo presenta: el texto tal cual se teclea ("0,5") y el error los lleva quien lo usa; se valida con parseServings.
import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { SERVINGS, SERVINGS_ERROR, formatServings, parseServings, stepServings } from "@/lib/diary";
import { inputCls } from "@/components/ui/input";

// Botones − / + : cuadrados con borde, como los toggles Receta/Personalizada
const stepBtnCls =
  "shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-40";

export function ServingsField({
  id,
  value,
  onChange,
  error,
  preview,
}: {
  id: string;
  value: string;
  /** Texto nuevo; quien lo usa limpia el error al editar. */
  onChange: (text: string) => void;
  error: boolean;
  /** Vista previa a la derecha del campo (p. ej. "= 300 kcal"). */
  preview?: ReactNode;
}) {
  const errorId = `${id}-error`;
  const parsed = parseServings(value);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        Raciones
      </label>
      <div className="flex items-center gap-2 max-w-72">
        {/* ±0,25, deshabilitados en los extremos */}
        <button
          type="button"
          onClick={() => onChange(formatServings(stepServings(value, -1)))}
          disabled={parsed === SERVINGS.min}
          aria-label="Quitar 0,25 raciones"
          className={stepBtnCls}
        >
          <Minus className="w-4 h-4" aria-hidden />
        </button>
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error}
          aria-describedby={error ? errorId : undefined}
          className={`${inputCls} min-w-0 text-center ${error ? "border-[var(--color-expired)]" : ""}`}
        />
        <button
          type="button"
          onClick={() => onChange(formatServings(stepServings(value, 1)))}
          disabled={parsed === SERVINGS.max}
          aria-label="Añadir 0,25 raciones"
          className={stepBtnCls}
        >
          <Plus className="w-4 h-4" aria-hidden />
        </button>
        {preview}
      </div>
      {error && (
        <span id={errorId} role="alert" className="text-xs text-[var(--color-expired)]">
          {SERVINGS_ERROR}
        </span>
      )}
    </div>
  );
}
