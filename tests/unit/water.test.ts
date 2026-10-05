// Spec: docs/pm/23-agua-fibra-micros/spec.md › R10, R11, R12 (criterios de aceptación y edge cases de la entrega 2).
// Tech: tech.md › Design › Data model y Components & files. Contrato de `src/lib/water.ts` (puro, sin React ni store),
// acordado con Manuel al escribir los tests:
//   WATER_GOAL_DEFAULT_ML = 2000, GLASS_DEFAULT_ML = 250, GLASS_OPTIONS = [200, 250, 330, 500], WATER_MAX_ML = 6000.
//   waterGoalMl(profile) / glassMl(profile): el valor del perfil o el de por defecto (un vaso que no es una de las
//     cuatro opciones vuelve a 250).
//   glassesFor(goalMl, glassMl) = objetivo ÷ vaso hacia ARRIBA; glassesDrunk(ml, glassMl) = ml ÷ vaso hacia ABAJO.
//   addGlass(ml, glassMl) = +1 vaso, sin pasar de 6000; removeGlass = −1 vaso, sin bajar de 0.
//   tapGlass(ml, glassMl, n): tocar el vaso n fija el total en n vasos; si ya hay exactamente n llenos, queda en n − 1.
//   goalReached(ml, goalMl): ml ≥ objetivo.
//   parseWaterGoal(text): litros (coma o punto, hasta 2 decimales, 0,5–6) → ml; fuera de rango o ilegible → null.
//   formatLiters(ml): litros con coma, hasta 2 decimales y sin ceros sobrantes («1,25», «2», «0,99»).
//   withWater(water, date, ml): copia con el día fijado; 0 ml quita la clave.
//   sanitizeWater(raw): descarta fechas mal formadas y valores no numéricos, no finitos, negativos o cero; recorta a 6000.
// Fallan hasta que exista src/lib/water.ts (tarea 9 del tech design).
import { describe, expect, it } from "vitest";
import {
  GLASS_DEFAULT_ML,
  GLASS_OPTIONS,
  WATER_GOAL_DEFAULT_ML,
  WATER_MAX_ML,
  addGlass,
  formatLiters,
  glassMl,
  glassesDrunk,
  glassesFor,
  goalReached,
  parseWaterGoal,
  removeGlass,
  sanitizeWater,
  tapGlass,
  waterGoalMl,
  withWater,
} from "@/lib/water";
import { lucia } from "../fixtures/profiles";
import { AGUA_DOS_DIAS, TODAY, YESTERDAY } from "../fixtures/agua";

describe("R11: valores por defecto y del perfil", () => {
  it("las constantes del spec", () => {
    expect(WATER_GOAL_DEFAULT_ML).toBe(2000);
    expect(GLASS_DEFAULT_ML).toBe(250);
    expect(GLASS_OPTIONS).toEqual([200, 250, 330, 500]);
    expect(WATER_MAX_ML).toBe(6000);
  });

  it("un perfil sin objetivo de agua ni vaso usa 2 L y 250 ml", () => {
    expect(waterGoalMl(lucia)).toBe(2000);
    expect(glassMl(lucia)).toBe(250);
  });

  it("un perfil con waterGoalMl y glassMl usa esos valores", () => {
    const p = { ...lucia, waterGoalMl: 2500, glassMl: 330 };
    expect(waterGoalMl(p)).toBe(2500);
    expect(glassMl(p)).toBe(330);
  });

  it("un tamaño de vaso que no es una de las cuatro opciones vuelve a 250 ml", () => {
    expect(glassMl({ ...lucia, glassMl: 123 })).toBe(250);
  });
});

describe("R10 / R11: vasos del objetivo y vasos bebidos", () => {
  it("2 L con vaso de 250 ml = 8 vasos; con 500 ml = 4", () => {
    expect(glassesFor(2000, 250)).toBe(8);
    expect(glassesFor(2000, 500)).toBe(4);
  });

  it("si el objetivo no es múltiplo del vaso, los vasos del objetivo se redondean hacia arriba (2 L con 330 ml = 7)", () => {
    expect(glassesFor(2000, 330)).toBe(7);
  });

  it("los vasos bebidos se redondean hacia abajo (1000 ml con 250 = 4; con 500 = 2; con 330 = 3)", () => {
    expect(glassesDrunk(1000, 250)).toBe(4);
    expect(glassesDrunk(1000, 500)).toBe(2);
    expect(glassesDrunk(1000, 330)).toBe(3);
  });
});

