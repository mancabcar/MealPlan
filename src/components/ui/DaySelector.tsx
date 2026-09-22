// Rediseño visual (docs/pm/design-refresh, R8): selector de días con scroll horizontal, sustituye
// la lista vertical Lunes-Domingo del Plan semanal.
const DAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"]; // índice = Date#getDay() (0 = domingo)
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function DaySelector({
  dates,
  selected,
  onSelect,
  todayDate,
}: {
  /** Fechas YYYY-MM-DD, en el orden a mostrar. */
  dates: string[];
  selected: string;
  onSelect: (date: string) => void;
  todayDate?: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Seleccionar día">
      {dates.map((date) => {
        const isSelected = date === selected;
        const d = new Date(date + "T00:00:00");
        const dayNum = d.getDate();
        return (
          <button
            key={date}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={`${DAY_NAMES[d.getDay()]} ${dayNum}`}
            onClick={() => onSelect(date)}
            className={`flex flex-col items-center justify-center min-w-12 shrink-0 py-2 rounded-2xl text-sm font-medium transition-colors ${
              isSelected
                ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wide">{DAY_LETTERS[d.getDay()]}</span>
            <span className="font-display text-base leading-tight">{dayNum}</span>
            {date === todayDate && (
              <span
                aria-hidden
                className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-[var(--color-on-accent)]" : "bg-[var(--color-accent)]"}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
