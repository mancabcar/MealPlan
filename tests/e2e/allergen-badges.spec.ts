// Decisión de PM (2026-09-22, spec feedback #2): aviso no bloqueante de alérgenos en el recetario
// y en los selectores de recetas del plan semanal y del diario.
import { expect, test } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { signIn } from "./helpers";

// recipe_003 "Yogur griego con avena, plátano y nueces" lleva nueces
const allergic = { ...lucia, allergies: { preset: ["frutos_secos"], custom: [] } };

test("Recetas: la receta con nueces muestra '⚠ contiene Frutos secos'", async ({ page }) => {
  await signIn(page, { profile: allergic });
  await page.goto("/recetas");
  const card = page.getByRole("button").filter({ hasText: "Yogur griego con avena" });
  await expect(card.getByText("⚠ contiene Frutos secos")).toBeVisible();
  // Recetas sin alérgenos no llevan aviso
  await expect(page.getByText("⚠ contiene")).toHaveCount(1);
});

test("Diario: el selector de recetas avisa del alérgeno sin bloquear la elección", async ({ page }) => {
  await signIn(page, { profile: allergic });
  await page.goto("/");
  // Rediseño visual (docs/pm/design-refresh): el "+" pasa a ser un icono Lucide, el texto ya no lo incluye.
  await page.getByRole("button", { name: "Añadir comida" }).click();
  const option = page.locator("option").filter({ hasText: "Yogur griego con avena" });
  await expect(option).toContainText("⚠ contiene Frutos secos");
});

test("Plan: el selector de recetas avisa del alérgeno", async ({ page }) => {
  await signIn(page, { profile: allergic });
  await page.goto("/plan");
  await page.getByRole("button", { name: /Desayuno/ }).first().click();
  const option = page.locator("option").filter({ hasText: "Yogur griego con avena" });
  await expect(option).toContainText("⚠ contiene Frutos secos");
});

test("Sin alergias declaradas no hay avisos", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/recetas");
  await expect(page.getByText("Yogur griego con avena")).toBeVisible();
  await expect(page.getByText("⚠ contiene")).toHaveCount(0);
});
