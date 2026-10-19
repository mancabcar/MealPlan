// Fila de una entrada del Diario (docs/pm/57-editar-gramos-diario/tech.md › UI): nombre con su etiqueta («× 0,5»,
// «150 g», «2 ud · 120 g»), fibra, marca «Copiada», kcal y la ✕ «Eliminar».
import { X } from "lucide-react";
import { quantityLabel, servingsLabel } from "@/lib/diary";
import { formatFiber } from "@/lib/fiber";
import type { MealEntry } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { singleClick } from "@/components/ui/singleClick";

export function DiaryEntryRow({
  entry,
  name,
  fiber,
  copied,
  onRemove,
}: {
  entry: MealEntry;
  /** entryName: el propio, el de su receta o «Receta». */
  name: string;
  /** entryFiber; undefined = sin dato. */
  fiber: number | undefined;
  /** Recién copiada desde otro día (docs/pm/54-copiar-diario). */
  copied: boolean;
  onRemove: () => void;
}) {
  // Raciones (docs/pm/raciones R4): "× 0,5" junto al nombre; nada con 1 ración o en entradas anteriores (R5).
  // Alimentos (#13, R9): "150 g" o "2 ud · 120 g"; una entrada tiene una cosa o la otra.
  const label = servingsLabel(entry) ?? quantityLabel(entry);
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <div>
        <span>
          {name}
          {label && <span className="text-[var(--color-text-muted)]"> {label}</span>}
          {copied && <Chip tone="accent" className="ml-2">Copiada</Chip>}
        </span>
        <span className="block text-xs text-[var(--color-text-muted)]">
          {fiber === undefined ? "Fibra: sin dato" : `Fibra ${formatFiber(fiber)} g`}
        </span>
      </div>
      <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {/* Con raciones los macros pueden no ser enteros (0,25 × 150 = 37,5): se redondea al mostrar */}
        {Math.round(entry.calories)} kcal
        <button onClick={singleClick(onRemove)} aria-label="Eliminar" className="text-[var(--color-expired)]">
          <X className="w-4 h-4" aria-hidden />
        </button>
      </span>
    </div>
  );
}
