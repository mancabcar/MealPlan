// Selector de recetas del Plan y de «Añadir comida» (docs/pm/20-recetas-filtros/tech.md › UI): lista táctil filtrada por la
// franja elegida, con ★ Favoritas arriba, buscador y «Ver todas». Sustituye al <select> largo.
// Contrato de nombres accesibles: tech.md › UI test contract (lo comprueba tests/e2e/favoritos-franja.spec.ts).
import { useId, useState } from "react";
import { allergenWarning } from "@/lib/allergens";
import { groupRecipes, slotLabel } from "@/lib/recipeSlots";
import { useApp } from "@/lib/store";
import type { MealType, Recipe } from "@/lib/types";
import { inputCls } from "@/components/ui/input";
import { Highlight } from "@/components/ui/Highlight";
import { FavoriteStar } from "./FavoriteStar";

const SECTION_TITLE = "px-1 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";

export function RecipePicker({
  mealType,
  value,
  onPick,
  onClear,
}: {
  mealType: MealType;
  /** Id de la receta ya asignada a la franja ("" = ninguna). */
  value: string;
  onPick: (recipeId: string) => void;
  /** Solo en el Plan: deja la franja sin asignar. */
  onClear?: () => void;
}) {
  const { recipes, favorites, profile } = useApp();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const ids = useId();
  const groups = groupRecipes({ recipes, favorites, mealType, query, showAll });
  const empty = groups.favorites.length + groups.slot.length + groups.others.length === 0;

  const row = (r: Recipe, withSlot: boolean) => {
    const warning = allergenWarning(r, profile?.allergies);
    const slot = withSlot ? slotLabel(r) : null;
    return (
      <li key={r.id} className="flex items-center gap-1 border-b border-[var(--color-border)] last:border-b-0">
        <button
          type="button"
          onClick={() => onPick(r.id)}
          aria-current={value === r.id ? "true" : undefined}
          className={`flex-1 min-h-11 py-1.5 pl-2 text-left flex items-center gap-2 rounded-lg ${
            value === r.id ? "bg-[var(--color-surface-2)]" : ""
          }`}
        >
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              <Highlight text={r.name} query={query} />
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {r.calories} kcal · {r.protein} g proteína · {r.prepTimeMinutes} min
              {warning && <span className="text-[var(--color-expired)]"> · {warning}</span>}
            </span>
          </span>
          {slot && (
            <span className="shrink-0 rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
              {slot}
            </span>
          )}
        </button>
        <FavoriteStar recipe={r} />
      </li>
    );
  };

  const section = (title: string, name: string, items: Recipe[], withSlot = false) =>
    items.length > 0 && (
      <section>
        <h4 id={`${ids}-${name}`} className={SECTION_TITLE}>
          {title}
        </h4>
        <ul aria-labelledby={`${ids}-${name}`}>{items.map((r) => row(r, withSlot))}</ul>
      </section>
    );

  return (
    <div role="group" aria-label="Elegir receta" className="flex flex-col gap-2">
      <input
        type="search"
        aria-label="Buscar"
        placeholder={showAll ? "Buscar en todas las recetas..." : `Buscar en ${mealType.toLowerCase()}...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls}
      />
      {onClear && value && (
        <button type="button" onClick={onClear} className="min-h-11 self-start text-sm text-[var(--color-text-muted)]">
          Quitar
        </button>
      )}
      <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-1">
        {groups.favorites.length > 0 ? (
          section("★ Favoritas", "fav", groups.favorites)
        ) : (
          !showAll &&
          !query.trim() && (
            <section>
              <h4 className={SECTION_TITLE}>★ Favoritas</h4>
              <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-text-muted)]">
                Aún no tienes favoritas para esta franja. Toca la estrella de una receta y aparecerá aquí.
              </p>
            </section>
          )
        )}
        {section(mealType, "slot", groups.slot)}
        {section(showAll ? "Otras franjas" : "Otras recetas", "others", groups.others, true)}
        {empty && (
          <p className="p-3 text-sm text-[var(--color-text-muted)]">
            {query.trim() ? `Sin resultados para «${query.trim()}»` : "No hay recetas."}
          </p>
        )}
      </div>
      {showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="min-h-11 self-start text-sm font-semibold text-[var(--color-accent)]"
        >
          ← Solo {mealType}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="min-h-11 rounded-lg border border-[var(--color-border)] text-sm font-semibold text-[var(--color-accent)]"
        >
          Ver todas las recetas
        </button>
      )}
    </div>
  );
}
