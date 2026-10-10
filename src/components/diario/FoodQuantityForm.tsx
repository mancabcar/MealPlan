// Cantidad de un alimento favorito (docs/pm/55-mis-alimentos, R12): gramos o, si se guardó en unidades, unidades. Misma
// validación y errores que la tarjeta de FoodPicker; con un valor no válido no deja guardar.
import { useId, useState } from "react";
import { formatServings } from "@/lib/diary";
import { GRAMS_ERROR, UNITS_ERROR, parseGrams, parseUnits } from "@/lib/foods";
import type { FoodFavorite } from "@/lib/mealFavorites";
import { inputCls } from "@/components/ui/input";

export function FoodQuantityForm({
  favorite,
  onSave,
  onCancel,
}: {
  favorite: FoodFavorite;
  onSave: (quantity: { grams: number; units?: number }) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const inUnits = favorite.units !== undefined;
  const [text, setText] = useState(inUnits ? formatServings(favorite.units!) : String(favorite.grams));
  // En unidades, el peso de 1 ud es el que se guardó (gramos / unidades)
  const units = inUnits ? parseUnits(text) : null;
  const grams = inUnits ? (units === null ? null : units * (favorite.grams / favorite.units!)) : parseGrams(text);
  const invalid = grams === null;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label htmlFor={id} className="text-[13px] text-[var(--color-text-muted)]">
        {inUnits ? "Unidades" : "Gramos"}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode={inUnits ? "decimal" : "numeric"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className={`${inputCls} ${invalid ? "border-[var(--color-expired)]" : ""}`}
        />
        <span className="shrink-0 text-[var(--color-text-muted)]">{inUnits ? "ud" : "g"}</span>
      </div>
      {invalid && (
        <span id={errorId} role="alert" className="text-xs text-[var(--color-expired)]">
          {inUnits ? UNITS_ERROR : GRAMS_ERROR}
        </span>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={invalid}
          onClick={() => grams !== null && onSave(units === null ? { grams } : { grams, units })}
          className="flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm disabled:opacity-40"
        >
          Guardar cambios
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg py-2 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
