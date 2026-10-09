// @vitest-environment jsdom
// Spec: docs/pm/recetas-almacenamiento/spec.md › Acceptance criteria R2, R3, R4, R6 y R7 (relajado: el hueco huérfano
// no rompe nada y se queda como está).
// Tech: tech.md › Design › Components & files: AppProvider guarda solo las recetas del usuario y expone
// recipes = [...catálogo, ...usuario]. R1 (un cambio del JSON llega sin migrar) está en store-catalog-change.test.tsx,
// que mockea el JSON.
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { buildBackup } from "@/lib/backup";
import { AppProvider, useApp } from "@/lib/store";
import type { MealEntry, Recipe, WeekPlan } from "@/lib/types";
import { AI_RECIPE } from "../fixtures/backup";
import { BOWL_POLLO } from "../fixtures/recetas-propias";

const SEED = seedData.recipes as Recipe[];
const AI_2: Recipe = { ...AI_RECIPE, id: "ai_k3x9_1", name: "Pollo al limón con quinoa" };

function mount() {
  const ref: { app: ReturnType<typeof useApp> | null } = { app: null };
  function Probe() {
    ref.app = useApp();
    return null;
  }
  const view = render(
    <AppProvider userId="u">
      <Probe />
    </AppProvider>,
  );
  return { ref, view };
}

const stored = <T,>(k: string): T => JSON.parse(localStorage.getItem(`mp_u_${k}`) ?? "null");
const storedRecipes = () => stored<Recipe[] | null>("recipes") ?? [];
const seedStorage = (data: { recipes?: Recipe[]; entries?: MealEntry[]; weekplan?: WeekPlan; favorites?: string[] }) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(`mp_u_${k}`, JSON.stringify(v));
};

describe("R2: en localStorage solo se guardan recetas del usuario", () => {
  beforeEach(() => localStorage.clear());

  it("una cuenta nueva ve el catálogo pero no lo guarda", () => {
    const { ref } = mount();
    expect(ref.app!.recipes.map((r) => r.id)).toEqual(SEED.map((r) => r.id));
    expect(storedRecipes()).toEqual([]);
  });

  it("addRecipes (IA) guarda solo las nuevas y las suma al catálogo en el estado", () => {
    const { ref } = mount();
    act(() => ref.app!.addRecipes([AI_RECIPE, AI_2]));
    expect(storedRecipes()).toEqual([AI_RECIPE, AI_2]);
    expect(ref.app!.recipes).toHaveLength(SEED.length + 2);
  });

  it("saveRecipe (alta y edición) toca solo lo guardado del usuario", () => {
    const { ref } = mount();
    act(() => ref.app!.saveRecipe(BOWL_POLLO));
    expect(storedRecipes()).toEqual([BOWL_POLLO]);
    const edited = { ...BOWL_POLLO, calories: 555 };
    act(() => ref.app!.saveRecipe(edited));
    expect(storedRecipes()).toEqual([edited]);
    expect(ref.app!.recipes.find((r) => r.id === BOWL_POLLO.id)).toEqual(edited);
  });

  it("removeRecipe de una receta del usuario la quita de lo guardado y deja el catálogo intacto", () => {
    seedStorage({ recipes: [AI_RECIPE, BOWL_POLLO] });
    const { ref } = mount();
    act(() => ref.app!.removeRecipe(AI_RECIPE.id));
    expect(storedRecipes()).toEqual([BOWL_POLLO]);
    expect(ref.app!.recipes).toHaveLength(SEED.length + 1);
  });
});

describe("R3: al cargar, el catálogo guardado se quita y las recetas del usuario se conservan", () => {
  beforeEach(() => localStorage.clear());

  it("catálogo + 2 de IA + 1 propia guardados → en localStorage quedan esas 3, y el estado tiene catálogo + 3", () => {
    seedStorage({ recipes: [...SEED, AI_RECIPE, AI_2, BOWL_POLLO] });
    const { ref } = mount();
    expect(storedRecipes()).toEqual([AI_RECIPE, AI_2, BOWL_POLLO]);
    expect(ref.app!.recipes).toHaveLength(SEED.length + 3);
    expect(ref.app!.recipes.filter((r) => r.isAIGenerated || r.isCustom).map((r) => r.id)).toEqual([
      AI_RECIPE.id,
      AI_2.id,
      BOWL_POLLO.id,
    ]);
  });

  it("recargar de nuevo no cambia lo guardado (idempotente)", () => {
    seedStorage({ recipes: [...SEED, AI_RECIPE] });
    mount().view.unmount();
    const afterFirst = localStorage.getItem("mp_u_recipes");
    mount();
    expect(localStorage.getItem("mp_u_recipes")).toBe(afterFirst);
    expect(storedRecipes()).toEqual([AI_RECIPE]);
  });

  it("una receta guardada con id del catálogo y contenido distinto se quita y se ve la versión del JSON", () => {
    seedStorage({ recipes: [{ ...SEED[0], name: "Nombre viejo", calories: 1 }] });
    const { ref } = mount();
    expect(storedRecipes()).toEqual([]);
    expect(ref.app!.recipes.find((r) => r.id === SEED[0].id)).toEqual(SEED[0]);
  });
});

describe("R4: la copia de seguridad exporta solo las recetas del usuario", () => {
  beforeEach(() => localStorage.clear());

  it("cuenta con el catálogo guardado de antes: tras cargar, la copia lleva solo las de IA y propias", () => {
    seedStorage({ recipes: [...SEED, AI_RECIPE, BOWL_POLLO] });
    mount();
    expect(buildBackup(localStorage, "u").data.recipes).toEqual([AI_RECIPE, BOWL_POLLO]);
  });
});

describe("R6: el plan, el diario y los favoritos que referencian el catálogo no cambian", () => {
  beforeEach(() => localStorage.clear());

  const recipe = SEED[3];
  const plan: WeekPlan = { "2026-09-22": [{ mealType: "Comida", recipeId: recipe.id }] };
  const entries: MealEntry[] = [
    { id: "e1", date: "2026-09-22", mealType: "Cena", recipeId: recipe.id, calories: 400, protein: 30, carbs: 20, fat: 10 },
  ];

  it("lo guardado se conserva y la receta sigue resolviéndose por id", () => {
    seedStorage({ recipes: [...SEED, AI_RECIPE], weekplan: plan, entries, favorites: [recipe.id] });
    const { ref } = mount();
    expect(stored("weekplan")).toEqual(plan);
    expect(stored("entries")).toEqual(entries);
    expect(stored("favorites")).toEqual([recipe.id]);
    expect(ref.app!.recipes.find((r) => r.id === recipe.id)).toEqual(recipe);
  });

  it("marcar y desmarcar como favorita una receta del catálogo funciona sin tenerla guardada", () => {
    const { ref } = mount();
    act(() => ref.app!.toggleFavorite(recipe.id));
    expect(stored("favorites")).toEqual([recipe.id]);
    act(() => ref.app!.toggleFavorite(recipe.id));
    expect(stored("favorites")).toEqual([]);
  });
});

describe("R7 (relajado): un id sin receta no rompe nada y no se limpia en silencio", () => {
  beforeEach(() => localStorage.clear());

  it("un hueco del plan con un id huérfano se conserva y no aparece ninguna receta nueva", () => {
    const plan: WeekPlan = { "2026-09-22": [{ mealType: "Cena", recipeId: "recipe_999" }] };
    seedStorage({ weekplan: plan });
    const { ref } = mount();
    expect(stored("weekplan")).toEqual(plan);
    expect(ref.app!.recipes.some((r) => r.id === "recipe_999")).toBe(false);
  });
});
