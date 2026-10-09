// Valoración 1–5 de una receta (docs/pm/111-recetas-valoracion-filtros R1, R6). Estrellas ámbar, para no confundirlas con la
// favorita (FavoriteStar, color acento). Tocar la nota actual la quita.
import { Star } from "lucide-react";
import { useApp } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const STARS = [1, 2, 3, 4, 5];

export function RatingStars({ recipe }: { recipe: Pick<Recipe, "id" | "name"> }) {
  const { ratings, setRating } = useApp();
  const current = ratings[recipe.id] ?? 0;
  return (
    <div role="group" aria-label={`Valoración de ${recipe.name}`} className="flex items-center">
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setRating(recipe.id, n)}
          aria-pressed={current === n}
          aria-label={`Valorar ${recipe.name} con ${n} estrellas`}
          className="min-h-11 min-w-11 flex items-center justify-center"
        >
          <Star
            className={`w-6 h-6 ${n <= current ? "text-[var(--color-expiring)]" : "text-[var(--color-text-muted)]"}`}
            fill={n <= current ? "currentColor" : "none"}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
