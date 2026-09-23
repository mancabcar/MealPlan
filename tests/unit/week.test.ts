// Tech: docs/pm/lista-compra/tech.md › Tasks 1 — `weekDates`/`DAY_NAMES` salen de plan/page.tsx a
// src/lib/week.ts (+ `mondayOf`) para que Plan y la lista usen exactamente la misma semana (R2, spec › Risks).
import { describe, expect, it } from "vitest";
import { DAY_NAMES, mondayOf, weekDates } from "@/lib/week";

describe("R2: semana lunes–domingo compartida por Plan y la lista", () => {
  it("un martes da lunes → domingo de esa semana", () => {
    expect(weekDates("2026-09-22")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("el domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(weekDates("2026-09-27")[0]).toBe("2026-09-21");
    expect(mondayOf("2026-09-27")).toBe("2026-09-21");
  });

  it("el lunes es su propio lunes", () => {
    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
  });

  it("cruza cambios de mes y de año", () => {
    expect(mondayOf("2026-10-01")).toBe("2026-09-28");
    expect(weekDates("2027-01-01")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("DAY_NAMES en español, empezando en lunes", () => {
    expect(DAY_NAMES).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]);
  });
});
