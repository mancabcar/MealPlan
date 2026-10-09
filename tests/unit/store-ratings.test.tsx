// @vitest-environment jsdom
// Spec: docs/pm/111-recetas-valoracion-filtros/spec.md › R1 (puntuar, cambiar y quitar con la misma nota) y R2 (persisten
// por usuario, se limpian las de recetas que ya no existen). Tech: tech.md › APIs / interfaces (`AppState.ratings`,
// `setRating(id, n)`). Fallan hasta la tarea 1 del tech design.
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

const stored = (userId: string) => JSON.parse(localStorage.getItem(`mp_${userId}_ratings`) ?? "null");

describe("R1: setRating", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado no hay valoraciones", () => {
    expect(mount().app!.ratings).toEqual({});
  });

  it("R1: puntuar una receta sin nota la deja con esa nota, en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => ref.app!.setRating(A, 3));
    expect(ref.app!.ratings).toEqual({ [A]: 3 });
    expect(stored("u")).toEqual({ [A]: 3 });
  });

  it("R1: tocar otra nota la cambia", () => {
    const ref = mount();
    act(() => ref.app!.setRating(A, 3));
    act(() => ref.app!.setRating(A, 5));
    expect(stored("u")).toEqual({ [A]: 5 });
  });

  it("R1: tocar la nota actual la quita y la receta queda sin valorar", () => {
    const ref = mount();
    act(() => ref.app!.setRating(A, 3));
    act(() => ref.app!.setRating(B, 4));
    act(() => ref.app!.setRating(A, 3));
    expect(ref.app!.ratings).toEqual({ [B]: 4 });
    expect(stored("u")).toEqual({ [B]: 4 });
  });

  it("dos toques en el mismo evento se encadenan, no se pisan", () => {
    const ref = mount();
    act(() => {
      ref.app!.setRating(A, 2);
      ref.app!.setRating(B, 5);
    });
    expect(stored("u")).toEqual({ [A]: 2, [B]: 5 });
  });

  it("una nota fuera de 1–5 no se guarda", () => {
    const ref = mount();
    act(() => {
      ref.app!.setRating(A, 0);
      ref.app!.setRating(B, 6);
      ref.app!.setRating(C, 2.5);
    });
    expect(ref.app!.ratings).toEqual({});
  });
});

describe("R2: persistencia por usuario", () => {
  beforeEach(() => localStorage.clear());

  it("persisten tras recargar: un AppProvider nuevo del mismo usuario las lee", () => {
    const first = mount();
    act(() => first.app!.setRating(C, 4));
    expect(mount().app!.ratings).toEqual({ [C]: 4 });
  });

  it("cada usuario tiene las suyas: no se mezclan", () => {
    const u1 = mount("u1");
    act(() => u1.app!.setRating(A, 5));
    const u2 = mount("u2");
    expect(u2.app!.ratings).toEqual({});
    act(() => u2.app!.setRating(B, 1));
    expect(stored("u1")).toEqual({ [A]: 5 });
    expect(stored("u2")).toEqual({ [B]: 1 });
  });

  it("la nota de una receta que ya no existe se ignora y se limpia al guardar", () => {
    localStorage.setItem("mp_u_ratings", JSON.stringify({ "receta-borrada": 3, [A]: 4 }));
    const ref = mount();
    act(() => ref.app!.setRating(B, 2));
    expect(stored("u")).toEqual({ [A]: 4, [B]: 2 });
  });

  it("una nota corrupta en localStorage se descarta al cargar", () => {
    localStorage.setItem("mp_u_ratings", JSON.stringify({ [A]: 9, [B]: 3 }));
    expect(mount().app!.ratings).toEqual({ [B]: 3 });
  });
});

describe("R2: importData recarga las valoraciones", () => {
  beforeEach(() => localStorage.clear());

  it("sustituye las valoraciones del contexto y de localStorage", () => {
    localStorage.setItem("mp_u_ratings", JSON.stringify({ [A]: 5 }));
    const ref = mount();
    expect(ref.app!.ratings).toEqual({ [A]: 5 });

    act(() => ref.app!.importData({ ...EMPTY_USER_DATA, recipes: SEED, ratings: { [B]: 2, [C]: 4 } }));

    expect(ref.app!.ratings).toEqual({ [B]: 2, [C]: 4 });
    expect(stored("u")).toEqual({ [B]: 2, [C]: 4 });
  });

  it("una copia sin valoraciones las deja vacías", () => {
    localStorage.setItem("mp_u_ratings", JSON.stringify({ [A]: 5 }));
    const ref = mount();
    act(() => ref.app!.importData({ ...EMPTY_USER_DATA, recipes: SEED }));
    expect(ref.app!.ratings).toEqual({});
  });
});
