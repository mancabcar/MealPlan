// @vitest-environment jsdom
// Spec: docs/pm/55-mis-alimentos/spec.md › R12 (cambiar la cantidad guardada de un alimento favorito).
// Tech: tech.md › Components & files. Contrato acordado con Manuel el 2026-10-10
// (src/components/diario/FoodQuantityForm.tsx, export nombrado):
//   <FoodQuantityForm favorite={MealFavorite (kind "food")} onSave={({ grams, units? }) => void} onCancel={() => void} />
//   - En gramos: campo «Gramos» (validación de FoodPicker: GRAMS_ERROR). En unidades (si el favorito las tiene): campo
//     «Unidades» (UNITS_ERROR); los gramos son unidades × (gramos / unidades) del favorito.
//   - «Guardar cambios» (desactivado con un valor no válido) y «Cancelar».
// Fallan hasta la tarea 7 del tech design.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoodQuantityForm } from "@/components/diario/FoodQuantityForm";
import { GRAMS_ERROR, UNITS_ERROR } from "@/lib/foods";
import { AVENA_FAV, HUEVOS_FAV } from "../fixtures/favoritos-anadir";

// #57 (docs/pm/57-editar-gramos-diario/tech.md › Components & files): la prop pasa de `favorite` a `quantity`, que
// Favoritos y el Diario rellenan con { grams, units? }. Fallan hasta la tarea 3 de ese tech design.
const AVENA_Q = { grams: AVENA_FAV.grams };
const HUEVOS_Q = { grams: HUEVOS_FAV.grams, units: HUEVOS_FAV.units };

afterEach(cleanup);

describe("R12: cantidad de un alimento favorito", () => {
  it("R12: en gramos, de 40 a 60 g", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm quantity={AVENA_Q} onSave={onSave} onCancel={vi.fn()} />);
    const grams = screen.getByLabelText("Gramos") as HTMLInputElement;
    expect(grams.value).toBe("40");
    fireEvent.change(grams, { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith({ grams: 60 });
  });

  it("R12: en unidades, de 2 a 3 huevos (3 × 60 g = 180 g)", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm quantity={HUEVOS_Q} onSave={onSave} onCancel={vi.fn()} />);
    const units = screen.getByLabelText("Unidades") as HTMLInputElement;
    expect(units.value).toBe("2");
    fireEvent.change(units, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith({ grams: 180, units: 3 });
  });

  it("Edge: una cantidad no válida muestra el error del buscador y no deja guardar", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm quantity={AVENA_Q} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "0" } });
    expect(screen.getByRole("alert").textContent).toBe(GRAMS_ERROR);
    const save = screen.getByRole("button", { name: "Guardar cambios" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Edge: unidades fuera de pasos de 0,5", () => {
    render(<FoodQuantityForm quantity={HUEVOS_Q} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Unidades"), { target: { value: "1,3" } });
    expect(screen.getByRole("alert").textContent).toBe(UNITS_ERROR);
  });

  it("«Cancelar» llama a onCancel", () => {
    const onCancel = vi.fn();
    render(<FoodQuantityForm quantity={AVENA_Q} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

// Spec: docs/pm/57-editar-gramos-diario/spec.md › R6 (vista previa mientras se edita).
// Contrato: prop opcional `preview={(q: { grams; units? }) => ReactNode}`, pintada junto al campo solo con un valor válido.
describe("R6 (#57): vista previa de la cantidad nueva", () => {
  const preview = (q: { grams: number; units?: number }) => `${q.grams} g → ${Math.round(q.grams * 1.3)} kcal`;

  it("R6: con un valor válido muestra lo que devuelve preview con la cantidad tecleada", () => {
    render(<FoodQuantityForm quantity={{ grams: 150 }} preview={preview} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("150 g → 195 kcal")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "100" } });
    expect(screen.getByText("100 g → 130 kcal")).toBeTruthy();
  });

  it("R6: en unidades recibe las unidades y sus gramos", () => {
    const spy = vi.fn(() => "x");
    render(<FoodQuantityForm quantity={HUEVOS_Q} preview={spy} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Unidades"), { target: { value: "3" } });
    expect(spy).toHaveBeenLastCalledWith({ grams: 180, units: 3 });
  });

  it("R6: con un valor no válido no hay vista previa", () => {
    render(<FoodQuantityForm quantity={{ grams: 150 }} preview={preview} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "0" } });
    expect(screen.queryByText(/→/)).toBeNull();
  });
});

describe("#174: gramos con decimales (entradas o favoritos antiguos)", () => {
  it("abre redondeado y, sin tocar el campo, guarda la cantidad tal cual (no la reescribe a 113)", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm quantity={{ grams: 112.5 }} onSave={onSave} onCancel={vi.fn()} />);
    expect((screen.getByLabelText("Gramos") as HTMLInputElement).value).toBe("113");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith({ grams: 112.5 });
  });

  it("si se cambia el valor, guarda el nuevo", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm quantity={{ grams: 112.5 }} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith({ grams: 100 });
  });
});
