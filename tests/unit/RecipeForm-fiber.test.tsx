// @vitest-environment jsdom
// Spec: docs/pm/23-agua-fibra-micros/spec.md › R8. Tech: tech.md › UI.
// Contrato (acordado con Manuel): el formulario de RecipeForm gana el campo «Fibra (g)» (opcional) junto a «Grasas (g)».
// Falla hasta construir la tarea 7.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipeForm } from "@/components/recetas/RecipeForm";
import type { Recipe } from "@/lib/types";
import { LENTEJAS_FIBRA } from "../fixtures/fibra";

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof RecipeForm>> = {}) {
  const onSave = vi.fn();
  render(<RecipeForm suggestedTags={[]} onSave={onSave} onClose={vi.fn()} {...props} />);
  const dialog = screen.getByRole("dialog", { name: props.recipe ? "Editar receta" : "Nueva receta" });
  const fill = (label: string, value: string) => fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  const save = () => fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
  return { onSave, dialog, fill, save };
}

describe("R8: campo de fibra en el formulario de receta", () => {
  it("«Fibra (g)» existe y está vacío en una receta nueva", () => {
    const { dialog } = setup();
    expect((within(dialog).getByLabelText("Fibra (g)") as HTMLInputElement).value).toBe("");
  });

  it("al guardar con fibra «6,5» la receta lleva fiber 6.5", () => {
    const { onSave, fill, save } = setup();
    fill("Nombre", "Crema de calabaza");
    fill("Ingredientes", "300g calabaza");
    fill("Calorías (kcal)", "180");
    fill("Fibra (g)", "6,5");
    save();
    expect((onSave.mock.calls[0][0] as Recipe).fiber).toBe(6.5);
  });

  it("al guardar con la fibra vacía la receta no lleva fiber", () => {
    const { onSave, fill, save } = setup();
    fill("Nombre", "Crema de calabaza");
    fill("Ingredientes", "300g calabaza");
    fill("Calorías (kcal)", "180");
    save();
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("fiber");
  });

  it("al editar una receta con fibra, el campo la muestra", () => {
    const { dialog } = setup({ recipe: { ...LENTEJAS_FIBRA, isCustom: true } });
    expect((within(dialog).getByLabelText("Fibra (g)") as HTMLInputElement).value).toBe("14");
  });

  it("una fibra fuera de 0–200 no guarda y muestra un error", () => {
    const { onSave, dialog, fill, save } = setup();
    fill("Nombre", "Crema de calabaza");
    fill("Ingredientes", "300g calabaza");
    fill("Calorías (kcal)", "180");
    fill("Fibra (g)", "250");
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert")).toBeTruthy();
  });
});
