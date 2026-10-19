// @vitest-environment jsdom
// Spec: docs/pm/57-editar-gramos-diario/spec.md › R1, R2, R5, R6, R8 y Edge cases.
// Tech: tech.md › Components & files y UI. Contrato (src/components/diario/DiaryEntryRow.tsx, export nombrado):
//   <DiaryEntryRow
//     entry={MealEntry} name={string} fiber={number | undefined} copied={boolean} editing={boolean}
//     onEdit={() => void}               // tocar la fila (con singleClick)
//     onSave={(next: MealEntry) => void} // ya escalada con rescaleEntry
//     onCancel={() => void}             // «Cancelar», y también «Guardar cambios» con el mismo valor (sin onSave)
//     onRemove={() => void}             // la ✕ «Eliminar», fuera del botón de la fila
//   />
//   - Fila editable (entryQuantity ≠ null): <button> «Cambiar cantidad de <nombre>». No editable: sin ese botón.
//   - Editor: alimento con FoodQuantityForm («Gramos» / «Unidades»), receta con ServingsField («Raciones»).
//   - Vista previa: «<etiqueta de la fila> → <kcal redondeadas> kcal» («100 g → 130 kcal», «3 ud · 180 g → 252 kcal»,
//     «× 0,5 → 300 kcal», «× 1 → 600 kcal»).
// Fallan hasta las tareas 4–6 del tech design.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiaryEntryRow } from "@/components/diario/DiaryEntryRow";
import { SERVINGS_ERROR } from "@/lib/diary";
import type { MealEntry } from "@/lib/types";
import { ARROZ_ENTRY, GRAMS_NAN, GUISO_ENTRY, HUEVO_ENTRY, YOGUR_ENTRY } from "../fixtures/editar-cantidad";

afterEach(cleanup);

function renderRow(entry: MealEntry, name: string, opts: { editing?: boolean; copied?: boolean; fiber?: number } = {}) {
  const props = {
    onEdit: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <div>
      <DiaryEntryRow
        entry={entry}
        name={name}
        fiber={opts.fiber}
        copied={opts.copied ?? false}
        editing={opts.editing ?? false}
        {...props}
      />
    </div>,
  );
  return props;
}

const ARROZ = "Arroz blanco, cocido";

describe("R1: tocar la fila abre el editor", () => {
  it("R1: una entrada de alimento es un botón «Cambiar cantidad de …» que llama a onEdit", () => {
    const p = renderRow(ARROZ_ENTRY, ARROZ);
    fireEvent.click(screen.getByRole("button", { name: `Cambiar cantidad de ${ARROZ}` }), { detail: 1 });
    expect(p.onEdit).toHaveBeenCalledTimes(1);
  });

  it("R1: la fila sigue mostrando nombre, «150 g» y «195 kcal»", () => {
    renderRow(ARROZ_ENTRY, ARROZ);
    const row = screen.getByRole("button", { name: `Cambiar cantidad de ${ARROZ}` });
    expect(row.textContent).toContain(ARROZ);
    expect(row.textContent).toContain("150 g");
    expect(screen.getByText(/195 kcal/)).toBeTruthy();
  });

  // Review de la PR #173 (bloqueante 1): el nombre accesible no puede tapar lo que la fila muestra
  it("R1: el lector de pantalla sigue anunciando cantidad, fibra, «Copiada» y kcal como descripción del botón", () => {
    renderRow(ARROZ_ENTRY, ARROZ, { copied: true, fiber: 2 });
    const row = screen.getByRole("button", { name: `Cambiar cantidad de ${ARROZ}`, description: /150 g/ });
    for (const text of [ARROZ, "Copiada", "Fibra 2 g", "195 kcal"]) {
      expect(screen.getByRole("button", { name: `Cambiar cantidad de ${ARROZ}`, description: new RegExp(text) })).toBe(row);
    }
  });

  it("R1: la ✕ «Eliminar» está fuera del botón de la fila y borra sin abrir el editor", () => {
    const p = renderRow(ARROZ_ENTRY, ARROZ);
    const row = screen.getByRole("button", { name: `Cambiar cantidad de ${ARROZ}` });
    const remove = screen.getByRole("button", { name: "Eliminar" });
    expect(row.contains(remove)).toBe(false);
    fireEvent.click(remove, { detail: 1 });
    expect(p.onRemove).toHaveBeenCalledTimes(1);
    expect(p.onEdit).not.toHaveBeenCalled();
  });

  it("Edge: el segundo clic de un doble toque no abre el editor (singleClick)", () => {
    const p = renderRow(ARROZ_ENTRY, ARROZ);
    fireEvent.click(screen.getByRole("button", { name: `Cambiar cantidad de ${ARROZ}` }), { detail: 2 });
    expect(p.onEdit).not.toHaveBeenCalled();
  });

  it("Edge: una entrada copiada sigue mostrando «Copiada»", () => {
    renderRow(ARROZ_ENTRY, ARROZ, { copied: true });
    expect(screen.getByText("Copiada")).toBeTruthy();
  });
});

