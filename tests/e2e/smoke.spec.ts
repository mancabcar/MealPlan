import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("sin sesión se muestra la pantalla de acceso", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /MealPlanner/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
});

test("con sesión y sin perfil empieza el onboarding", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await expect(page.getByLabel("¿Cómo te llamas?")).toBeVisible();
});
