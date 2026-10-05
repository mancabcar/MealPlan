// Spec: docs/pm/23-agua-fibra-micros/spec.md › R1, R2, R3, R5, R7, R8, R9 (criterios de aceptación y edge cases).
// Tech: tech.md › Design › Data model y Testing strategy. Contrato de `src/lib/fiber.ts` (puro, sin React ni store),
// acordado con Manuel:
//   FIBER_GOAL_DEFAULT = 38; fiberGoal(profile) = profile.fiberGoal ?? 38.
//   entryFiber(entry, recipes): number | undefined → entry.fiber; si falta y hay recipeId con receta que tenga fiber,
//     receta.fiber × (entry.servings ?? 1); si no, undefined (sin dato). 0 es un dato.
//   dayFiber(entries, recipes): { total, missing, count } → suma de las entradas con dato; `missing` las que no tienen; `count` = entries.length.
//   scaleFiber(fiberPer100 | undefined, grams): number | undefined (sin redondear).
//   parseFiber(text): number (0–200, coma o punto) | undefined (vacío = sin dato) | null (inválido).
//   parseFiberGoal(text): number (entero 10–100) | null.
//   formatFiber(n): 1 decimal con coma, sin «,0»: 28 → «28», 9.5 → «9,5», 3.75 → «3,8».
// Fallan hasta que exista src/lib/fiber.ts (tarea 1 del tech design).
import { describe, expect, it } from "vitest";
import {
  FIBER_GOAL_DEFAULT,
  dayFiber,
  entryFiber,
  fiberGoal,
  formatFiber,
  parseFiber,
  parseFiberGoal,
  scaleFiber,
} from "@/lib/fiber";
import { lucia } from "../fixtures/profiles";
import {
  DIA_COMPLETO,
  DIA_FIBRA_CERO,
  DIA_PARCIAL,
  DIA_SIN_DATOS,
  ENTRADA_RECETA_ANTIGUA,
  FIBRA_RECIPES,
  LENTEJAS_FIBRA,
  POLLO_SIN_FIBRA,
  entry,
} from "../fixtures/fibra";

describe("R3: objetivo de fibra", () => {
  it("un perfil sin objetivo de fibra usa 38 g", () => {
    expect(FIBER_GOAL_DEFAULT).toBe(38);
    expect(fiberGoal(lucia)).toBe(38);
  });

  it("un perfil con fiberGoal usa ese valor", () => {
    expect(fiberGoal({ ...lucia, fiberGoal: 30 })).toBe(30);
  });

  it("parseFiberGoal acepta enteros de 10 a 100", () => {
    expect(parseFiberGoal("10")).toBe(10);
    expect(parseFiberGoal("38")).toBe(38);
    expect(parseFiberGoal("100")).toBe(100);
  });

  it("parseFiberGoal rechaza lo que está fuera de 10–100, los decimales y el texto", () => {
    for (const bad of ["9", "101", "0", "-5", "37,5", "37.5", "", "abc"]) expect(parseFiberGoal(bad), bad).toBeNull();
  });
});

describe("R1 / R8: campo de fibra opcional", () => {
  it("vacío = sin dato (undefined), no 0", () => {
    expect(parseFiber("")).toBeUndefined();
    expect(parseFiber("   ")).toBeUndefined();
  });

  it("0 escrito explícitamente es un dato", () => {
    expect(parseFiber("0")).toBe(0);
  });

  it("acepta coma o punto decimal", () => {
    expect(parseFiber("2,5")).toBe(2.5);
    expect(parseFiber("2.5")).toBe(2.5);
  });

  it("acepta de 0 a 200 g", () => {
    expect(parseFiber("200")).toBe(200);
    expect(parseFiber("14")).toBe(14);
  });

  it("rechaza más de 200, negativos y texto (null)", () => {
    for (const bad of ["201", "-1", "abc", "1,2,3"]) expect(parseFiber(bad), bad).toBeNull();
  });
});

