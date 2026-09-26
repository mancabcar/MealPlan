"use client";

// Evolución (docs/pm/9-historial-medidas): historial de peso y medidas con gráfica. Toda la lógica está en
// lib/measurements; aquí se pinta y se orquesta el guardado (medición → peso del perfil → oferta o aviso, R9–R10).
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Ruler, Scale } from "lucide-react";
import { useApp } from "@/lib/store";
import { calculateTargets, type Targets } from "@/lib/nutrition";
import {
  filterByRange,
  formatDecimal,
  formatMeasurementDate,
  formatShortDate,
  formatSigned,
  formatValue,
  METRICS,
  metricSeries,
  profileWeightPatch,
  seriesUnit,
  SKIN_SUM_LABEL,
  weightChangeOnSave,
  weightTrend,
  type Range,
  type SeriesKey,
  type SeriesPoint,
} from "@/lib/measurements";
import { todayStr, type Measurement } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { RecalcOffer, recalcPatch } from "@/components/perfil/RecalcOffer";
import { LineChart, type ChartSeries } from "@/components/evolucion/LineChart";
import { MeasurementForm, type FormKind, type MeasurementValue } from "@/components/evolucion/MeasurementForm";

/** Una opción del selector de métrica (R13): las bilaterales son una sola, con dos líneas. */
interface MetricOption {
  label: string;
  keys: SeriesKey[];
}

const OPTIONS: MetricOption[] = [
  ...METRICS.reduce<MetricOption[]>((acc, m) => {
    const label = m.chart ?? m.label;
    const existing = acc.find((o) => o.label === label);
    if (existing) existing.keys.push(m.key);
    else acc.push({ label, keys: [m.key] });
    return acc;
  }, []),
  { label: SKIN_SUM_LABEL, keys: ["skinSum"] },
];

const RANGES: { value: Range; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "all", label: "Todo" },
];

const SIDE = ["izq.", "der."];

type SheetState = { kind: "add"; form: FormKind } | { kind: "edit"; m: Measurement } | null;

/** Grupo de radios nativos con aspecto de chip, con nombre accesible (radiogroup). */
function ChipRadios<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="relative inline-flex items-center px-3 py-1.5 rounded-full text-sm border select-none border-[var(--color-border)] text-[var(--color-text)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:text-[var(--color-accent)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-accent)_18%,var(--color-surface))] has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
        >
          {/* Radio nativo transparente sobre todo el chip: teclado y lector de pantalla como un radio normal */}
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function chartLabel(option: MetricOption, series: SeriesPoint[][]): string {
  const all = series.flat();
  const dates = all.map((p) => p.date).sort();
  const [first, last] = [dates[0], dates[dates.length - 1]];
  const span = first === last ? `del ${formatShortDate(first)}` : `del ${formatShortDate(first)} al ${formatShortDate(last)}`;
  const describe = (pts: SeriesPoint[], key: SeriesKey) =>
    pts.length === 1
      ? formatValue(pts[0].value, key)
      : `de ${formatDecimal(pts[0].value)} a ${formatValue(pts[pts.length - 1].value, key)}`;
  const parts = series
    .map((pts, i) => (pts.length === 0 ? "" : (series.length > 1 ? `${SIDE[i]} ` : "") + describe(pts, option.keys[i])))
    .filter(Boolean);
  return `${option.label} ${span}: ${parts.join(", ")}`;
}

