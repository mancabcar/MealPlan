// Review de #120 (docs/pm/23-agua-fibra-micros/review.md › Blocking 1): las recetas semilla que el usuario ya tenía
// guardadas antes de que el catálogo trajera fibra (#119) deben recibirla al cargar (R4), no solo las recetas nuevas.
import { describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { withSeedRecipes } from "@/lib/userData";
import type { Recipe } from "@/lib/types";

const SEED = seedData.recipes as Recipe[];
const withoutFiber = (r: Recipe): Recipe => {
  const { fiber: _fiber, ...rest } = r;
  void _fiber;
  return rest;
};

describe("R4: la fibra del catálogo llega a las recetas semilla ya guardadas", () => {
  it("una receta semilla guardada sin fibra la recupera del catálogo", () => {
    const stored = SEED.map(withoutFiber);
    const loaded = withSeedRecipes(stored);
    for (const r of loaded) expect(r.fiber, r.id).toBe(SEED.find((s) => s.id === r.id)!.fiber);
    expect(loaded.length).toBe(SEED.length);
  });

  it("no pisa una fibra ya guardada", () => {
    const stored = [{ ...SEED[0], fiber: 99 }];
    expect(withSeedRecipes(stored).find((r) => r.id === SEED[0].id)!.fiber).toBe(99);
  });

  it("no toca las recetas propias ni las que no son del catálogo", () => {
    const custom: Recipe = { ...withoutFiber(SEED[0]), id: "custom_abc", isCustom: true };
    const loaded = withSeedRecipes([custom]);
    expect(loaded.find((r) => r.id === "custom_abc")).toEqual(custom);
    expect(loaded.find((r) => r.id === "custom_abc")).not.toHaveProperty("fiber");
  });

  it("es idempotente", () => {
    const once = withSeedRecipes(SEED.map(withoutFiber));
    expect(withSeedRecipes(once)).toEqual(once);
  });
});
