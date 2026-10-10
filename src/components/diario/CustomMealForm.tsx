// Formulario de «Personalizada» (docs/pm/55-mis-alimentos/tech.md › Components & files): el de la pestaña de «Añadir
// comida», sacado de page.tsx sin cambiar su comportamiento, y el de editar una personalizada favorita (R4).
// add: casilla «Guardar en favoritos» justo encima de «Añadir» (R3). edit: «Guardar cambios» y «Quitar de favoritos».
import { useState } from "react";
import { Star } from "lucide-react";
import { FIBER_ERROR, parseFiber } from "@/lib/fiber";
import { inputCls } from "@/components/ui/input";

export interface CustomValues {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export const NAME_TAKEN_ERROR = "Ya tienes un favorito con ese nombre";

const MACROS = [
  ["calories", "kcal"],
  ["protein", "prot"],
  ["carbs", "carb"],
  ["fat", "grasa"],
] as const;

const PRIMARY = "flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm";
const SECONDARY = "flex-1 rounded-lg py-2 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]";

export function CustomMealForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  onRemove,
  nameTaken,
  hidden = false,
}: {
  mode: "add" | "edit";
  initial?: Partial<CustomValues>;
  /** Solo con el formulario válido. En modo edit, saveAsFavorite es siempre false. */
  onSubmit: (values: CustomValues, saveAsFavorite: boolean) => void;
  /** «Cancelar» junto al botón principal; sin él no se pinta. */
  onCancel?: () => void;
  /** «Quitar de favoritos» (solo en modo edit). */
  onRemove?: () => void;
  /** R4: el nombre ya es de otra personalizada favorita. */
  nameTaken?: (name: string) => boolean;
  /** Fuera de su pestaña no pinta nada, pero sigue montado: lo escrito sobrevive a un cambio de pestaña. */
  hidden?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [macros, setMacros] = useState({
    calories: initial?.calories ?? 0,
    protein: initial?.protein ?? 0,
    carbs: initial?.carbs ?? 0,
    fat: initial?.fat ?? 0,
  });
  // Fibra opcional (#23, R8): texto tal cual se teclea; vacío = sin dato
  const [fiberText, setFiberText] = useState(initial?.fiber === undefined ? "" : String(initial.fiber).replace(".", ","));
  const [fiberError, setFiberError] = useState(false);
  const [nameError, setNameError] = useState(false);
  // R3: desmarcada al abrir (se monta con «Añadir comida») y tras cada registro
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    const fiber = parseFiber(fiberText);
    if (fiber === null) {
      setFiberError(true);
      return;
    }
    if (nameTaken?.(name)) {
      setNameError(true);
      return;
    }
    onSubmit({ name, ...macros, ...(fiber !== undefined && { fiber }) }, mode === "add" && saveAsFavorite);
    if (mode === "add") {
      setName("");
      setMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      setFiberText("");
      setSaveAsFavorite(false);
    }
  };

  // Montado pero sin DOM: el estado se conserva y no quedan campos ocultos con las mismas etiquetas que otro formulario
  if (hidden) return null;
  return (
    <div className="flex flex-col gap-3">
      <input
        className={inputCls}
        placeholder="Nombre"
        value={name}
        aria-invalid={nameError}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(false);
        }}
      />
      {nameError && (
        <span role="alert" className="text-xs text-[var(--color-expired)]">
          {NAME_TAKEN_ERROR}
        </span>
      )}
      <div className="grid grid-cols-4 gap-2">
        {MACROS.map(([k, label]) => (
          <label key={k} className="text-[10px] text-[var(--color-text-muted)] flex flex-col gap-0.5">
            {label}
            <input
              type="number"
              className={inputCls}
              value={macros[k] || ""}
              onChange={(e) => setMacros({ ...macros, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <label className="w-1/4 text-[10px] text-[var(--color-text-muted)] flex flex-col gap-0.5">
        fibra
        <input
          inputMode="decimal"
          className={inputCls}
          value={fiberText}
          aria-invalid={fiberError}
          onChange={(e) => {
            setFiberText(e.target.value);
            setFiberError(false);
          }}
        />
      </label>
      {fiberError && (
        <span role="alert" className="text-xs text-[var(--color-expired)]">
          {FIBER_ERROR}
        </span>
      )}
      {mode === "add" && (
        <label className="flex items-center gap-2 min-h-11 text-sm">
          <input
            type="checkbox"
            checked={saveAsFavorite}
            onChange={(e) => setSaveAsFavorite(e.target.checked)}
            className="w-5 h-5 accent-[var(--color-accent)]"
          />
          <Star className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" aria-hidden />
          Guardar en favoritos
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={submit} className={PRIMARY}>
          {mode === "add" ? "Añadir" : "Guardar cambios"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={SECONDARY}>
            Cancelar
          </button>
        )}
      </div>
      {mode === "edit" && onRemove && (
        <button type="button" onClick={onRemove} className="self-start min-h-11 text-sm font-semibold text-[var(--color-expired)]">
          Quitar de favoritos
        </button>
      )}
    </div>
  );
}
