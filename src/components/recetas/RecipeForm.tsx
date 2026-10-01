"use client";

// Formulario de receta propia (docs/pm/18-recetas-propias R1, R2, R4, R10), dentro de un Sheet. Sin `recipe` crea una
// nueva; con `recipe` la edita (también la copia sin guardar de "Duplicar y editar"). Las etiquetas de los campos son su
// nombre accesible exacto: errores y pistas van fuera, con aria-describedby.
import { useId, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/input";
import {
  parseAmount,
  suggestCalories,
  validateRecipeDraft,
  type RecipeDraft,
} from "@/lib/recipeEdit";
import type { ImportedRecipe } from "@/lib/recipeImport";
import type { Recipe } from "@/lib/types";

/** Receta traída de una URL (#19): llega como borrador de una receta NUEVA; nada se guarda hasta pulsar "Guardar". */
export interface ImportedDraft {
  recipe: ImportedRecipe;
  source: "jsonld" | "ai";
  sourceUrl?: string;
  /** Raciones que indica la web, como pista (R8). */
  servingsHint?: string;
}

const MACRO_FIELDS = ["calories", "protein", "carbs", "fat"] as const;

const num = (n: number) => (n === 0 ? "" : String(n));
const opt = (n?: number) => (n === undefined ? "" : String(n));

function draftFrom(recipe?: Recipe, imported?: ImportedDraft): RecipeDraft {
  if (imported) {
    const r = imported.recipe;
    return {
      name: r.name,
      ingredients: r.ingredients.join("\n"),
      instructions: r.instructions.join("\n"),
      prepTimeMinutes: opt(r.prepTimeMinutes),
      calories: opt(r.calories),
      protein: opt(r.protein),
      carbs: opt(r.carbs),
      fat: opt(r.fat),
      tags: [],
    };
  }
  if (!recipe) {
    return { name: "", ingredients: "", instructions: "", prepTimeMinutes: "", calories: "", protein: "", carbs: "", fat: "", tags: [] };
  }
  return {
    name: recipe.name,
    ingredients: recipe.ingredients.join("\n"),
    instructions: recipe.instructions.join("\n"),
    prepTimeMinutes: num(recipe.prepTimeMinutes),
    calories: String(recipe.calories),
    protein: String(recipe.protein),
    carbs: String(recipe.carbs),
    fat: String(recipe.fat),
    tags: [...recipe.tags],
  };
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy || undefined })}
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-[var(--color-text-muted)]">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-xs text-[var(--color-expired)]">
          {error}
        </span>
      )}
    </div>
  );
}

