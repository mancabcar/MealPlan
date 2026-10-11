// @vitest-environment jsdom
// Spec: docs/pm/55-mis-alimentos/spec.md › R3 (casilla «Guardar en favoritos», desmarcada en cada registro) y R4 (editar
// una personalizada favorita: errores de nombre repetido y de datos no válidos).
// Tech: tech.md › Components & files y UI. Contrato acordado con Manuel el 2026-10-10
// (src/components/diario/CustomMealForm.tsx, export nombrado, solo props):
//   <CustomMealForm mode="add" | "edit" initial?={CustomValues} onSubmit={(values, saveAsFavorite) => void}
//                   onRemove?={() => void} nameTaken?={(name) => boolean} />
//   CustomValues = { name, calories, protein, carbs, fat, fiber? }
//   - Mismos campos que la pestaña Personalizada de hoy: «Nombre» (placeholder), kcal, prot, carb, grasa y fibra.
//   - add: casilla «Guardar en favoritos» justo encima de «Añadir».
//   - edit: sin casilla; «Guardar cambios» y «Quitar de favoritos».
// Fallan hasta la tarea 6 (add) y la 7 (edit) del tech design.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomMealForm } from "@/components/diario/CustomMealForm";
import { FIBER_ERROR } from "@/lib/fiber";

afterEach(cleanup);

const checkbox = () => screen.getByRole("checkbox", { name: "Guardar en favoritos" }) as HTMLInputElement;

function fill({ name = "Tortilla francesa", kcal = "190", prot = "13", carb = "1", grasa = "15", fibra = "" } = {}) {
  fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("kcal"), { target: { value: kcal } });
  fireEvent.change(screen.getByLabelText("prot"), { target: { value: prot } });
  fireEvent.change(screen.getByLabelText("carb"), { target: { value: carb } });
  fireEvent.change(screen.getByLabelText("grasa"), { target: { value: grasa } });
  fireEvent.change(screen.getByLabelText("fibra"), { target: { value: fibra } });
}

describe("R3: «Guardar en favoritos» al registrar una personalizada", () => {
  it("R3: al abrir, la casilla está desmarcada y va justo encima de «Añadir»", () => {
    render(<CustomMealForm mode="add" onSubmit={vi.fn()} />);
    expect(checkbox().checked).toBe(false);
    const add = screen.getByRole("button", { name: "Añadir" });
    expect(checkbox().compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R3: con la casilla marcada y el formulario válido, envía los datos y saveAsFavorite = true", () => {
    const onSubmit = vi.fn();
    render(<CustomMealForm mode="add" onSubmit={onSubmit} />);
    fill({ fibra: "0,5" });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Tortilla francesa", calories: 190, protein: 13, carbs: 1, fat: 15, fiber: 0.5 }, true);
  });

  it("sin marcarla, saveAsFavorite = false y sin fibra no hay campo fiber", () => {
    const onSubmit = vi.fn();
    render(<CustomMealForm mode="add" onSubmit={onSubmit} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Tortilla francesa", calories: 190, protein: 13, carbs: 1, fat: 15 }, false);
  });

  it("R3: tras un registro, la casilla vuelve a estar desmarcada", () => {
    render(<CustomMealForm mode="add" onSubmit={vi.fn()} />);
    fill();
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(checkbox().checked).toBe(false);
  });

  it("R3: con el formulario no válido (sin nombre) no se envía nada", () => {
    const onSubmit = vi.fn();
    render(<CustomMealForm mode="add" onSubmit={onSubmit} />);
    fill({ name: "  " });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("R3: con la fibra no válida, el mismo error de hoy y no se envía nada", () => {
    const onSubmit = vi.fn();
    render(<CustomMealForm mode="add" onSubmit={onSubmit} />);
    fill({ fibra: "abc" });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(screen.getByRole("alert").textContent).toBe(FIBER_ERROR);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("en modo add no hay «Quitar de favoritos»", () => {
    render(<CustomMealForm mode="add" onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Quitar de favoritos" })).toBeNull();
  });
});

describe("R4: editar una personalizada favorita", () => {
  const initial = { name: "Tostada con aceite", calories: 210, protein: 5, carbs: 28, fat: 11, fiber: 3 };

  it("R4: abre relleno, sin casilla, con «Guardar cambios» y «Quitar de favoritos»", () => {
    render(<CustomMealForm mode="edit" initial={initial} onSubmit={vi.fn()} onRemove={vi.fn()} nameTaken={() => false} />);
    expect((screen.getByPlaceholderText("Nombre") as HTMLInputElement).value).toBe("Tostada con aceite");
    expect((screen.getByLabelText("grasa") as HTMLInputElement).value).toBe("11");
    expect((screen.getByLabelText("fibra") as HTMLInputElement).value).toBe("3");
    expect(screen.queryByRole("checkbox", { name: "Guardar en favoritos" })).toBeNull();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toBeTruthy();
  });

  it("R4: corrige la grasa de 11 a 9 g y guarda", () => {
    const onSubmit = vi.fn();
    render(<CustomMealForm mode="edit" initial={initial} onSubmit={onSubmit} nameTaken={() => false} />);
    fireEvent.change(screen.getByLabelText("grasa"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ ...initial, fat: 9 });
  });

  it("R4: con el nombre de otra favorita, «Ya tienes un favorito con ese nombre» y no se guarda", () => {
    const onSubmit = vi.fn();
    const nameTaken = vi.fn(() => true);
    render(<CustomMealForm mode="edit" initial={initial} onSubmit={onSubmit} nameTaken={nameTaken} />);
    fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Tortilla francesa" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(nameTaken).toHaveBeenCalledWith("Tortilla francesa");
    expect(screen.getByRole("alert").textContent).toBe("Ya tienes un favorito con ese nombre");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("R4: con el nombre vacío o la fibra no válida no se guarda", () => {
    const onSubmit = vi.fn();
    render(<CustomMealForm mode="edit" initial={initial} onSubmit={onSubmit} nameTaken={() => false} />);
    fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Tostada con aceite" } });
    fireEvent.change(screen.getByLabelText("fibra"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert").textContent).toBe(FIBER_ERROR);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("R5: «Quitar de favoritos» llama a onRemove", () => {
    const onRemove = vi.fn();
    render(<CustomMealForm mode="edit" initial={initial} onSubmit={vi.fn()} onRemove={onRemove} nameTaken={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: "Quitar de favoritos" }));
    expect(onRemove).toHaveBeenCalled();
  });
});
