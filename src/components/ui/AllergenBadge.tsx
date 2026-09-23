// Aviso de alérgenos no bloqueante ("⚠ contiene Lactosa") compartido por Recetas y el Diario (diario-desde-plan R10).
import type { Allergies, Recipe } from "@/lib/types";
import { allergenWarning } from "@/lib/allergens";
import { Chip } from "./Chip";

export function AllergenBadge({
  recipe,
  allergies,
  className = "",
}: {
  recipe: Pick<Recipe, "name" | "ingredients">;
  allergies?: Allergies;
  className?: string;
}) {
  const warning = allergenWarning(recipe, allergies);
  if (!warning) return null;
  return (
    <Chip tone="expired" wrap className={className}>
      {warning}
    </Chip>
  );
}
