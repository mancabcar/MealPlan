// Panel de filtros y orden de la página Recetas (docs/pm/111-recetas-valoracion-filtros R3, R4, R5, R7).
// El botón va en la fila de chips y el panel debajo; el estado vive en la página (se reinicia al salir de Recetas).
import { SlidersHorizontal } from "lucide-react";
import {
  countActiveFilters,
  KCAL_STEPS,
  NO_FILTERS,
  PROTEIN_STEPS,
  TIME_STEPS,
  type RecipeFilterState,
  type SortKey,
} from "@/lib/recipeFilters";
import { inputCls } from "@/components/ui/input";

export const SORT_LABELS: Record<SortKey, string> = {
  name: "A–Z",
  protein: "Proteína",
  kcal: "Calorías",
  time: "Tiempo",
  rating: "Valoración",
};

const PANEL_ID = "recipe-filters-panel";

const chipCls = (on: boolean) =>
  `rounded-full px-3 py-1 text-sm font-semibold border min-h-9 ${
    on
      ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent"
      : "border-[var(--color-border)] text-[var(--color-text-muted)]"
  }`;

export function FiltersButton({ state, open, onToggle }: { state: RecipeFilterState; open: boolean; onToggle: () => void }) {
  const n = countActiveFilters(state);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={PANEL_ID}
      className={`flex items-center gap-1.5 ${chipCls(n > 0)}`}
    >
      <SlidersHorizontal className="w-4 h-4" aria-hidden />
      {n > 0 ? `Filtros (${n})` : "Filtros"}
    </button>
  );
}

/** «Tiempo ≤30 min · Proteína ≥30 g»: lo que está filtrando, para el estado vacío. */
export function describeFilters(state: RecipeFilterState): string {
  return [
    state.maxTime !== null && `Tiempo ≤${state.maxTime} min`,
    state.maxKcal !== null && `Calorías ≤${state.maxKcal} kcal`,
    state.minProtein !== null && `Proteína ≥${state.minProtein} g`,
    state.hideAllergens && "Sin mis alérgenos",
  ]
    .filter(Boolean)
    .join(" · ");
}

function StepGroup({
  label,
  steps,
  value,
  format,
  onPick,
}: {
  label: string;
  steps: number[];
  value: number | null;
  format: (n: number) => string;
  onPick: (n: number | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[var(--color-text-muted)] w-20">{label}</span>
      {steps.map((n) => (
        <button key={n} type="button" aria-pressed={value === n} onClick={() => onPick(value === n ? null : n)} className={chipCls(value === n)}>
          {format(n)}
        </button>
      ))}
    </div>
  );
}

export function FiltersPanel({
  state,
  onChange,
  sort,
  onSort,
  hasAllergies,
}: {
  state: RecipeFilterState;
  onChange: (next: RecipeFilterState) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  hasAllergies: boolean;
}) {
  return (
    <div id={PANEL_ID} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-3">
      <StepGroup label="Tiempo" steps={TIME_STEPS} value={state.maxTime} format={(n) => `≤${n} min`} onPick={(maxTime) => onChange({ ...state, maxTime })} />
      <StepGroup label="Calorías" steps={KCAL_STEPS} value={state.maxKcal} format={(n) => `≤${n} kcal`} onPick={(maxKcal) => onChange({ ...state, maxKcal })} />
      <StepGroup label="Proteína" steps={PROTEIN_STEPS} value={state.minProtein} format={(n) => `≥${n} g`} onPick={(minProtein) => onChange({ ...state, minProtein })} />
      {hasAllergies && (
        <label className="flex items-center justify-between gap-3 text-sm">
          Ocultar mis alérgenos
          <button
            type="button"
            role="switch"
            aria-checked={state.hideAllergens}
            aria-label="Ocultar mis alérgenos"
            onClick={() => onChange({ ...state, hideAllergens: !state.hideAllergens })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${state.hideAllergens ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-2)]"}`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--color-text)] transition-all ${state.hideAllergens ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </label>
      )}
      <label className="flex items-center justify-between gap-3 text-sm">
        Ordenar por
        <select className={`${inputCls} w-auto`} value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {countActiveFilters(state) > 0 && (
        <button type="button" onClick={() => onChange(NO_FILTERS)} className="self-start text-sm font-semibold text-[var(--color-accent)]">
          Quitar filtros
        </button>
      )}
    </div>
  );
}
