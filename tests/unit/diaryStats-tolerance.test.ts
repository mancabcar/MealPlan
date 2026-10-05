// Spec: docs/pm/49-tolerancia-cumplido/spec.md › R2 (Plan y Diario juzgan con el mismo valor) y R6 (el histórico se recalcula).
// Tech: tech.md › Components & files: `isCompliantDay` y `periodStats` toman la tolerancia de `profile.tolerancePct`.
// Fallan hasta que existan `tolerancePct` en el perfil y su uso en diaryStats (tarea 2).
import { describe, expect, it } from "vitest";
import { isCompliantDay, periodStats } from "@/lib/diaryStats";
import { macroStatus, macroTarget, type MacroTarget } from "@/lib/planMacros";
import type { UserProfile } from "@/lib/types";
import { WEEK_ENTRIES, statsProfileNoRange } from "../fixtures/medias-adherencia";

const status = macroStatus as unknown as (v: number, t: MacroTarget, pct: number) => string;
const withTol = (tolerancePct?: number) => ({ ...statsProfileNoRange, tolerancePct }) as UserProfile;
const day = (calories: number, protein: number) => ({ calories, protein, carbs: 200, fat: 60 });
const DATES = ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21"];

describe("R2: isCompliantDay usa la tolerancia del perfil", () => {
  it("1850 kcal con objetivo 2000 y proteína 140: no cumple con 5 %, cumple con 10 % y con ausente (10)", () => {
    expect(isCompliantDay(day(1850, 140), withTol(5))).toBe(false);
    expect(isCompliantDay(day(1850, 140), withTol(10))).toBe(true);
    expect(isCompliantDay(day(1850, 140), withTol(undefined))).toBe(true);
  });

  it("proteína 120 con objetivo 140 sin rango: no cumple con 10 %, cumple con 20 %", () => {
    expect(isCompliantDay(day(2000, 120), withTol(10))).toBe(false);
    expect(isCompliantDay(day(2000, 120), withTol(20))).toBe(true);
  });

  it("mismo criterio que el Plan para cada tolerancia: cumple ⇔ macroStatus de kcal y proteína es «within»", () => {
    for (const pct of [5, 10, 15, 20]) {
      const profile = withTol(pct);
      for (const calories of [1599, 1900, 2000, 2100, 2101]) {
        for (const protein of [111, 119, 133, 147, 155]) {
          const plan =
            status(calories, macroTarget("calories", profile), pct) === "within" &&
            status(protein, macroTarget("protein", profile), pct) === "within";
          expect(isCompliantDay(day(calories, protein), profile), `${pct} % · ${calories} kcal / ${protein} g`).toBe(plan);
        }
      }
    }
  });

  it("un valor guardado fuera de rango se ajusta: 50 se comporta como 20", () => {
    expect(isCompliantDay(day(2000, 115), withTol(50))).toBe(true);
    expect(isCompliantDay(day(2000, 111), withTol(50))).toBe(false);
  });
});

describe("R6: periodStats recalcula la adherencia del histórico al cambiar la tolerancia", () => {
  // Semana 15–21 sep (fixture medias-adherencia): días de 1800 kcal (P 135), 2200 kcal (P 140) y 2000 kcal (P 120).
  // Con proteinGoal 140 sin rango: 10 % → 126–154, 20 % → 112–168.
  const compliant = (tol?: number) => periodStats({ entries: WEEK_ENTRIES, profile: withTol(tol), dates: DATES })!.compliantDays;

  it("con 10 % cumplen 2 de 3 y con 20 % cumplen los 3 (la proteína 120 entra en 112–168)", () => {
    expect(compliant(10)).toBe(2);
    expect(compliant(20)).toBe(3);
  });

  it("con 5 % cumplen menos: 1800 kcal ya no está en 1900–2100", () => {
    expect(compliant(5)).toBeLessThan(compliant(10));
  });
});
