// @vitest-environment jsdom
// Spec: docs/pm/18-recetas-propias/spec.md › Acceptance criteria R1, R4, R7 (formulario), R10.
// Tech: docs/pm/18-recetas-propias/tech.md › UI. Contrato del componente (`src/components/recetas/RecipeForm.tsx`, export
// nombrado), acordado con Manuel:
//   <RecipeForm recipe?={Recipe} suggestedTags={string[]} onSave={(r: Recipe) => void} onClose={() => void} />
//   - Va dentro de un Sheet: role="dialog", nombre "Nueva receta" (sin `recipe`) o "Editar receta" (con `recipe`).
//   - Campos por etiqueta: "Nombre", "Ingredientes" y "Pasos" (textarea, una línea por elemento), "Tiempo (min)",
//     "Calorías (kcal)", "Proteínas (g)", "Carbos (g)", "Grasas (g)" y "Etiquetas" (input: Enter añade la etiqueta).
//   - Con P/C/G rellenos aparece el botón "Usar N kcal" (N = 4P + 4C + 9G) que rellena "Calorías (kcal)".
//   - Etiquetas sugeridas: un botón por etiqueta con aria-pressed; se marcan/desmarcan al pulsar.
//   - "Guardar" valida con validateRecipeDraft: si falla no llama a onSave y muestra los errores en role="alert".
//     Si va bien llama a onSave con la receta: con `recipe` conserva su id y marcas (isCustom, isAIGenerated); sin
//     `recipe` id `custom_<uuid>` e isCustom: true.
// Fallan hasta que exista el componente (tarea 3 del tech design).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipeForm } from "@/components/recetas/RecipeForm";
import { duplicateRecipe } from "@/lib/recipeEdit";
import { IA_WRAP, MACARRONES_MAMA, SEMILLA_TORTILLA } from "../fixtures/recetas-propias";

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof RecipeForm>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<RecipeForm suggestedTags={["comida", "bowl", "rápido"]} onSave={onSave} onClose={onClose} {...props} />);
  const dialog = screen.getByRole("dialog", { name: props.recipe ? "Editar receta" : "Nueva receta" });
  const field = (label: string) => within(dialog).getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
  const fill = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
  const save = () => fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
  return { onSave, onClose, dialog, field, fill, save };
}

function fillMinimum(fill: (label: string, value: string) => void) {
  fill("Nombre", "Crema de calabaza");
  fill("Ingredientes", "300g calabaza\n1 cebolla");
  fill("Calorías (kcal)", "180");
}