export function RecipeForm({
  recipe,
  imported,
  suggestedTags,
  onSave,
  onClose,
}: {
  recipe?: Recipe;
  imported?: ImportedDraft;
  suggestedTags: string[];
  onSave: (r: Recipe) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RecipeDraft>(() => draftFrom(recipe, imported));
  // Valores de partida: el distintivo "estimado" se quita si el usuario cambia kcal, proteínas, carbos o grasas
  const [initial] = useState<RecipeDraft>(draft);
  const estimated = recipe ? !!recipe.macrosEstimated : imported?.source === "ai";
  const macrosChanged = MACRO_FIELDS.some((k) => (parseAmount(draft[k]) ?? draft[k]) !== (parseAmount(initial[k]) ?? initial[k]));
  const notices = [
    estimated && "Macros estimados por IA: revísalos.",
    imported?.servingsHint && `La web indica ${imported.servingsHint} raciones: revisa que los macros sean por ración.`,
  ].filter((n): n is string => !!n);
  const [errors, setErrors] = useState<Partial<Record<keyof RecipeDraft, string>>>({});
  const [tagText, setTagText] = useState("");
  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Sugeridas primero, y después las de la receta que no estén entre ellas
  const tagOptions = [...suggestedTags, ...draft.tags.filter((t) => !suggestedTags.includes(t))];
  const toggleTag = (t: string) => set("tags", draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t]);
  const addTypedTag = () => {
    const t = tagText.trim();
    if (t && !draft.tags.includes(t)) set("tags", [...draft.tags, t]);
    setTagText("");
  };

  const macros = [draft.protein, draft.carbs, draft.fat].map((v) => parseAmount(v));
  const hasMacros = [draft.protein, draft.carbs, draft.fat].some((v) => v.trim());
  // Los vacíos cuentan 0, pero con un macro inválido no se sugiere nada
  const macrosValid = [draft.protein, draft.carbs, draft.fat].every((v, i) => !v.trim() || macros[i] !== null);
  const kcalSuggestion = hasMacros && macrosValid ? suggestCalories(macros[0] ?? 0, macros[1] ?? 0, macros[2] ?? 0) : null;

  const save = () => {
    const result = validateRecipeDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const keepEstimated = estimated && !macrosChanged;
    if (recipe) {
      const rest: Recipe = { ...recipe };
      delete rest.macrosEstimated;
      onSave({ ...rest, ...result.recipe, ...(keepEstimated && { macrosEstimated: true as const }) });
      return;
    }
    onSave({
      ...result.recipe,
      id: `custom_${crypto.randomUUID()}`,
      isCustom: true,
      ...(imported?.sourceUrl && { sourceUrl: imported.sourceUrl }),
      ...(keepEstimated && { macrosEstimated: true as const }),
    });
  };

  return (
    <Sheet title={recipe ? "Editar receta" : "Nueva receta"} onClose={onClose}>
      {notices.map((n) => (
        <p key={n} role="status" className="text-sm rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
          {n}
        </p>
      ))}
      <Field label="Nombre" error={errors.name}>
        {(p) => <input {...p} className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} />}
      </Field>
      <Field label="Ingredientes" error={errors.ingredients} hint="Uno por línea: cantidad + ingrediente, p. ej. 200 g de pollo">
        {(p) => <textarea {...p} rows={4} className={inputCls} value={draft.ingredients} onChange={(e) => set("ingredients", e.target.value)} />}
      </Field>
      <Field label="Pasos" hint="Uno por línea">
        {(p) => <textarea {...p} rows={4} className={inputCls} value={draft.instructions} onChange={(e) => set("instructions", e.target.value)} />}
      </Field>
      <Field label="Tiempo (min)" error={errors.prepTimeMinutes}>
        {(p) => <input {...p} inputMode="decimal" className={inputCls} value={draft.prepTimeMinutes} onChange={(e) => set("prepTimeMinutes", e.target.value)} />}
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Proteínas (g)" error={errors.protein}>
          {(p) => <input {...p} inputMode="decimal" className={inputCls} value={draft.protein} onChange={(e) => set("protein", e.target.value)} />}
        </Field>
        <Field label="Carbos (g)" error={errors.carbs}>
          {(p) => <input {...p} inputMode="decimal" className={inputCls} value={draft.carbs} onChange={(e) => set("carbs", e.target.value)} />}
        </Field>
        <Field label="Grasas (g)" error={errors.fat}>
          {(p) => <input {...p} inputMode="decimal" className={inputCls} value={draft.fat} onChange={(e) => set("fat", e.target.value)} />}
        </Field>
      </div>
      <Field label="Calorías (kcal)" error={errors.calories} hint="Por ración">
        {(p) => <input {...p} inputMode="decimal" className={inputCls} value={draft.calories} onChange={(e) => set("calories", e.target.value)} />}
      </Field>
      {kcalSuggestion !== null && (
        <button
          type="button"
          onClick={() => set("calories", String(kcalSuggestion))}
          className="self-start rounded-full border border-[var(--color-border)] px-3 py-1 text-sm text-[var(--color-accent)]"
        >
          Usar {kcalSuggestion} kcal
        </button>
      )}
      <Field label="Etiquetas" hint="Escribe una y pulsa Enter, o elige entre las ya usadas">
        {(p) => (
          <input
            {...p}
            className={inputCls}
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTypedTag();
              }
            }}
          />
        )}
      </Field>
      {tagOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagOptions.map((t) => {
            const on = draft.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                className={`rounded-full px-3 py-1 text-sm border ${
                  on
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={save}
        className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-4 py-2 text-sm font-semibold"
      >
        Guardar
      </button>
    </Sheet>
  );
}
