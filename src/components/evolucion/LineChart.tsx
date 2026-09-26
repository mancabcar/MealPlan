// Gráfica de líneas en SVG hecha a mano (historial-medidas tech.md › enfoque A): son decenas de puntos, sin zoom ni
// tooltips. Colores con los tokens del tema, como WeekBarChart. El nombre accesible resume la serie; la alternativa
// completa es el historial de la página.
import { dayNumber, formatDecimal, formatShortDate } from "@/lib/measurements";
import type { MeasurementSource } from "@/lib/types";

export interface ChartPoint {
  date: string;
  value: number;
  source?: MeasurementSource;
}

export interface ChartSeries {
  points: ChartPoint[];
  /** Variable CSS del color de la serie (línea y anillos). */
  color: string;
  /** Une los puntos con una línea (R13); sin ella, solo puntos (el peso lleva la tendencia aparte). */
  connect?: boolean;
  dashed?: boolean;
}

const W = 320;
const H = 170;
const PAD = { top: 10, right: 10, bottom: 22, left: 34 };
const COMPACT = { w: 320, h: 64 };

export function LineChart({
  label,
  series,
  trend,
  compact = false,
}: {
  label: string;
  series: ChartSeries[];
  /** Línea de tendencia (R8), en el color de acento. */
  trend?: { date: string; value: number }[];
  compact?: boolean;
}) {
  const w = compact ? COMPACT.w : W;
  const h = compact ? COMPACT.h : H;
  const pad = compact ? { top: 6, right: 6, bottom: 6, left: 6 } : PAD;

  const all = [...series.flatMap((s) => s.points), ...(trend ?? [])];
  const days = all.map((p) => dayNumber(p.date));
  const values = all.map((p) => p.value);
  const [d0, d1] = [Math.min(...days), Math.max(...days)];
  let [v0, v1] = [Math.min(...values), Math.max(...values)];
  // Un margen para que los puntos no toquen los bordes; con un solo valor, una banda alrededor
  const margin = v1 - v0 === 0 ? Math.max(1, Math.abs(v0) * 0.02) : (v1 - v0) * 0.1;
  v0 -= margin;
  v1 += margin;

  const x = (date: string) =>
    d1 === d0 ? (pad.left + w - pad.right) / 2 : pad.left + ((dayNumber(date) - d0) / (d1 - d0)) * (w - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - v0) / (v1 - v0)) * (h - pad.top - pad.bottom);
  const path = (pts: { date: string; value: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const ticks = [v1 - margin, (v0 + v1) / 2, v0 + margin];
  const firstDate = all.reduce((a, p) => (p.date < a ? p.date : a), all[0].date);
  const lastDate = all.reduce((a, p) => (p.date > a ? p.date : a), all[0].date);
  const r = compact ? 2.5 : 3.5;

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
      {!compact &&
        ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">
              {formatDecimal(t, 1)}
            </text>
          </g>
        ))}
      {!compact && (
        <>
          <text x={pad.left} y={h - 6} fontSize={10} fill="var(--color-text-muted)">
            {formatShortDate(firstDate)}
          </text>
          {lastDate !== firstDate && (
            <text x={w - pad.right} y={h - 6} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">
              {formatShortDate(lastDate)}
            </text>
          )}
        </>
      )}

      {trend && trend.length > 1 && (
        <path d={path(trend)} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
      )}

      {series.map((s, i) => (
        <g key={i}>
          {s.connect && s.points.length > 1 && (
            <path
              d={path(s.points)}
              fill="none"
              stroke={`var(${s.color})`}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
            />
          )}
          {s.points.map((p, j) =>
            // Casa: punto relleno; Nutricionista: anillo (se distinguen por la forma, no solo por el color)
            p.source === "nutritionist" ? (
              <circle
                key={j}
                cx={x(p.date)}
                cy={y(p.value)}
                r={r + 0.5}
                fill="var(--color-surface)"
                stroke={`var(${s.color})`}
                strokeWidth={2}
              />
            ) : (
              <circle
                key={j}
                cx={x(p.date)}
                cy={y(p.value)}
                r={r}
                fill={s.connect ? `var(${s.color})` : "var(--color-text-muted)"}
              />
            ),
          )}
        </g>
      ))}
    </svg>
  );
}
