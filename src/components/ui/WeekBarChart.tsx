// Rediseño visual (docs/pm/design-refresh, R7): gráfico de 7 barras (calorías por día) con el
// objetivo marcado, sustituye a la sección "Calorías esta semana" plana del Diario.
export function WeekBarChart({
  data,
  goal,
}: {
  data: { label: string; value: number }[];
  goal: number;
}) {
  const max = Math.max(goal, ...data.map((d) => d.value), 1);
  return (
    <div className="relative flex items-end gap-2 h-28">
      <div
        aria-hidden
        className="absolute left-0 right-0 border-t border-dashed border-[var(--color-accent)]/50"
        style={{ bottom: `${(goal / max) * 100}%` }}
      />
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div
            className="w-full rounded-t-md bg-[var(--color-accent)] min-h-[2px]"
            style={{ height: `${(d.value / max) * 100}%` }}
          />
          <span className="text-[10px] text-[var(--color-text-muted)]">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
