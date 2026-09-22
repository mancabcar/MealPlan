// Rediseño visual (docs/pm/design-refresh, R7): anillo de progreso de calorías del Diario,
// sustituye la barra plana de "Calorías". Puramente presentacional: recibe value/max ya calculados.
export function ProgressRing({
  value,
  max,
  size = 152,
  strokeWidth = 14,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={sublabel ? `${label} ${sublabel}` : label}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-surface-2)" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-display text-2xl font-bold text-[var(--color-text)] leading-none">{label}</span>
        {sublabel && <span className="text-xs text-[var(--color-text-muted)]">{sublabel}</span>}
      </div>
    </div>
  );
}
