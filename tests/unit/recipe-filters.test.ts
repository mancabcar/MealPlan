// Spec: docs/pm/111-recetas-valoracion-filtros/spec.md › R3 (filtros de tiempo, kcal y proteína), R4 (ocultar alérgenos),
// R5 (orden) y R7 (contador de filtros activos). Tech: tech.md › APIs / interfaces (`filterRecipes`, `sortRecipes`,
// `countActiveFilters`, tramos). Lógica pura, sin DOM. Fallan hasta la tarea 2 del tech design.
import { describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import {
  countActiveFilters,
  filterRecipes,
  KCAL_STEPS,
  PROTEIN_STEPS,
  sortRecipes,
  TIME_STEPS,
  type RecipeFilterState,
} from "@/lib/recipeFilters";
import type { Recipe } from "@/lib/types";
import {
  NO_ALLERGIES,
  NUTS_ALLERGY,
  V1_TOSTA,
  V2_BOWL,
  V3_POLLO,
  V4_SALMON,
  V5_TERNERA,
  V6_ESTOFADO,
  V7_VACIA,
  V8_EMPATE,
  VAL_RATINGS,
  VAL_RECIPES,
} from "../fixtures/valoracion";

const NONE: RecipeFilterState = { maxTime: null, maxKcal: null, minProtein: null, hideAllergens: false };
const ids = (list: Recipe[]) => list.map((r) => r.id);
const idsOf = (...rs: Recipe[]) => rs.map((r) => r.id);
const names = (list: Recipe[]) => list.map((r) => r.name.slice(0, 2));

describe("R3: tramos de los chips", () => {
  it("tiempo ≤15/30/45 min, kcal ≤300/400/500 y proteína ≥20/30/40 g", () => {
    expect(TIME_STEPS).toEqual([15, 30, 45]);
    expect(KCAL_STEPS).toEqual([300, 400, 500]);
    expect(PROTEIN_STEPS).toEqual([20, 30, 40]);
  });

  it("con el catálogo real cada tramo deja al menos 10 recetas y no las deja todas", () => {
    const catalog = seedData.recipes as Recipe[];
    for (const t of TIME_STEPS) {
      const n = filterRecipes(catalog, { ...NONE, maxTime: t }, undefined).length;
      expect(n, `≤${t} min`).toBeGreaterThanOrEqual(10);
      expect(n, `≤${t} min`).toBeLessThan(catalog.length);
    }
    for (const k of KCAL_STEPS) {
      const n = filterRecipes(catalog, { ...NONE, maxKcal: k }, undefined).length;
      expect(n, `≤${k} kcal`).toBeGreaterThanOrEqual(10);
      expect(n, `≤${k} kcal`).toBeLessThan(catalog.length);
    }
    for (const p of PROTEIN_STEPS) {
      const n = filterRecipes(catalog, { ...NONE, minProtein: p }, undefined).length;
      expect(n, `≥${p} g`).toBeGreaterThanOrEqual(10);
      expect(n, `≥${p} g`).toBeLessThan(catalog.length);
    }
  });
});

describe("R3: filterRecipes", () => {
  it("sin filtros devuelve todas, en el mismo orden", () => {
    expect(ids(filterRecipes(VAL_RECIPES, NONE, NO_ALLERGIES))).toEqual(ids(VAL_RECIPES));
  });

  it("tiempo máximo: incluye el valor del borde y excluye lo que lo supera", () => {
    const out = ids(filterRecipes(VAL_RECIPES, { ...NONE, maxTime: 30 }, NO_ALLERGIES));
    expect(out.sort()).toEqual(idsOf(V1_TOSTA, V2_BOWL, V3_POLLO, V4_SALMON, V7_VACIA, V8_EMPATE).sort());
    const out15 = ids(filterRecipes(VAL_RECIPES, { ...NONE, maxTime: 15 }, NO_ALLERGIES));
    expect(out15.sort()).toEqual(idsOf(V1_TOSTA, V2_BOWL, V7_VACIA).sort());
  });

  it("kcal máximas: incluye el borde", () => {
    const out = ids(filterRecipes(VAL_RECIPES, { ...NONE, maxKcal: 400 }, NO_ALLERGIES));
    expect(out.sort()).toEqual(idsOf(V1_TOSTA, V2_BOWL, V3_POLLO, V7_VACIA).sort());
  });

  it("proteína mínima: incluye el borde", () => {
    const out = ids(filterRecipes(VAL_RECIPES, { ...NONE, minProtein: 30 }, NO_ALLERGIES));
    expect(out.sort()).toEqual(idsOf(V3_POLLO, V4_SALMON, V5_TERNERA, V8_EMPATE).sort());
  });

  it("los tres filtros se combinan (≤30 min y ≥30 g)", () => {
    const out = ids(filterRecipes(VAL_RECIPES, { ...NONE, maxTime: 30, minProtein: 30 }, NO_ALLERGIES));
    expect(out.sort()).toEqual(idsOf(V3_POLLO, V4_SALMON, V8_EMPATE).sort());
    const all = ids(filterRecipes(VAL_RECIPES, { ...NONE, maxTime: 30, maxKcal: 400, minProtein: 30 }, NO_ALLERGIES));
    expect(all).toEqual(idsOf(V3_POLLO));
  });

  it("una receta sin dato (0 guardado) se compara con ese 0: pasa tiempo y kcal, no pasa proteína mínima", () => {
    expect(ids(filterRecipes([V7_VACIA], { ...NONE, maxTime: 15, maxKcal: 300 }, NO_ALLERGIES))).toEqual(idsOf(V7_VACIA));
    expect(filterRecipes([V7_VACIA], { ...NONE, minProtein: 20 }, NO_ALLERGIES)).toEqual([]);
  });

  it("un campo ausente (propia sin proteína) cuenta como 0", () => {
    const sinProteina = { ...V2_BOWL, id: "x", protein: undefined } as unknown as Recipe;
    expect(filterRecipes([sinProteina], { ...NONE, minProtein: 20 }, NO_ALLERGIES)).toEqual([]);
    expect(filterRecipes([sinProteina], { ...NONE, maxKcal: 300 }, NO_ALLERGIES)).toHaveLength(1);
  });

  it("no modifica la lista original", () => {
    const copy = [...VAL_RECIPES];
    filterRecipes(VAL_RECIPES, { ...NONE, maxTime: 15 }, NO_ALLERGIES);
    expect(VAL_RECIPES).toEqual(copy);
  });
});

describe("R4: ocultar alérgenos", () => {
  it("con el interruptor activo quita las recetas con un alérgeno del perfil", () => {
    const out = ids(filterRecipes(VAL_RECIPES, { ...NONE, hideAllergens: true }, NUTS_ALLERGY));
    expect(out).not.toContain(V4_SALMON.id);
    expect(out).toHaveLength(VAL_RECIPES.length - 1);
  });

  it("con el interruptor apagado no quita nada aunque haya alergias", () => {
    expect(filterRecipes(VAL_RECIPES, NONE, NUTS_ALLERGY)).toHaveLength(VAL_RECIPES.length);
  });

  it("activo pero sin alergias (o sin perfil) no quita nada", () => {
    expect(filterRecipes(VAL_RECIPES, { ...NONE, hideAllergens: true }, NO_ALLERGIES)).toHaveLength(VAL_RECIPES.length);
    expect(filterRecipes(VAL_RECIPES, { ...NONE, hideAllergens: true }, undefined)).toHaveLength(VAL_RECIPES.length);
  });

  it("se combina con los demás filtros", () => {
    const out = ids(filterRecipes(VAL_RECIPES, { ...NONE, maxTime: 30, minProtein: 30, hideAllergens: true }, NUTS_ALLERGY));
    expect(out.sort()).toEqual(idsOf(V3_POLLO, V8_EMPATE).sort());
  });
});

describe("R5: sortRecipes", () => {
  it("A–Z por nombre", () => {
    expect(names(sortRecipes(VAL_RECIPES, "name", {}))).toEqual(["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"]);
  });

  it("proteína de mayor a menor, con empate por nombre", () => {
    expect(names(sortRecipes(VAL_RECIPES, "protein", {}))).toEqual(["V5", "V4", "V3", "V8", "V2", "V1", "V6", "V7"]);
  });

  it("kcal de menor a mayor", () => {
    expect(names(sortRecipes(VAL_RECIPES, "kcal", {}))).toEqual(["V7", "V1", "V2", "V3", "V8", "V4", "V5", "V6"]);
  });

  it("tiempo de menor a mayor, con empate por nombre", () => {
    expect(names(sortRecipes(VAL_RECIPES, "time", {}))).toEqual(["V7", "V1", "V2", "V8", "V3", "V4", "V5", "V6"]);
  });

  it("valoración de mayor a menor, empate por nombre y las sin valorar al final (A–Z)", () => {
    expect(names(sortRecipes(VAL_RECIPES, "rating", VAL_RATINGS))).toEqual(["V5", "V1", "V3", "V2", "V4", "V6", "V7", "V8"]);
  });

  it("valoración sin ninguna nota: queda A–Z", () => {
    expect(names(sortRecipes(VAL_RECIPES, "rating", {}))).toEqual(["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"]);
  });

  it("el nombre se compara en español (la Ñ va tras la N)", () => {
    const a = { ...V1_TOSTA, id: "a", name: "Ñoquis" };
    const b = { ...V1_TOSTA, id: "b", name: "Nata" };
    const c = { ...V1_TOSTA, id: "c", name: "Olla" };
    expect(sortRecipes([a, c, b], "name", {}).map((r) => r.name)).toEqual(["Nata", "Ñoquis", "Olla"]);
  });

  it("no modifica la lista original", () => {
    const copy = [...VAL_RECIPES];
    sortRecipes(VAL_RECIPES, "protein", {});
    expect(VAL_RECIPES).toEqual(copy);
  });
});

describe("R7: countActiveFilters", () => {
  it("cuenta tiempo, kcal, proteína y alérgenos activos", () => {
    expect(countActiveFilters(NONE)).toBe(0);
    expect(countActiveFilters({ ...NONE, maxTime: 30 })).toBe(1);
    expect(countActiveFilters({ maxTime: 30, maxKcal: 400, minProtein: 30, hideAllergens: false })).toBe(3);
    expect(countActiveFilters({ maxTime: 30, maxKcal: 400, minProtein: 30, hideAllergens: true })).toBe(4);
    expect(countActiveFilters({ ...NONE, hideAllergens: true })).toBe(1);
  });
});
