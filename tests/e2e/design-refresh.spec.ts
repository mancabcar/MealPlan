// Spec: docs/pm/design-refresh/spec.md › R2, R7, R8, R9.
// Cobertura nueva señalada por tech.md § Testing strategy / Test coverage (tarea 13): el resaltado de
// pestaña activa en la barra inferior, el cambio de día en el selector de Plan, la presencia del
// anillo de calorías + gráfico de 7 días en Diario, y el marcado de la checklist de ingredientes.
import { expect, test } from "@playwright/test";
import { lucia, manuel } from "../fixtures/profiles";
import { signIn, TODAY } from "./helpers";

test("R2: la barra de navegación inferior resalta la pestaña activa", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });

  await expect(nav.getByRole("link", { name: "Diario" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Plan" })).not.toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { name: "Plan semanal" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Diario" })).not.toHaveAttribute("aria-current", "page");
});

test("R8: el selector de días cambia las franjas mostradas", async ({ page }) => {
  // TODAY = 2026-09-22 es martes; el lunes de esa semana es 2026-09-21.
  await signIn(page, {
    profile: manuel,
    weekplan: {
      "2026-09-21": [{ mealType: "Desayuno", recipeId: "recipe_001" }],
      [TODAY]: [{ mealType: "Desayuno", recipeId: "recipe_002" }],
    },
  });
  await page.goto("/plan");

  // Por defecto se selecciona hoy (martes)
  await expect(page.getByRole("heading", { name: "Martes", level: 2 })).toBeVisible();
  await expect(page.getByText("Pollo a la plancha con arroz y brócoli")).toBeVisible();

  await page.getByRole("tab", { name: /^Lunes/ }).click();
  await expect(page.getByRole("heading", { name: "Lunes", level: 2 })).toBeVisible();
  await expect(page.getByText("Tortilla de claras con verduras")).toBeVisible();
  await expect(page.getByText("Pollo a la plancha con arroz y brócoli")).toHaveCount(0);
});

test("R7: el Diario muestra el anillo de calorías y el gráfico de 7 días", async ({ page }) => {
  await signIn(page, {
    profile: lucia,
    entries: [{ id: "e1", date: TODAY, mealType: "Comida", customName: "Pollo con arroz", calories: 600, protein: 40, carbs: 60, fat: 15 }],
  });
  await page.goto("/");
  // ProgressRing: <svg role="img" aria-label="{consumidas} kcal">
  await expect(page.getByRole("img", { name: "600 kcal" })).toBeVisible();
  await expect(page.getByText("600 / 1750")).toBeVisible();
  await expect(page.getByText("Calorías esta semana")).toBeVisible();
});

test("R9: la checklist de ingredientes de una receta se puede marcar", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/recetas");
  // Las tarjetas de receta son los únicos botones que muestran "kcal" (evita el botón "Sugerir con IA").
  await page.getByRole("button").filter({ hasText: "kcal" }).first().click();

  const firstIngredient = page.getByRole("listitem").first().getByRole("checkbox");
  await expect(firstIngredient).not.toBeChecked();
  await firstIngredient.check();
  await expect(firstIngredient).toBeChecked();
});
