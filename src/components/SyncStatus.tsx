"use client";

// Indicador de sincronización (docs/pm/22-sincronizacion-dispositivos/spec.md › R10): una píldora fija arriba a la
// derecha, en todas las pantallas con sesión. aria-live="polite" para que los lectores de pantalla lo anuncien al cambiar (sin role="status": los avisos de la app, como el de Deshacer, ya lo usan y los tests los buscan por ese rol).
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSync } from "@/lib/syncContext";

const LABELS = { synced: "Al día", syncing: "Sincronizando…", unsynced: "Sin sincronizar" } as const;

export default function SyncStatus() {
  const { status } = useSync();
  const Icon = status === "synced" ? Cloud : status === "syncing" ? RefreshCw : CloudOff;
  return (
    <div className="pointer-events-none fixed top-1 right-2 z-50 max-w-lg w-full mx-auto left-1/2 -translate-x-1/2 flex justify-end px-2">
      <span
        data-testid="sync-status"
        aria-live="polite"
        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium bg-[var(--color-surface)] ${
          status === "unsynced"
            ? "border-[var(--color-expired)] text-[var(--color-expired)]"
            : "border-[var(--color-border)] text-[var(--color-text-muted)]"
        }`}
      >
        <Icon className={`w-3 h-3 ${status === "syncing" ? "animate-spin" : ""}`} aria-hidden />
        {LABELS[status]}
      </span>
    </div>
  );
}
