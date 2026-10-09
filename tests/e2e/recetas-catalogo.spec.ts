// Spec: docs/pm/recetas-almacenamiento/spec.md › Acceptance criteria R3, R6 y R7 (relajado).
// Una cuenta con el catálogo copiado en localStorage (como lo dejaba la app antes de separarlo) más una receta de IA y
// una propia: al cargar, el almacén queda solo con las del usuario y el resto de la app se ve igual.
import { expect, test } from "@playwright/test";
import seedData from "../../src/data/recipes.json";
import { AI_RECIPE } from "../fixtures/backup";
import { lucia } from "../fixtures/profiles";
import { BOWL_POLLO } from "../fixtures/recetas-propias";
import { readStored, signIn, TODAY } from "./helpers";

const SEED = seedData.recipes;
const COMIDA = SEED[3];
const CENA = SEED[5];

test("R3, R6: una cuenta con el catálogo guardado migra y su recetario, plan, diario y favoritos siguen igual", async ({ page }) => {
  await signIn(page, {
    profile: lucia,
    recipes: [...SEED, AI_RECIPE, BOWL_POLLO],
    weekplan: { [TODAY]: [{ mealType: "Comida", recipeId: COMIDA.id }] },
    entries: [
      { id: "e1", date: TODAY, mealType: "Cena", recipeId: CENA.id, calories: CENA.calories, protein: CENA.protein, carbs: CENA.carbs, fat: CENA.fat },
    ],
    favorites: [COMIDA.id],
  });

  // Recetas: el catálogo se ve una sola vez cada receta, y las del usuario siguen ahí
  await page.goto("/recetas");
  await expect(page.getByText(COMIDA.name, { exact: true })).toHaveCount(1);
  await expect(page.getByText(AI_RECIPE.name, { exact: true })).toHaveCount(1);
  await expect(page.getByText(BOWL_POLLO.name, { exact: true })).toHaveCount(1);

  // Lo guardado: solo las del usuario (R3)
  const stored = await readStored<{ id: string }[]>(page, "recipes");
  expect(stored.map((r) => r.id)).toEqual([AI_RECIPE.id, BOWL_POLLO.id]);

  // El resto de claves no cambia (R6)
  expect(await readStored<string[]>(page, "favorites")).toEqual([COMIDA.id]);
  expect((await readStored<Record<string, { recipeId: string }[]>>(page, "weekplan"))[TODAY][0].recipeId).toBe(COMIDA.id);

  // Plan y Diario siguen mostrando el nombre de la receta del catálogo
  await page.goto("/plan");
  await expect(page.getByText(COMIDA.name)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(CENA.name)).toBeVisible();
});

test("R7: un hueco del plan con un id sin receta no rompe el Plan y se queda como 'Añadir'", async ({ page }) => {
  await signIn(page, {
    profile: lucia,
    weekplan: {
      [TODAY]: [
        { mealType: "Comida", recipeId: COMIDA.id },
        { mealType: "Cena", recipeId: "recipe_999" },
      ],
    },
  });

  await page.goto("/plan");
  await expect(page.getByText(COMIDA.name)).toBeVisible();
  await expect(page.getByRole("button", { name: /Cena/ }).filter({ hasText: "Añadir" })).toBeVisible();

  // No se limpia en silencio
  const plan = await readStored<Record<string, { recipeId: string }[]>>(page, "weekplan");
  expect(plan[TODAY].map((s) => s.recipeId)).toContain("recipe_999");
});
