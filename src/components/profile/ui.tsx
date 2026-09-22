"use client";

// Piezas básicas del perfil: chips accesibles (radio/checkbox nativos), campos y chip input.
import { useState, type ReactNode } from "react";
import { normalize } from "@/lib/allergens";

export const inputCls =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2";

export const primaryBtn = "bg-emerald-600 text-white rounded-lg py-3 font-semibold disabled:opacity-40";
export const secondaryBtn = "rounded-lg py-3 border border-zinc-300 dark:border-zinc-700 font-semibold";

const chipCls = (tone: "emerald" | "rose") =>
  `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border cursor-pointer select-none
   border-zinc-300 dark:border-zinc-700
   ${
     tone === "rose"
       ? "has-[:checked]:bg-rose-50 has-[:checked]:border-rose-500 has-[:checked]:text-rose-700 dark:has-[:checked]:bg-rose-950 dark:has-[:checked]:text-rose-300"
       : "has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-600 has-[:checked]:text-emerald-800 dark:has-[:checked]:bg-emerald-950 dark:has-[:checked]:text-emerald-300"
   }`;

export interface Option<T extends string> {
  value: T;
  label: string;
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
        {note && <span className="ml-2 font-normal text-xs text-zinc-500">{note}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={chipCls("emerald")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              aria-describedby={o.hint ? `${name}-${o.value}-hint` : undefined}
              className="accent-emerald-600"
            />
            {o.label}
            {o.hint && (
              <span id={`${name}-${o.value}-hint`} className="text-xs text-zinc-500">
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
  tone = "emerald",
}: {
  legend: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  tone?: "emerald" | "rose";
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
              className={tone === "rose" ? "accent-rose-600" : "accent-emerald-600"}
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
          className={`${inputCls} ${error ? "border-rose-500" : ""}`}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix}
      </div>
      {error && <span className="text-xs font-normal text-rose-600">{error}</span>}
    </label>
  );
}

/** Añade con Enter; ignora duplicados sin distinguir mayúsculas ni acentos. */
export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  tone = "emerald",
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  tone?: "emerald" | "rose";
}) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v && !values.some((x) => normalize(x) === normalize(v))) onChange([...values, v]);
    setText("");
  };
  const chip =
    tone === "rose"
      ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
      : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200";
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
            <span key={v} className={`inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border ${chip}`}>
              {v}
              <button
                type="button"
                aria-label={`Quitar ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="px-1.5 rounded-full hover:bg-black/10"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