export default function EvolutionPage() {
  const { profile, setProfile, measurements, saveMeasurement, removeMeasurement } = useApp();
  const today = todayStr();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [recalc, setRecalc] = useState<Targets | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hideNotice = useCallback(() => setNotice(null), []);

  if (!profile) return null;

  const options = OPTIONS.filter((o) => o.keys.some((k) => metricSeries(measurements, k).length > 0));
  const option = options.find((o) => o.label === selected) ?? options.find((o) => o.label === "Peso") ?? options[0];

  const save = (value: MeasurementValue) => {
    const saved: Measurement = {
      ...value,
      id: sheet?.kind === "edit" ? sheet.m.id : crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    };
    // R9: solo cambia el perfil si es la última con peso y el peso es otro; borrar nunca lo cambia
    const weight = weightChangeOnSave(measurements, saved, profile);
    saveMeasurement(saved);
    setSheet(null);
    if (weight === null) return;
    const updated = { ...profile, ...profileWeightPatch(profile, weight) };
    setProfile(updated);
    // R10: con objetivos calculados se ofrece recalcular; con los de la nutricionista, no cambian
    if (updated.targetSource === "calculated" && updated.body) {
      setRecalc(calculateTargets({ ...updated.body, goal: updated.goal }));
    } else if (updated.targetSource === "prescribed") {
      setNotice(`Peso guardado: ${formatValue(weight, "weightKg")}. Tus objetivos son los de tu nutricionista y no cambian.`);
    }
  };

  const remove = (m: Measurement) => {
    if (!confirm(`¿Eliminar la medición del ${formatMeasurementDate(m.date)}?`)) return;
    removeMeasurement(m.id);
    setSheet(null);
  };

  const addButton = (
    <button
      type="button"
      aria-label="Añadir medición"
      onClick={() => setSheet({ kind: "add", form: "weight" })}
      className="fixed bottom-24 right-4 z-30 flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] px-5 py-3 font-semibold shadow-lg shadow-black/40"
    >
      <Plus className="w-5 h-5" aria-hidden />
      Añadir
    </button>
  );

  let content;
  if (!option) {
    // R11: sin mediciones (el peso del perfil no se convierte en medición)
    content = (
      <Card className="flex flex-col items-center gap-3 text-center py-10">
        <Scale className="w-8 h-8 text-[var(--color-text-muted)]" aria-hidden />
        <p className="font-semibold">Aún no hay mediciones</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Apunta tu peso cuando te peses en casa, o copia el informe de tu nutricionista para ver cómo evolucionas.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <button
            type="button"
            onClick={() => setSheet({ kind: "add", form: "weight" })}
            className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-3 font-semibold"
          >
            Apuntar peso
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: "add", form: "full" })}
            className="rounded-lg py-3 border border-[var(--color-border)] font-semibold text-[var(--color-text)] flex items-center justify-center gap-1.5"
          >
            <Ruler className="w-4 h-4" aria-hidden />
            Añadir informe completo
          </button>
        </div>
      </Card>
    );
  } else {
    const isWeight = option.label === "Peso";
    const allSeries = option.keys.map((k) => metricSeries(measurements, k));
    const series = allSeries.map((pts) => filterByRange(pts, range, today));
    const trend = isWeight ? filterByRange(weightTrend(measurements), range, today) : undefined;
    const unitKey = option.keys[0];

    // Resumen: último valor y, para el peso, la tendencia (R8); para el resto, el cambio desde la primera (R13)
    const latest = allSeries.map((pts) => pts.at(-1));
    const first = allSeries.map((pts) => pts[0]);
    const lastTrend = isWeight ? weightTrend(measurements).at(-1) : undefined;

    const chartSeries: ChartSeries[] = series.map((points, i) => ({
      points,
      color: i === 0 ? "--color-accent" : "--color-protein",
      connect: !isWeight,
      dashed: i === 1,
    }));

    // Historial (R7): las que tienen la métrica, de la más reciente a la más antigua, con la diferencia (R13)
    const rows = measurements
      .filter((m) => allSeries.some((pts) => pts.some((p) => p.id === m.id)))
      .sort((a, b) => (a.date === b.date ? b.savedAt.localeCompare(a.savedAt) : b.date.localeCompare(a.date)));

    content = (
      <>
        <ChipRadios
          label="Métrica"
          name="metric"
          options={options.map((o) => ({ value: o.label, label: o.label }))}
          value={option.label}
          onChange={setSelected}
        />

        <Card className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">{option.label}</p>
              <p className="font-display text-3xl font-bold">
                {latest
                  .map((p, i) => (p ? (latest.length > 1 ? `${SIDE[i]} ` : "") + formatValue(p.value, option.keys[i]) : ""))
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="text-right text-sm text-[var(--color-text-muted)]">
              {lastTrend ? (
                <p>{`Tendencia ${formatDecimal(lastTrend.value, 1)} kg`}</p>
              ) : (
                latest.length === 1 &&
                first[0] &&
                latest[0] &&
                first[0].id !== latest[0].id && (
                  <p>{`${formatSigned(latest[0].value - first[0].value)} ${seriesUnit(unitKey)} desde el ${formatShortDate(first[0].date)}`}</p>
                )
              )}
            </div>
          </div>

          <ChipRadios label="Periodo" name="range" options={RANGES} value={range} onChange={setRange} />

          {series.some((pts) => pts.length > 0) ? (
            <LineChart label={chartLabel(option, series)} series={chartSeries} trend={trend} />
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">No hay mediciones en este periodo</p>
          )}

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]" aria-label="Leyenda">
            {isWeight ? (
              <>
                <li className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)]" aria-hidden /> Casa
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--color-accent)]" aria-hidden /> Nutricionista
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-[var(--color-accent)]" aria-hidden /> Tendencia (7 días)
                </li>
              </>
            ) : option.keys.length > 1 ? (
              <>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-[var(--color-accent)]" aria-hidden /> Izquierda
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-[var(--color-protein)]" aria-hidden /> Derecha
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" aria-hidden /> Casa
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--color-accent)]" aria-hidden /> Nutricionista
                </li>
              </>
            )}
          </ul>
        </Card>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Historial</h2>
          <ul aria-label="Historial" className="flex flex-col gap-2">
            {rows.map((m) => {
              const values = option.keys.map((k, i) => {
                const pts = allSeries[i];
                const idx = pts.findIndex((p) => p.id === m.id);
                if (idx < 0) return null;
                const prev = pts[idx - 1];
                return {
                  text: (option.keys.length > 1 ? `${SIDE[i]} ` : "") + formatValue(pts[idx].value, k),
                  diff: prev ? `${formatSigned(pts[idx].value - prev.value)} ${seriesUnit(k)}`.trim() : undefined,
                };
              });
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: "edit", m })}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-sm">{formatMeasurementDate(m.date)}</span>
                      {m.source === "nutritionist" && (
                        <Chip tone="protein" className="self-start">
                          Nutricionista
                        </Chip>
                      )}
                    </span>
                    <span className="flex flex-col items-end">
                      {values.map(
                        (v, i) =>
                          v && (
                            <span key={i} className="flex flex-col items-end">
                              <span className="font-semibold">{v.text}</span>
                              {v.diff && <span className="text-xs text-[var(--color-text-muted)]">{v.diff}</span>}
                            </span>
                          ),
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      <div className="flex flex-col gap-1">
        <Link
          href="/perfil"
          aria-label="Volver a Perfil"
          className="text-sm text-[var(--color-text-muted)] flex items-center gap-1 self-start"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Perfil
        </Link>
        <h1 className="font-display text-2xl font-bold">Evolución</h1>
      </div>

      {recalc && (
        <RecalcOffer
          targets={recalc}
          profile={profile}
          onApply={() => {
            setProfile({ ...profile, ...recalcPatch(recalc) });
            setRecalc(null);
          }}
          onKeep={() => setRecalc(null)}
        />
      )}

      {content}
      {addButton}

      {sheet && (
        <Sheet title={sheet.kind === "edit" ? "Editar medición" : "Añadir medición"} onClose={() => setSheet(null)}>
          <MeasurementForm
            key={sheet.kind === "edit" ? sheet.m.id : sheet.form}
            editing={sheet.kind === "edit" ? sheet.m : undefined}
            initialKind={sheet.kind === "add" ? sheet.form : undefined}
            measurements={measurements}
            today={today}
            onSave={save}
            onDelete={sheet.kind === "edit" ? () => remove(sheet.m) : undefined}
          />
        </Sheet>
      )}

      {notice && <Toast onDismiss={hideNotice}>{notice}</Toast>}
    </div>
  );
}
