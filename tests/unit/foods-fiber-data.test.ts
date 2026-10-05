// Spec: docs/pm/23-agua-fibra-micros/spec.md › R5 («los alimentos locales traen fibra»). Tech: tech.md › tarea 5
// (build-foods.mjs lee la fibra de CIQUAL, 34100; los USDA la llevan en scripts/foods-list.json).
// Lee la tabla REAL (src/data/foods.json). Falla hasta regenerar foods.json con fibra.
import { describe, expect, it } from "vitest";
import { FOODS, type LocalFood } from "@/lib/foods";

type WithFiber = LocalFood & { fiber?: number };
const foods = FOODS as WithFiber[];
const byId = (id: string) => {
  const f = foods.find((x) => x.id === id);
  if (!f) throw new Error(`Falta «${id}» en src/data/foods.json`);
  return f;
};

describe("R5: todos los alimentos locales traen fibra (g por 100 g)", () => {
  it("cada alimento tiene fibra numérica entre 0 y 100", () => {
    const bad = foods.filter((f) => typeof f.fiber !== "number" || !Number.isFinite(f.fiber) || f.fiber < 0 || f.fiber > 100);
    expect(bad.map((f) => f.id)).toEqual([]);
  });

  it("legumbres: las lentejas crudas llevan más de 8 g y las cocidas entre 3 y 12", () => {
    expect(byId("lentejas-crudas").fiber!).toBeGreaterThan(8);
    expect(byId("lentejas-cocidas").fiber!).toBeGreaterThanOrEqual(3);
    expect(byId("lentejas-cocidas").fiber!).toBeLessThanOrEqual(12);
  });

  it("integrales: el pan integral lleva más de 4 g", () => {
    expect(byId("pan-integral").fiber!).toBeGreaterThan(4);
  });

  it("carne: la pechuga de pollo cruda lleva 0 g (un dato, no «sin dato»)", () => {
    expect(byId("pollo-pechuga-cruda").fiber).toBe(0);
  });
});
