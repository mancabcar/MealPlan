// Spec: docs/pm/lista-compra/spec.md › R11 (pasillos), R12 (especias y básicos).
// Tech: docs/pm/lista-compra/tech.md › classify.ts (`AISLES`, `classify(key)` → `{ aisle, basic }`), "Aisle check".
import { describe, expect, it } from "vitest";
import { AISLES, classify } from "@/lib/shopping/classify";
import { normalizeKey, parseIngredientLine } from "@/lib/shopping/parse";
import seed from "@/data/recipes.json";

const of = (name: string) => classify(normalizeKey(name));

describe("R11: pasillos", () => {
  it("los cinco pasillos, en el orden de la lista", () => {
    expect(AISLES).toEqual(["Frutas y verduras", "Carne y pescado", "Lácteos y huevos", "Despensa y conservas", "Otros"]);
  });

  it("brócoli → Frutas y verduras", () => {
    expect(of("brócoli")).toEqual({ aisle: "Frutas y verduras", basic: false });
  });

  it("un ingrediente desconocido → Otros", () => {
    expect(of("xantana")).toEqual({ aisle: "Otros", basic: false });
  });

  it.each([
    ["cebolla morada", "Frutas y verduras"],
    ["espárragos verdes", "Frutas y verduras"],
    ["plátano", "Frutas y verduras"],
    ["pechuga de pollo", "Carne y pescado"],
    ["lomo de salmón", "Carne y pescado"],
    ["gambas peladas", "Carne y pescado"],
    ["huevos", "Lácteos y huevos"],
    ["yogur griego natural", "Lácteos y huevos"],
    ["mozzarella fresca", "Lácteos y huevos"],
    ["arroz", "Despensa y conservas"],
    ["garbanzos cocidos", "Despensa y conservas"],
    ["lentejas rojas", "Despensa y conservas"],
    ["judías verdes", "Frutas y verduras"], // review N1: el plural en -es ya no rompe "judía verde"
    ["atún al natural", "Despensa y conservas"],
  ])("%s → %s", (name, aisle) => {
    expect(of(name).aisle).toBe(aisle);
  });

  it("ningún ingrediente de las recetas semilla cae en Otros (tech.md › Aisle check)", () => {
    const keys = new Set(
      (seed.recipes as { ingredients: string[] }[]).flatMap((r) => r.ingredients.flatMap((l) => parseIngredientLine(l).map((i) => i.key))),
    );
    const otros = [...keys].filter((k) => classify(k).aisle === "Otros" && !classify(k).basic);
    expect(otros).toEqual([]);
  });
});

describe("R12: especias y básicos", () => {
  it.each(["sal", "pimienta", "orégano", "vinagre", "agua", "comino", "pimentón", "canela", "caldo en pastilla"])(
    "%s es un básico",
    (name) => {
      expect(of(name).basic).toBe(true);
    },
  );

  it("el aceite de oliva no es un básico (se cruza con la Despensa como cualquier otro)", () => {
    expect(of("aceite de oliva").basic).toBe(false);
  });

  it.each(["perejil fresco", "albahaca fresca", "cebollino", "jengibre rallado"])(
    "la hierba fresca %s va a Frutas y verduras, no a básicos",
    (name) => {
      expect(of(name)).toEqual({ aisle: "Frutas y verduras", basic: false });
    },
  );
});
