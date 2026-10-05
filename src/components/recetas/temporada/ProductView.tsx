// Página de producto (docs/pm/34-temporada R4, R5): barra de 12 meses, recetas que lo llevan y, si no hay ninguna,
// estado vacío con «Sugerir receta con <producto>» (IA). Con recetas, la IA es una acción secundaria.
import { ArrowLeft, Sparkles } from "lucide-react";
import type { Allergies, Recipe } from "@/lib/types";
import { MONTH_NAMES, MONTH_SHORT, monthMark, type SeasonalProduct } from "@/lib/seasonal";
import { Chip } from "@/components/ui/Chip";
import { RecipeCard } from "../RecipeCard";

export function ProductView({
  product,
  recipes,
  month,
  allergies,
  generating,
  error,
  onSelect,
  onSuggest,
  onBack,
}: {
  product: SeasonalProduct;
  recipes: Recipe[];
  month: number;
  allergies?: Allergies;
  generating: boolean;
  error: string;
  onSelect: (r: Recipe) => void;
  onSuggest: () => void;
  onBack: () => void;
}) {
  const inSeason = product.months.includes(month);
  const mark = monthMark(product, month);
  const suggestLabel = recipes.length === 0 ? `Sugerir receta con ${product.name}` : `Más ideas con ${product.name}`;
  const suggestBtn = (
    <button
      onClick={onSuggest}
      disabled={generating}
      className={
        recipes.length === 0
          ? "flex items-center gap-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          : "flex items-center gap-1.5 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      }
    >
      <Sparkles className="w-4 h-4" aria-hidden />
      {generating ? "Generando..." : suggestLabel}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1 text-[var(--color-accent)] text-sm self-start">
        <ArrowLeft className="w-4 h-4" aria-hidden /> Volver
      </button>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">{product.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Chip tone={inSeason ? "accent" : "neutral"}>
            {inSeason ? `De temporada en ${MONTH_NAMES[month - 1].toLowerCase()}` : "Fuera de temporada"}
          </Chip>
          {mark && <Chip>{mark}</Chip>}
        </div>
      </div>
      <ul aria-label="Meses de temporada" className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {MONTH_SHORT.map((short, i) => {
          const m = i + 1;
          const on = product.months.includes(m);
          return (
            <li
              key={m}
              aria-current={m === month ? "date" : undefined}
              className={`rounded-md py-1.5 text-center text-xs font-medium ${
                on
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              } ${m === month ? "ring-2 ring-offset-2 ring-offset-[var(--color-bg)] ring-[var(--color-text)]" : ""}`}
            >
              {short}
              <span className="sr-only">{on ? ", de temporada" : ", fuera de temporada"}</span>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="text-sm" style={{ color: "var(--color-expired)" }}>
          {error}
        </p>
      )}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
          <p>Aún no hay recetas con {product.name.toLowerCase()}.</p>
          {suggestBtn}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Recetas con {product.name.toLowerCase()}</h2>
            {suggestBtn}
          </div>
          <div className="flex flex-col gap-2">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} allergies={allergies} month={month} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
