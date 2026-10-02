// @vitest-environment jsdom
// Spec: docs/pm/20-recetas-filtros/spec.md › R2 (marcar y desmarcar) y R4 (persisten por usuario, huérfanas se limpian).
// Tech: docs/pm/20-recetas-filtros/tech.md › APIs / interfaces (`AppState.favorites`, `toggleFavorite`) y Data model.
// Fallan hasta la tarea 1.
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { AppProvider, useApp } from "@/lib/store";
import { EMPTY_USER_DATA } from "@/lib/userData";
import type { Recipe } from "@/lib/types";

const SEED = seedData.recipes as Recipe[];
const [A, B, C] = [SEED[0].id, SEED[1].id, SEED[2].id];

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

const stored = (userId: string) => JSON.parse(localStorage.getItem(`mp_${userId}_favorites`) ?? "null");

describe("R2/R4: toggleFavorite", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado no hay favoritas", () => {
    expect(mount().app!.favorites).toEqual([]);
  });

  it("marca y desmarca, en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => ref.app!.toggleFavorite(A));
    expect(ref.app!.favorites).toEqual([A]);
    expect(stored("u")).toEqual([A]);

    act(() => ref.app!.toggleFavorite(B));
    expect(stored("u")).toEqual([A, B]);

    act(() => ref.app!.toggleFavorite(A));
    expect(ref.app!.favorites).toEqual([B]);
    expect(stored("u")).toEqual([B]);
  });

  it("dos toques en el mismo evento se encadenan, no se pisan", () => {
    const ref = mount();
    act(() => {
      ref.app!.toggleFavorite(A);
      ref.app!.toggleFavorite(B);
    });
    expect(stored("u")).toEqual([A, B]);
  });

  it("no hay límite de favoritas", () => {
    const ref = mount();
    act(() => SEED.slice(0, 40).forEach((r) => ref.app!.toggleFavorite(r.id)));
    expect(ref.app!.favorites).toHaveLength(40);
  });

  it("persisten tras recargar: un AppProvider nuevo del mismo usuario las lee", () => {
    const first = mount();
    act(() => first.app!.toggleFavorite(C));
    expect(mount().app!.favorites).toEqual([C]);
  });

  it("cada usuario tiene las suyas: no se mezclan", () => {
    const u1 = mount("u1");
    act(() => u1.app!.toggleFavorite(A));
    const u2 = mount("u2");
    expect(u2.app!.favorites).toEqual([]);
    act(() => u2.app!.toggleFavorite(B));
    expect(stored("u1")).toEqual([A]);
    expect(stored("u2")).toEqual([B]);
  });

  it("una favorita de una receta que ya no existe se ignora y se limpia al guardar", () => {
    localStorage.setItem("mp_u_favorites", JSON.stringify(["receta-borrada", A]));
    const ref = mount();
    act(() => ref.app!.toggleFavorite(B));
    expect(stored("u")).toEqual([A, B]);
  });
});

describe("R4: importData recarga los favoritos", () => {
  beforeEach(() => localStorage.clear());

  it("sustituye los favoritos del contexto y de localStorage", () => {
    localStorage.setItem("mp_u_favorites", JSON.stringify([A]));
    const ref = mount();
    expect(ref.app!.favorites).toEqual([A]);

    act(() => ref.app!.importData({ ...EMPTY_USER_DATA, recipes: SEED, favorites: [B, C] }));

    expect(ref.app!.favorites).toEqual([B, C]);
    expect(stored("u")).toEqual([B, C]);
  });

  it("una copia sin favoritos (vacíos) los deja vacíos", () => {
    localStorage.setItem("mp_u_favorites", JSON.stringify([A]));
    const ref = mount();
    act(() => ref.app!.importData({ ...EMPTY_USER_DATA, recipes: SEED }));
    expect(ref.app!.favorites).toEqual([]);
  });
});
