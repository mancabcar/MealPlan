"use client";

// Perfil › "Instalar app": solo aparece si el navegador permite instalar (issue #21 R7).
import { useId } from "react";
import { Smartphone } from "lucide-react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { Card } from "@/components/ui/Card";

export function InstallSection() {
  const titleId = useId();
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="font-semibold text-[var(--color-text)]">
        Instalar app
      </h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        Ábrela desde la pantalla de inicio, a pantalla completa y también sin conexión.
      </p>
      <button
        type="button"
        onClick={install}
        className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)]"
      >
        <Smartphone className="w-4 h-4" aria-hidden /> Instalar app
      </button>
    </Card>
  );
}
