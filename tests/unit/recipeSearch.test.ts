// Spec: docs/pm/combobox-recetas/spec.md › R2 (Recetas en orden A–Z) y R3 (búsqueda sin tildes ni mayúsculas, por nombre
// o etiqueta). Tech: docs/pm/combobox-recetas/tech.md › Components & files: src/lib/recipeSearch.ts (searchRecipes,
// sortByName; puras). Fallan hasta la tarea 2.
import { describe, expect, it } from "vitest";
import { searchRecipes, sortByName } from "@/lib/recipeSearch";
import { favRecipe } from "../fixtures/favoritos";

const PURE = favRecipe("a", "Puré de calabaza", ["cena", "vegetariano"]);
const POLLO = favRecipe("b", "Pollo al limón", ["comida", "Alto en proteína"]);
const ZARZUELA = favRecipe("c", "Zarzuela de pescado", ["Cena"]);
const ALCACHOFAS = favRecipe("d", "Alcachofas al horno", ["cena"]);
const NOQUIS = favRecipe("e", "Ñoquis de patata", ["comida"]);
const ALL = [ZARZUELA, PURE, NOQUIS, POLLO, ALCACHOFAS];

describe("R2: sortByName", () => {
  it("ordena A–Z en español (la Ñ va después de la N, no al final)", () => {
    expect(sortByName([ZARZUELA, NOQUIS, PURE, ALCACHOFAS]).map((r) => r.name)).toEqual([
      "Alcachofas al horno",
      "Ñoquis de patata",
      "Puré de calabaza",
      "Zarzuela de pescado",
    ]);
  });

  it("no modifica la lista original", () => {
    const copy = [...ALL];
    sortByName(ALL);
    expect(ALL).toEqual(copy);
  });
});

describe("R3: searchRecipes", () => {
  it("«pure», «PURE» y «puré» encuentran «Puré de calabaza»", () => {
    for (const q of ["pure", "PURE", "puré"]) expect(searchRecipes(ALL, q)).toEqual([PURE]);
  });

  it("busca por etiqueta sin distinguir mayúsculas: «cena» encuentra las de cena", () => {
    expect(
      searchRecipes(ALL, "cena")
        .map((r) => r.id)
        .sort(),
    ).toEqual(["a", "c", "d"]);
  });

  it("busca por etiqueta con tildes: «proteina» encuentra «Alto en proteína»", () => {
    expect(searchRecipes(ALL, "proteina")).toEqual([POLLO]);
  });

  it("consulta vacía o solo espacios → todas", () => {
    expect(searchRecipes(ALL, "")).toEqual(ALL);
    expect(searchRecipes(ALL, "  ")).toEqual(ALL);
  });

  it("sin coincidencias → lista vacía", () => {
    expect(searchRecipes(ALL, "salmón")).toEqual([]);
  });
});
