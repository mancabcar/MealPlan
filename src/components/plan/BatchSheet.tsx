"use client";

// Hojas del Plan para las tandas de batch cooking (docs/pm/17-sobras-batch-cooking/tech.md › UI):
// BatchSheet crea o edita la tanda desde la cocinada, LeftoverSheet quita una sobra y BatchWarningSheet pregunta qué
// hacer con las sobras al borrar o cambiar la receta de la cocinada (R4, R9). Todas usan components/ui/Sheet.
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/input";
import {
  MAX_COOKED_SERVINGS,
  MIN_COOKED_SERVINGS,
  batchOf,
  createBatch,
  editBatch,
  eligibleLeftoverSlots,
  removeLeftover,
  type SlotRef,
} from "@/lib/plan/batch";
import type { MealType, WeekPlan } from "@/lib/types";
import { DAY_NAMES, weekDates } from "@/lib/week";

/** "Martes" para una fecha YYYY-MM-DD. */
export const dayName = (date: string) => DAY_NAMES[(new Date(date + "T00:00:00").getDay() + 6) % 7];

const key = (r: SlotRef) => `${r.date}|${r.mealType}`;
const primaryBtn = "flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm";
const secondaryBtn = "flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm";
const stepBtn =
  "shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-40";

const servingsError = `De ${MIN_COOKED_SERVINGS} a ${MAX_COOKED_SERVINGS} raciones, enteras`;

/** Texto → N entero de 2 a 8, o null. Acepta solo dígitos ("2,5", "9" y vacío no valen). */
function parseCooked(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= MIN_COOKED_SERVINGS && n <= MAX_COOKED_SERVINGS ? n : null;
}

