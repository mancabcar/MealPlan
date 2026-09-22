"use client";

// Rediseño visual (docs/pm/design-refresh): fork de src/components/profile/ui.tsx, re-tokenizado
// para las pantallas rediseñadas. Manuel decidió forkear en vez de re-tokenizar el original in situ
// para que Onboarding.tsx (el otro consumidor de profile/ui.tsx) quedara completamente intacto — ver
// tech.md § Spec feedback / Risks. Hermano: src/components/perfil/steps.tsx. Lógica de negocio
// (@/lib/profileDraft, @/lib/nutrition, @/lib/allergens) no se duplica, solo esta capa de presentación.
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { normalize } from "@/lib/allergens";

export const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)]";

export const primaryBtn =
  "bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-3 font-semibold disabled:opacity-40";
export const secondaryBtn = "rounded-lg py-3 border border-[var(--color-border)] font-semibold text-[var(--color-text)]";

const chipCls = (tone: "accent" | "expired") =>
  `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border cursor-pointer select-none
   border-[var(--color-border)] text-[var(--color-text)]
   ${
     tone === "expired"
       ? "has-[:checked]:bg-[color-mix(in_oklab,var(--color-expired)_18%,var(--color-surface))] has-[:checked]:border-[var(--color-expired)] has-[:checked]:text-[var(--color-expired)]"
       : "has-[:checked]:bg-[color-mix(in_oklab,var(--color-accent)_18%,var(--color-surface))] has-[:checked]:border-[var(--color-accent)] has-[:checked]:text-[var(--color-accent)]"
   }`;

export interface Option<T extends string> {
  value: T;
  /** ReactNode (no solo string) para permitir un icono junto al texto — ver MEAL_OPTIONS en steps.tsx. */
  label: ReactNode;
  /** Texto de apoyo: va fuera del nombre accesible (aria-describedby). */
  hint?: string;
}

/** Elección única: radios nativos con aspecto de chip. */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  note,
}: {
  legend: string;
  name: string;
  options: Option<T>[];
  value: T | "";
  onChange: (v: T) => void;
  note?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium mb-1">
        {legend}
        {note && <span className="ml-2 font-normal text-xs text-[var(--color-text-muted)]">{note}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={chipCls("accent")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              aria-describedby={o.hint ? `${name}-${o.value}-hint` : undefined}
              className="accent-[var(--color-accent)]"
            />
            {o.label}
            {o.hint && (
              <span id={`${name}-${o.value}-hint`} className="text-xs text-[var(--color-text-muted)]">
                {o.hint}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Elección múltiple: checkboxes nativos con aspecto de chip. */
export function MultiChoice<T extends string>({
  legend,
  options,
  value,
  onChange,
  tone = "accent",
}: {
  legend: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  tone?: "accent" | "expired";
}) {
  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={chipCls(tone)}>
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={() => toggle(o.value)}
              className={tone === "expired" ? "accent-[var(--color-expired)]" : "accent-[var(--color-accent)]"}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Field({
  label,
  value,
  onChange,
  error,
  inputMode = "numeric",
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputMode?: "numeric" | "decimal" | "text";
  placeholder?: string;
  suffix?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <div className="flex items-center gap-2">
        <input
          className={`${inputCls} ${error ? "border-[var(--color-expired)]" : ""}`}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix}
      </div>
      {error && <span className="text-xs font-normal text-[var(--color-expired)]">{error}</span>}
    </label>
  );
}

/** Añade con Enter; ignora duplicados sin distinguir mayúsculas ni acentos. */
export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  tone = "accent",
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  tone?: "accent" | "expired";
}) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v && !values.some((x) => normalize(x) === normalize(v))) onChange([...values, v]);
    setText("");
  };
  const chip =
    tone === "expired"
      ? "text-[var(--color-expired)] border-[var(--color-expired)]"
      : "text-[var(--color-text)] border-[var(--color-border)]";
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        <input
          className={inputCls}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      </label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className={`inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border bg-[var(--color-surface)] ${chip}`}
            >
              {v}
              <button
                type="button"
                aria-label={`Quitar ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="px-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
