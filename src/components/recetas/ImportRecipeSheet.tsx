"use client";

// Diálogo para importar una receta desde una URL (#19). Llama a la ruta del servidor y, si sale bien, entrega el
// borrador a la página para abrir el formulario de receta; no guarda nada.
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/input";
import { apiUrl } from "@/lib/apiBase";
import { IMPORT_ERROR_MESSAGES, validateImportUrl, type ImportResponse } from "@/lib/recipeImport";
import type { ImportedDraft } from "@/components/recetas/RecipeForm";

export function ImportRecipeSheet({
  onImported,
  onManual,
  onClose,
}: {
  onImported: (draft: ImportedDraft) => void;
  /** "Crear a mano": formulario vacío; recibe la URL si era válida (R9). */
  onManual: (sourceUrl?: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Cerrar el diálogo cancela la petición en curso: su respuesta no debe abrir el formulario después
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(apiUrl("/api/recipes/import"), {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as ImportResponse;
      if ("error" in data) {
        setError(data.message || IMPORT_ERROR_MESSAGES[data.error]);
      } else if (!res.ok || !data.recipe) {
        setError(IMPORT_ERROR_MESSAGES.fetch_failed);
      } else {
        const checked = validateImportUrl(url);
        onImported({
          recipe: data.recipe,
          source: data.source,
          sourceUrl: checked.ok ? checked.url.href : undefined,
          servingsHint: data.servingsHint,
        });
        return;
      }
    } catch {
      if (controller.signal.aborted) return;
      setError(IMPORT_ERROR_MESSAGES.fetch_failed);
    }
    setLoading(false);
  };

  const checked = validateImportUrl(url);

  return (
    <Sheet title="Importar receta" onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="import-url" className="text-sm font-medium">
            URL de la receta
          </label>
          <input
            id="import-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-describedby={error ? "import-url-error" : undefined}
            aria-invalid={!!error}
          />
        </div>
        {error && (
          <p id="import-url-error" role="alert" className="text-sm text-[var(--color-expired)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {error && (
            <button
              type="button"
              onClick={() => onManual(checked.ok ? checked.url.href : undefined)}
              className="flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm font-semibold"
            >
              Crear a mano
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Importando…" : "Importar"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
