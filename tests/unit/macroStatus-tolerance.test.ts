// Spec: docs/pm/49-tolerancia-cumplido/spec.md › R2 y R3 (macroStatus recibe la tolerancia; el rango de proteína no la usa).
// Tech: tech.md › APIs / interfaces: macroStatus(value, target, tolerancePct) con el tercer parámetro obligatorio.
// Fallan hasta que macroStatus acepte la tolerancia (tarea 2 del tech design).
import { describe, expect, it } from "vitest";
import { macroStatus, type MacroTarget } from "@/lib/planMacros";

// Los tests antiguos de planMacros.test.ts pasan a la firma de tres parámetros en la tarea 2 (dev-code).
const status = macroStatus as unknown as (value: number, target: MacroTarget, tolerancePct: number) => string;

describe("R3: kcal con objetivo 2000 y distintas tolerancias", () => {
  it.each([
    [5, 1899, "below"],
    [5, 1900, "within"],
    [5, 2100, "within"],
    [5, 2101, "above"],
    [10, 1799, "below"],
    [10, 1800, "within"],
    [10, 2200, "within"],
    [10, 2201, "above"],
    [20, 1599, "below"],
    [20, 1600, "within"],
    [20, 2400, "within"],
    [20, 2401, "above"],
  ] as const)("tolerancia %d %%: %d kcal → %s", (pct, value, expected) => {
    expect(status(value, 2000, pct)).toBe(expected);
  });
});

describe("R3: los límites siguen exactos con objetivos que no lo son en coma flotante (hidratos 230)", () => {
  it.each([
    [5, 218, "below"],
    [5, 219, "within"],
    [5, 241, "within"],
    [5, 242, "above"],
    [20, 183, "below"],
    [20, 184, "within"],
    [20, 276, "within"],
    [20, 277, "above"],
  ] as const)("tolerancia %d %%: %d g → %s", (pct, value, expected) => {
    expect(status(value, 230, pct)).toBe(expected);
  });
});

describe("R2: el rango de proteína no depende de la tolerancia", () => {
  const range = { min: 130, max: 160 };
  it.each([5, 10, 20])("con tolerancia %d %%: 129 por debajo, 130 y 160 dentro, 161 por encima", (pct) => {
    expect(status(129, range, pct)).toBe("below");
    expect(status(130, range, pct)).toBe("within");
    expect(status(160, range, pct)).toBe("within");
    expect(status(161, range, pct)).toBe("above");
  });
});
