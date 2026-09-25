"use client";

// Perfil › "Tus datos": exportar e importar una copia de seguridad (docs/pm/backup-datos).
import { useId, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/store";
import { backupFileName, buildBackup, formatExportDate, parseBackup } from "@/lib/backup";
import { Card } from "@/components/ui/Card";

const secondaryBtn =
  "flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)]";

const READ_FAILED = "No se ha podido leer el fichero. No se ha cambiado nada.";
const WRITE_FAILED = "No se han podido guardar los datos (¿falta espacio?). No se ha cambiado nada.";

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

type Message = { kind: "error" | "success"; text: string };

/** `onImported`: Perfil descarta sus borradores y avisos, que se refieren a los datos de antes. */
export function DataSection({ onImported }: { onImported: () => void }) {
  const { user } = useAuth();
  const { importData } = useApp();
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // R5, R6, R8, R9: validar y migrar todo antes de preguntar; nada se escribe hasta aceptar la confirmación.
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // para poder elegir el mismo fichero otra vez
    setMessage(null);
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ kind: "error", text: READ_FAILED });
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const date = formatExportDate(result.exportedAt);
    const copy = date ? `la copia del ${date}` : "esta copia";
    if (!confirm(`¿Sustituir todos tus datos por ${copy}? Lo que tengas ahora se perderá.`)) return;

    try {
      importData(result.data);
    } catch {
      setMessage({ kind: "error", text: WRITE_FAILED });
      return;
    }
    setMessage({ kind: "success", text: "Datos importados" });
    onImported();
  };

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
        <button type="button" className={secondaryBtn} onClick={() => fileInput.current?.click()}>
          <Upload className="w-4 h-4" aria-hidden />
          Importar datos
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label="Fichero de copia"
          hidden
          onChange={onFile}
        />
      </div>
      {message?.kind === "error" && (
        <p role="alert" className="text-sm text-[var(--color-expired)]">
          {message.text}
        </p>
      )}
      {message?.kind === "success" && (
        <p role="status" className="text-sm font-semibold text-[var(--color-text)]">
          {message.text}
        </p>
      )}
    </Card>
  );
}
