// @vitest-environment jsdom
// Review de #120 (docs/pm/23-agua-fibra-micros/review.md › Blocking 1): quien ya tenía recetas del catálogo guardadas
// antes de que el catálogo trajera fibra (#119) debe ver la fibra (R4). Desde #42 el catálogo no se guarda: se lee del
// bundle en cada carga, así que la fibra llega sin ningún relleno al cargar.
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { AppProvider, useApp } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const SEED = seedData.recipes as Recipe[];
const withoutFiber = (r: Recipe): Recipe => {
  const { fiber: _fiber, ...rest } = r;
  void _fiber;
  return rest;
};

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

describe("R4: la fibra del catálogo llega a las cuentas con recetas guardadas sin ella", () => {
  beforeEach(() => localStorage.clear());

  it("una cuenta con el catálogo guardado sin fibra ve la fibra del catálogo", () => {
    localStorage.setItem("mp_u_recipes", JSON.stringify(SEED.map(withoutFiber)));
    const ref = mount();
    expect(ref.app!.recipes).toHaveLength(SEED.length);
    for (const r of ref.app!.recipes) expect(r.fiber, r.id).toBe(SEED.find((s) => s.id === r.id)!.fiber);
  });

  it("no toca las recetas propias: siguen sin fibra si no la tenían", () => {
    const custom: Recipe = { ...withoutFiber(SEED[0]), id: "custom_abc", isCustom: true };
    localStorage.setItem("mp_u_recipes", JSON.stringify([custom]));
    const mine = mount().app!.recipes.find((r) => r.id === "custom_abc");
    expect(mine).toEqual(custom);
    expect(mine).not.toHaveProperty("fiber");
  });
});
