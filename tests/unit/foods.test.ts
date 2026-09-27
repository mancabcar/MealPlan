// Spec: docs/pm/13-base-alimentos/spec.md › R2, R6, R7, R12 (búsqueda, cálculo, validación y límite de OFF).
// Tech: docs/pm/13-base-alimentos/tech.md › APIs / interfaces (`src/lib/foods.ts`). Tabla de fixture: tests/fixtures/foods.ts.
import { describe, expect, it } from "vitest";
import { OFF_LIMIT, displayMacro, offCooldown, parseGrams, parseUnits, scaleMacros, searchLocalFoods } from "@/lib/foods";
import {
  ARROZ_BASMATI,
  ARROZ_COCIDO,
  ARROZ_CRUDO,
  ARROZ_INTEGRAL,
  ARROZ_JAZMIN,
  ARROZ_SALVAJE,
  FOODS_FIXTURE,
  HARINA_ARROZ,
  PLATANO,
  TORTITAS,
} from "../fixtures/foods";

const search = (q: string) => searchLocalFoods(q, FOODS_FIXTURE).map((f) => f.name);

describe("R2: búsqueda en los básicos", () => {
  it("con menos de 2 letras no devuelve nada", () => {
    expect(search("")).toEqual([]);
    expect(search("a")).toEqual([]);
    expect(search("  a ")).toEqual([]);
  });

  it("«arroz coc» encuentra «Arroz blanco, cocido» y no «Arroz blanco, crudo» (todas las palabras)", () => {
    expect(search("arroz coc")).toEqual([ARROZ_COCIDO.name]);
  });

  it("«platano» encuentra «Plátano» (sin tildes ni mayúsculas)", () => {
    expect(search("platano")).toEqual([PLATANO.name]);
    expect(search("PLÁTANO")).toEqual([PLATANO.name]);
  });

  it("las palabras pueden ir en cualquier orden y con espacios de más", () => {
    expect(search("  cocido   arroz ")).toEqual([ARROZ_COCIDO.name]);
  });

  it("crudo y cocido son filas distintas", () => {
    const names = search("arroz blanco");
    expect(names).toContain(ARROZ_CRUDO.name);
    expect(names).toContain(ARROZ_COCIDO.name);
  });

  it("con más de 8 coincidencias devuelve 8: primero las que empiezan por lo escrito, luego el orden de la tabla", () => {
    expect(search("arroz")).toEqual([
      ARROZ_CRUDO.name,
      ARROZ_COCIDO.name,
      ARROZ_BASMATI.name,
      ARROZ_INTEGRAL.name,
      ARROZ_SALVAJE.name,
      ARROZ_JAZMIN.name,
      TORTITAS.name,
      HARINA_ARROZ.name,
    ]);
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    expect(search("tortilla de mi abuela")).toEqual([]);
  });

  it("acepta un límite distinto", () => {
    expect(searchLocalFoods("arroz", FOODS_FIXTURE, 3)).toHaveLength(3);
  });
});

describe("R6: macros por gramos", () => {
  it("150 g de un alimento de 130 / 2,7 / 28 / 0,3 por 100 g → 195 / 4,05 / 42 / 0,45 sin redondear", () => {
    const m = scaleMacros(ARROZ_COCIDO, 150);
    expect(m.calories).toBeCloseTo(195, 6);
    expect(m.protein).toBeCloseTo(4.05, 6);
    expect(m.carbs).toBeCloseTo(42, 6);
    expect(m.fat).toBeCloseTo(0.45, 6);
  });

  it("100 g devuelve los valores por 100 g", () => {
    const m = scaleMacros(ARROZ_COCIDO, 100);
    expect(m.calories).toBeCloseTo(130, 9);
    expect(m.protein).toBeCloseTo(2.7, 9);
    expect(m.carbs).toBeCloseTo(28, 9);
    expect(m.fat).toBeCloseTo(0.3, 9);
  });

  it("se muestran redondeados a entero: 195 kcal, 4 P, 42 C (criterio del issue)", () => {
    const m = scaleMacros(ARROZ_COCIDO, 150);
    expect(displayMacro(m.calories, "kcal")).toBe("195");
    expect(displayMacro(m.protein, "protein")).toBe("4");
    expect(displayMacro(m.carbs, "carbs")).toBe("42");
  });

  it("la grasa por debajo de 1 g lleva un decimal con coma: 0,3 × 1,5 → «0,5» (ojo: en coma flotante es 0,4499…)", () => {
    expect(displayMacro(scaleMacros(ARROZ_COCIDO, 150).fat, "fat")).toBe("0,5");
    expect(displayMacro(0.3, "fat")).toBe("0,3");
  });

  it("la grasa de 1 g o más se redondea a entero", () => {
    expect(displayMacro(1, "fat")).toBe("1");
    expect(displayMacro(9.8, "fat")).toBe("10");
  });

  it("los demás macros por debajo de 1 g no llevan decimal", () => {
    expect(displayMacro(0.45, "protein")).toBe("0");
  });
});

describe("R6: gramos válidos (enteros de 1 a 2000)", () => {
  it.each([
    ["1", 1],
    ["150", 150],
    ["2000", 2000],
    [" 80 ", 80],
  ])("«%s» → %d", (text, grams) => {
    expect(parseGrams(text)).toBe(grams);
  });

  it.each(["0", "2001", "12,5", "12.5", "-5", "", "abc"])("«%s» no es válido", (text) => {
    expect(parseGrams(text)).toBeNull();
  });
});

describe("R7: unidades válidas (0,5 a 10 en pasos de 0,5)", () => {
  it.each([
    ["1", 1],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["0,5", 0.5],
    ["10", 10],
  ])("«%s» → %d", (text, units) => {
    expect(parseUnits(text)).toBe(units);
  });

  it.each(["0,3", "0", "11", "10,5", "1,25", "", "dos"])("«%s» no es válido", (text) => {
    expect(parseUnits(text)).toBeNull();
  });
});

describe("R12: límite de búsquedas en OFF (10 por minuto)", () => {
  const NOW = Date.parse("2026-09-22T10:00:00Z");

  it("el límite es 10 búsquedas por 60 s", () => {
    expect(OFF_LIMIT).toEqual({ max: 10, windowMs: 60_000 });
  });

  it("sin búsquedas o con 9 en el último minuto se puede buscar", () => {
    expect(offCooldown([], NOW)).toBe(0);
    expect(offCooldown(Array.from({ length: 9 }, (_, i) => NOW - i * 1000), NOW)).toBe(0);
  });

  it("con 10 en el último minuto hay que esperar a que la más antigua cumpla 60 s", () => {
    // La más antigua fue hace 45 s → faltan 15 s
    const stamps = Array.from({ length: 10 }, (_, i) => NOW - 45_000 + i * 1000);
    expect(offCooldown(stamps, NOW)).toBe(15);
  });

  it("redondea hacia arriba los segundos que faltan", () => {
    const stamps = Array.from({ length: 10 }, () => NOW - 45_500);
    expect(offCooldown(stamps, NOW)).toBe(15);
  });

  it("las búsquedas de hace más de 60 s no cuentan", () => {
    const stamps = [...Array.from({ length: 5 }, () => NOW - 61_000), ...Array.from({ length: 9 }, () => NOW - 1000)];
    expect(offCooldown(stamps, NOW)).toBe(0);
  });
});
