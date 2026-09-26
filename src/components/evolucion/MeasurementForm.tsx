"use client";

// Formulario de una medición (historial-medidas R1–R5, R14, R16), dentro del Sheet de Evolución. Al añadir se elige
// «Solo peso» (pesada en casa) o «Informe completo» (las 22 métricas del informe); al editar, siempre el completo.
// Las etiquetas de los campos son su nombre accesible exacto: errores y avisos van fuera, con aria-describedby.
import { useId, useState } from "react";
import { parseDecimal } from "@/lib/nutrition";
import {
  draftFrom,
  emptyDraft,
  formatShortDate,
  formatValue,
  GROUP_LEGENDS,
  latestWeightMeasurement,
  METRICS,
  parseMeasurementDraft,
  previousValues,
  skinfoldSum,
  unusualValues,
  type MeasurementDraft,
  type MetricDef,
  type MetricGroup,
} from "@/lib/measurements";
import type { Measurement, MeasurementSource, MetricKey } from "@/lib/types";
import { ChoiceGroup, inputCls } from "@/components/perfil/ui";

export type FormKind = "weight" | "full";
export type MeasurementValue = Omit<Measurement, "id" | "savedAt">;

const KIND_OPTIONS = [
  { value: "weight" as const, label: "Solo peso" },
  { value: "full" as const, label: "Informe completo" },
];
const SOURCE_OPTIONS = [
  { value: "home" as const, label: "Casa" },
  { value: "nutritionist" as const, label: "Nutricionista" },
];
const GROUPS: MetricGroup[] = ["bia", "perimeters", "skinfolds"];
const WEIGHT = METRICS[0];

function MetricField({
  metric,
  value,
  error,
  warning,
  hint,
  onChange,
}: {
  metric: MetricDef;
  value: string;
  error?: string;
  warning?: string;
  hint?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const describedBy = [error && `${id}-error`, warning && `${id}-warning`, hint && `${id}-hint`].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {metric.fieldLabel}
      </label>
      <input
        id={id}
        className={`${inputCls} ${error ? "border-[var(--color-expired)]" : ""}`}
        inputMode="decimal"
        value={value}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
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
      {warning && (
        <span id={`${id}-warning`} className="text-xs text-[var(--color-expiring)]">
          {warning}
        </span>
      )}
    </div>
  );
}

export function MeasurementForm({
  editing,
  initialKind = "weight",
  measurements,
  today,
  onSave,
  onDelete,
}: {
  /** La medición que se edita; sin ella, es un alta. */
  editing?: Measurement;
  initialKind?: FormKind;
  measurements: Measurement[];
  today: string;
  onSave: (value: MeasurementValue) => void;
  onDelete?: () => void;
}) {
  const dateId = useId();
  const [kind, setKind] = useState<FormKind>(editing ? "full" : initialKind);
  const [draft, setDraft] = useState<MeasurementDraft>(() =>
    editing ? draftFrom(editing) : emptyDraft(today, initialKind === "full" ? "nutritionist" : "home"),
  );
  const [errors, setErrors] = useState<ReturnType<typeof parseMeasurementDraft>["errors"]>({});

  const setValue = (key: MetricKey, text: string) => {
    setDraft((d) => ({ ...d, values: { ...d.values, [key]: text } }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  // «Solo peso» es una pesada en casa; el informe, de la nutricionista (se puede cambiar)
  const changeKind = (k: FormKind) => {
    setKind(k);
    setDraft((d) => ({ ...d, source: k === "full" ? "nutritionist" : "home" }));
    setErrors({});
  };

  // Lo que ya es un número válido, para la suma de pliegues (R14) y los avisos (R16)
  const typed: Measurement["values"] = {};
  for (const m of METRICS) {
    const n = parseDecimal(draft.values[m.key] ?? "");
    if (!Number.isNaN(n) && n >= m.range[0] && n <= m.range[1]) typed[m.key] = n;
  }
  const warnings = unusualValues(typed, previousValues(measurements, draft.date, editing?.id));
  const skinSum = skinfoldSum(typed);

  const last = latestWeightMeasurement(measurements);
  const lastHint = last ? `Última: ${formatValue(last.values.weightKg!, "weightKg")} el ${formatShortDate(last.date)}` : undefined;

  const submit = () => {
    const toParse = kind === "weight" ? { ...draft, values: { weightKg: draft.values.weightKg } } : draft;
    const { value, errors } = parseMeasurementDraft(toParse, today);
    setErrors(errors);
    if (value) onSave(value);
  };

  const field = (m: MetricDef, hint?: string) => (
    <MetricField
      key={m.key}
      metric={m}
      value={draft.values[m.key] ?? ""}
      error={errors[m.key]}
      warning={warnings[m.key]}
      hint={hint}
      onChange={(v) => setValue(m.key, v)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {!editing && (
        <ChoiceGroup legend="Tipo de medición" name="measurement-kind" options={KIND_OPTIONS} value={kind} onChange={changeKind} />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={dateId} className="text-sm font-medium">
          Fecha
        </label>
        <input
          id={dateId}
          type="date"
          className={`${inputCls} ${errors.date ? "border-[var(--color-expired)]" : ""}`}
          value={draft.date}
          max={today}
          aria-invalid={!!errors.date}
          aria-describedby={errors.date ? `${dateId}-error` : undefined}
          onChange={(e) => {
            setDraft((d) => ({ ...d, date: e.target.value }));
            setErrors((er) => ({ ...er, date: undefined }));
          }}
        />
        {errors.date && (
          <span id={`${dateId}-error`} role="alert" className="text-xs text-[var(--color-expired)]">
            {errors.date}
          </span>
        )}
      </div>

      {kind === "weight" ? (
        field(WEIGHT, lastHint)
      ) : (
        <>
          <ChoiceGroup<MeasurementSource>
            legend="Origen"
            name="measurement-source"
            options={SOURCE_OPTIONS}
            value={draft.source}
            onChange={(source) => setDraft((d) => ({ ...d, source }))}
          />
          {GROUPS.map((g) => (
            <fieldset key={g} className="flex flex-col gap-3">
              <legend className="font-semibold mb-2">{GROUP_LEGENDS[g]}</legend>
              <div className="grid grid-cols-2 gap-3">{METRICS.filter((m) => m.group === g).map((m) => field(m))}</div>
              {g === "skinfolds" && (
                <p className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Suma de pliegues</span>
                  <output aria-label="Suma de pliegues" className="font-semibold">
                    {skinSum === undefined ? "—" : formatValue(skinSum, "skinSum")}
                  </output>
                </p>
              )}
            </fieldset>
          ))}
        </>
      )}

      <div className="sticky -bottom-8 -mx-5 -mb-8 px-5 pt-3 pb-8 flex flex-col gap-2 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
        {errors.form && (
          <p role="alert" className="text-sm text-[var(--color-expired)]">
            {errors.form}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-3 font-semibold"
        >
          Guardar
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="py-2 text-sm font-semibold text-[var(--color-expired)]">
            Eliminar medición
          </button>
        )}
      </div>
    </div>
  );
}