describe("R10: sumar y restar vasos", () => {
  it("con 0 ml y vaso de 250, + deja 250 ml", () => {
    expect(addGlass(0, 250)).toBe(250);
  });

  it("− con 0 ml sigue en 0", () => {
    expect(removeGlass(0, 250)).toBe(0);
  });

  it("− baja un vaso", () => {
    expect(removeGlass(1250, 250)).toBe(1000);
  });

  it("− con 250 ml y vaso de 330 queda en 0, no negativo", () => {
    expect(removeGlass(250, 330)).toBe(0);
  });

  it("+ nunca pasa de 6 L: con 5900 ml y vaso de 500 queda en 6000", () => {
    expect(addGlass(5900, 500)).toBe(6000);
  });

  it("+ con 6000 ml se queda en 6000", () => {
    expect(addGlass(6000, 250)).toBe(6000);
  });
});

describe("R10: tocar un vaso de la fila", () => {
  it("tocar el vaso 5 con 0 ml deja 5 vasos (1250 ml)", () => {
    expect(tapGlass(0, 250, 5)).toBe(1250);
  });

  it("tocar un vaso por debajo de lo bebido recorta al vaso tocado (1250 → vaso 2 = 500)", () => {
    expect(tapGlass(1250, 250, 2)).toBe(500);
  });

  it("tocar el último vaso lleno quita uno (1250 → vaso 5 = 1000)", () => {
    expect(tapGlass(1250, 250, 5)).toBe(1000);
  });

  it("tocar el único vaso lleno lo vacía (250 → vaso 1 = 0)", () => {
    expect(tapGlass(250, 250, 1)).toBe(0);
  });

  it("tocar un vaso por encima llena hasta él (500 → vaso 8 = 2000)", () => {
    expect(tapGlass(500, 250, 8)).toBe(2000);
  });

  it("el total tocado nunca pasa de 6 L", () => {
    expect(tapGlass(0, 500, 20)).toBe(6000);
  });
});

describe("R12: objetivo cumplido", () => {
  it("1750 de 2000: no; 2000 de 2000: sí; 2250 de 2000: sí", () => {
    expect(goalReached(1750, 2000)).toBe(false);
    expect(goalReached(2000, 2000)).toBe(true);
    expect(goalReached(2250, 2000)).toBe(true);
  });
});

describe("R11: objetivo de agua en litros", () => {
  it("acepta de 0,5 a 6 L, con coma o punto, y devuelve ml", () => {
    expect(parseWaterGoal("2")).toBe(2000);
    expect(parseWaterGoal("1,5")).toBe(1500);
    expect(parseWaterGoal("1.5")).toBe(1500);
    expect(parseWaterGoal("0,5")).toBe(500);
    expect(parseWaterGoal("6")).toBe(6000);
    expect(parseWaterGoal("1,25")).toBe(1250);
  });

  it("rechaza fuera de rango, más de 2 decimales y texto", () => {
    for (const bad of ["0,4", "0", "6,1", "7", "-1", "1,255", "abc", "", "1,2,3"]) expect(parseWaterGoal(bad), bad).toBeNull();
  });
});

describe("R10: formato de litros", () => {
  it("coma, hasta 2 decimales y sin ceros sobrantes", () => {
    expect(formatLiters(1250)).toBe("1,25");
    expect(formatLiters(2000)).toBe("2");
    expect(formatLiters(1500)).toBe("1,5");
    expect(formatLiters(990)).toBe("0,99");
    expect(formatLiters(0)).toBe("0");
    expect(formatLiters(250)).toBe("0,25");
  });
});

describe("R10: el agua se guarda en ml por día", () => {
  it("withWater fija el día sin tocar los demás y sin mutar el original", () => {
    const next = withWater(AGUA_DOS_DIAS, TODAY, 1500);
    expect(next).toEqual({ [YESTERDAY]: 1500, [TODAY]: 1500 });
    expect(AGUA_DOS_DIAS[TODAY]).toBe(1250);
  });

  it("withWater con 0 ml quita la clave del día", () => {
    expect(withWater(AGUA_DOS_DIAS, TODAY, 0)).toEqual({ [YESTERDAY]: 1500 });
  });
});

describe("R10 / R13: sanitizeWater al cargar", () => {
  it("conserva los días válidos", () => {
    expect(sanitizeWater(AGUA_DOS_DIAS)).toEqual(AGUA_DOS_DIAS);
  });

  it("descarta fechas mal formadas y valores no numéricos, no finitos, negativos o cero", () => {
    const raw = {
      [TODAY]: 750,
      ayer: 500,
      "2026-9-1": 500,
      "2026-09-20": "500",
      "2026-09-19": -5,
      "2026-09-18": NaN,
      "2026-09-17": 0,
      "2026-09-16": null,
    };
    expect(sanitizeWater(raw)).toEqual({ [TODAY]: 750 });
  });

  it("recorta a 6000 ml lo que lo supere", () => {
    expect(sanitizeWater({ [TODAY]: 9000 })).toEqual({ [TODAY]: 6000 });
  });

  it("lo que no es un objeto da {}", () => {
    for (const raw of [null, undefined, [], "x", 5]) expect(sanitizeWater(raw), String(raw)).toEqual({});
  });
});
