// Spec: docs/pm/20-recetas-filtros/spec.md › Acceptance criteria R1–R3 y Edge cases.
// Tech: docs/pm/20-recetas-filtros/tech.md › APIs / interfaces (`slotTag`, `slotLabel`, `groupRecipes`) y Testing strategy
// (unit). Funciones puras sin UI. Fallan hasta que exista src/lib/recipeSlots.ts (tarea 2).
import { describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { groupRecipes, slotLabel, slotTag } from "@/lib/recipeSlots";
import type { MealType, Recipe } from "@/lib/types";
import {
  CENA_ALCACHOFAS,
  CENA_IA,
  CENA_PUERROS,
  CENA_PURE,
  CENA_QUESO,
  CENA_ZARZUELA,
  COMIDA_LENTEJAS,
  DESAYUNO_TOSTADA,
  DOBLE_COMIDA_CENA,
  FAV_RECIPES,
  favRecipe,
  SIN_FRANJA,
  SNACK_PUDIN,
  SNACK_YOGUR,
} from "../fixtures/favoritos";

const names = (rs: Recipe[]) => rs.map((r) => r.name);
const group = (over: Partial<Parameters<typeof groupRecipes>[0]> = {}) =>
  groupRecipes({ recipes: FAV_RECIPES, favorites: [], mealType: "Cena", query: "", showAll: false, ...over });

describe("R1: slotTag — franja del Plan → tag de receta", () => {
  it.each<[MealType, string]>([
    ["Desayuno", "desayuno"],
    ["Comida", "comida"],
    ["Cena", "cena"],
    ["Media mañana", "snack"],
    ["Merienda", "snack"],
    ["Pre-entreno", "snack"],
  ])("%s → %s", (mealType, tag) => {
    expect(slotTag(mealType)).toBe(tag);
  });
});

describe("R3: slotLabel — etiqueta de franja de una receta en «Otras franjas»", () => {
  it("usa su tag de franja con la primera letra en mayúscula", () => {
    expect(slotLabel(SNACK_YOGUR)).toBe("Snack");
    expect(slotLabel(DESAYUNO_TOSTADA)).toBe("Desayuno");
  });
  it("sin ninguna franja no hay etiqueta", () => {
    expect(slotLabel(SIN_FRANJA)).toBeNull();
  });
});

describe("R1: groupRecipes filtra por la franja elegida", () => {
  it("Cena: solo recetas con tag cena, sin distinguir mayúsculas (la de IA lleva «Cena»)", () => {
    const { slot } = group();
    expect(names(slot)).toContain(CENA_ZARZUELA.name);
    expect(names(slot)).toContain(CENA_IA.name);
    expect(names(slot)).not.toContain(COMIDA_LENTEJAS.name);
    expect(names(slot)).not.toContain(SNACK_YOGUR.name);
    expect(names(slot)).not.toContain(SIN_FRANJA.name);
  });

  it.each<MealType>(["Media mañana", "Merienda", "Pre-entreno"])("%s usa las recetas con tag snack", (mealType) => {
    const { slot } = group({ mealType });
    expect(names(slot).sort()).toEqual([SNACK_PUDIN.name, SNACK_YOGUR.name].sort());
  });

  it("una receta con dos tags de franja aparece en las dos franjas", () => {
    expect(names(group({ mealType: "Comida" }).slot)).toContain(DOBLE_COMIDA_CENA.name);
    expect(names(group({ mealType: "Cena" }).slot)).toContain(DOBLE_COMIDA_CENA.name);
  });

  it("el buscador se combina con la franja: coincide por nombre o por etiqueta", () => {
    expect(names(group({ query: "zarzuela" }).slot)).toEqual([CENA_ZARZUELA.name]);
    expect(names(group({ query: "vegetariano" }).slot)).toEqual([CENA_PUERROS.name]);
    // Está en el catálogo de prueba pero es de comida: la franja manda
    expect(names(group({ query: "lentejas" }).slot)).toEqual([]);
  });

  it("el buscador ignora mayúsculas y tildes: «PURE» encuentra «Puré»", () => {
    expect(names(group({ query: "PURE" }).slot)).toEqual([CENA_PURE.name]);
    expect(names(group({ query: "puré" }).slot)).toEqual([CENA_PURE.name]);
  });
});

describe("R2: groupRecipes y la sección ★ Favoritas", () => {
  it("las favoritas de la franja salen en ★ y no se repiten en la lista de la franja", () => {
    const g = group({ favorites: [CENA_PUERROS.id] });
    expect(names(g.favorites)).toEqual([CENA_PUERROS.name]);
    expect(names(g.slot)).not.toContain(CENA_PUERROS.name);
  });

  it("una favorita de otra franja no entra en ★ al elegir Cena", () => {
    const g = group({ favorites: [SNACK_YOGUR.id] });
    expect(g.favorites).toEqual([]);
  });

  it("con «Ver todas», ★ trae todas las favoritas de cualquier franja", () => {
    const g = group({ favorites: [SNACK_YOGUR.id, CENA_PUERROS.id], showAll: true });
    expect(names(g.favorites)).toEqual([CENA_PUERROS.name, SNACK_YOGUR.name]);
  });

  it("★ y la lista de la franja van A–Z (con tildes y mayúsculas del castellano)", () => {
    const g = group({ favorites: [CENA_ZARZUELA.id, CENA_ALCACHOFAS.id, CENA_QUESO.id, CENA_PURE.id] });
    expect(names(g.favorites)).toEqual([CENA_ALCACHOFAS.name, CENA_QUESO.name, CENA_PURE.name, CENA_ZARZUELA.name]);
    const sorted = [...names(g.slot)].sort((a, b) => a.localeCompare(b, "es"));
    expect(names(g.slot)).toEqual(sorted);
  });

  it("el buscador también filtra ★", () => {
    const g = group({ favorites: [CENA_PUERROS.id, CENA_ZARZUELA.id], query: "puerros" });
    expect(names(g.favorites)).toEqual([CENA_PUERROS.name]);
  });

  it("un id de favorita que ya no existe se ignora sin romper nada", () => {
    const g = group({ favorites: ["receta-borrada", CENA_PUERROS.id] });
    expect(names(g.favorites)).toEqual([CENA_PUERROS.name]);
  });

  it("sin favoritas, ★ queda vacía (la UI pinta la pista)", () => {
    expect(group().favorites).toEqual([]);
  });
});

describe("R3: groupRecipes y «Ver todas»", () => {
  it("«Ver todas» deja la franja primero y el resto en `others`, con la propia sin franja incluida", () => {
    const g = group({ showAll: true });
    expect(names(g.slot)).toContain(CENA_ZARZUELA.name);
    expect(names(g.others)).toEqual(
      expect.arrayContaining([COMIDA_LENTEJAS.name, SNACK_YOGUR.name, DESAYUNO_TOSTADA.name, SIN_FRANJA.name]),
    );
    // Lo de la franja no se repite en `others`
    expect(names(g.others)).not.toContain(CENA_ZARZUELA.name);
    expect(names(g.others)).not.toContain(DOBLE_COMIDA_CENA.name);
  });

  it("`others` va A–Z y el buscador lo filtra también", () => {
    const g = group({ showAll: true, query: "yogur" });
    expect(names(g.others)).toEqual([SNACK_YOGUR.name]);
    expect(names(g.slot)).toEqual([]);
  });

  it("sin «Ver todas» y con ≥5 recetas en la franja, `others` queda vacío", () => {
    expect(group().others).toEqual([]);
  });
});

describe("Edge: franja con menos de 5 recetas se completa con las de otras franjas", () => {
  const FEW: Recipe[] = [
    favRecipe("s1", "Batido A", ["snack"]),
    favRecipe("s2", "Batido B", ["snack"]),
    favRecipe("c1", "Cena X", ["cena"]),
    favRecipe("d1", "Desayuno X", ["desayuno"]),
  ];
  it("con 2 de snack, `others` trae el resto aunque no se pulse «Ver todas»", () => {
    const g = groupRecipes({ recipes: FEW, favorites: [], mealType: "Merienda", query: "", showAll: false });
    expect(names(g.slot)).toEqual(["Batido A", "Batido B"]);
    expect(names(g.others)).toEqual(["Cena X", "Desayuno X"]);
  });
  it("con 5 en la franja ya no se completa", () => {
    const five = Array.from({ length: 5 }, (_, i) => favRecipe(`s${i}`, `Snack ${i}`, ["snack"]));
    const g = groupRecipes({ recipes: [...five, FEW[2]], favorites: [], mealType: "Merienda", query: "", showAll: false });
    expect(g.others).toEqual([]);
  });
});

describe("Riesgo: el catálogo siempre tiene tag de franja", () => {
  it("cada receta de src/data/recipes.json lleva al menos uno de desayuno, comida, cena o snack", () => {
    const tags = ["desayuno", "comida", "cena", "snack"];
    const sinFranja = (seedData.recipes as Recipe[]).filter((r) => !r.tags.some((t) => tags.includes(t.toLowerCase())));
    expect(sinFranja.map((r) => r.name)).toEqual([]);
  });
});
