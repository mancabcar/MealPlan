// Historial de peso y medidas (docs/pm/9-historial-medidas). Lógica pura: sin localStorage ni reloj; "hoy" se pasa
// como argumento. Las fechas son cadenas YYYY-MM-DD y la aritmética va en días enteros (UTC), sin Date locales, para
// no depender de la zona horaria ni del cambio de hora.
import { parseDecimal, type FieldErrors } from "./nutrition";
import type { Measurement, MeasurementSource, MetricKey, UserProfile } from "./types";

export type MetricGroup = "bia" | "perimeters" | "skinfolds";

export interface MetricDef {
  key: MetricKey;
  /** Nombre corto (selector, gráfica): «Cintura», «Bíceps izq.» */
  label: string;
  /** Nombre accesible del campo del formulario (tech.md › UI test contract). */
  fieldLabel: string;
  unit: string;
  group: MetricGroup;
  /** Rango válido, límites incluidos (spec › Edge cases). */
  range: readonly [number, number];
  /** Bilaterales: nombre de la gráfica que comparten izq. y der. */
  chart?: string;
  side?: "L" | "R";
}

const bia = (key: MetricKey, label: string, fieldLabel: string, unit: string, range: readonly [number, number]): MetricDef => ({
  key, label, fieldLabel, unit, group: "bia", range,
});
const perimeter = (key: MetricKey, label: string, pair?: { chart: string; side: "L" | "R" }): MetricDef => ({
  key, label, fieldLabel: `${label} (cm)`, unit: "cm", group: "perimeters", range: [5, 250], ...pair,
});
const skinfold = (key: MetricKey, name: string): MetricDef => ({
  key, label: `Pliegue ${name}`, fieldLabel: `Pliegue ${name} (mm)`, unit: "mm", group: "skinfolds", range: [1, 80],
});

/** Las 22 métricas del informe de la nutricionista, en su orden (R3). */
export const METRICS: MetricDef[] = [
  bia("weightKg", "Peso", "Peso (kg)", "kg", [30, 250]),
  bia("muscleKg", "Masa muscular", "Masa muscular (kg)", "kg", [1, 150]),
  bia("fatKg", "Grasa corporal", "Grasa corporal (kg)", "kg", [1, 150]),
  bia("fatPct", "% grasa", "% grasa", "%", [1, 75]),
  bia("bmi", "IMC", "IMC", "", [10, 70]),
  bia("visceralFat", "Grasa visceral", "Grasa visceral", "", [1, 59]),
  perimeter("bicepsL", "Bíceps izq.", { chart: "Bíceps", side: "L" }),
  perimeter("bicepsR", "Bíceps der.", { chart: "Bíceps", side: "R" }),
  perimeter("waist", "Cintura"),
  perimeter("hip", "Cadera"),
  perimeter("legL", "Pierna izq.", { chart: "Pierna", side: "L" }),
  perimeter("legR", "Pierna der.", { chart: "Pierna", side: "R" }),
  perimeter("calfL", "Gemelo izq.", { chart: "Gemelo", side: "L" }),
  perimeter("calfR", "Gemelo der.", { chart: "Gemelo", side: "R" }),
  perimeter("chestBack", "Pecho-espalda"),
  perimeter("glutes", "Glúteos"),
  skinfold("skinBiceps", "bicipital"),
  skinfold("skinTriceps", "tricipital"),
  skinfold("skinAbdominal", "abdominal"),
  skinfold("skinSuprailiac", "suprailíaco"),
  skinfold("skinQuadriceps", "cuadricipital"),
  skinfold("skinCalf", "gemelo"),
];

export const METRIC_KEYS: MetricKey[] = METRICS.map((m) => m.key);
const BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;
export const metricDef = (key: MetricKey): MetricDef => BY_KEY[key];

export const GROUP_LEGENDS: Record<MetricGroup, string> = {
  bia: "Bioimpedancia",
  perimeters: "Perímetros",
  skinfolds: "Pliegues cutáneos",
};

