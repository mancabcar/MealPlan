// Recientes en «Añadir comida» (docs/pm/12-registro-rapido/tech.md › UI): una lista de botones de fila completa
// entre el selector de franja y las pestañas Receta/Personalizada. Sin recientes no pinta nada (R6).
import { useId, type MouseEvent } from "react";
import { quantityLabel, servingsLabel, type RecentMeal } from "@/lib/diary";

export function RecentMeals({
  recents,
  onPick,
}: {
  recents: RecentMeal[];
  /** Recibe el evento para que el Diario ignore el segundo clic de un doble toque (singleClick). */
  onPick: (recent: RecentMeal, ev: MouseEvent) => void;
}) {
  const headingId = useId();
  if (recents.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h4 id={headingId} className="text-xs font-semibold text-[var(--color-text-muted)]">Recientes</h4>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1.5">
        {recents.map((r) => {
          // R5: "× 0,5" junto al nombre, como en la lista del Diario; kcal redondeadas.
          // Alimentos (#13, R13): "150 g" o "2 ud · 120 g", también como en el Diario.
          const label = servingsLabel(r.entry) ?? quantityLabel(r.entry);
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={(ev) => onPick(r, ev)}
                className="w-full flex justify-between items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-left"
              >
                <span>
                  {r.name}
                  {label && <span className="text-[var(--color-text-muted)]"> {label}</span>}
                </span>
                <span className="shrink-0 text-[var(--color-text-muted)]">{Math.round(r.entry.calories)} kcal</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
