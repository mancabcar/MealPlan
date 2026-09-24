"use client";

// Perfil › "Tus datos": exportar e importar una copia de seguridad (docs/pm/backup-datos).
import { useId } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { backupFileName, buildBackup } from "@/lib/backup";
import { Card } from "@/components/ui/Card";

const secondaryBtn =
  "flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)]";

/** Descarga la copia de las seis claves del usuario como mealplan-backup-<hoy>.json (R1). */
function exportData(userId: string) {
  const backup = buildBackup(localStorage, userId);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Tras dejar que empiece la descarga (revocar en el mismo tick la corta en algunos navegadores)
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function DataSection() {
  const { user } = useAuth();
  const titleId = useId();

  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="font-semibold text-[var(--color-text)]">
        Tus datos
      </h2>
      {/* R11 */}
      <p className="text-sm text-[var(--color-text-muted)]">
        Tus datos solo se guardan en este navegador. Exporta una copia de vez en cuando para no perderlos.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryBtn} onClick={() => user && exportData(user.id)}>
          <Download className="w-4 h-4" aria-hidden />
          Exportar mis datos
        </button>
      </div>
    </Card>
  );
}
