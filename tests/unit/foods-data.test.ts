// Spec: docs/pm/13-base-alimentos/spec.md › R3 (tabla local de ~150 genéricos centrada en los planes).
// Tech: docs/pm/13-base-alimentos/tech.md › Data model (`LocalFood`), Risks (valores plausibles) y Testing strategy.
// Se prueba la tabla REAL (src/data/foods.json), generada por scripts/build-foods.mjs.
import { describe, expect, it } from "vitest";
import foodsJson from "@/data/foods.json";
import { searchLocalFoods, type LocalFood } from "@/lib/foods";

const FOODS = foodsJson as LocalFood[];
const find = (q: string) => searchLocalFoods(q, FOODS, 50);

/** Alimentos de los planes de agosto y septiembre (docs/referencia/) y básicos de despensa, acordados en dev-test. */
const PLAN_TERMS = [
  "pan de centeno",
  "pan integral",
  "huevo",
  "clara de huevo",
  "jamon de pavo",
  "lomo embuchado",
  "salmon ahumado",
  "queso cottage",
  "queso fresco",
  "avena",
  "chia",
  "tortitas de arroz",
  "arroz basmati",
  "arroz integral",
  "pasta",
  "pasta integral",
  "quinoa",
  "gnocchi",
  "patata",
  "boniato",
  "pollo",
  "pavo",
  "merluza",
  "salmon",
  "atun",
  "sardina",
  "rodaballo",
  "pepino",
  "tomate",
  "aguacate",
  "judias verdes",
  "pimiento",
  "calabacin",
  "berenjena",
  "esparrago",
  "brocoli",
  "zanahoria",
  "espinaca",
  "cebolla",
  "alubia",
  "lenteja",
  "garbanzo",
  "aceite de oliva",
  "nuez",
  "almendra",
  "kiwi",
  "platano",
  "manzana",
  "naranja",
  "mandarina",
  "fresa",
  "mango",
];

/** Los que el plan pesa en crudo y que también se comen cocidos: filas distintas (R3, brief). */
const RAW_AND_COOKED = ["arroz basmati", "arroz integral", "pasta", "quinoa"];

/** Nombres que usan tests/e2e/food.spec.ts: son contrato. */
const E2E_NAMES = ["Arroz blanco, crudo", "Arroz blanco, cocido", "Plátano", "Huevo"];

describe("R3: forma de la tabla local", () => {
  it("tiene ~150 alimentos (entre 120 y 250)", () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(120);
    expect(FOODS.length).toBeLessThanOrEqual(250);
  });

  it("cada alimento tiene id, nombre, kcal/P/C/G por 100 g, fuente y código en la fuente", () => {
    for (const f of FOODS) {
      expect(f.id, JSON.stringify(f)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(f.name.trim(), f.id).not.toBe("");
      for (const k of ["kcal", "protein", "carbs", "fat"] as const) {
        expect(Number.isFinite(f[k]) && f[k] >= 0, `${f.id}.${k}`).toBe(true);
      }
      expect(f.protein + f.carbs + f.fat, `${f.id}: más de 100 g de macros por 100 g`).toBeLessThanOrEqual(100);
      expect(["CIQUAL", "USDA"], f.id).toContain(f.source);
      expect(String(f.sourceCode).trim(), f.id).not.toBe("");
      if (f.unitGrams !== undefined) expect(f.unitGrams > 0 && f.unitGrams <= 1000, `${f.id}.unitGrams`).toBe(true);
    }
  });

  it("los ids y los nombres son únicos", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    expect(new Set(FOODS.map((f) => f.name.toLowerCase())).size).toBe(FOODS.length);
  });

  it("los valores son plausibles: kcal ≈ 4P + 4C + 9G (±15 % o ±15 kcal, lo que sea mayor)", () => {
    const off = FOODS.filter((f) => {
      const expected = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
      return Math.abs(f.kcal - expected) > Math.max(0.15 * expected, 15);
    }).map((f) => `${f.id}: ${f.kcal} kcal vs ${Math.round(4 * f.protein + 4 * f.carbs + 9 * f.fat)}`);
    expect(off).toEqual([]);
  });
});

describe("R3: cubre los alimentos de los planes", () => {
  it.each(PLAN_TERMS)("«%s» tiene al menos un resultado", (term) => {
    expect(find(term).length).toBeGreaterThan(0);
  });

  it.each(RAW_AND_COOKED)("«%s» tiene crudo y cocido como filas distintas", (term) => {
    expect(find(`${term} crud`).length, `${term} crudo`).toBeGreaterThan(0);
    expect(find(`${term} cocid`).length, `${term} cocido`).toBeGreaterThan(0);
  });

  it("el crudo tiene más kcal por 100 g que el cocido (no se han confundido)", () => {
    for (const term of RAW_AND_COOKED) {
      const raw = find(`${term} crud`)[0];
      const cooked = find(`${term} cocid`)[0];
      expect(raw.kcal, term).toBeGreaterThan(cooked.kcal * 1.5);
    }
  });

  it("los nombres que usa el e2e existen tal cual", () => {
    const names = FOODS.map((f) => f.name);
    for (const n of E2E_NAMES) expect(names).toContain(n);
  });

  it("el huevo y el plátano tienen peso de unidad (R7)", () => {
    expect(FOODS.find((f) => f.name === "Huevo")?.unitGrams).toBeGreaterThan(0);
    expect(FOODS.find((f) => f.name === "Plátano")?.unitGrams).toBeGreaterThan(0);
  });

  it("el arroz blanco cocido no tiene unidad (R7: sin selector)", () => {
    expect(FOODS.find((f) => f.name === "Arroz blanco, cocido")?.unitGrams).toBeUndefined();
  });
});
