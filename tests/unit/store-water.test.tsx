// @vitest-environment jsdom
// Spec: docs/pm/23-agua-fibra-micros/spec.md › R10 (el agua del día se conserva al recargar) y R13 (novena clave).
// Tech: tech.md › Data model (clave `water`) y Components & files (`AppState.water`, `setWaterDay`).
// Contrato del store: `water: Record<YYYY-MM-DD, ml>` y `setWaterDay(date, ml)` (0 ml quita el día); se guarda en
// localStorage bajo mp_<userId>_water. Fallan hasta la tarea 10 del tech design.
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import { AGUA_DOS_DIAS, TODAY, YESTERDAY } from "../fixtures/agua";

function mount(userId = "u") {
  const ref: { app: ReturnType<typeof useApp> | null } = { app: null };
  function Probe() {
    ref.app = useApp();
    return null;
  }
  render(
    <AppProvider userId={userId}>
      <Probe />
    </AppProvider>,
  );
  return ref;
}

const stored = (userId: string) => JSON.parse(localStorage.getItem(`mp_${userId}_water`) ?? "null");

describe("R10: el agua del día se guarda y se conserva", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado no hay agua", () => {
    expect(mount().app!.water).toEqual({});
  });

  it("setWaterDay guarda en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => ref.app!.setWaterDay(TODAY, 250));
    expect(ref.app!.water).toEqual({ [TODAY]: 250 });
    expect(stored("u")).toEqual({ [TODAY]: 250 });
  });

  it("dos toques en el mismo evento se encadenan, no se pisan (días distintos)", () => {
    const ref = mount();
    act(() => {
      ref.app!.setWaterDay(YESTERDAY, 500);
      ref.app!.setWaterDay(TODAY, 250);
    });
    expect(stored("u")).toEqual({ [YESTERDAY]: 500, [TODAY]: 250 });
  });

  it("0 ml quita el día", () => {
    const ref = mount();
    act(() => ref.app!.setWaterDay(TODAY, 250));
    act(() => ref.app!.setWaterDay(TODAY, 0));
    expect(stored("u")).toEqual({});
  });

  it("al montar lee lo guardado", () => {
    localStorage.setItem("mp_u_water", JSON.stringify(AGUA_DOS_DIAS));
    expect(mount().app!.water).toEqual(AGUA_DOS_DIAS);
  });

  it("cada usuario tiene su agua", () => {
    const a = mount("a");
    act(() => a.app!.setWaterDay(TODAY, 250));
    expect(stored("b")).toBeNull();
  });

  it("lo guardado mal formado se sanea al cargar (fecha rara descartada, 9000 ml recortado a 6000)", () => {
    localStorage.setItem("mp_u_water", JSON.stringify({ [TODAY]: 9000, mañana: 500 }));
    expect(mount().app!.water).toEqual({ [TODAY]: 6000 });
  });
});
