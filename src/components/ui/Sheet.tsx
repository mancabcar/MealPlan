"use client";

// Hoja inferior modal (lista-compra: detalle de ingrediente y "Pasar a la Despensa").
// role="dialog" nombrado por su título; se cierra con Escape o tocando el fondo.
import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-t-3xl p-5 pb-8 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-[var(--color-text-muted)] p-1">
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
