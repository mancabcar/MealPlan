// Fila de Recientes y Favoritos en «Añadir comida» (docs/pm/55-mis-alimentos/tech.md › UI): botón de toque completo
// que registra, y a su derecha, fuera de él, el lápiz (modo Editar) y la estrella. Como FavoriteStar, nunca anidados.
import type { MouseEvent } from "react";
import { Pencil, Star } from "lucide-react";

// Caja de 44 px con borde, como la fila (prototipo, artboards 2 y 3)
const ICON_BUTTON = "shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-[var(--color-border)]";

export function MealRow({
  name,
  label,
  calories,
  onPick,
  star,
  edit,
}: {
  name: string;
  /** «× 0,5», «40 g» o «2 ud · 120 g» junto al nombre; null si no hay nada que mostrar. */
  label: string | null;
  /** Sin redondear: se redondea al mostrar. */
  calories: number;
  /** Recibe el evento para que el Diario ignore el segundo clic de un doble toque (singleClick). */
  onPick: (ev: MouseEvent) => void;
  /** ☆ (guardar) o ★ (quitar); sin ella, la fila no lleva estrella. */
  star?: { filled: boolean; label: string; onClick: () => void };
  /** Lápiz del modo Editar. */
  edit?: { label: string; onClick: () => void };
}) {
  return (
    <li className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={onPick}
        className="flex-1 min-w-0 flex justify-between items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-left"
      >
        <span>
          {name}
          {label && <span className="text-[var(--color-text-muted)]"> {label}</span>}
        </span>
        <span className="shrink-0 text-[var(--color-text-muted)]">{Math.round(calories)} kcal</span>
      </button>
      {edit && (
        <button type="button" onClick={edit.onClick} aria-label={edit.label} className={`${ICON_BUTTON} text-[var(--color-text-muted)]`}>
          <Pencil className="w-4 h-4" aria-hidden />
        </button>
      )}
      {star && (
        <button type="button" onClick={star.onClick} aria-label={star.label} className={ICON_BUTTON}>
          <Star
            className={`w-5 h-5 ${star.filled ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
            fill={star.filled ? "currentColor" : "none"}
            aria-hidden
          />
        </button>
      )}
    </li>
  );
}
