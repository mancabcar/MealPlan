// @vitest-environment jsdom
// Spec: docs/pm/19-importar-receta-url/spec.md › R2, R4, R5, R8, R9 (formulario). Tech: tech.md › UI.
// Contrato de `src/components/recetas/RecipeForm.tsx` con la prop nueva (acordado con Manuel):
//   <RecipeForm imported?={{ recipe, source, sourceUrl, servingsHint? }} … />
//   - `recipe`: lo que devuelve la ruta (name, ingredients: string[], instructions: string[], prepTimeMinutes?, calories?,
//     protein?, carbs?, fat?); `source`: "jsonld" | "ai"; `sourceUrl`: la URL pegada; `servingsHint`: "4".
//   - Es una receta NUEVA: role="dialog" "Nueva receta", campos prerrellenados (una línea por ingrediente y paso), los
//     macros que faltan quedan vacíos y no se inventan. No llama a onSave hasta pulsar "Guardar" (R5).
//   - Avisos en role="status" dentro del diálogo:
//       source "ai"  → "Macros estimados por IA: revísalos."
//       servingsHint → "La web indica N raciones: revisa que los macros sean por ración."
//   - Al guardar: id custom_<uuid>, isCustom: true, sourceUrl, y macrosEstimated: true solo si source es "ai" y no se ha
//     cambiado ninguno de kcal, proteínas, carbos o grasas. Con source "jsonld" no hay macrosEstimated.
//   - Editar una receta ya guardada con macrosEstimated (prop `recipe`): si se cambia kcal/P/C/G se quita la marca; si
//     solo cambia el nombre, los pasos, etc., se conserva. sourceUrl se conserva siempre.
// Fallan hasta que el componente acepte `imported` (tarea 5 del tech design).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipeForm } from "@/components/recetas/RecipeForm";
import type { Recipe } from "@/lib/types";
import { CALABAZA_AI, LENTEJAS_IMPORTED, RECIPE_URL } from "../fixtures/importar-receta";

afterEach(cleanup);

type Imported = NonNullable<React.ComponentProps<typeof RecipeForm>["imported"]>;

const AI: Imported = { recipe: CALABAZA_AI, source: "ai", sourceUrl: RECIPE_URL };
const JSONLD: Imported = { recipe: LENTEJAS_IMPORTED, source: "jsonld", sourceUrl: RECIPE_URL, servingsHint: "4" };

function setup(props: Partial<React.ComponentProps<typeof RecipeForm>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<RecipeForm suggestedTags={["comida", "bowl"]} onSave={onSave} onClose={onClose} {...props} />);
  const dialog = screen.getByRole("dialog", { name: props.recipe ? "Editar receta" : "Nueva receta" });
  const field = (label: string) => within(dialog).getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
  const fill = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
  const save = () => fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
  const notices = () => within(dialog).queryAllByRole("status").map((n) => n.textContent ?? "");
  return { onSave, onClose, dialog, field, fill, save, notices };
}

