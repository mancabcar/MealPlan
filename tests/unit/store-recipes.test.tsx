// @vitest-environment jsdom
// Spec: docs/pm/18-recetas-propias/spec.md › Acceptance criteria R2, R3, R6, R8.
// Tech: docs/pm/18-recetas-propias/tech.md › APIs / interfaces: el store gana
//   - saveRecipe(r): alta si el id no existe, edición si ya hay una con ese id (como saveMeasurement).
//   - removeRecipe(id): escribe entradas → plan → recetas, en ese orden (la receta al final: si algo falla antes no se
//     pierde nada). Reutiliza withoutRecipe (tests/unit/recipe-edit.test.ts).
// Fallan hasta que existan saveRecipe/removeRecipe (tarea 2 del tech design).
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import type { MealEntry, Recipe, WeekPlan } from "@/lib/types";
import {
  BOWL_POLLO,
  ENTRADAS,
  ENTRY_BOWL,
  ENTRY_MACARRONES,
  MACARRONES_MAMA,
  PLAN_CON_MACARRONES,
  SEMILLA_TORTILLA,
} from "../fixtures/recetas-propias";

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

const stored = <T,>(k: string): T => JSON.parse(localStorage.getItem(`mp_u_${k}`) ?? "null");
const seed = (data: { recipes?: Recipe[]; entries?: MealEntry[]; weekplan?: WeekPlan }) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(`mp_u_${k}`, JSON.stringify(v));
};

describe("R2: saveRecipe da de alta o edita por id", () => {
  beforeEach(() => localStorage.clear());

  it("con un id nuevo añade la receta al estado y a localStorage, sin tocar las demás", () => {
    const ref = mount();
    const before = ref.app!.recipes.length;
    act(() => ref.app!.saveRecipe(MACARRONES_MAMA));
    expect(ref.app!.recipes).toHaveLength(before + 1);
    expect(ref.app!.recipes.at(-1)).toEqual(MACARRONES_MAMA);
    expect(stored<Recipe[]>("recipes").find((r) => r.id === MACARRONES_MAMA.id)).toEqual(MACARRONES_MAMA);
  });

  it("con un id existente sustituye esa receta en su sitio: mismo número de recetas, mismo orden", () => {
    seed({ recipes: [MACARRONES_MAMA, BOWL_POLLO] });
    const ref = mount();
    const ids = ref.app!.recipes.map((r) => r.id);
    const edited = { ...MACARRONES_MAMA, name: "Macarrones de la abuela", calories: 500 };
    act(() => ref.app!.saveRecipe(edited));
    expect(ref.app!.recipes.map((r) => r.id)).toEqual(ids);
    expect(ref.app!.recipes.find((r) => r.id === MACARRONES_MAMA.id)).toEqual(edited);
    expect(stored<Recipe[]>("recipes").find((r) => r.id === MACARRONES_MAMA.id)).toEqual(edited);
  });

  it("dos altas seguidas en el mismo evento se conservan las dos", () => {
    const ref = mount();
    act(() => {
      ref.app!.saveRecipe(MACARRONES_MAMA);
      ref.app!.saveRecipe(BOWL_POLLO);
    });
    expect(ref.app!.recipes.filter((r) => r.isCustom).map((r) => r.id)).toEqual([MACARRONES_MAMA.id, BOWL_POLLO.id]);
  });

  it("una receta propia guardada sobrevive a la siembra de semillas al recargar", () => {
    seed({ recipes: [MACARRONES_MAMA] });
    const ref = mount();
    expect(ref.app!.recipes.find((r) => r.id === MACARRONES_MAMA.id)).toEqual(MACARRONES_MAMA);
    expect(ref.app!.recipes.some((r) => r.id === SEMILLA_TORTILLA.id)).toBe(true);
  });
});

