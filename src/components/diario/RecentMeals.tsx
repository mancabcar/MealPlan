// Recientes en «Añadir comida» (docs/pm/12-registro-rapido/tech.md › UI): una lista de botones de fila completa
// entre el selector de franja y las pestañas Receta/Personalizada. Sin recientes no pinta nada (R6).
// Favoritos (docs/pm/55-mis-alimentos, R2): cada fila que se puede guardar lleva ☆ a la derecha.
import { useId, type MouseEvent } from "react";
import { quantityLabel, servingsLabel, type RecentMeal } from "@/lib/diary";
import { MealRow } from "./MealRow";

export function RecentMeals({
  recents,
  onPick,
  onStar,
  canStar = () => true,
}: {
  recents: RecentMeal[];
  /** Recibe el evento para que el Diario ignore el segundo clic de un doble toque (singleClick). */
  onPick: (recent: RecentMeal, ev: MouseEvent) => void;
  /** Guarda la fila en Favoritos; sin él no hay ☆. */
  onStar?: (recent: RecentMeal) => void;
  /** Filas sin ☆: recetas con raciones ≠ 1, alimentos sin gramos válidos (tech.md › Spec feedback). */
  canStar?: (recent: RecentMeal) => boolean;
}) {
  const headingId = useId();
  if (recents.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h4 id={headingId} className="text-xs font-semibold text-[var(--color-text-muted)]">Recientes</h4>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1.5">
        {recents.map((r) => (
          // R5: "× 0,5" junto al nombre, como en la lista del Diario; kcal redondeadas.
          // Alimentos (#13, R13): "150 g" o "2 ud · 120 g", también como en el Diario.
          <MealRow
            key={r.key}
            name={r.name}
            label={servingsLabel(r.entry) ?? quantityLabel(r.entry)}
            calories={r.entry.calories}
            onPick={(ev) => onPick(r, ev)}
            star={onStar && canStar(r) ? { filled: false, label: `Guardar ${r.name} en Favoritos`, onClick: () => onStar(r) } : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
