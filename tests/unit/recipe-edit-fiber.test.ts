// Spec: docs/pm/23-agua-fibra-micros/spec.md › R8 (formulario de receta propia: fibra opcional, 0–200 g).
// Tech: tech.md › Components & files (`RecipeDraft.fiber: string`, `validateRecipeDraft` en src/lib/recipeEdit.ts).
// Falla hasta construir la tarea 7.
import { describe, expect, it } from "vitest";
import { validateRecipeDraft, type RecipeDraft } from "@/lib/recipeEdit";

const base = {
  name: "Crema de calabaza",
  ingredients: "300g calabaza\n1 cebolla",
  instructions: "",
  prepTimeMinutes: "",
  calories: "180",
  protein: "",
  carbs: "",
  fat: "",
  tags: [],
};
const draft = (fiber: string) => ({ ...base, fiber }) as RecipeDraft;

describe("R8: fibra en el formulario de receta propia", () => {
  it("vacía = sin dato: la receta no lleva la propiedad fiber", () => {
    const v = validateRecipeDraft(draft(""));
    if (!v.ok) throw new Error("debería ser válido");
    expect(v.recipe).not.toHaveProperty("fiber");
  });

  it("un valor con coma o punto se guarda como número", () => {
    for (const [text, n] of [["2,5", 2.5], ["14", 14], ["2.5", 2.5]] as const) {
      const v = validateRecipeDraft(draft(text));
      if (!v.ok) throw new Error(`«${text}» debería ser válido`);
      expect(v.recipe.fiber, text).toBe(n);
    }
  });

  it("0 escrito explícitamente se guarda como 0 (es un dato)", () => {
    const v = validateRecipeDraft(draft("0"));
    if (!v.ok) throw new Error("debería ser válido");
    expect(v.recipe.fiber).toBe(0);
  });

  it("fuera de 0–200 o no numérico es un error en el campo fiber", () => {
    for (const bad of ["201", "-1", "mucha"]) {
      const v = validateRecipeDraft(draft(bad));
      expect(v.ok, bad).toBe(false);
      if (!v.ok) expect(v.errors.fiber, bad).toBeTruthy();
    }
  });
});
