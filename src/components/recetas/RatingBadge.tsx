// Nota de una receta en la tarjeta y el detalle (docs/pm/111-recetas-valoracion-filtros R6). Sin nota no pinta nada.
import { Star } from "lucide-react";
import { useApp } from "@/lib/store";
import { Chip } from "@/components/ui/Chip";

export function RatingBadge({ recipeId }: { recipeId: string }) {
  const { ratings } = useApp();
  const n = ratings[recipeId];
  if (!n) return null;
  return (
    <Chip tone="expiring" icon={Star}>
      <span aria-hidden>{n}</span>
      <span className="sr-only">Valoración {n} de 5</span>
    </Chip>
  );
}
