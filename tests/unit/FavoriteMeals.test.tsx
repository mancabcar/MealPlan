// @vitest-environment jsdom
// Spec: docs/pm/55-mis-alimentos/spec.md › Acceptance criteria R1 (tocar registra), R4 (editar una personalizada),
// R5 (quitar con la ★ y desde el formulario), R9 (5 filas y «Ver todos (N)»), R10 (pista sin favoritos), R12 (cantidad
// de un alimento) y User flows › «Editar o quitar».
// Tech: tech.md › UI. Contrato acordado con Manuel el 2026-10-10 (src/components/diario/FavoriteMeals.tsx, export nombrado,
// solo props; page.tsx lo conecta al store):
//   <FavoriteMeals favorites={RankedFavorite[]} onPick={(f, ev) => void} onRemove={(f) => void}
//                  onSaveCustom={(fav: MealFavorite) => void} onSaveQuantity={(fav, { grams, units? }) => void}
//                  nameTaken={(name, exceptId) => boolean} />
//   - h4 «Favoritos» + lista con ese nombre accesible, como Recientes. Cada fila: botón de toque completo (nombre, cantidad,
//     kcal) y ★ aparte «Quitar <nombre> de Favoritos».
//   - Sin favoritos: solo la pista «Toca ☆ en lo que repites para tenerlo aquí».
//   - «Editar» junto al título (pasa a «Listo»): lista completa, lápiz «Editar <nombre>» en personalizadas y alimentos.
//   - Lápiz de personalizada → CustomMealForm (modo edit); de alimento → FoodQuantityForm.
// Fallan hasta la tarea 5 (lista) y la 7 (Editar) del tech design.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FavoriteMeals } from "@/components/diario/FavoriteMeals";
import type { MealFavorite, RankedFavorite } from "@/lib/mealFavorites";
import { AVENA_FAV, POLLO_CURRY, TORTILLA_FAV, TOSTADA_FAV, TWELVE_FAVS } from "../fixtures/favoritos-anadir";

afterEach(cleanup);

const ranked = (fav: MealFavorite): RankedFavorite =>
  fav.kind === "custom"
    ? { key: `c|${fav.id}`, name: fav.name, calories: fav.calories, label: null, fav }
    : { key: `f|${fav.id}`, name: fav.name, calories: (fav.per100.kcal * fav.grams) / 100, label: `${fav.grams} g`, fav };
const POLLO_ROW: RankedFavorite = { key: `r|${POLLO_CURRY.id}`, name: POLLO_CURRY.name, calories: POLLO_CURRY.calories, label: null, recipe: POLLO_CURRY };
const MIXED = [ranked(TOSTADA_FAV), ranked(AVENA_FAV), POLLO_ROW];

function setup(favorites: RankedFavorite[] = MIXED, nameTaken = () => false) {
  const props = {
    onPick: vi.fn(),
    onRemove: vi.fn(),
    onSaveCustom: vi.fn(),
    onSaveQuantity: vi.fn(),
    nameTaken: vi.fn(nameTaken),
  };
  render(<FavoriteMeals favorites={favorites} {...props} />);
  return props;
}

const list = () => screen.getByRole("list", { name: "Favoritos" });
const rowButtons = () => within(list()).getAllByRole("button").filter((b) => !/^(Quitar|Editar) /.test(b.getAttribute("aria-label") ?? ""));

describe("R10: sin favoritos, una pista", () => {
  it("R10: muestra «Toca ☆ en lo que repites para tenerlo aquí» y ninguna lista", () => {
    setup([]);
    expect(screen.getByText("Toca ☆ en lo que repites para tenerlo aquí")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Favoritos" })).toBeNull();
  });

  it("R10: con un favorito, la pista desaparece", () => {
    setup([ranked(TORTILLA_FAV)]);
    expect(screen.queryByText("Toca ☆ en lo que repites para tenerlo aquí")).toBeNull();
    expect(list()).toBeTruthy();
  });
});

describe("R1: un toque en una fila la registra", () => {
  it("cada fila muestra nombre, cantidad y kcal redondeadas", () => {
    setup();
    expect(rowButtons().map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Tostada con aceite.*210 kcal$/),
      expect.stringMatching(/^Avena 40 g.*150 kcal$/),
      expect.stringMatching(/^Pollo al curry.*520 kcal$/),
    ]);
  });

  it("R1: tocar la fila llama a onPick con ese favorito", () => {
    const { onPick } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Avena 40 g/ }));
    expect(onPick).toHaveBeenCalledWith(MIXED[1], expect.anything());
  });
});

