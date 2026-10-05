// Tarjeta de receta de la lista de Recetas (y de la página de producto): extraída de recetas/page.tsx para reutilizarla.
import { ChefHat, Clock, Flame, Sparkles } from "lucide-react";
import type { Allergies, Recipe } from "@/lib/types";
import { daysUntil } from "@/lib/types";
import type { RecipeUsage } from "@/lib/pantryRecipes";
import { seasonalIn } from "@/lib/seasonal";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Highlight } from "@/components/ui/Highlight";
import { FavoriteStar } from "./FavoriteStar";
import { SeasonalSummaryChip } from "./temporada/SeasonalChips";

/** Placeholder de imagen (R9/non-goal: sin fotos reales todavía, ver spec § Non-goals). */
export function RecipeImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] shrink-0 ${className}`}
    >
      <ChefHat className="w-7 h-7" />
    </div>
  );
}

export function RecipeCard({
  recipe: r,
  query = "",
  usage,
  allergies,
  month,
  onSelect,
}: {
  recipe: Recipe;
  query?: string;
  usage?: RecipeUsage;
  allergies?: Allergies;
  month: number;
  onSelect: (r: Recipe) => void;
}) {
  return (
    // La estrella va fuera del botón de la tarjeta (un botón dentro de otro no es válido)
    <div className="relative">
      <button onClick={() => onSelect(r)} className="text-left w-full">
        <Card className="flex gap-3">
          <RecipeImagePlaceholder className="h-16 w-16" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm flex items-center gap-1.5 pr-10">
              {r.isAIGenerated && <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" aria-hidden />}
              <span className="truncate">
                <Highlight text={r.name} query={query} />
              </span>
              {r.isCustom && <Chip tone="accent">Propia</Chip>}
            </div>
            <AllergenBadge recipe={r} allergies={allergies} className="mt-1" />
            {usage && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--color-text-muted)]">
                <span>
                  Tienes {usage.matched} de {usage.total} ingredientes
                </span>
                {usage.soonest && daysUntil(usage.soonest) <= 2 && <Chip tone="expiring">caduca pronto</Chip>}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <SeasonalSummaryChip products={seasonalIn(r, month)} />
              <Chip icon={Flame}>{r.calories} kcal</Chip>
              <Chip tone="protein">P {r.protein}g</Chip>
              <Chip icon={Clock}>{r.prepTimeMinutes} min</Chip>
              {r.tags.map((t) => (
                <Chip key={t} tone="neutral">
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </Card>
      </button>
      <FavoriteStar recipe={r} className="absolute top-1 right-1" />
    </div>
  );
}
