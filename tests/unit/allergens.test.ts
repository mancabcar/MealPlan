// Spec: docs/pm/onboarding-profile/spec.md › "Allergen families (R10, R18)" y edge cases.
import { describe, expect, it } from "vitest";
import { ALLERGEN_FAMILIES, ingredientMatches, normalize, recipeViolations } from "@/lib/allergens";
import type { PresetAllergen } from "@/lib/types";

describe("normalize", () => {
  it("ignora mayúsculas, acentos y espacios de más", () => {
    expect(normalize("  Piñón  TOSTADO ")).toBe("pinon tostado");
    expect(normalize("Cuscús")).toBe("cuscus");
  });
});

describe("R18: cada término de la familia cuenta como su alérgeno", () => {
  const cases = Object.entries(ALLERGEN_FAMILIES).flatMap(([allergen, terms]) =>
    terms.map((term) => [allergen as PresetAllergen, term] as const),
  );
  it.each(cases)("%s ⊃ '%s'", (allergen, term) => {
    expect(ingredientMatches(`100 g de ${term}`, allergen)).toBe(true);
  });
});

describe("R18: plurales, mayúsculas y acentos", () => {
  it.each([
    ["almendras laminadas", "frutos_secos"],
    ["Nueces", "frutos_secos"],
    ["30 g de piñones", "frutos_secos"],
    ["Nuez de Brasil picada", "frutos_secos"],
    ["gambas peladas", "marisco"],
    ["mejillones al vapor", "marisco"],
    ["2 huevos", "huevo"],
    ["2 yogures naturales", "lactosa"],
    ["CUSCUS integral", "gluten"],
    ["Tofu firme", "soja"],
  ] as const)("'%s' coincide con %s", (ingredient, allergen) => {
    expect(ingredientMatches(ingredient, allergen)).toBe(true);
  });
});

describe("R18: coincide por palabras completas, no por subcadenas", () => {
  it.each([
    ["150 g de panceta", "gluten"],
    ["pimienta negra", "gluten"],
    ["arroz basmati", "gluten"],
    ["pechuga de pollo", "lactosa"],
    ["aceite de oliva", "frutos_secos"],
  ] as const)("'%s' NO coincide con %s", (ingredient, allergen) => {
    expect(ingredientMatches(ingredient, allergen)).toBe(false);
  });
});

describe("Edge case: productos 'sin <alérgeno>'", () => {
  it("'leche sin lactosa' y 'queso sin lactosa' no cuentan como Lactosa", () => {
    expect(ingredientMatches("200 ml de leche sin lactosa", "lactosa")).toBe(false);
    expect(ingredientMatches("queso sin lactosa rallado", "lactosa")).toBe(false);
  });

  it("'pan sin gluten' no cuenta como Gluten", () => {
    expect(ingredientMatches("2 rebanadas de pan sin gluten", "gluten")).toBe(false);
  });

  it("'sin' solo excluye el alérgeno que nombra: 'yogur sin azúcar' sigue siendo Lactosa", () => {
    expect(ingredientMatches("yogur sin azúcar", "lactosa")).toBe(true);
  });

  // Hallazgo de la revisión de la PR #2: el "sin" eximía a toda la línea
  it("el 'sin' solo exime al producto que acompaña, no al resto de la línea", () => {
    expect(ingredientMatches("nata y leche sin lactosa", "lactosa")).toBe(true);
    expect(ingredientMatches("pasta y pan sin gluten", "gluten")).toBe(true);
    expect(ingredientMatches("bizcocho de almendra sin gluten", "frutos_secos")).toBe(true);
  });
});

describe("Edge case: falsos positivos aceptados (mejor excluir de más)", () => {
  it("'leche de coco' cuenta como Lactosa", () => {
    expect(ingredientMatches("leche de coco", "lactosa")).toBe(true);
  });
});

describe("R18: alérgenos libres", () => {
  it("coinciden solo con su propio nombre, con plurales y sin acentos", () => {
    expect(ingredientMatches("2 kiwis", "Kiwi")).toBe(true);
    expect(ingredientMatches("Kiwi en dados", "kiwi")).toBe(true);
    expect(ingredientMatches("fresas", "Kiwi")).toBe(false);
  });
});

describe("R18: recipeViolations", () => {
  const safe = { name: "Pollo al horno con verduras", ingredients: ["pechuga de pollo", "calabacín", "aceite de oliva"] };

  it("receta segura → sin infracciones", () => {
    expect(recipeViolations(safe, { preset: ["frutos_secos", "gluten"], custom: [] })).toEqual([]);
  });

  it("detecta alérgenos preset en los ingredientes", () => {
    const r = { name: "Ensalada crujiente", ingredients: ["lechuga", "almendras laminadas"] };
    expect(recipeViolations(r, { preset: ["frutos_secos"], custom: [] }).length).toBeGreaterThan(0);
  });

  it("también revisa el nombre de la receta", () => {
    const r = { name: "Tarta de almendra", ingredients: ["azúcar", "limón"] };
    expect(recipeViolations(r, { preset: ["frutos_secos"], custom: [] }).length).toBeGreaterThan(0);
  });

  it("detecta alérgenos libres", () => {
    const r = { name: "Macedonia", ingredients: ["2 kiwis", "fresas"] };
    expect(recipeViolations(r, { preset: [], custom: ["Kiwi"] }).length).toBeGreaterThan(0);
  });

  it("sin alergias declaradas, nada infringe", () => {
    const r = { name: "Tarta de almendra", ingredients: ["almendra molida", "huevos"] };
    expect(recipeViolations(r, { preset: [], custom: [] })).toEqual([]);
  });
});
