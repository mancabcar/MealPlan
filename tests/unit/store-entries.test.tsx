// @vitest-environment jsdom
// Spec: docs/pm/54-copiar-diario/spec.md › R2 (la copia añade las entradas nuevas sin tocar las que había).
// Tech: tech.md › APIs / interfaces (`addEntries(es)` en el store: `setEntries(prev => [...prev, ...es])`, una sola
// escritura, como `addPantryItems`). Falla hasta la tarea 2 del tech design.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import type { MealEntry } from "@/lib/types";
import { DESTINO_ENTRIES, ORIGEN_ENTRIES } from "../fixtures/copiar-dia";

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

const stored = (userId: string): MealEntry[] => JSON.parse(localStorage.getItem(`mp_${userId}_entries`) ?? "null");

describe("R2: addEntries añade varias entradas de una vez", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("las añade detrás de las que ya había, en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => ref.app!.addEntries(DESTINO_ENTRIES));
    act(() => ref.app!.addEntries(ORIGEN_ENTRIES));
    const ids = [...DESTINO_ENTRIES, ...ORIGEN_ENTRIES].map((e) => e.id);
    expect(ref.app!.entries.map((e) => e.id)).toEqual(ids);
    expect(stored("u").map((e) => e.id)).toEqual(ids);
  });

  it("escribe la clave de entradas una sola vez, no una por entrada", () => {
    const ref = mount();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => ref.app!.addEntries(ORIGEN_ENTRIES));
    const writes = setItem.mock.calls.filter(([key]) => key === "mp_u_entries");
    expect(writes).toHaveLength(1);
  });

  it("una lista vacía no cambia nada", () => {
    const ref = mount();
    act(() => ref.app!.addEntries(DESTINO_ENTRIES));
    act(() => ref.app!.addEntries([]));
    expect(ref.app!.entries).toHaveLength(DESTINO_ENTRIES.length);
  });

  it("encadena con addEntry en el mismo evento, sin pisarse", () => {
    const ref = mount();
    act(() => {
      ref.app!.addEntry(DESTINO_ENTRIES[0]);
      ref.app!.addEntries(ORIGEN_ENTRIES);
    });
    expect(stored("u")).toHaveLength(1 + ORIGEN_ENTRIES.length);
  });
});
