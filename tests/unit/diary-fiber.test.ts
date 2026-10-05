// Spec: docs/pm/23-agua-fibra-micros/spec.md › R1, R5, R7 (la entrada guarda la fibra).
// Tech: tech.md › Design › Components & files (`recipeEntry`, `foodEntry`, `Macros.fiber?`, `Per100.fiber?`).
// En archivo aparte de diary.test.ts / diary-food.test.ts para no tocar esos. Fallan hasta construir la tarea 3.
import { describe, expect, it } from "vitest";
import { foodEntry, recipeEntry, repeatEntry } from "@/lib/diary";
import { LENTEJAS_FIBRA, POLLO_SIN_FIBRA, TODAY } from "../fixtures/fibra";

const lentejasCocidas = {
  foodId: "local:lentejas-cocidas",
  name: "Lentejas, cocidas",
  per100: { kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 2.5 },
};
const pollo = {
  foodId: "local:pollo-pechuga-cruda",
  name: "Pollo, pechuga, cruda",
  per100: { kcal: 110, protein: 23, carbs: 0, fat: 1.5 },
};

describe("R7: la fibra de una receta se multiplica por las raciones", () => {
  it("1 ración guarda la fibra de la receta (14 g)", () => {
    expect(recipeEntry(LENTEJAS_FIBRA, TODAY, "Comida", { id: "e1" }).fiber).toBe(14);
  });

  it("2 raciones guardan 28 g, igual que los macros", () => {
    const e = recipeEntry(LENTEJAS_FIBRA, TODAY, "Comida", { servings: 2, id: "e1" });
    expect(e.fiber).toBe(28);
    expect(e.calories).toBe(840);
  });

  it("0,5 raciones guardan 7 g", () => {
    expect(recipeEntry(LENTEJAS_FIBRA, TODAY, "Comida", { servings: 0.5, id: "e1" }).fiber).toBe(7);
  });
});

describe("R1: sin fibra en la receta, la entrada no inventa un 0", () => {
  it("una receta sin fibra produce una entrada sin la propiedad fiber", () => {
    const e = recipeEntry(POLLO_SIN_FIBRA, TODAY, "Comida", { id: "e1" });
    expect(e).not.toHaveProperty("fiber");
    expect(e.calories).toBe(610);
  });
});

describe("R5: fibra proporcional a los gramos de un alimento", () => {
  it("2,5 g por 100 g × 150 g = 3,75 g sin redondear", () => {
    const e = foodEntry(lentejasCocidas, TODAY, "Comida", { grams: 150, id: "e1" });
    expect(e.fiber).toBeCloseTo(3.75, 6);
    expect(e.grams).toBe(150);
  });

  it("registrar en unidades guarda la fibra de los gramos equivalentes", () => {
    const e = foodEntry(lentejasCocidas, TODAY, "Comida", { grams: 100, units: 2, id: "e1" });
    expect(e.fiber).toBeCloseTo(2.5, 6);
  });

  it("un alimento sin fibra produce una entrada sin la propiedad fiber", () => {
    expect(foodEntry(pollo, TODAY, "Cena", { grams: 200, id: "e1" })).not.toHaveProperty("fiber");
  });

  it("un alimento con fibra 0 guarda 0 (es un dato)", () => {
    const e = foodEntry({ ...pollo, per100: { ...pollo.per100, fiber: 0 } }, TODAY, "Cena", { grams: 200, id: "e1" });
    expect(e.fiber).toBe(0);
  });
});

describe("R1: repetir una entrada conserva su fibra", () => {
  it("repeatEntry copia fiber", () => {
    const e = foodEntry(lentejasCocidas, TODAY, "Comida", { grams: 150, id: "e1" });
    expect(repeatEntry(e, TODAY, "Cena", "e2").fiber).toBeCloseTo(3.75, 6);
  });
});