describe("R5: personalizadas y entradas sin cantidad válida no son editables", () => {
  it("R5: una personalizada no tiene botón de fila, pero sí la ✕", () => {
    renderRow(YOGUR_ENTRY, "Yogur con nueces");
    expect(screen.queryByRole("button", { name: /Cambiar cantidad/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
  });

  it("R5: un alimento con gramos NaN no tiene botón de fila", () => {
    renderRow(GRAMS_NAN, ARROZ);
    expect(screen.queryByRole("button", { name: /Cambiar cantidad/ })).toBeNull();
  });
});

describe("R2, R3, R6: editar los gramos o las unidades", () => {
  it("R2: en gramos el campo es «Gramos» con 150", () => {
    renderRow(ARROZ_ENTRY, ARROZ, { editing: true });
    expect((screen.getByLabelText("Gramos") as HTMLInputElement).value).toBe("150");
  });

  it("R3: guardar 100 g llama a onSave con la entrada escalada (130 kcal) y la misma id", () => {
    const p = renderRow(ARROZ_ENTRY, ARROZ, { editing: true });
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(p.onSave).toHaveBeenCalledTimes(1);
    const next = p.onSave.mock.calls[0][0] as MealEntry;
    expect(next.id).toBe(ARROZ_ENTRY.id);
    expect(next.grams).toBe(100);
    expect(next.calories).toBeCloseTo(130, 9);
  });

  it("R6: vista previa «100 g → 130 kcal» mientras se escribe", () => {
    renderRow(ARROZ_ENTRY, ARROZ, { editing: true });
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "100" } });
    expect(screen.getByText("100 g → 130 kcal")).toBeTruthy();
  });

  it("R2/R6: en unidades el campo es «Unidades» con 2, y con 3 la vista previa es «3 ud · 180 g → 252 kcal»", () => {
    const p = renderRow(HUEVO_ENTRY, "Huevo", { editing: true });
    const units = screen.getByLabelText("Unidades") as HTMLInputElement;
    expect(units.value).toBe("2");
    fireEvent.change(units, { target: { value: "3" } });
    expect(screen.getByText("3 ud · 180 g → 252 kcal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(p.onSave.mock.calls[0][0]).toMatchObject({ units: 3, grams: 180 });
  });

  it("Edge: guardar el mismo valor no llama a onSave y cierra el editor (onCancel)", () => {
    const p = renderRow(ARROZ_ENTRY, ARROZ, { editing: true });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(p.onSave).not.toHaveBeenCalled();
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it("R4: «Cancelar» llama a onCancel sin guardar", () => {
    const p = renderRow(ARROZ_ENTRY, ARROZ, { editing: true });
    fireEvent.change(screen.getByLabelText("Gramos"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    expect(p.onSave).not.toHaveBeenCalled();
  });
});

describe("R8: editar las raciones de una receta", () => {
  it("R8: el campo es «Raciones» con 1 y vista previa «× 1 → 600 kcal»", () => {
    renderRow(GUISO_ENTRY, "Guiso", { editing: true });
    expect((screen.getByLabelText("Raciones") as HTMLInputElement).value).toBe("1");
    expect(screen.getByText("× 1 → 600 kcal")).toBeTruthy();
  });

  it("R8: con − dos veces queda 0,5, vista previa «× 0,5 → 300 kcal», y guarda servings 0,5", () => {
    const p = renderRow(GUISO_ENTRY, "Guiso", { editing: true });
    const minus = screen.getByRole("button", { name: "Quitar 0,25 raciones" });
    fireEvent.click(minus);
    fireEvent.click(minus);
    expect((screen.getByLabelText("Raciones") as HTMLInputElement).value).toBe("0,5");
    expect(screen.getByText("× 0,5 → 300 kcal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const next = p.onSave.mock.calls[0][0] as MealEntry;
    expect(next.servings).toBe(0.5);
    expect(next.calories).toBe(300);
  });

  it.each(["0,3", "5"])("R8: %s raciones muestra el error de siempre y no guarda", (value) => {
    const p = renderRow(GUISO_ENTRY, "Guiso", { editing: true });
    fireEvent.change(screen.getByLabelText("Raciones"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert").textContent).toBe(SERVINGS_ERROR);
    expect(p.onSave).not.toHaveBeenCalled();
  });
});
