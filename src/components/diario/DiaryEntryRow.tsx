// Fila de una entrada del Diario (docs/pm/57-editar-gramos-diario/tech.md › UI): nombre con su etiqueta («× 0,5»,
// «150 g», «2 ud · 120 g»), fibra, marca «Copiada», kcal y la ✕ «Eliminar». Si la entrada tiene una cantidad editable
// (R5), la fila es un botón que abre, debajo y dentro de la propia fila, el editor de gramos, unidades o raciones (R1, R8).
import { useId, useState } from "react";
import { X } from "lucide-react";
import { entryQuantity, formatServings, parseServings, quantityLabel, rescaleEntry, servingsLabel } from "@/lib/diary";
import { formatFiber } from "@/lib/fiber";
import type { MealEntry } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { ServingsField } from "@/components/ui/ServingsField";
import { singleClick } from "@/components/ui/singleClick";
import { FoodQuantityForm } from "./FoodQuantityForm";

export function DiaryEntryRow({
  entry,
  name,
  fiber,
  copied,
  editing,
  onEdit,
  onSave,
  onCancel,
  onRemove,
}: {
  entry: MealEntry;
  /** entryName: el propio, el de su receta o «Receta». */
  name: string;
  /** entryFiber; undefined = sin dato. */
  fiber: number | undefined;
  /** Recién copiada desde otro día (docs/pm/54-copiar-diario). */
  copied: boolean;
  /** Editor abierto: solo una fila a la vez, lo decide el Diario (R4). */
  editing: boolean;
  onEdit: () => void;
  /** La entrada ya escalada con rescaleEntry (R3). */
  onSave: (next: MealEntry) => void;
  /** «Cancelar», y también «Guardar cambios» con el mismo valor: se cierra sin guardar ni avisar. */
  onCancel: () => void;
  onRemove: () => void;
}) {
  const quantity = entryQuantity(entry);
  // Raciones (docs/pm/raciones R4): "× 0,5" junto al nombre; nada con 1 ración o en entradas anteriores (R5).
  // Alimentos (#13, R9): "150 g" o "2 ud · 120 g"; una entrada tiene una cosa o la otra.
  const label = servingsLabel(entry) ?? quantityLabel(entry);
  const summary = (
    <>
      {/* Solo spans: va dentro de un <button> */}
      <span>
        <span>
          {name}
          {label && <span className="text-[var(--color-text-muted)]"> {label}</span>}
          {copied && <Chip tone="accent" className="ml-2">Copiada</Chip>}
        </span>
        <span className="block text-xs text-[var(--color-text-muted)]">
          {fiber === undefined ? "Fibra: sin dato" : `Fibra ${formatFiber(fiber)} g`}
        </span>
      </span>
      {/* Con raciones los macros pueden no ser enteros (0,25 × 150 = 37,5): se redondea al mostrar */}
      <span className="shrink-0 text-[var(--color-text-muted)]">{Math.round(entry.calories)} kcal</span>
    </>
  );
  // Vista previa (R6): la etiqueta que tendrá la fila y sus kcal
  const kcal = (next: Parameters<typeof rescaleEntry>[1]) => `${Math.round(rescaleEntry(entry, next).calories)} kcal`;

  return (
    <div className="py-1 text-sm">
      <div className="flex justify-between items-center gap-2">
        {quantity ? (
          // Toda la fila abre el editor; la ✕ va fuera, nunca anidada (como MealRow)
          <button
            type="button"
            onClick={singleClick(onEdit)}
            aria-label={`Cambiar cantidad de ${name}`}
            aria-expanded={editing}
            className="flex-1 min-w-0 flex justify-between items-center gap-2 text-left"
          >
            {summary}
          </button>
        ) : (
          <div className="flex-1 min-w-0 flex justify-between items-center gap-2">{summary}</div>
        )}
        <button onClick={singleClick(onRemove)} aria-label="Eliminar" className="text-[var(--color-expired)]">
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
      {editing && quantity && (
        <div className="mt-2 mb-1">
          {quantity.kind === "servings" ? (
            <ServingsEditor
              servings={quantity.servings}
              preview={(s) => `× ${formatServings(s)} → ${kcal({ servings: s })}`}
              onSave={(s) => (s === quantity.servings ? onCancel() : onSave(rescaleEntry(entry, { servings: s })))}
              onCancel={onCancel}
            />
          ) : (
            <FoodQuantityForm
              quantity={quantity.kind === "units" ? { grams: quantity.grams, units: quantity.units } : { grams: quantity.grams }}
              preview={(q) => `${quantityLabel(q)} → ${kcal(q)}`}
              onSave={(q) => {
                const same = q.grams === quantity.grams && q.units === (quantity.kind === "units" ? quantity.units : undefined);
                if (same) onCancel();
                else onSave(rescaleEntry(entry, q));
              }}
              onCancel={onCancel}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Raciones de una receta (R8): ServingsField con «Guardar cambios» y «Cancelar»; el error sale al guardar, como al registrar. */
function ServingsEditor({
  servings,
  preview,
  onSave,
  onCancel,
}: {
  servings: number;
  preview: (servings: number) => string;
  onSave: (servings: number) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(formatServings(servings));
  const [error, setError] = useState(false);
  const parsed = parseServings(text);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <ServingsField
        id={id}
        value={text}
        onChange={(t) => {
          setText(t);
          setError(false);
        }}
        error={error}
        preview={parsed !== null && <span className="shrink-0 text-[var(--color-text-muted)]">{preview(parsed)}</span>}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => (parsed === null ? setError(true) : onSave(parsed))}
          className="flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm"
        >
          Guardar cambios
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg py-2 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
