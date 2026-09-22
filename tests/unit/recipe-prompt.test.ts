// tech.md › Risks: "Sensitive data" — los datos corporales no se envían al route de recetas.
import { describe, expect, it } from "vitest";
import { toRecipeProfile } from "@/lib/recipePrompt";
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
