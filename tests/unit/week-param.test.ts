// Spec: docs/pm/78-plan-navegar-semanas/spec.md › R1, R2 (Acceptance criteria) y Edge cases.
// Tech: docs/pm/78-plan-navegar-semanas/tech.md › Components & files (`src/lib/useWeekParam.ts`):
//   parseWeekParam(raw, today): lunes (YYYY-MM-DD) de la semana vista; semana actual si falta o no vale.
//   weekHref(path, monday, today): `path` + `?semana=<lunes>`; sin parámetro si es la semana actual.
//   shiftWeek(monday, n): lunes de la semana n posiciones después (n negativo = antes).
// Falla hasta que exista el módulo (tareas 2 del tech.md). "Hoy" = martes 2026-09-22 (lunes 2026-09-21).
import { describe, expect, it } from "vitest";
import { parseWeekParam, shiftWeek, weekHref } from "@/lib/useWeekParam";

const TODAY = "2026-09-22";
const THIS_MONDAY = "2026-09-21";
const NEXT_MONDAY = "2026-09-28";
const LAST_MONDAY = "2026-09-14";

describe("R2: parseWeekParam", () => {
  it("sin parámetro → semana actual", () => {
    expect(parseWeekParam(null, TODAY)).toBe(THIS_MONDAY);
    expect(parseWeekParam(undefined, TODAY)).toBe(THIS_MONDAY);
    expect(parseWeekParam("", TODAY)).toBe(THIS_MONDAY);
  });

  it("un lunes válido se respeta, sea pasado o futuro", () => {
    expect(parseWeekParam(NEXT_MONDAY, TODAY)).toBe(NEXT_MONDAY);
    expect(parseWeekParam(LAST_MONDAY, TODAY)).toBe(LAST_MONDAY);
    expect(parseWeekParam("2030-01-07", TODAY)).toBe("2030-01-07");
  });

  it("una fecha que no es lunes se normaliza al lunes de su semana", () => {
    expect(parseWeekParam("2026-09-30", TODAY)).toBe(NEXT_MONDAY); // miércoles
    expect(parseWeekParam("2026-10-04", TODAY)).toBe(NEXT_MONDAY); // domingo
  });

  it.each(["hola", "2026-13-40", "2026-02-30", "26-09-28", "2026/09/28", "2026-09-28T10:00", "<script>", "9999999999"])(
    "valor no válido %j → semana actual",
    (raw) => {
      expect(parseWeekParam(raw, TODAY)).toBe(THIS_MONDAY);
    },
  );

  it("el domingo cuenta como la semana que empezó el lunes anterior", () => {
    expect(parseWeekParam(null, "2026-09-27")).toBe(THIS_MONDAY);
    expect(parseWeekParam(null, "2026-09-28")).toBe(NEXT_MONDAY);
  });
});

describe("R1: shiftWeek", () => {
  it("avanza y retrocede de semana en semana", () => {
    expect(shiftWeek(THIS_MONDAY, 1)).toBe(NEXT_MONDAY);
    expect(shiftWeek(THIS_MONDAY, -1)).toBe(LAST_MONDAY);
    expect(shiftWeek(THIS_MONDAY, 0)).toBe(THIS_MONDAY);
  });

  it("cruza fin de mes, de año y cambios de hora sin desfases", () => {
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(shiftWeek("2026-10-19", 2)).toBe("2026-11-02"); // cambio de hora el 25 oct
    expect(shiftWeek("2026-03-23", 1)).toBe("2026-03-30"); // cambio de hora el 29 mar
  });

  it("no tiene límite (spec › Non-goals)", () => {
    expect(shiftWeek(THIS_MONDAY, 520)).toBe("2036-09-15");
    expect(shiftWeek(THIS_MONDAY, -520)).toBe("2016-09-26");
  });
});

describe("R2: weekHref", () => {
  it("la semana actual no lleva parámetro", () => {
    expect(weekHref("/plan/compra", THIS_MONDAY, TODAY)).toBe("/plan/compra");
    expect(weekHref("/plan", THIS_MONDAY, TODAY)).toBe("/plan");
  });

  it("otra semana añade ?semana=<lunes>", () => {
    expect(weekHref("/plan/compra", NEXT_MONDAY, TODAY)).toBe("/plan/compra?semana=2026-09-28");
    expect(weekHref("/plan", LAST_MONDAY, TODAY)).toBe("/plan?semana=2026-09-14");
  });

  it("la ruta que sale de weekHref se lee de vuelta como la misma semana", () => {
    const href = weekHref("/plan", NEXT_MONDAY, TODAY);
    const raw = new URL(href, "http://x").searchParams.get("semana");
    expect(parseWeekParam(raw, TODAY)).toBe(NEXT_MONDAY);
  });
});
