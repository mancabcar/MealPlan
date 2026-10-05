// @vitest-environment jsdom
// Spec: docs/pm/49-tolerancia-cumplido/spec.md › R2 (el Plan juzga con la tolerancia del perfil; ausente = 10).
// Tech: tech.md › Components & files (`DayMacroSummary` pasa `tolerancePct(profile)` a `macroStatus`).
// Falla hasta que el componente use la tolerancia (tarea 2).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DayMacroSummary } from "@/components/plan/DayMacroSummary";
import type { UserProfile } from "@/lib/types";
import { statsProfileNoRange } from "../fixtures/medias-adherencia";

afterEach(cleanup);

// 1850 kcal con objetivo 2000: dentro con 10 % (1800–2200), por debajo con 5 % (1900–2100)
const SUMMARY = { totals: { calories: 1850, protein: 140, carbs: 230, fat: 69 }, planned: 4, total: 4 };
const kcalCell = () =>
  within(screen.getByRole("list", { name: "Macros del día" }))
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes("Calorías"))!;

const renderWith = (tolerancePct?: number) =>
  render(<DayMacroSummary summary={SUMMARY} profile={{ ...statsProfileNoRange, tolerancePct } as UserProfile} />);

describe("R2: el estado de cada macro usa la tolerancia del perfil", () => {
  it("con 5 %: 1850 / 2000 kcal → Por debajo", () => {
    renderWith(5);
    expect(within(kcalCell()).getByText("Por debajo")).toBeTruthy();
  });

  it("con 10 % y con el campo ausente: 1850 / 2000 kcal → Dentro", () => {
    renderWith(10);
    expect(within(kcalCell()).getByText("Dentro")).toBeTruthy();
    cleanup();
    renderWith(undefined);
    expect(within(kcalCell()).getByText("Dentro")).toBeTruthy();
  });
});
