// @vitest-environment jsdom
// Spec: docs/pm/55-mis-alimentos/spec.md › R2 (guardar, sin duplicados por nombre), R4 (editar no toca el Diario),
// R5 (quitar y Deshacer) y R6 (persisten por usuario).
// Tech: tech.md › APIs / interfaces: AppState.mealFavorites, saveMealFavorite (upsert por id, o por nombre si es una
// personalizada), removeMealFavorite(id) y setMealFavorites(list) (Deshacer restaura la instantánea).
// Fallan hasta la tarea 2 del tech design.
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import type { MealFavorite } from "@/lib/mealFavorites";
import { AVENA_FAV, CREMA_FAV, TORTILLA_FAV, TOSTADA_FAV, YESTERDAY, customEntry } from "../fixtures/favoritos-anadir";

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

const stored = (userId = "u") => JSON.parse(localStorage.getItem(`mp_${userId}_mealFavorites`) ?? "null");

describe("mealFavorites en el store", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado la lista está vacía", () => {
    expect(mount().app!.mealFavorites).toEqual([]);
  });

  it("R2/R6: guardar añade el favorito, en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => ref.app!.saveMealFavorite(TORTILLA_FAV));
    act(() => ref.app!.saveMealFavorite(AVENA_FAV));
    expect(ref.app!.mealFavorites).toEqual([TORTILLA_FAV, AVENA_FAV]);
    expect(stored()).toEqual([TORTILLA_FAV, AVENA_FAV]);
  });

  it("R2: una personalizada con el nombre de otra actualiza la existente (mismo id), sin una segunda", () => {
    const ref = mount();
    act(() => ref.app!.saveMealFavorite(TORTILLA_FAV));
    act(() => ref.app!.saveMealFavorite({ ...TORTILLA_FAV, id: "otro", name: "tortilla FRANCESA", calories: 200 }));
    expect(stored()).toEqual([{ ...TORTILLA_FAV, name: "tortilla FRANCESA", calories: 200 }]);
  });

  it("R4: guardar con el mismo id reemplaza el favorito y no toca las entradas del Diario", () => {
    localStorage.setItem("mp_u_entries", JSON.stringify([customEntry(YESTERDAY, "Cena", { customName: "Tostada con aceite", fat: 11 })]));
    const ref = mount();
    act(() => ref.app!.saveMealFavorite(TOSTADA_FAV));
    act(() => ref.app!.saveMealFavorite({ ...TOSTADA_FAV, fat: 9 } as MealFavorite));
    expect(stored()).toEqual([{ ...TOSTADA_FAV, fat: 9 }]);
    expect(ref.app!.entries[0].fat).toBe(11);
  });

  it("R5: quitar por id", () => {
    const ref = mount();
    act(() => ref.app!.setMealFavorites([TORTILLA_FAV, CREMA_FAV]));
    act(() => ref.app!.removeMealFavorite(TORTILLA_FAV.id));
    expect(stored()).toEqual([CREMA_FAV]);
  });

  it("R5: Deshacer restaura la lista exactamente como estaba (misma posición)", () => {
    const ref = mount();
    act(() => ref.app!.setMealFavorites([TORTILLA_FAV, CREMA_FAV, AVENA_FAV]));
    const before = ref.app!.mealFavorites;
    act(() => ref.app!.removeMealFavorite(CREMA_FAV.id));
    act(() => ref.app!.setMealFavorites(before));
    expect(stored()).toEqual([TORTILLA_FAV, CREMA_FAV, AVENA_FAV]);
  });

  it("R6: cada usuario tiene los suyos", () => {
    const a = mount("a");
    act(() => a.app!.saveMealFavorite(TORTILLA_FAV));
    expect(stored("a")).toEqual([TORTILLA_FAV]);
    expect(stored("b")).toBeNull();
  });
});
