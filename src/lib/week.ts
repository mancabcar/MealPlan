// Semana lunes–domingo compartida por Plan y la lista de la compra (docs/pm/lista-compra › R2):
// un solo cálculo para que ambas pantallas no puedan divergir.

export const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lunes (YYYY-MM-DD) de la semana que contiene `date`. */
export function mondayOf(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateStr(d);
}

/** Lunes → domingo de la semana que contiene `date`. */
export function weekDates(date: string): string[] {
  const monday = new Date(mondayOf(date) + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return toDateStr(x);
  });
}

/** "2026-09-22", -1 → "2026-09-21". Por fecha local (setDate): siempre un día de calendario, también con cambio de hora. */
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
