"use client";

// Escanear un ticket de compra (#67, docs/pm/67-escanear-ticket/tech.md › UI): foto o imagen → lectura en el servidor
// → lista editable → la página añade lo confirmado. El sheet no escribe en la Despensa.
import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/input";
import { apiUrl } from "@/lib/apiBase";
import { useAuth } from "@/lib/auth";
import { ImageError, shrinkImage } from "@/lib/receiptImage";
import {
  RECEIPT_ERROR_MESSAGES,
  canConfirm,
  toPantryItems,
  type EditableLine,
  type ReceiptErrorCode,
  type ReceiptLine,
} from "@/lib/receiptScan";
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from "@/lib/types";

type Step = { kind: "choose" } | { kind: "loading" } | { kind: "list"; lines: EditableLine[] } | { kind: "error"; message: string };

type ScanResponse = { lines: ReceiptLine[] } | { error: ReceiptErrorCode; message?: string };

class ScanError extends Error {}

const pickCls =
  "flex-1 flex flex-col items-center gap-2 border border-[var(--color-border)] rounded-xl py-5 text-sm font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-[var(--color-accent)]";

export function ScanReceiptSheet({
  today,
  onAdd,
  onManual,
  onClose,
}: {
  today: string;
  onAdd: (items: PantryItem[]) => void;
  /** "Añadir a mano": la página abre su formulario. */
  onManual: () => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>({ kind: "choose" });
  // Cerrar el sheet cancela la lectura en curso: su respuesta ya no debe mostrar nada
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const scan = async (file: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStep({ kind: "loading" });
    try {
      if (!token) throw new ScanError(RECEIPT_ERROR_MESSAGES.unauthorized);
      const image = await shrinkImage(file);
      if (controller.signal.aborted) return;
      const res = await fetch(apiUrl("/api/pantry/receipt"), {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
      const data = (await res.json()) as ScanResponse;
      if ("error" in data) throw new ScanError(data.message || RECEIPT_ERROR_MESSAGES[data.error] || RECEIPT_ERROR_MESSAGES.ai_failed);
      if (!res.ok || !Array.isArray(data.lines) || data.lines.length === 0) throw new ScanError(RECEIPT_ERROR_MESSAGES.unreadable);
      setStep({ kind: "list", lines: data.lines.map((l) => ({ ...l, checked: l.isFood })) });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof ScanError ? err.message : err instanceof ImageError ? RECEIPT_ERROR_MESSAGES.invalid_image : RECEIPT_ERROR_MESSAGES.ai_failed;
      setStep({ kind: "error", message });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite volver a elegir la misma imagen al reintentar
    e.target.value = "";
    if (file) void scan(file);
  };

  const editLine = (index: number, patch: Partial<EditableLine>) =>
    setStep((s) => (s.kind === "list" ? { kind: "list", lines: s.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) } : s));

  return (
    <Sheet title="Escanear ticket" onClose={onClose}>
      {step.kind === "choose" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Haz una foto del ticket entero o elige una que ya tengas. Revisarás la lista antes de añadir nada.
          </p>
          <div className="flex gap-3">
            <label className={pickCls}>
              <Camera className="w-6 h-6" aria-hidden />
              Hacer foto
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
            </label>
            <label className={pickCls}>
              <ImageIcon className="w-6 h-6" aria-hidden />
              Elegir imagen
              <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
            </label>
          </div>
        </div>
      )}

      {step.kind === "loading" && (
        <p role="status" className="text-sm text-center py-8 text-[var(--color-text-muted)]">
          Leyendo el ticket…
        </p>
      )}

      {step.kind === "error" && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-[var(--color-expired)]">
            {step.message}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onManual} className="flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm font-semibold">
              Añadir a mano
            </button>
            <button
              type="button"
              onClick={() => setStep({ kind: "choose" })}
              className="flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 text-sm font-semibold"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {step.kind === "list" && <LineList lines={step.lines} onEdit={editLine} onConfirm={() => onAdd(toPantryItems(step.lines, today))} />}
    </Sheet>
  );
}

function LineList({
  lines,
  onEdit,
  onConfirm,
}: {
  lines: EditableLine[];
  onEdit: (index: number, patch: Partial<EditableLine>) => void;
  onConfirm: () => void;
}) {
  const count = lines.filter((l) => l.checked).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-muted)]">Revisa los productos. Desmarca lo que no quieras añadir.</p>
      {lines.map((line, i) => (
        <div
          key={i}
          role="group"
          aria-label={`Línea ${i + 1}`}
          className={`flex gap-3 items-start border border-[var(--color-border)] rounded-xl p-3 ${line.checked ? "" : "opacity-60"}`}
        >
          <input
            type="checkbox"
            aria-label="Añadir"
            checked={line.checked}
            onChange={(e) => onEdit(i, { checked: e.target.checked })}
            className="mt-2.5 w-4 h-4 accent-[var(--color-accent)]"
          />
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <input
              aria-label="Nombre"
              className={inputCls}
              value={line.name}
              aria-invalid={line.checked && line.name.trim() === ""}
              onChange={(e) => onEdit(i, { name: e.target.value })}
            />
            <div className="flex gap-2">
              <input aria-label="Cantidad" className={inputCls} value={line.quantity} onChange={(e) => onEdit(i, { quantity: e.target.value })} />
              <select
                aria-label="Ubicación"
                className={inputCls}
                value={line.category}
                onChange={(e) => onEdit(i, { category: e.target.value as PantryCategory })}
              >
                {PANTRY_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={!canConfirm(lines)}
        onClick={onConfirm}
        className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm disabled:opacity-50"
      >
        {count === 1 ? "Añadir 1 producto" : `Añadir ${count} productos`}
      </button>
    </div>
  );
}
