// @vitest-environment jsdom
// #116 (review de docs/pm/78-plan-navegar-semanas): pasar artículos a la Despensa también limpia las marcas
// caducadas de la semana, como cualquier otra escritura de la lista (review N6 de lista-compra).
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useShoppingList } from "@/lib/shopping/useShoppingList";
import type { ShoppingState } from "@/lib/shopping/state";
import { todayStr } from "@/lib/types";
import { mondayOf } from "@/lib/week";
import { GUISO, SOBRAS_RECIPES } from "../fixtures/sobras";

const monday = mondayOf(todayStr());
const app = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/lib/store", () => ({ useApp: () => app.current }));

describe("#116: mover a la Despensa poda las marcas caducadas", () => {
  it("una marca cuyo artículo ya no está en el plan desaparece al mover otro artículo", () => {
    const setShopping = vi.fn();
    const shopping: ShoppingState = {
      weeks: { [monday]: { week: monday, bought: { "ya-no-esta": "1 kg" }, overrides: [], moved: {} } },
    };
    app.current = {
      profile: null,
      weekPlan: { [monday]: [{ mealType: "Comida", recipeId: GUISO.id }] },
      recipes: SOBRAS_RECIPES,
      pantry: [],
      shopping,
      setShopping,
      addPantryItems: vi.fn(),
      removePantryItems: vi.fn(),
    };
    const { result } = renderHook(() => useShoppingList(monday));
    const { toBuy, haveIt, basics } = result.current.view;
    const { item } = [...Object.values(toBuy).flat(), ...haveIt, ...basics][0];
    act(() => {
      result.current.moveToPantry([{ item, category: "Despensa" }]);
    });

    const next = (setShopping.mock.calls[0][0] as (prev: ShoppingState) => ShoppingState)(shopping);
    expect(next.weeks[monday].bought).not.toHaveProperty("ya-no-esta");
    expect(next.weeks[monday].moved).toHaveProperty(item.key);
    expect(next.lastMove?.week).toBe(monday);
  });
});
