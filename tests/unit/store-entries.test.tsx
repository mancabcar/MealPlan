// @vitest-environment jsdom
// Spec: docs/pm/54-copiar-diario/spec.md › R2 (la copia añade las entradas nuevas sin tocar las que había).
// Tech: tech.md › APIs / interfaces (`addEntries(es)` en el store: `setEntries(prev => [...prev, ...es])`, una sola
// escritura, como `addPantryItems`). Falla hasta la tarea 2 del tech design.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import type { MealEntry } from "@/lib/types";
import { DESTINO_ENTRIES, ORIGEN_ENTRIES } from "../fixtures/copiar-dia";
import { rescaleEntry } from "@/lib/diary";
import { ARROZ_ENTRY, DAY_ENTRIES, GUISO_ENTRY, HUEVO_ENTRY } from "../fixtures/editar-cantidad";

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

// Spec: docs/pm/57-editar-gramos-diario/spec.md › R3 (la entrada editada conserva su identidad).
// Tech: tech.md › Components & files (`replaceEntry(entry)` en el store). Falla hasta la tarea 2 del tech design.
describe("R3 (#57): replaceEntry sustituye la entrada con la misma id", () => {
  beforeEach(() => localStorage.clear());

  it("la cambia en su sitio, en pantalla y en localStorage, sin tocar las demás", () => {
    const ref = mount();
    act(() => ref.app!.addEntries(DAY_ENTRIES));
    const edited = rescaleEntry(ARROZ_ENTRY, { grams: 100 });
    act(() => ref.app!.replaceEntry(edited));
    expect(ref.app!.entries.map((e) => e.id)).toEqual(DAY_ENTRIES.map((e) => e.id));
    expect(ref.app!.entries.find((e) => e.id === ARROZ_ENTRY.id)).toEqual(edited);
    expect(stored("u").find((e) => e.id === ARROZ_ENTRY.id)?.grams).toBe(100);
    expect(ref.app!.entries.find((e) => e.id === HUEVO_ENTRY.id)).toEqual(HUEVO_ENTRY);
  });

  it("quita los campos que la entrada nueva no trae (servings al volver a 1)", () => {
    const ref = mount();
    act(() => ref.app!.addEntries([{ ...GUISO_ENTRY, servings: 0.5 }]));
    act(() => ref.app!.replaceEntry(GUISO_ENTRY));
    expect("servings" in ref.app!.entries[0]).toBe(false);
  });

  it("una id que no existe no cambia nada (la entrada se borró antes)", () => {
    const ref = mount();
    act(() => ref.app!.addEntries([HUEVO_ENTRY]));
    act(() => ref.app!.replaceEntry(ARROZ_ENTRY));
    expect(ref.app!.entries).toEqual([HUEVO_ENTRY]);
  });
});
