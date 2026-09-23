"use client";

// Aviso flotante con acción opcional (lista-compra R13: "{n} añadidos · Deshacer").
// role="status": los lectores de pantalla lo anuncian sin robar el foco.
import { useEffect, type ReactNode } from "react";

export function Toast({
  children,
  action,
  onDismiss,
  durationMs = 10000,
}: {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm shadow-lg shadow-black/40"
    >
      <span>{children}</span>
      {action && (
        <button onClick={action.onClick} className="font-semibold text-[var(--color-accent)]">
          {action.label}
        </button>
      )}
    </div>
  );
}
