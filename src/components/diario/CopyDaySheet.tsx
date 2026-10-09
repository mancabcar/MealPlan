"use client";

// Hoja «Copiar día a…» del Diario (docs/pm/54-copiar-diario/tech.md › UI, R1, R3, R6, R7): elegir la fecha de destino
// y, si ya tiene entradas, un segundo paso que avisa antes de sumar. No escribe nada: `onCopy(to)` lo hace el Diario.
// Usa components/ui/Sheet. Cada paso es su propio Sheet (key) para que el lector de pantalla anuncie el título nuevo y
// el foco vuelva a entrar en el diálogo.
import { useId, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { singleClick } from "@/components/ui/singleClick";
import { canCopyTo, copyTargets, entryName, formatDayShort } from "@/lib/diary";
import { addDays } from "@/lib/week";
import type { MealEntry, Recipe } from "@/lib/types";
import { inputCls } from "@/components/ui/input";

const primaryBtn =
  "w-full bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-xl py-3 font-semibold text-sm disabled:opacity-40";
const secondaryBtn = "w-full border border-[var(--color-border)] rounded-xl py-3 text-sm font-semibold";

const entradas = (n: number) => (n === 1 ? "1 entrada" : `${n} entradas`);

export function CopyDaySheet({
  from,
  today,
  entries,
  recipes,
  onCopy,
  onClose,
}: {
  from: string;
  today: string;
  /** Todas las entradas: el origen y, para el aviso, las que ya tiene el destino. Se leen vivas en cada render. */
  entries: MealEntry[];
  recipes: Recipe[];
  onCopy: (to: string) => void;
  onClose: () => void;
}) {
  const dateId = useId();
  const [target, setTarget] = useState("");
  const [step, setStep] = useState<"pick" | "conflict">("pick");

  const origin = entries.filter((e) => e.date === from);
  // Una entrada de una copia de seguridad editada puede no tener kcal: suma 0 en vez de contagiar NaN al total
  const kcal = Math.round(origin.reduce((sum, e) => sum + (Number.isFinite(e.calories) ? e.calories : 0), 0));
  const existing = entries.filter((e) => e.date === target);
  const valid = canCopyTo(from, target);

  const copyLabel = !valid
    ? "Copiar"
    : target === today
      ? "Copiar a hoy"
      : target === addDays(today, 1)
        ? "Copiar a mañana"
        : `Copiar al ${formatDayShort(target)}`;

  if (step === "conflict") {
    return (
      <Sheet key="conflict" title={`El ${formatDayShort(target)} ya tiene ${entradas(existing.length)}`} onClose={onClose}>
        <p className="text-sm text-[var(--color-text-muted)]">
          {origin.length === 1 ? "Si sigues, se añade la entrada" : `Si sigues, se añaden las ${origin.length}`} del{" "}
          {formatDayShort(from)} {existing.length === 1 ? "a la que ya hay" : "a las que ya hay"}. No se borra nada.
        </p>
        <ul className="flex flex-col rounded-xl bg-[var(--color-surface-2)] px-3.5 py-1 text-sm divide-y divide-[var(--color-border)]">
          {existing.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>{entryName(e, recipes)}</span>
              <span className="shrink-0 text-[var(--color-text-muted)]">{`${e.mealType} · ${Math.round(e.calories)} kcal`}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={singleClick(() => onCopy(target))} className={primaryBtn}>
            {origin.length === 1 ? "Sumar la entrada" : `Sumar las ${origin.length} entradas`}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancelar
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet key="pick" title={`Copiar el ${formatDayShort(from)} a…`} onClose={onClose}>
      <p className="text-sm text-[var(--color-text-muted)]">{`${entradas(origin.length)} · ${kcal} kcal`}</p>
      <div className="flex gap-2">
        {copyTargets(from, today).map((t) => {
          const selected = target === t.date;
          return (
            <button
              key={t.date}
              type="button"
              aria-pressed={selected}
              onClick={() => setTarget(t.date)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-sm font-semibold ${
                selected
                  ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-surface))]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
              }`}
            >
              {t.label}{" "}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">{formatDayShort(t.date)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={dateId} className="text-sm text-[var(--color-text-muted)] shrink-0">
          Otra fecha
        </label>
        <input id={dateId} type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} max-w-48`} />
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={singleClick(() => (existing.length > 0 ? setStep("conflict") : onCopy(target)))}
          className={primaryBtn}
        >
          {copyLabel}
        </button>
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}