describe("R1 / R2: fibra de una entrada", () => {
  it("usa el campo de la entrada", () => {
    expect(entryFiber(entry("Comida", "Ensalada", { fiber: 3 }), FIBRA_RECIPES)).toBe(3);
  });

  it("una entrada sin fibra ni receta es «sin dato» (undefined), no 0", () => {
    expect(entryFiber(entry("Comida", "Ensalada"), FIBRA_RECIPES)).toBeUndefined();
  });

  it("0 explícito es un dato", () => {
    expect(entryFiber(entry("Comida", "Zumo", { fiber: 0 }), FIBRA_RECIPES)).toBe(0);
  });

  it("una entrada de receta antigua (sin fiber) recupera la fibra de la receta × raciones", () => {
    expect(entryFiber(ENTRADA_RECETA_ANTIGUA, FIBRA_RECIPES)).toBe(28);
  });

  it("sin raciones guardadas cuenta 1 ración", () => {
    const { servings: _servings, ...una } = ENTRADA_RECETA_ANTIGUA;
    void _servings;
    expect(entryFiber(una, FIBRA_RECIPES)).toBe(14);
  });

  it("si la receta ya no existe o no tiene fibra, sigue siendo «sin dato»", () => {
    expect(entryFiber(ENTRADA_RECETA_ANTIGUA, [])).toBeUndefined();
    expect(entryFiber({ ...ENTRADA_RECETA_ANTIGUA, recipeId: POLLO_SIN_FIBRA.id }, FIBRA_RECIPES)).toBeUndefined();
  });

  it("el campo de la entrada gana a la receta", () => {
    expect(entryFiber({ ...ENTRADA_RECETA_ANTIGUA, fiber: 5 }, [LENTEJAS_FIBRA])).toBe(5);
  });
});

describe("R2: total del día", () => {
  it("día completo: suma 28 g y no falta ningún dato", () => {
    expect(dayFiber(DIA_COMPLETO, FIBRA_RECIPES)).toEqual({ total: 28, missing: 0, count: 2 });
  });

  it("día parcial: 12 g y faltan 3 de 5", () => {
    expect(dayFiber(DIA_PARCIAL, FIBRA_RECIPES)).toEqual({ total: 12, missing: 3, count: 5 });
  });

  it("entradas y ninguna con dato: 0 g y faltan todas", () => {
    expect(dayFiber(DIA_SIN_DATOS, FIBRA_RECIPES)).toEqual({ total: 0, missing: 2, count: 2 });
  });

  it("día sin entradas: 0 g, no falta nada (no es parcial)", () => {
    expect(dayFiber([], FIBRA_RECIPES)).toEqual({ total: 0, missing: 0, count: 0 });
  });

  it("fibra 0 explícita es un dato: el día no es parcial", () => {
    expect(dayFiber(DIA_FIBRA_CERO, FIBRA_RECIPES)).toEqual({ total: 0, missing: 0, count: 1 });
  });

  it("incluye la fibra recuperada de las entradas de receta antiguas", () => {
    expect(dayFiber([ENTRADA_RECETA_ANTIGUA, entry("Cena", "Fruta")], FIBRA_RECIPES)).toEqual({ total: 28, missing: 1, count: 2 });
  });
});

describe("R5: fibra proporcional a la cantidad", () => {
  it("2,5 g por 100 g × 150 g = 3,75 g (sin redondear)", () => {
    expect(scaleFiber(2.5, 150)).toBeCloseTo(3.75, 6);
  });

  it("sin fibra por 100 g, sigue sin dato", () => {
    expect(scaleFiber(undefined, 150)).toBeUndefined();
  });

  it("0 g por 100 g es un dato: 0", () => {
    expect(scaleFiber(0, 150)).toBe(0);
  });
});

describe("R2 / R5: formato de la fibra (1 decimal, coma)", () => {
  it("un entero se muestra sin decimal", () => {
    expect(formatFiber(28)).toBe("28");
    expect(formatFiber(12.04)).toBe("12");
  });

  it("con decimal usa coma", () => {
    expect(formatFiber(9.5)).toBe("9,5");
    expect(formatFiber(3.75)).toBe("3,8");
  });
});
