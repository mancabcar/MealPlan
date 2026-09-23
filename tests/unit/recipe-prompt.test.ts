// tech.md › Risks: "Sensitive data" — los datos corporales no se envían al route de recetas.
import { describe, expect, it } from "vitest";
import { buildRecipePrompt, toRecipeProfile } from "@/lib/recipePrompt";
import { lucia, manuel } from "../fixtures/profiles";

describe("toRecipeProfile", () => {
  it("no incluye sexo, año de nacimiento, altura ni peso", () => {
    const sent = toRecipeProfile(lucia);
    expect(sent).not.toHaveProperty("body");
    expect(sent).not.toHaveProperty("weightKg");
    expect(sent).not.toHaveProperty("name");
    expect(JSON.stringify(sent)).not.toMatch(/1992|165|female/);
  });

  it("R17: con rango envía el punto medio como proteína", () => {
    expect(toRecipeProfile(manuel).proteinGoal).toBe(150);
    expect(toRecipeProfile(manuel)).not.toHaveProperty("weightKg");
  });
});

// docs/pm/lista-compra/tech.md › "AI recipe prompt": formato de ingredientes que el parser de la lista entiende sin ruido.
describe("formato de ingredientes para la lista de la compra", () => {
  it("pide cantidad + unidad + ingrediente, uno por línea, sin alternativas", () => {
    const prompt = buildRecipePrompt(toRecipeProfile(lucia), [], 3);
    expect(prompt).toContain('"<cantidad> <unidad> de <ingrediente>"');
    expect(prompt).toContain("Un ingrediente por línea");
    expect(prompt).not.toContain("ingrediente 1");
  });
});
