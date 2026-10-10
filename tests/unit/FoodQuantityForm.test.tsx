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

afterEach(cleanup);

describe("R12: cantidad de un alimento favorito", () => {
  it("R12: en gramos, de 40 a 60 g", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm favorite={AVENA_FAV} onSave={onSave} onCancel={vi.fn()} />);
    const grams = screen.getByLabelText("Gramos") as HTMLInputElement;
    expect(grams.value).toBe("40");
    fireEvent.change(grams, { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith({ grams: 60 });
  });

  it("R12: en unidades, de 2 a 3 huevos (3 × 60 g = 180 g)", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm favorite={HUEVOS_FAV} onSave={onSave} onCancel={vi.fn()} />);
    const units = screen.getByLabelText("Unidades") as HTMLInputElement;
    expect(units.value).toBe("2");
    fireEvent.change(units, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith({ grams: 180, units: 3 });
  });

  it("Edge: una cantidad no válida muestra el error del buscador y no deja guardar", () => {
    const onSave = vi.fn();
    render(<FoodQuantityForm favorite={AVENA_FAV} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "0" } });
    expect(screen.getByRole("alert").textContent).toBe(GRAMS_ERROR);
    const save = screen.getByRole("button", { name: "Guardar cambios" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Edge: unidades fuera de pasos de 0,5", () => {
    render(<FoodQuantityForm favorite={HUEVOS_FAV} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Unidades"), { target: { value: "1,3" } });
    expect(screen.getByRole("alert").textContent).toBe(UNITS_ERROR);
  });

  it("«Cancelar» llama a onCancel", () => {
    const onCancel = vi.fn();
    render(<FoodQuantityForm favorite={AVENA_FAV} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
