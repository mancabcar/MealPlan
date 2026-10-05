// «Destacadas este mes» (docs/pm/34-temporada R2): carrusel corto de las recetas con más productos de temporada.
// Tarjetas compactas (nombre, productos y aviso de alérgenos), sin macros: la lista completa está en el filtro.
import type { Allergies, Recipe } from "@/lib/types";
import { seasonalIn } from "@/lib/seasonal";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { Chip } from "@/components/ui/Chip";

export function FeaturedRecipes({
  recipes,
  month,
  allergies,
  onSelect,
}: {
  recipes: Recipe[];
  month: number;
  allergies?: Allergies;
  onSelect: (r: Recipe) => void;
}) {
  // Sin coincidencias no hay sección: ni título ni tarjetas vacías
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="featured-title" className="flex flex-col gap-2">
      <h2 id="featured-title" className="font-semibold">
        Destacadas este mes
      </h2>
      <div className="flex gap-2 overflow-x-auto snap-x pb-1">
        {recipes.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="snap-start shrink-0 w-56 text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-2"
          >
            <span className="font-semibold text-sm">{r.name}</span>
            <span className="flex flex-wrap gap-1.5">
              {seasonalIn(r, month).map((p) => (
                <Chip key={p.id} tone="accent">
                  {p.name}
                </Chip>
              ))}
            </span>
            <AllergenBadge recipe={r} allergies={allergies} />
          </button>
        ))}
      </div>
    </section>
  );
}
