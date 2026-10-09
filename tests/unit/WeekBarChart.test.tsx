// @vitest-environment jsdom
// Spec: docs/pm/50-marcar-dias-cumplen/spec.md › R1–R4.
// Tech: docs/pm/50-marcar-dias-cumplen/tech.md › UI (contrato de la prueba):
//   - Datos por barra: { label, value, state: "met" | "missed" | "empty" | "today", name }.
//   - Cada barra es un contenedor que incluye su texto `sr-only` («<name>, <kcal> kcal, <estado>»), su letra
//     visible (aria-hidden) y, solo si `state` es "met", un icono <svg> (aria-hidden).
//   - La leyenda «día dentro del objetivo (kcal y proteína)» se muestra siempre.
// Falla hasta que WeekBarChart reciba `state` y `name` (tarea 3).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeekBarChart } from "@/components/ui/WeekBarChart";

afterEach(cleanup);

type Bar = Parameters<typeof WeekBarChart>[0]["data"][number];

const WEEK = [
  { label: "X", value: 1800, state: "met", name: "Miércoles" },
  { label: "J", value: 0, state: "empty", name: "Jueves" },
  { label: "V", value: 2200, state: "met", name: "Viernes" },
  { label: "S", value: 0, state: "empty", name: "Sábado" },
  { label: "D", value: 2000, state: "missed", name: "Domingo" },
  { label: "L", value: 0, state: "empty", name: "Lunes" },
  { label: "M", value: 900, state: "today", name: "Martes" },
] as Bar[];

const LEGEND = /día dentro del objetivo \(kcal y proteína\)/i;
const bar = (text: RegExp) => screen.getByText(text).parentElement as HTMLElement;
const icons = (el: HTMLElement) => el.querySelectorAll("svg").length;

describe("#50 R3: texto accesible por barra con los 4 estados", () => {
  it("día cumplido: «Miércoles, 1800 kcal, cumple el objetivo»", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(screen.getByText(/^Miércoles, 1800 kcal, cumple el objetivo$/i)).toBeTruthy();
  });

  it("día incumplido: «Domingo, 2000 kcal, no cumple el objetivo»", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(screen.getByText(/^Domingo, 2000 kcal, no cumple el objetivo$/i)).toBeTruthy();
  });

  it("día sin registros: «Jueves, sin registros»", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(screen.getByText(/^Jueves, sin registros$/i)).toBeTruthy();
  });

  it("día en curso: «Martes, 900 kcal, día en curso»", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(screen.getByText(/^Martes, 900 kcal, día en curso$/i)).toBeTruthy();
  });

  it("las 7 barras tienen su texto sr-only", () => {
    const { container } = render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(container.querySelectorAll(".sr-only")).toHaveLength(7);
  });

  it("las kcal con decimales se redondean en el texto", () => {
    render(<WeekBarChart data={[{ label: "L", value: 1999.6, state: "missed", name: "Lunes" }]} goal={2000} />);
    expect(screen.getByText(/^Lunes, 2000 kcal, no cumple el objetivo$/i)).toBeTruthy();
  });

  it("sin nombre de día (fecha borrada) el texto dice solo el estado, sin «undefined»", () => {
    const { container } = render(<WeekBarChart data={[{ label: "", value: 0, state: "empty", name: "" }]} goal={2000} />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("sin registros");
  });

  it("la letra visible no se lee además del texto (aria-hidden)", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(screen.getByText("X", { exact: true }).closest("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("#50 R1 · R2: icono solo en los días cumplidos", () => {
  it("«met» lleva un icono; «missed», «empty» y «today» no", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(icons(bar(/^Miércoles, /i))).toBe(1);
    expect(icons(bar(/^Viernes, /i))).toBe(1);
    expect(icons(bar(/^Domingo, /i))).toBe(0);
    expect(icons(bar(/^Jueves, /i))).toBe(0);
    expect(icons(bar(/^Martes, /i))).toBe(0);
  });

  it("el icono es decorativo (aria-hidden): el estado lo dice el texto", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(bar(/^Miércoles, /i).querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("#50 R4: leyenda visible", () => {
  it("se muestra con días cumplidos", () => {
    render(<WeekBarChart data={WEEK} goal={2000} />);
    expect(screen.getByText(LEGEND)).toBeTruthy();
  });

  it("se muestra también sin ningún día cumplido (no salta el layout)", () => {
    render(<WeekBarChart data={WEEK.map((b) => ({ ...b, state: "empty" }) as Bar)} goal={2000} />);
    expect(screen.getByText(LEGEND)).toBeTruthy();
  });
});