const SKINFOLD_KEYS = METRICS.filter((m) => m.group === "skinfolds").map((m) => m.key);

/** Métrica de la gráfica: una clave del catálogo o la suma de pliegues derivada (R14). */
export type SeriesKey = MetricKey | "skinSum";
export const SKIN_SUM_LABEL = "Suma de pliegues";

const withUnit = (text: string, unit: string) => (unit ? `${text} ${unit}` : text);

/** «Entre 30 y 250 kg»: el error de un valor no numérico o fuera de rango (R4). */
export function rangeError(key: MetricKey): string {
  const { range, unit } = BY_KEY[key];
  return withUnit(`Entre ${range[0]} y ${range[1]}`, unit);
}

// ---------------------------------------------------------------- Formato

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 74.8 → «74,8»; 76 → «76»; como mucho `maxDecimals` decimales, sin restos de coma flotante. */
export function formatDecimal(n: number, maxDecimals = 2): string {
  return String(Number(n.toFixed(maxDecimals))).replace(".", ",");
}

/** «−8,5» con el signo menos U+2212, «+1,2», «0». */
export function formatSigned(n: number, maxDecimals = 1): string {
  const text = formatDecimal(Math.abs(n), maxDecimals);
  if (text === "0") return "0";
  return `${n < 0 ? "−" : "+"}${text}`;
}

/** Valor con su unidad: «75 kg», «84,5 cm», «29,3». */
export function formatValue(value: number, key: SeriesKey): string {
  return withUnit(formatDecimal(value), key === "skinSum" ? "mm" : BY_KEY[key].unit);
}

export const seriesUnit = (key: SeriesKey) => (key === "skinSum" ? "mm" : BY_KEY[key].unit);

/** «2026-09-22» → «22 sep». */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** «2026-09-22» → «22 sep 2026» (historial). */
export function formatMeasurementDate(date: string): string {
  return `${formatShortDate(date)} ${date.slice(0, 4)}`;
}

// ---------------------------------------------------------------- Fechas

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Día absoluto (días desde 1970-01-01), o NaN si no es una fecha real. */
function dayNumber(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return NaN;
  return t / 86400000;
}

// ---------------------------------------------------------------- Formulario (R1–R5)

export interface MeasurementDraft {
  date: string;
  source: MeasurementSource;
  /** Texto de cada campo, tal como lo escribe el usuario. */
  values: Partial<Record<MetricKey, string>>;
}

export const DATE_FUTURE_ERROR = "La fecha no puede ser futura";
export const DATE_REQUIRED_ERROR = "Elige una fecha";
export const EMPTY_MEASUREMENT_ERROR = "Añade al menos un valor";

export function emptyDraft(today: string, source: MeasurementSource = "home"): MeasurementDraft {
  return { date: today, source, values: {} };
}

/** Para editar: cada número con coma y sin ceros de más (76 → «76», 36.4 → «36,4»). */
export function draftFrom(m: Measurement): MeasurementDraft {
  const values: MeasurementDraft["values"] = {};
  for (const [k, v] of Object.entries(m.values) as [MetricKey, number][]) values[k] = formatDecimal(v, 6);
  return { date: m.date, source: m.source, values };
}

/** Valida el borrador. Sin errores, `value` es la medición (sin id ni savedAt) con los números tal cual. */
export function parseMeasurementDraft(
  draft: MeasurementDraft,
  today: string,
): { value?: Omit<Measurement, "id" | "savedAt">; errors: FieldErrors<MetricKey | "date" | "form"> } {
  const errors: FieldErrors<MetricKey | "date" | "form"> = {};
  const day = dayNumber(draft.date);
  if (Number.isNaN(day)) errors.date = DATE_REQUIRED_ERROR;
  else if (day > dayNumber(today)) errors.date = DATE_FUTURE_ERROR;

  const values: Measurement["values"] = {};
  for (const key of METRIC_KEYS) {
    const text = draft.values[key]?.trim();
    if (!text) continue;
    const n = parseDecimal(text);
    const [min, max] = BY_KEY[key].range;
    if (Number.isNaN(n) || n < min || n > max) errors[key] = rangeError(key);
    else values[key] = n;
  }
  const hasFieldErrors = METRIC_KEYS.some((k) => errors[k]);
  if (!hasFieldErrors && Object.keys(values).length === 0) errors.form = EMPTY_MEASUREMENT_ERROR;

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { date: draft.date, source: draft.source, values }, errors };
}

