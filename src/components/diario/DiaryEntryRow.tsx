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
import { EditorActions, FoodQuantityForm } from "./FoodQuantityForm";

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
  // El aria-label del botón tapa su contenido: el resumen se enlaza como descripción para que el lector de pantalla
  // siga anunciando cantidad, «Copiada», fibra y kcal (review de la PR #173)
  const summaryId = useId();
  const summary = (
    <>
      {/* Solo spans: va dentro de un <button> */}
      <span id={`${summaryId}-info`}>
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
      <span id={`${summaryId}-kcal`} className="shrink-0 text-[var(--color-text-muted)]">
        {Math.round(entry.calories)} kcal
      </span>
    </>
  );
  // Vista previa (R6): la etiqueta que tendrá la fila y sus kcal
  const kcal = (next: Parameters<typeof rescaleEntry>[1]) => `${Math.round(rescaleEntry(entry, next).calories)} kcal`;

  return (
    <div className="py-1 text-sm">
      <div className="flex justify-between items-center gap-2">
        {quantity ? (
          // Toda la fila abre el editor, y con él abierto lo cierra sin guardar (#175); la ✕ va fuera, nunca anidada (como MealRow)
          <button
            type="button"
            onClick={singleClick(editing ? onCancel : onEdit)}
            aria-label={`Cambiar cantidad de ${name}`}
            aria-describedby={`${summaryId}-info ${summaryId}-kcal`}
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
                // En gramos el editor abre redondeado (#174): guardar ese mismo valor no cambia nada
                const same =
                  quantity.kind === "units" ? q.units === quantity.units : q.units === undefined && q.grams === Math.round(quantity.grams);
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

/**
 * Raciones de una receta (R8): ServingsField con «Guardar cambios» y «Cancelar». Como el editor de gramos, el error sale
 * al escribir y un valor no válido desactiva «Guardar cambios» (#176).
 */
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
  const parsed = parseServings(text);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <ServingsField
        id={id}
        value={text}
        onChange={setText}
        error={parsed === null}
        preview={parsed !== null && <span className="shrink-0 text-[var(--color-text-muted)]">{preview(parsed)}</span>}
      />
      <EditorActions disabled={parsed === null} onSave={() => parsed !== null && onSave(parsed)} onCancel={onCancel} />
    </div>
  );
}
