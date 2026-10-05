// Calendario completo (docs/pm/34-temporada R8): verduras y frutas × 12 meses, estático, mes actual resaltado.
// Es la única vista donde salen los básicos de todo el año.
import { ArrowLeft } from "lucide-react";
import { MONTH_NAMES, MONTH_SHORT, SEASONAL_PRODUCTS, type SeasonalProduct } from "@/lib/seasonal";

const GROUPS: { kind: SeasonalProduct["kind"]; label: string }[] = [
  { kind: "verdura", label: "Verduras" },
  { kind: "fruta", label: "Frutas" },
];

export function SeasonCalendar({ month, onBack }: { month: number; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1 text-[var(--color-accent)] text-sm self-start">
        <ArrowLeft className="w-4 h-4" aria-hidden /> Volver
      </button>
      <h1 className="font-display text-2xl font-bold">Calendario de temporada</h1>
      {/* tabIndex: la región con scroll horizontal tiene que poder enfocarse con el teclado */}
      <div role="region" aria-label="Tabla de temporada, desplazable" tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-y-1">
          <caption className="sr-only">Meses de temporada de cada verdura y fruta</caption>
          <thead>
            <tr>
              <th scope="col" className="text-left font-semibold pr-2 sticky left-0 bg-[var(--color-bg)]">
                Producto
              </th>
              {MONTH_SHORT.map((short, i) => (
                <th
                  key={short}
                  scope="col"
                  aria-current={i + 1 === month ? "date" : undefined}
                  className={`px-1 font-semibold ${i + 1 === month ? "text-[var(--color-accent)] underline" : "text-[var(--color-text-muted)]"}`}
                >
                  <abbr title={MONTH_NAMES[i]} className="no-underline">
                    {short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          {GROUPS.map(({ kind, label }) => (
            <tbody key={kind}>
              <tr>
                <th scope="rowgroup" colSpan={13} className="text-left text-sm font-semibold pt-2">
                  {label}
                </th>
              </tr>
              {SEASONAL_PRODUCTS.filter((p) => p.kind === kind).map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="text-left font-normal pr-2 whitespace-nowrap sticky left-0 bg-[var(--color-bg)]">
                    {p.name}
                  </th>
                  {MONTH_SHORT.map((short, i) => {
                    const on = p.months.includes(i + 1);
                    return (
                      <td
                        key={short}
                        className={`h-6 min-w-6 rounded-sm text-center ${
                          on ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-2)]"
                        } ${i + 1 === month ? "outline outline-2 outline-[var(--color-text)]" : ""}`}
                      >
                        <span className="sr-only">{on ? "de temporada" : "fuera de temporada"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
