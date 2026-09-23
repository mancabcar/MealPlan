// @vitest-environment jsdom
// docs/pm/lista-compra/review.md › limpieza "store setter": el setter de usePersisted encadena las
// escrituras del mismo evento en vez de quedarse solo con la última (cierre obsoleto).
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import type { PantryItem } from "@/lib/types";

const item = (id: string): PantryItem => ({ id, name: id, quantity: "1", category: "Despensa" });

function mount() {
  const ref: { app: ReturnType<typeof useApp> | null } = { app: null };
  function Probe() {
    ref.app = useApp();
    return null;
  }
  render(
    <AppProvider userId="u">
      <Probe />
    </AppProvider>,
  );
  return ref;
}

const stored = (k: string) => JSON.parse(localStorage.getItem(`mp_u_${k}`) ?? "null");

describe("usePersisted: varias escrituras en un mismo evento", () => {
  beforeEach(() => localStorage.clear());

  it("dos addPantryItem seguidos conservan los dos, en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => {
      ref.app!.addPantryItem(item("a"));
      ref.app!.addPantryItem(item("b"));
    });
    expect(ref.app!.pantry.map((p) => p.id)).toEqual(["a", "b"]);
    expect(stored("pantry").map((p: PantryItem) => p.id)).toEqual(["a", "b"]);
  });

  it("añadir y quitar en el mismo evento se aplican en orden", () => {
    const ref = mount();
    act(() => {
      ref.app!.addPantryItems([item("a"), item("b"), item("c")]);
      ref.app!.removePantryItem("b");
    });
    expect(ref.app!.pantry.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("setShopping acepta una función del valor más reciente", () => {
    const ref = mount();
    act(() => {
      ref.app!.setShopping((s) => ({ ...s, current: { ...s.current, week: "2026-09-21" } }));
      ref.app!.setShopping((s) => ({ ...s, current: { ...s.current, overrides: ["x"] } }));
    });
    expect(ref.app!.shopping.current).toMatchObject({ week: "2026-09-21", overrides: ["x"] });
  });
});
