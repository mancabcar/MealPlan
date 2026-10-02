// Estrella de favorita de una receta (docs/pm/20-recetas-filtros R2/R5): la usan el selector y la página Recetas.
// Siempre fuera de otros botones: el nombre accesible lleva la receta («Marcar … como favorita» / «Quitar … de favoritas»).
import { Star } from "lucide-react";
import { useApp } from "@/lib/store";
import type { Recipe } from "@/lib/types";

export function FavoriteStar({ recipe, className = "" }: { recipe: Pick<Recipe, "id" | "name">; className?: string }) {
  const { favorites, toggleFavorite } = useApp();
  const fav = favorites.includes(recipe.id);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(recipe.id)}
      aria-label={fav ? `Quitar ${recipe.name} de favoritas` : `Marcar ${recipe.name} como favorita`}
      className={`shrink-0 min-h-11 min-w-11 flex items-center justify-center ${className}`}
    >
      <Star
        className={`w-5 h-5 ${fav ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
        fill={fav ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}
