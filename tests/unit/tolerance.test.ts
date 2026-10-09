// Spec: docs/pm/49-tolerancia-cumplido/spec.md › R1 (rango 5–20, defecto 10) y R5 (ausente o inválido = 10; fuera de rango se ajusta).
// Tech: tech.md › Design (`src/lib/tolerance.ts`, puro, mismo patrón que `fiber.ts`), acordado con Manuel:
//   TOLERANCE_DEFAULT = 10, TOLERANCE_MIN = 5, TOLERANCE_MAX = 20.
//   tolerancePct(profile) = entero guardado ajustado a 5–20; ausente, NaN o no numérico = 10.
//   parseTolerance(text): entero 5–20 (sin signo %) | null (vacío, decimales, fuera de rango, texto).
// Fallan hasta que exista src/lib/tolerance.ts (tarea 1 del tech design).
import { describe, expect, it } from "vitest";
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, parseTolerance, tolerancePct } from "@/lib/tolerance";
import type { UserProfile } from "@/lib/types";
import { lucia } from "../fixtures/profiles";

const withTolerance = (v: unknown) => ({ ...lucia, tolerancePct: v }) as unknown as UserProfile;

describe("R1: constantes y defecto", () => {
  it("rango 5–20 y defecto 10", () => {
    expect([TOLERANCE_MIN, TOLERANCE_DEFAULT, TOLERANCE_MAX]).toEqual([5, 10, 20]);
  });

  it("un perfil sin tolerancia guardada usa 10", () => {
    expect(tolerancePct(lucia)).toBe(10);
  });
});

describe("R1: parseTolerance", () => {
  it.each([
    ["5", 5],
    ["10", 10],
    ["15", 15],
    ["20", 20],
    [" 12 ", 12],
  ] as const)("«%s» → %d", (text, expected) => {
    expect(parseTolerance(text)).toBe(expected);
  });

  it.each(["", "  ", "4", "21", "0", "-10", "7,5", "7.5", "15 %", "abc"])("«%s» → null", (text) => {
    expect(parseTolerance(text)).toBeNull();
  });
});

describe("R5: tolerancePct(profile) nunca devuelve un valor fuera de 5–20", () => {
  it.each([
    [5, 5],
    [12, 12],
    [20, 20],
  ] as const)("%d válido se conserva", (v, expected) => {
    expect(tolerancePct(withTolerance(v))).toBe(expected);
  });

  it("fuera de rango se ajusta al límite más cercano: 3 → 5, 50 → 20", () => {
    expect(tolerancePct(withTolerance(3))).toBe(5);
    expect(tolerancePct(withTolerance(50))).toBe(20);
  });

  it.each([
    ["NaN", NaN],
    ["texto", "quince"],
    ["null", null],
    ["Infinity", Infinity],
  ] as const)("no válido (%s) → 10", (_name, v) => {
    expect(tolerancePct(withTolerance(v))).toBe(10);
  });
});