// ---------------------------------------------------------------- Carga (R6)

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KNOWN = new Set<string>(METRIC_KEYS);

/** `upgrade` de la carga: descarta lo mal formado y las métricas desconocidas. Idempotente. */
export function sanitizeMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return [];
  const out: Measurement[] = [];
  for (const m of raw) {
    if (!isObject(m) || typeof m.id !== "string" || typeof m.date !== "string" || !DATE_RE.test(m.date)) continue;
    if ((m.source !== "home" && m.source !== "nutritionist") || typeof m.savedAt !== "string" || !isObject(m.values)) continue;
    const values: Measurement["values"] = {};
    for (const [k, v] of Object.entries(m.values)) {
      if (KNOWN.has(k) && typeof v === "number" && Number.isFinite(v)) values[k as MetricKey] = v;
    }
    if (Object.keys(values).length === 0) continue;
    out.push({ id: m.id, date: m.date, source: m.source, values, savedAt: m.savedAt });
  }
  return out;
}

// ---------------------------------------------------------------- Orden y peso del perfil (R9, R10)

/** Más antigua primero; el mismo día, por orden de guardado. */
export const byDate = (a: Measurement, b: Measurement) =>
  a.date === b.date ? a.savedAt.localeCompare(b.savedAt) : a.date.localeCompare(b.date);

/** La medición con peso de fecha más reciente; el mismo día, la última guardada. */
export function latestWeightMeasurement(ms: Measurement[]): Measurement | undefined {
  return ms.filter((m) => m.values.weightKg !== undefined).sort(byDate).at(-1);
}

export const profileWeight = (p: UserProfile): number | undefined => p.body?.weightKg ?? p.weightKg;

/** Escribe el peso donde lo lee cada tipo de perfil, igual que «Datos corporales». */
export function profileWeightPatch(profile: UserProfile, weightKg: number): Partial<UserProfile> {
  if (!profile.body) return { weightKg };
  const body = { ...profile.body, weightKg };
  return profile.targetSource === "prescribed" ? { body, weightKg } : { body };
}

/**
 * El peso nuevo del perfil si `saved` (nueva o editada) pasa a ser la última con peso y su peso difiere del actual;
 * si no, null. Borrar no se evalúa aquí: nunca cambia el perfil (spec › Edge cases).
 */
export function weightChangeOnSave(before: Measurement[], saved: Measurement, profile: UserProfile): number | null {
  const after = [...before.filter((m) => m.id !== saved.id), saved];
  const weight = saved.values.weightKg;
  if (weight === undefined || latestWeightMeasurement(after)?.id !== saved.id) return null;
  return weight === profileWeight(profile) ? null : weight;
}

// ---------------------------------------------------------------- Series (R8, R12–R15)

export interface TrendPoint {
  date: string;
  value: number;
}

/** R8: para cada fecha con peso, la media de los pesos de los 7 días anteriores, ese día incluido. */
export function weightTrend(ms: Measurement[]): TrendPoint[] {
  const weights = ms
    .filter((m) => m.values.weightKg !== undefined)
    .map((m) => ({ date: m.date, day: dayNumber(m.date), kg: m.values.weightKg! }));
  const dates = [...new Set(weights.map((w) => w.date))].sort();
  return dates.map((date) => {
    const day = dayNumber(date);
    const window = weights.filter((w) => w.day <= day && w.day >= day - 6);
    return { date, value: window.reduce((s, w) => s + w.kg, 0) / window.length };
  });
}

