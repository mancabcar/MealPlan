// Franja «De temporada · <mes>» (docs/pm/34-temporada R1): productos del mes, verduras y frutas por separado,
// con «empieza» / «últimas» en los meses de transición. Sin los básicos de todo el año.
import { Apple, Carrot, type LucideIcon } from "lucide-react";
import { MONTH_NAMES, monthMark, seasonalProducts, type SeasonalProduct } from "@/lib/seasonal";

function ProductList({
  label,
  icon: Icon,
  products,
  month,
  onProduct,
}: {
  label: string;
  icon: LucideIcon;
  products: SeasonalProduct[];
  month: number;
  onProduct: (p: SeasonalProduct) => void;
}) {
  if (products.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {products.map((p) => {
        const mark = monthMark(p, month);
        return (
          <li key={p.id}>
            <button
              onClick={() => onProduct(p)}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium"
            >
              <Icon className="w-4 h-4 text-[var(--color-accent)]" aria-hidden />
              {p.name}
              {mark && <span className="text-xs text-[var(--color-text-muted)]">{mark}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SeasonStrip({
  month,
  onProduct,
  onCalendar,
}: {
  month: number;
  onProduct: (p: SeasonalProduct) => void;
  onCalendar: () => void;
}) {
  const { verduras, frutas } = seasonalProducts(month);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">De temporada · {MONTH_NAMES[month - 1]}</h2>
        <button onClick={onCalendar} className="text-sm text-[var(--color-accent)] font-medium">
          Ver calendario completo
        </button>
      </div>
      <ProductList label="Verduras" icon={Carrot} products={verduras} month={month} onProduct={onProduct} />
      <ProductList label="Frutas" icon={Apple} products={frutas} month={month} onProduct={onProduct} />
    </section>
  );
}