describe("R6: editar una receta no cambia las entradas ya registradas en el Diario", () => {
  beforeEach(() => localStorage.clear());

  it("cambiar los macros de la receta deja las entradas con los macros con los que se registraron", () => {
    seed({ recipes: [MACARRONES_MAMA], entries: ENTRADAS });
    const ref = mount();
    act(() => ref.app!.saveRecipe({ ...MACARRONES_MAMA, calories: 900, protein: 60, carbs: 90, fat: 40 }));
    expect(ref.app!.entries).toEqual(ENTRADAS);
    expect(stored<MealEntry[]>("entries")).toEqual(ENTRADAS);
    expect(ref.app!.entries.find((e) => e.id === ENTRY_MACARRONES.id)).toMatchObject({ calories: 480, protein: 32, carbs: 45, fat: 18 });
  });
});

describe("R3 / R8: removeRecipe", () => {
  beforeEach(() => localStorage.clear());

  it("R8: borra la receta, y sus entradas del Diario pasan a comida suelta con nombre y macros", () => {
    seed({ recipes: [MACARRONES_MAMA, BOWL_POLLO], entries: ENTRADAS, weekplan: PLAN_CON_MACARRONES });
    const ref = mount();
    act(() => ref.app!.removeRecipe(MACARRONES_MAMA.id));
    expect(ref.app!.recipes.some((r) => r.id === MACARRONES_MAMA.id)).toBe(false);
    expect(ref.app!.recipes.some((r) => r.id === BOWL_POLLO.id)).toBe(true);
    const kept = ref.app!.entries.find((e) => e.id === ENTRY_MACARRONES.id)!;
    expect(kept).toMatchObject({ customName: "Macarrones de mamá", calories: 480, protein: 32, carbs: 45, fat: 18 });
    expect(kept).not.toHaveProperty("recipeId");
    expect(ref.app!.entries).toHaveLength(ENTRADAS.length);
    expect(ref.app!.entries.find((e) => e.id === ENTRY_BOWL.id)).toEqual(ENTRY_BOWL);
  });

  it("R3: vacía todas las franjas del Plan con esa receta, incluida la tanda de sobras, y deja las demás", () => {
    seed({ recipes: [MACARRONES_MAMA, BOWL_POLLO], entries: ENTRADAS, weekplan: PLAN_CON_MACARRONES });
    const ref = mount();
    act(() => ref.app!.removeRecipe(MACARRONES_MAMA.id));
    const slots = Object.values(ref.app!.weekPlan).flat();
    expect(slots).toEqual([{ mealType: "Comida", recipeId: BOWL_POLLO.id }]);
  });

  it("persiste las tres claves: recetas, entradas y plan", () => {
    seed({ recipes: [MACARRONES_MAMA, BOWL_POLLO], entries: ENTRADAS, weekplan: PLAN_CON_MACARRONES });
    const ref = mount();
    act(() => ref.app!.removeRecipe(MACARRONES_MAMA.id));
    expect(stored<Recipe[]>("recipes").some((r) => r.id === MACARRONES_MAMA.id)).toBe(false);
    expect(stored<MealEntry[]>("entries").every((e) => e.recipeId !== MACARRONES_MAMA.id)).toBe(true);
    expect(Object.values(stored<WeekPlan>("weekplan")).flat().every((s) => s.recipeId !== MACARRONES_MAMA.id)).toBe(true);
  });

  it("escribe primero las entradas, luego el plan y la receta al final (orden seguro del tech design)", () => {
    seed({ recipes: [MACARRONES_MAMA, BOWL_POLLO], entries: ENTRADAS, weekplan: PLAN_CON_MACARRONES });
    const ref = mount();
    const writes: string[] = [];
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      writes.push(key.replace("mp_u_", ""));
      original.call(this, key, value);
    });
    act(() => ref.app!.removeRecipe(MACARRONES_MAMA.id));
    spy.mockRestore();
    expect(writes.filter((k) => ["entries", "weekplan", "recipes"].includes(k))).toEqual(["entries", "weekplan", "recipes"]);
  });

  it("borrar una receta que no está en el Plan ni en el Diario solo quita la receta", () => {
    seed({ recipes: [MACARRONES_MAMA, BOWL_POLLO], entries: [ENTRY_BOWL], weekplan: {} });
    const ref = mount();
    act(() => ref.app!.removeRecipe(MACARRONES_MAMA.id));
    expect(ref.app!.entries).toEqual([ENTRY_BOWL]);
    expect(ref.app!.weekPlan).toEqual({});
  });
});