/**
 * R12: tendencia de la última pesada menos la de la pesada más cercana a hace 30 días (entre 35 y 25 días atrás).
 * Sin pesadas en esa ventana, undefined.
 */
export function weightTrendChange(ms: Measurement[], today: string): number | undefined {
  const trend = weightTrend(ms);
  const target = dayNumber(today) - 30;
  const candidates = trend.filter((p) => Math.abs(dayNumber(p.date) - target) <= 5);
  if (candidates.length === 0) return undefined;
  const base = candidates.reduce((best, p) =>
    Math.abs(dayNumber(p.date) - target) < Math.abs(dayNumber(best.date) - target) ? p : best,
  );
  return trend[trend.length - 1].value - base.value;
}

/** R14: suma de los seis pliegues, a una décima; undefined si falta alguno. */
export function skinfoldSum(values: Measurement["values"]): number | undefined {
  if (SKINFOLD_KEYS.some((k) => values[k] === undefined)) return undefined;
  return Math.round(SKINFOLD_KEYS.reduce((s, k) => s + values[k]!, 0) * 10) / 10;
}

export interface SeriesPoint {
  id: string;
  date: string;
  value: number;
  source: MeasurementSource;
}

const seriesValue = (m: Measurement, key: SeriesKey) => (key === "skinSum" ? skinfoldSum(m.values) : m.values[key]);

/** R13: los valores de una métrica, de la medición más antigua a la más reciente. */
export function metricSeries(ms: Measurement[], key: SeriesKey): SeriesPoint[] {
  return [...ms].sort(byDate).flatMap((m) => {
    const value = seriesValue(m, key);
    return value === undefined ? [] : [{ id: m.id, date: m.date, value, source: m.source }];
  });
}

export type Range = "1M" | "3M" | "6M" | "all";
const RANGE_DAYS: Record<Exclude<Range, "all">, number> = { "1M": 30, "3M": 90, "6M": 180 };

/** R15: los puntos de los últimos 30, 90 o 180 días (desde hoy − n, hoy incluido), o todos. */
export function filterByRange<T extends { date: string }>(points: T[], range: Range, today: string): T[] {
  if (range === "all") return points;
  const from = dayNumber(today) - RANGE_DAYS[range];
  return points.filter((p) => dayNumber(p.date) >= from);
}

/** Valores de la medición anterior a `date` para cada métrica (para R16), sin contar la que se edita. */
export function previousValues(ms: Measurement[], date: string, excludeId?: string): Measurement["values"] {
  const prev: Measurement["values"] = {};
  for (const m of [...ms].sort(byDate)) {
    if (m.id === excludeId || m.date > date) continue;
    Object.assign(prev, m.values);
  }
  return prev;
}

// ---------------------------------------------------------------- Avisos (R16, Could)

const UNUSUAL = 0.3;
const differs = (a: number, b: number) => Math.abs(a - b) / b > UNUSUAL;
const warning = (what: string, ref: number) => `Muy distinto de ${what} (${formatDecimal(ref)}). ¿Es correcto? Se guarda igual.`;

/**
 * Avisos sin bloquear: el lado derecho más de un 30 % distinto del izquierdo, o un valor más de un 30 % distinto de
 * la medición anterior de esa métrica.
 */
export function unusualValues(
  values: Measurement["values"],
  previous: Measurement["values"] = {},
): Partial<Record<MetricKey, string>> {
  const out: Partial<Record<MetricKey, string>> = {};
  for (const m of METRICS) {
    const v = values[m.key];
    if (v === undefined) continue;
    const left = m.side === "R" ? values[METRICS.find((o) => o.chart === m.chart && o.side === "L")!.key] : undefined;
    const prev = previous[m.key];
    if (left !== undefined && differs(v, left)) out[m.key] = warning("la izquierda", left);
    else if (prev !== undefined && differs(v, prev)) out[m.key] = warning("la anterior", prev);
  }
  return out;
}