describe("R1/R2: el formulario se abre prerrellenado con lo importado", () => {
  it("es 'Nueva receta' y trae nombre, ingredientes, pasos, tiempo y macros de la web", () => {
    const { field } = setup({ imported: JSONLD });
    expect(field("Nombre").value).toBe("Lentejas con verduras");
    expect(field("Ingredientes").value).toBe(LENTEJAS_IMPORTED.ingredients.join("\n"));
    expect(field("Pasos").value).toBe(LENTEJAS_IMPORTED.instructions.join("\n"));
    expect(field("Tiempo (min)").value).toBe("45");
    expect(field("Calorías (kcal)").value).toBe("420");
    expect(field("Proteínas (g)").value).toBe("24");
    expect(field("Carbos (g)").value).toBe("58");
    expect(field("Grasas (g)").value).toBe("10");
  });

  it("R2: los macros que la web no trae quedan vacíos y hay que rellenar las kcal para guardar", () => {
    const recipe = { ...LENTEJAS_IMPORTED, calories: undefined, protein: undefined, carbs: undefined, fat: undefined };
    const { field, onSave, save, dialog } = setup({ imported: { ...JSONLD, recipe } });
    expect(field("Nombre").value).toBe("Lentejas con verduras");
    for (const label of ["Calorías (kcal)", "Proteínas (g)", "Carbos (g)", "Grasas (g)"]) expect(field(label).value, label).toBe("");
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(within(dialog).getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("no asigna etiquetas (las elige el usuario)", () => {
    const { onSave, save } = setup({ imported: JSONLD });
    save();
    expect(onSave.mock.calls[0][0].tags).toEqual([]);
  });

  it("R2: una importación por JSON-LD no lleva aviso de macros estimados", () => {
    const { notices } = setup({ imported: { ...JSONLD, servingsHint: undefined } });
    expect(notices().join(" ")).not.toMatch(/estimados/i);
  });
});

describe("R4: macros estimados por IA", () => {
  it("muestra el aviso 'Macros estimados por IA: revísalos.' durante la revisión", () => {
    const { notices } = setup({ imported: AI });
    expect(notices()).toContain("Macros estimados por IA: revísalos.");
  });

  it("al guardar sin tocar los macros la receta lleva macrosEstimated y la URL de origen", () => {
    const { onSave, save } = setup({ imported: AI });
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: Recipe = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: "Sopa de calabaza al curry",
      calories: 180,
      protein: 5,
      carbs: 28,
      fat: 6,
      isCustom: true,
      macrosEstimated: true,
      sourceUrl: RECIPE_URL,
    });
    expect(saved.id).toMatch(/^custom_.+/);
  });

  it("cambiar solo el nombre o los pasos no quita la marca", () => {
    const { onSave, fill, save } = setup({ imported: AI });
    fill("Nombre", "Sopa de calabaza al curry casera");
    fill("Pasos", "Triturar todo.");
    save();
    expect(onSave.mock.calls[0][0]).toMatchObject({ macrosEstimated: true });
  });

  it.each([
    ["Calorías (kcal)", "200"],
    ["Proteínas (g)", "7"],
    ["Carbos (g)", "30"],
    ["Grasas (g)", "8"],
  ])("cambiar '%s' quita la marca de estimado", (label, value) => {
    const { onSave, fill, save } = setup({ imported: AI });
    fill(label, value);
    save();
    const saved: Recipe = onSave.mock.calls[0][0];
    expect(saved.macrosEstimated).toBeUndefined();
    expect(saved.sourceUrl).toBe(RECIPE_URL);
  });

  it("volver a escribir el mismo valor no cuenta como cambio", () => {
    const { onSave, fill, save } = setup({ imported: AI });
    fill("Proteínas (g)", "5");
    save();
    expect(onSave.mock.calls[0][0]).toMatchObject({ macrosEstimated: true });
  });

  it("editar una receta guardada con macros estimados: si cambia un macro, se quita la marca", () => {
    const saved: Recipe = { ...CALABAZA_AI, id: "custom_calabaza", tags: [], isCustom: true, macrosEstimated: true, sourceUrl: RECIPE_URL };
    const { onSave, fill, save } = setup({ recipe: saved });
    fill("Carbos (g)", "25");
    save();
    const result: Recipe = onSave.mock.calls[0][0];
    expect(result.macrosEstimated).toBeUndefined();
    expect(result.sourceUrl).toBe(RECIPE_URL);
    expect(result.id).toBe("custom_calabaza");
  });

  it("editar una receta guardada con macros estimados: si no cambia ninguno, se mantiene la marca", () => {
    const saved: Recipe = { ...CALABAZA_AI, id: "custom_calabaza", tags: [], isCustom: true, macrosEstimated: true, sourceUrl: RECIPE_URL };
    const { onSave, fill, save } = setup({ recipe: saved });
    fill("Nombre", "Sopa de calabaza al curry y jengibre");
    save();
    expect(onSave.mock.calls[0][0]).toMatchObject({ macrosEstimated: true, sourceUrl: RECIPE_URL });
  });
});

describe("R5: nada se guarda sin confirmar", () => {
  it("abrir el formulario importado no llama a onSave", () => {
    const { onSave } = setup({ imported: AI });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cerrar el formulario llama a onClose y nunca a onSave", () => {
    const { onSave, onClose, dialog } = setup({ imported: AI });
    fireEvent.click(within(dialog).getByRole("button", { name: /cerrar|cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("R8: pista de raciones", () => {
  it("muestra cuántas raciones indica la web sin cambiar los macros", () => {
    const { notices, field } = setup({ imported: JSONLD });
    expect(notices()).toContain("La web indica 4 raciones: revisa que los macros sean por ración.");
    expect(field("Calorías (kcal)").value).toBe("420");
  });

  it("sin servingsHint no hay aviso de raciones", () => {
    const { notices } = setup({ imported: { ...JSONLD, servingsHint: undefined } });
    expect(notices().join(" ")).not.toMatch(/raciones/);
  });
});

describe("R9: URL de origen", () => {
  it("una importación por JSON-LD guarda sourceUrl y no macrosEstimated", () => {
    const { onSave, save } = setup({ imported: JSONLD });
    save();
    const saved: Recipe = onSave.mock.calls[0][0];
    expect(saved.sourceUrl).toBe(RECIPE_URL);
    expect(saved).not.toHaveProperty("macrosEstimated");
  });

  it("una receta creada a mano no lleva sourceUrl ni macrosEstimated", () => {
    const { fill, onSave, save } = setup();
    fill("Nombre", "Tostada");
    fill("Ingredientes", "pan");
    fill("Calorías (kcal)", "120");
    save();
    const saved: Recipe = onSave.mock.calls[0][0];
    expect(saved).not.toHaveProperty("sourceUrl");
    expect(saved).not.toHaveProperty("macrosEstimated");
  });
});
