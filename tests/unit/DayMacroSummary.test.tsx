// @vitest-environment jsdom
// Spec: docs/pm/10-macros-plan/spec.md › Edge cases ("Sin perfil": totales sin objetivo ni estado).
// Tech: docs/pm/10-macros-plan/tech.md › Components & files (`DayMacroSummary` recibe `summary` y `profile` o `null`)
// y UI ("Sin perfil: solo N, kcal con ' kcal', resto con ' g'").
// En la app no se llega a /plan sin perfil (AppShell muestra el onboarding), así que se prueba el componente.
// Falla hasta que exista src/components/plan/DayMacroSummary.tsx (tarea 3).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DayMacroSummary } from "@/components/plan/DayMacroSummary";

afterEach(cleanup);

const SUMMARY = { totals: { calories: 1700, protein: 120.4, carbs: 180, fat: 57 }, planned: 3, total: 4 };

describe("Edge case: sin perfil", () => {
  it("muestra los totales redondeados sin objetivo ni estado", () => {
    render(<DayMacroSummary summary={SUMMARY} profile={null} />);
    const list = screen.getByRole("list", { name: "Macros del día" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText("1700 kcal")).toBeTruthy();
    expect(within(items[1]).getByText("120 g")).toBeTruthy();
    expect(list.textContent).not.toMatch(/\//);
    expect(list.textContent).not.toMatch(/Dentro|Por debajo|Por encima/);
  });
});

// docs/pm/11-medias-adherencia/tech.md › Components & files: el Diario reutiliza el resumen para las medias del
// periodo con otra etiqueta y sin el aviso "N de M comidas planificadas". Falla hasta la tarea 5.
describe("Medias del periodo (docs/pm/11-medias-adherencia, R1 · R9)", () => {
  it('con label y sin planned/total: lista "Medias del periodo" y sin aviso de comidas', () => {
    render(<DayMacroSummary summary={{ totals: SUMMARY.totals }} profile={null} label="Medias del periodo" />);
    expect(screen.getByRole("list", { name: "Medias del periodo" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Macros del día" })).toBeNull();
    expect(screen.queryByText(/comidas planificadas/)).toBeNull();
  });
});