describe("R1: crear una receta con el formulario", () => {
  it("se abre como 'Nueva receta' con los campos vacíos", () => {
    const { dialog, field } = setup();
    expect(dialog).toBeTruthy(); // setup() lo busca por su nombre accesible "Nueva receta"
    for (const label of ["Nombre", "Ingredientes", "Pasos", "Tiempo (min)", "Calorías (kcal)", "Proteínas (g)", "Carbos (g)", "Grasas (g)", "Etiquetas"]) {
      expect(field(label).value, label).toBe("");
    }
  });

  it("con nombre, ingredientes y kcal guarda una receta propia nueva: id custom_, isCustom, líneas separadas y valores por defecto", () => {
    const { onSave, fill, save } = setup();
    fillMinimum(fill);
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: "Crema de calabaza",
      ingredients: ["300g calabaza", "1 cebolla"],
      instructions: [],
      prepTimeMinutes: 0,
      calories: 180,
      protein: 0,
      carbs: 0,
      fat: 0,
      tags: [],
      isCustom: true,
    });
    expect(saved.id).toMatch(/^custom_.+/);
    expect(saved).not.toHaveProperty("isAIGenerated");
  });

  it("guarda todos los campos cuando están rellenos, con etiquetas sugeridas y escritas a mano", () => {
    const { onSave, dialog, fill, field, save } = setup();
    fillMinimum(fill);
    fill("Pasos", "Trocear.\nCocer.");
    fill("Tiempo (min)", "30");
    fill("Proteínas (g)", "5,5");
    fill("Carbos (g)", "25");
    fill("Grasas (g)", "6");
    fireEvent.click(within(dialog).getByRole("button", { name: "bowl" }));
    fireEvent.change(field("Etiquetas"), { target: { value: "cena" } });
    fireEvent.keyDown(field("Etiquetas"), { key: "Enter" });
    save();
    expect(onSave.mock.calls[0][0]).toMatchObject({
      instructions: ["Trocear.", "Cocer."],
      prepTimeMinutes: 30,
      protein: 5.5,
      carbs: 25,
      fat: 6,
      tags: ["bowl", "cena"],
    });
  });

  it("sin nombre, sin ingredientes o sin kcal no guarda y muestra el error en un role=alert", () => {
    const { onSave, dialog, fill, save } = setup();
    fill("Nombre", "Crema de calabaza");
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(within(dialog).getAllByRole("alert").length).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText("Ingredientes").getAttribute("aria-invalid")).toBe("true");
    expect(within(dialog).getByLabelText("Calorías (kcal)").getAttribute("aria-invalid")).toBe("true");
  });

  it("un valor no numérico o negativo en un macro no guarda", () => {
    const { onSave, fill, save } = setup();
    fillMinimum(fill);
    fill("Proteínas (g)", "-3");
    save();
    expect(onSave).not.toHaveBeenCalled();
    fill("Proteínas (g)", "mucho");
    save();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("'Cerrar' o Escape llaman a onClose sin guardar", () => {
    const { onSave, onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("R10: sugerencia de kcal", () => {
  it("con P/C/G rellenos ofrece 'Usar N kcal' (4P + 4C + 9G) y al pulsarlo rellena las calorías, que siguen siendo editables", () => {
    const { dialog, fill, field } = setup();
    fill("Proteínas (g)", "32");
    fill("Carbos (g)", "45");
    fill("Grasas (g)", "18");
    fireEvent.click(within(dialog).getByRole("button", { name: "Usar 470 kcal" }));
    expect(field("Calorías (kcal)").value).toBe("470");
    fill("Calorías (kcal)", "480");
    expect(field("Calorías (kcal)").value).toBe("480");
  });

  it("sin P/C/G no hay sugerencia", () => {
    const { dialog } = setup();
    expect(within(dialog).queryByRole("button", { name: /^Usar .* kcal$/ })).toBeNull();
  });
});

describe("R2: editar una receta existente", () => {
  it("se abre como 'Editar receta' precargado con todos sus datos", () => {
    const { dialog, field } = setup({ recipe: MACARRONES_MAMA });
    expect(dialog).toBeTruthy(); // setup() lo busca por su nombre accesible "Editar receta"
    expect(field("Nombre").value).toBe("Macarrones de mamá");
    expect(field("Ingredientes").value).toBe(MACARRONES_MAMA.ingredients.join("\n"));
    expect(field("Pasos").value).toBe(MACARRONES_MAMA.instructions.join("\n"));
    expect(field("Tiempo (min)").value).toBe("25");
    expect(field("Calorías (kcal)").value).toBe("480");
    expect(field("Proteínas (g)").value).toBe("32");
    expect(field("Carbos (g)").value).toBe("45");
    expect(field("Grasas (g)").value).toBe("18");
  });

  it("al guardar conserva el id y la marca de la receta y aplica los cambios", () => {
    const { onSave, fill, save } = setup({ recipe: MACARRONES_MAMA });
    fill("Calorías (kcal)", "500");
    save();
    expect(onSave.mock.calls[0][0]).toEqual({ ...MACARRONES_MAMA, calories: 500 });
  });

  it("una receta de IA conserva su marca isAIGenerated al editarla", () => {
    const { onSave, fill, save } = setup({ recipe: IA_WRAP });
    fill("Nombre", "Wrap de atún y maíz");
    save();
    expect(onSave.mock.calls[0][0]).toEqual({ ...IA_WRAP, name: "Wrap de atún y maíz" });
  });

  it("las etiquetas de la receta aparecen marcadas y se pueden quitar", () => {
    const { dialog, onSave, save } = setup({ recipe: MACARRONES_MAMA, suggestedTags: ["comida", "pasta", "bowl"] });
    expect(within(dialog).getByRole("button", { name: "pasta" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: "pasta" }));
    save();
    expect(onSave.mock.calls[0][0].tags).toEqual(["comida"]);
  });
});

describe("R4: Duplicar y editar una semilla", () => {
  it("el formulario precargado con la copia guarda una receta propia nueva y la semilla no cambia", () => {
    const copy = duplicateRecipe(SEMILLA_TORTILLA, "custom_copia");
    const { onSave, field, save } = setup({ recipe: copy });
    expect(field("Nombre").value).toBe("Tortilla de claras con verduras (copia)");
    expect(field("Calorías (kcal)").value).toBe("180");
    expect(field("Ingredientes").value).toBe(SEMILLA_TORTILLA.ingredients.join("\n"));
    save();
    expect(onSave.mock.calls[0][0]).toEqual(copy);
    expect(SEMILLA_TORTILLA).not.toHaveProperty("isCustom");
  });
});