export function BatchSheet({
  plan,
  origin,
  recipeName,
  meals,
  onSave,
  onClose,
}: {
  plan: WeekPlan;
  origin: SlotRef;
  recipeName: string;
  meals: MealType[];
  onSave: (plan: WeekPlan) => void;
  onClose: () => void;
}) {
  const originSlot = (plan[origin.date] ?? []).find((s) => s.mealType === origin.mealType);
  const existing = originSlot?.batchId ? batchOf(plan, originSlot.batchId) : null;
  const inBatch = new Set(existing?.leftovers.map(key));

  const [servingsText, setServingsText] = useState(String(existing?.origin.slot.cookedServings ?? MIN_COOKED_SERVINGS));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(inBatch));
  const [error, setError] = useState<string | null>(null);

  const week = weekDates(origin.date);
  // Las sobras de esta tanda cuentan como libres: se pueden desmarcar
  const slots = eligibleLeftoverSlots(plan, origin, meals).map((s) => ({ ...s, free: s.free || inBatch.has(key(s)) }));
  const anyFree = slots.some((s) => s.free);

  const step = (delta: number) => {
    const n = parseCooked(servingsText) ?? MIN_COOKED_SERVINGS;
    setServingsText(String(Math.min(MAX_COOKED_SERVINGS, Math.max(MIN_COOKED_SERVINGS, n + delta))));
    setError(null);
  };

  const toggle = (k: string, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(k);
    else next.delete(k);
    setPicked(next);
    setError(null);
  };

  const submit = () => {
    const n = parseCooked(servingsText);
    if (n === null) return setError(servingsError);
    // Las sobras de comidas que el perfil ya no tiene activas no salen como casilla: se conservan tal cual
    const hidden = (existing?.leftovers ?? []).filter((l) => !slots.some((s) => key(s) === key(l)));
    const targets = [...slots.filter((s) => picked.has(key(s))), ...hidden];
    if (targets.length > n - 1) return setError(`Con ${targets.length === 1 ? "1 sobra" : `${targets.length} sobras`}, cocina al menos ${targets.length + 1} raciones`);
    try {
      const refs = targets.map(({ date, mealType }) => ({ date, mealType }));
      onSave(existing ? editBatch(plan, existing.origin.slot.batchId!, n, refs) : createBatch(plan, origin, n, refs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la tanda");
    }
  };

  const servingsId = "batch-servings";
  return (
    <Sheet title="Cocinar varias raciones" onClose={onClose}>
      <p className="text-sm text-[var(--color-text-muted)]">
        {recipeName} · {origin.mealType} del {dayName(origin.date)}. Cocina una vez y come el resto en otras franjas: la lista de la
        compra cuenta la receta una sola vez.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={servingsId} className="font-medium text-sm">
          Raciones cocinadas
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={stepBtn}
            aria-label="Una ración menos"
            disabled={(parseCooked(servingsText) ?? MIN_COOKED_SERVINGS) <= MIN_COOKED_SERVINGS}
            onClick={() => step(-1)}
          >
            <Minus className="w-4 h-4" aria-hidden />
          </button>
          <input
            id={servingsId}
            type="text"
            inputMode="numeric"
            value={servingsText}
            onChange={(e) => {
              setServingsText(e.target.value);
              setError(null);
            }}
            aria-invalid={error !== null}
            className={`${inputCls} min-w-0 text-center`}
          />
          <button
            type="button"
            className={stepBtn}
            aria-label="Una ración más"
            disabled={(parseCooked(servingsText) ?? MIN_COOKED_SERVINGS) >= MAX_COOKED_SERVINGS}
            onClick={() => step(1)}
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium text-sm mb-1">Dónde comes las sobras (1 ración cada una)</legend>
        {anyFree ? (
          slots.map((s) => {
            const label = `${DAY_NAMES[week.indexOf(s.date)]} · ${s.mealType}`;
            return (
              <label
                key={key(s)}
                className={`flex items-center gap-2 text-sm py-1 ${s.free ? "" : "text-[var(--color-text-muted)]"}`}
              >
                <input
                  type="checkbox"
                  checked={picked.has(key(s))}
                  disabled={!s.free}
                  onChange={(e) => toggle(key(s), e.target.checked)}
                />
                {label}
              </label>
            );
          })
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">No quedan franjas libres esta semana</p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-expired)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancelar
        </button>
        <button type="button" onClick={submit} className={primaryBtn}>
          Guardar
        </button>
      </div>
    </Sheet>
  );
}

/** Tocar una sobra: de dónde viene y "Quitar esta sobra" (R5). No hay select de receta. */
export function LeftoverSheet({
  plan,
  at,
  recipeName,
  onSave,
  onClose,
}: {
  plan: WeekPlan;
  at: SlotRef;
  recipeName: string;
  onSave: (plan: WeekPlan) => void;
  onClose: () => void;
}) {
  const slot = (plan[at.date] ?? []).find((s) => s.mealType === at.mealType);
  const batch = slot?.batchId ? batchOf(plan, slot.batchId) : null;
  return (
    <Sheet title={`Sobras de ${recipeName}`} onClose={onClose}>
      {batch && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Cocinadas el {dayName(batch.origin.date)} ({batch.origin.mealType}) para {batch.origin.slot.cookedServings} raciones. Esta
          franja es 1 ración y no suma ingredientes a la lista de la compra.
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cerrar
        </button>
        <button type="button" onClick={() => onSave(removeLeftover(plan, at))} className={primaryBtn}>
          Quitar esta sobra
        </button>
      </div>
    </Sheet>
  );
}

/** Borrar o cambiar la receta de una cocinada con sobras: qué hacer con ellas (R4, R9). `null` = cancelar. */
export function BatchWarningSheet({
  recipeName,
  leftovers,
  onChoose,
}: {
  recipeName: string;
  leftovers: number;
  onChoose: (mode: "all" | "keep" | null) => void;
}) {
  return (
    <Sheet title="Esta receta tiene sobras" onClose={() => onChoose(null)}>
      <p className="text-sm text-[var(--color-text-muted)]">
        {leftovers === 1 ? "Hay 1 sobra" : `Hay ${leftovers} sobras`} de {recipeName} enlazadas a esta comida. ¿Qué hacemos con
        {leftovers === 1 ? " ella" : " ellas"}?
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => onChoose("all")} className={primaryBtn}>
          Borrar todo
        </button>
        <button type="button" onClick={() => onChoose("keep")} className={secondaryBtn}>
          Dejarlas como comidas normales
        </button>
        <button type="button" onClick={() => onChoose(null)} className={secondaryBtn}>
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}
