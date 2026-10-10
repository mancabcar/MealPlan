// Favoritos en «Añadir comida» (docs/pm/55-mis-alimentos/tech.md › UI): entre el selector de franja y Recientes, en
// las tres pestañas. Un toque registra (R1); la ★ quita (R5); 5 filas y «Ver todos (N)» (R9); sin favoritos, la pista (R10).
import { useId, useState, type MouseEvent } from "react";
import type { MealFavorite, RankedFavorite } from "@/lib/mealFavorites";
import type { MealType } from "@/lib/types";
import { MealRow } from "./MealRow";

export const FAVORITES_LIMIT = 5;
export const FAVORITES_HINT = "Toca ☆ en lo que repites para tenerlo aquí";

export function FavoriteMeals({
  favorites,
  mealType,
  onPick,
  onRemove,
}: {
  /** Ya ordenados y filtrados por franja (rankFavorites). */
  favorites: RankedFavorite[];
  /** Al cambiar de franja se pliega «Ver todos». */
  mealType?: MealType;
  /** Recibe el evento para que el Diario ignore el segundo clic de un doble toque (singleClick). */
  onPick: (favorite: RankedFavorite, ev: MouseEvent) => void;
  onRemove: (favorite: RankedFavorite) => void;
  onSaveCustom?: (fav: MealFavorite) => void;
  onSaveQuantity?: (fav: MealFavorite, quantity: { grams: number; units?: number }) => void;
  nameTaken?: (name: string, exceptId: string) => boolean;
}) {
  const headingId = useId();
  const [showAll, setShowAll] = useState(false);
  // «Ver todos» se pliega al cambiar de franja; el resto del estado se conserva (tech.md › State & edge cases)
  const [shownFor, setShownFor] = useState(mealType);
  if (shownFor !== mealType) {
    setShownFor(mealType);
    setShowAll(false);
  }

  if (favorites.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">{FAVORITES_HINT}</p>;

  const visible = showAll ? favorites : favorites.slice(0, FAVORITES_LIMIT);
  return (
    <div className="flex flex-col gap-1.5">
      <h4 id={headingId} className="text-xs font-semibold text-[var(--color-text-muted)]">Favoritos</h4>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1.5">
        {visible.map((f) => (
          <MealRow
            key={f.key}
            name={f.name}
            label={f.label}
            calories={f.calories}
            onPick={(ev) => onPick(f, ev)}
            star={{ filled: true, label: `Quitar ${f.name} de Favoritos`, onClick: () => onRemove(f) }}
          />
        ))}
      </ul>
      {!showAll && favorites.length > FAVORITES_LIMIT && (
        <button type="button" onClick={() => setShowAll(true)} className="self-start text-xs font-semibold text-[var(--color-accent)] py-1">
          Ver todos ({favorites.length})
        </button>
      )}
    </div>
  );
}
