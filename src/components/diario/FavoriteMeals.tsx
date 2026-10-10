// Favoritos en «Añadir comida» (docs/pm/55-mis-alimentos/tech.md › UI): entre el selector de franja y Recientes, en
// las tres pestañas. Un toque registra (R1); la ★ quita (R5); 5 filas y «Ver todos (N)» (R9); sin favoritos, la pista (R10).
// «Editar» abre la lista completa con lápiz en personalizadas (R4) y alimentos (R12); las recetas solo llevan ★.
import { useId, useState, type MouseEvent } from "react";
import type { MealFavorite, RankedFavorite } from "@/lib/mealFavorites";
import type { MealType } from "@/lib/types";
import { CustomMealForm } from "./CustomMealForm";
import { FoodQuantityForm } from "./FoodQuantityForm";
import { MealRow } from "./MealRow";

export const FAVORITES_LIMIT = 5;
export const FAVORITES_HINT = "Toca ☆ en lo que repites para tenerlo aquí";

export function FavoriteMeals({
  favorites,
  mealType,
  onPick,
  onRemove,
  onSaveCustom,
  onSaveQuantity,
  nameTaken,
}: {
  /** Ya ordenados y filtrados por franja (rankFavorites). */
  favorites: RankedFavorite[];
  /** Al cambiar de franja se pliega «Ver todos»; «Editar» y el formulario abierto siguen. */
  mealType?: MealType;
  /** Recibe el evento para que el Diario ignore el segundo clic de un doble toque (singleClick). */
  onPick: (favorite: RankedFavorite, ev: MouseEvent) => void;
  onRemove: (favorite: RankedFavorite) => void;
  /** R4: la personalizada corregida, con su mismo id. */
  onSaveCustom: (fav: MealFavorite) => void;
  /** R12: la cantidad nueva de un alimento. */
  onSaveQuantity: (fav: MealFavorite, quantity: { grams: number; units?: number }) => void;
  /** R4: el nombre ya es de otra personalizada favorita (la que se edita no cuenta). */
  nameTaken: (name: string, exceptId: string) => boolean;
}) {
  const headingId = useId();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  // Fila con el formulario abierto (RankedFavorite.key)
  const [openKey, setOpenKey] = useState<string | null>(null);
  // «Ver todos» se pliega al cambiar de franja; lo demás se conserva (tech.md › State & edge cases). Sin `key`, que
  // desmontaría también el formulario abierto y lo escrito en él.
  const [shownFor, setShownFor] = useState(mealType);
  if (shownFor !== mealType) {
    setShownFor(mealType);
    setShowAll(false);
  }

  if (favorites.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">{FAVORITES_HINT}</p>;

  const close = () => setOpenKey(null);
  const visible = editing || showAll ? favorites : favorites.slice(0, FAVORITES_LIMIT);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h4 id={headingId} className="text-xs font-semibold text-[var(--color-text-muted)]">Favoritos</h4>
        <button
          type="button"
          onClick={() => {
            setEditing(!editing);
            close();
          }}
          className="min-h-11 px-1 text-xs font-semibold text-[var(--color-accent)]"
        >
          {editing ? "Listo" : "Editar"}
        </button>
      </div>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1.5">
        {visible.map((f) => {
          const { fav } = f;
          if (editing && fav && openKey === f.key) {
            return (
              <li key={f.key} className="rounded-lg border border-[var(--color-border)] p-3">
                {fav.kind === "custom" ? (
                  <CustomMealForm
                    mode="edit"
                    initial={fav}
                    onSubmit={(values) => {
                      onSaveCustom({ id: fav.id, kind: "custom", ...values });
                      close();
                    }}
                    onCancel={close}
                    onRemove={() => {
                      onRemove(f);
                      close();
                    }}
                    nameTaken={(name) => nameTaken(name, fav.id)}
                  />
                ) : (
                  <FoodQuantityForm
                    favorite={fav}
                    onSave={(quantity) => {
                      onSaveQuantity(fav, quantity);
                      close();
                    }}
                    onCancel={close}
                  />
                )}
              </li>
            );
          }
          return (
            <MealRow
              key={f.key}
              name={f.name}
              label={f.label}
              calories={f.calories}
              onPick={(ev) => onPick(f, ev)}
              edit={editing && fav ? { label: `Editar ${f.name}`, onClick: () => setOpenKey(f.key) } : undefined}
              star={{ filled: true, label: `Quitar ${f.name} de Favoritos`, onClick: () => onRemove(f) }}
            />
          );
        })}
      </ul>
      {!editing && !showAll && favorites.length > FAVORITES_LIMIT && (
        <button type="button" onClick={() => setShowAll(true)} className="self-start min-h-11 text-xs font-semibold text-[var(--color-accent)]">
          Ver todos ({favorites.length})
        </button>
      )}
    </div>
  );
}
