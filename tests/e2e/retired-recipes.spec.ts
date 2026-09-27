// Recetas semilla duplicadas retiradas (src/lib/migrate.ts › RETIRED_RECIPE_IDS): quien ya las tenía guardadas
// deja de verlas repetidas, y su plan y su diario pasan a la receta que se queda.
import { expect, test } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { readStored, signIn, TODAY } from "./helpers";

// Copias guardadas de las recetas retiradas, como las sembraba la app antes de quitarlas del JSON
const oldCopy = (id: string, name: string, calories: number) => ({
  id, name, ingredients: ["80g lentejas (en seco)"], instructions: ["Cocer."], prepTimeMinutes: 45,
  calories, protein: 22, carbs: 58, fat: 4, tags: ["comida"],
});
const recipes = [
  oldCopy("recipe_009", "Lentejas estofadas con verduras", 380),
  oldCopy("recipe_010", "Revuelto de champiñones y gambas", 290),
  oldCopy("recipe_012", "Merluza en salsa verde con guisantes", 320),
];

test("quien tenía guardadas las recetas duplicadas deja de verlas repetidas y su plan y su diario siguen enlazados", async ({ page }) => {
  await signIn(page, {
    profile: lucia,
    recipes,
    weekplan: { [TODAY]: [{ mealType: "Comida", recipeId: "recipe_009" }] },
    entries: [
      { id: "e1", date: TODAY, mealType: "Cena", recipeId: "recipe_010", calories: 290, protein: 30, carbs: 4, fat: 17 },
    ],
  });

  await page.goto("/recetas");
  await expect(page.getByText("Lentejas estofadas con verduras", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Merluza en salsa verde con guisantes", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Revuelto de champiñones y gambas", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Revuelto de gambas y champiñones", { exact: true })).toHaveCount(1);

  const stored = await readStored<{ id: string }[]>(page, "recipes");
  expect(stored.map((r) => r.id)).not.toContain("recipe_009");

  // El diario sigue mostrando el nombre de la receta (no "Receta") y conserva sus macros
  await page.goto("/");
  await expect(page.getByText("Revuelto de gambas y champiñones")).toBeVisible();
  expect((await readStored<{ recipeId: string }[]>(page, "entries"))[0].recipeId).toBe("recipe_022");

  await page.goto("/plan");
  await expect(page.getByText("Lentejas estofadas con verduras")).toBeVisible();
  expect((await readStored<Record<string, { recipeId: string }[]>>(page, "weekplan"))[TODAY][0].recipeId).toBe("recipe_017");
});