describe("R5: la ★ rellena quita el favorito", () => {
  it("R5: «Quitar <nombre> de Favoritos» llama a onRemove, sin confirmar", () => {
    const { onRemove, onPick } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Pollo al curry de Favoritos" }));
    expect(onRemove).toHaveBeenCalledWith(POLLO_ROW);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("R9: como mucho 5 filas y «Ver todos (N)»", () => {
  it("R9: con 12 favoritos se ven 5 y «Ver todos (12)»", () => {
    setup(TWELVE_FAVS.map(ranked));
    expect(rowButtons()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Ver todos (12)" })).toBeTruthy();
  });

  it("R9: «Ver todos (12)» despliega los 12 en el sitio", () => {
    setup(TWELVE_FAVS.map(ranked));
    fireEvent.click(screen.getByRole("button", { name: "Ver todos (12)" }));
    expect(rowButtons()).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /^Ver todos/ })).toBeNull();
  });

  it("R9: con 5 o menos no aparece «Ver todos»", () => {
    setup(TWELVE_FAVS.slice(0, 5).map(ranked));
    expect(rowButtons()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /^Ver todos/ })).toBeNull();
  });
});

describe("«Editar»: lista completa y lápices (R4, R12)", () => {
  it("«Editar» pasa a «Listo» y abre la lista completa", () => {
    setup(TWELVE_FAVS.map(ranked));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Listo" })).toBeTruthy();
    expect(rowButtons()).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
  });

  it("R4: personalizadas y alimentos llevan lápiz; las recetas, no", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Editar Tostada con aceite" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar Avena" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar Pollo al curry" })).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar Pollo al curry de Favoritos" })).toBeTruthy();
  });

  it("R4: el lápiz abre el formulario relleno; «Guardar cambios» guarda el favorito corregido (mismo id) y vuelve a la lista", () => {
    const { onSaveCustom } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Tostada con aceite" }));
    expect((screen.getByPlaceholderText("Nombre") as HTMLInputElement).value).toBe("Tostada con aceite");
    fireEvent.change(screen.getByLabelText("grasa"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSaveCustom).toHaveBeenCalledWith({ ...TOSTADA_FAV, fat: 9 });
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(list()).toBeTruthy();
  });

  it("R4: con el nombre de otra favorita sale «Ya tienes un favorito con ese nombre» y no se guarda", () => {
    const { onSaveCustom, nameTaken } = setup(MIXED, () => true);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Tostada con aceite" }));
    fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Tortilla francesa" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(nameTaken).toHaveBeenCalledWith("Tortilla francesa", TOSTADA_FAV.id);
    expect(screen.getByRole("alert").textContent).toBe("Ya tienes un favorito con ese nombre");
    expect(onSaveCustom).not.toHaveBeenCalled();
  });

  it("R5: «Quitar de favoritos» desde el formulario llama a onRemove", () => {
    const { onRemove } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Tostada con aceite" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar de favoritos" }));
    expect(onRemove).toHaveBeenCalledWith(MIXED[0]);
  });

  it("R12: el lápiz de un alimento permite cambiar la cantidad", () => {
    const { onSaveQuantity } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Avena" }));
    const grams = screen.getByLabelText("Gramos") as HTMLInputElement;
    expect(grams.value).toBe("40");
    fireEvent.change(grams, { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSaveQuantity).toHaveBeenCalledWith(AVENA_FAV, { grams: 60 });
  });
});
