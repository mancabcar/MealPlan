// Indicadores de temporada de una receta (docs/pm/34-temporada R3): en la tarjeta, un chip corto; en el detalle,
// todos los productos como botones que abren su página.
import { Leaf } from "lucide-react";
import type { SeasonalProduct } from "@/lib/seasonal";
import { Chip } from "@/components/ui/Chip";

/** Tarjeta de la lista: «De temporada: Calabaza, Caqui +1» (hasta 2 nombres). */
export function SeasonalSummaryChip({ products }: { products: SeasonalProduct[] }) {
  if (products.length === 0) return null;
  const shown = products.slice(0, 2).map((p) => p.name).join(", ");
  const extra = products.length - 2;
  return (
    <Chip tone="accent" icon={Leaf}>
      De temporada: {shown}
      {extra > 0 && ` +${extra}`}
    </Chip>
  );
}

/** Detalle de la receta: un botón «Ver producto: <Nombre>» por cada producto de temporada. */
export function SeasonalProductLinks({
  products,
  monthName,
  onProduct,
}: {
  products: SeasonalProduct[];
  monthName: string;
  onProduct: (p: SeasonalProduct) => void;
}) {
  if (products.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip tone="accent" icon={Leaf}>
        De temporada en {monthName.toLowerCase()}
      </Chip>
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => onProduct(p)}
          aria-label={`Ver producto: ${p.name}`}
          className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm font-medium"
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
