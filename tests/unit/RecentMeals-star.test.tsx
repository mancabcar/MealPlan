// @vitest-environment jsdom
// Spec: docs/pm/55-mis-alimentos/spec.md › R2 (☆ en cada fila de Recientes guarda al momento, sin diálogo).
// Tech: tech.md › UI y Spec feedback (las filas de receta con raciones ≠ 1 no llevan ☆). Contrato acordado con Manuel el
// 2026-10-10: <RecentMeals recents onPick onStar?={(r) => void} canStar={(r) => boolean} />. La ☆ es un botón aparte a
// la derecha de la fila, «Guardar <nombre> en Favoritos»; sin onStar no hay ☆ (como hasta ahora).
// Fallan hasta la tarea 4 del tech design.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentMeals } from "@/components/diario/RecentMeals";
import type { RecentMeal } from "@/lib/diary";
import { POLLO_CURRY, YESTERDAY, customEntry, recipeEntryOf } from "../fixtures/favoritos-anadir";

afterEach(cleanup);

const TORTILLA: RecentMeal = { key: "c|tortilla", name: "Tortilla francesa", entry: customEntry(YESTERDAY, "Cena") };
const POLLO_MEDIO: RecentMeal = { key: "r|pollo|0.5", name: "Pollo al curry", entry: recipeEntryOf(YESTERDAY, "Cena", POLLO_CURRY, 0.5) };

function setup(canStar = (r: RecentMeal) => r.entry.servings === undefined) {
  const onPick = vi.fn();
  const onStar = vi.fn();
  render(<RecentMeals recents={[TORTILLA, POLLO_MEDIO]} onPick={onPick} onStar={onStar} canStar={canStar} />);
  return { onPick, onStar };
}

describe("R2: ☆ en las filas de Recientes", () => {
  it("R2: tocar ☆ llama a onStar con esa fila y no registra ni abre un diálogo", () => {
    const { onPick, onStar } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Guardar Tortilla francesa en Favoritos" }));
    expect(onStar).toHaveBeenCalledWith(TORTILLA);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("la fila sigue registrando con un toque", () => {
    const { onPick, onStar } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Tortilla francesa/ }));
    expect(onPick).toHaveBeenCalledWith(TORTILLA, expect.anything());
    expect(onStar).not.toHaveBeenCalled();
  });

  it("Spec feedback: una fila que no se puede guardar (receta × 0,5) no lleva ☆", () => {
    setup();
    expect(screen.getByRole("button", { name: /^Pollo al curry/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guardar Pollo al curry en Favoritos" })).toBeNull();
  });

  it("sin onStar no hay ninguna ☆", () => {
    render(<RecentMeals recents={[TORTILLA]} onPick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /en Favoritos$/ })).toBeNull();
  });
});
