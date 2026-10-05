// @vitest-environment jsdom
// Spec: docs/pm/recetas-almacenamiento/spec.md › Acceptance criteria R1 (un cambio en src/data/recipes.json llega a una
// cuenta existente al recargar, sin migrar datos). El JSON se mockea con un catálogo "nuevo" distinto al que la cuenta
// tenía copiado, que es lo que pasa cuando Manuel corrige una receta y despliega.
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import { AI_RECIPE } from "../fixtures/backup";

const { NEW_CATALOG, OLD_COPY } = vi.hoisted(() => {
  const base = {
    ingredients: ["100g avena"],
    instructions: ["Mezclar."],
    prepTimeMinutes: 5,
    protein: 10,
    carbs: 40,
    fat: 5,
    tags: ["desayuno"],
  };
  return {
    // Catálogo del bundle ahora: macros corregidas en la 001, campo nuevo (cuisine) y una receta nueva (003)
    NEW_CATALOG: [
      { ...base, id: "recipe_001", name: "Porridge", calories: 350, cuisine: "Mediterránea" },
      { ...base, id: "recipe_002", name: "Tostada", calories: 250 },
      { ...base, id: "recipe_003", name: "Receta nueva", calories: 300 },
    ],
    // Lo que la cuenta tenía guardado antes de la corrección
    OLD_COPY: [
      { ...base, id: "recipe_001", name: "Porridge", calories: 400 },
      { ...base, id: "recipe_002", name: "Tostada", calories: 250 },
    ],
  };
});

vi.mock("@/data/recipes.json", () => ({ default: { recipes: NEW_CATALOG } }));

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

describe("R1: un cambio del catálogo llega a una cuenta existente sin tocar sus datos", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mp_u_recipes", JSON.stringify([...OLD_COPY, AI_RECIPE]));
  });

  it("la macro corregida, el campo nuevo y la receta nueva se ven al recargar", () => {
    const ref = mount();
    const byId = (id: string) => ref.app!.recipes.find((r) => r.id === id) as (Recipe & { cuisine?: string }) | undefined;
    expect(byId("recipe_001")?.calories).toBe(350);
    expect(byId("recipe_001")?.cuisine).toBe("Mediterránea");
    expect(byId("recipe_003")?.name).toBe("Receta nueva");
  });

  it("las recetas del usuario siguen igual y lo guardado queda solo con ellas", () => {
    const ref = mount();
    expect(ref.app!.recipes.find((r) => r.id === AI_RECIPE.id)).toEqual(AI_RECIPE);
    expect(JSON.parse(localStorage.getItem("mp_u_recipes")!)).toEqual([AI_RECIPE]);
  });
});
