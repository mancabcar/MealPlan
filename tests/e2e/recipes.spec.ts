// Spec: docs/pm/onboarding-profile/spec.md › R18 (aviso cuando se descartan todas las recetas).
// Se intercepta /api/recipes en el navegador: el filtro del servidor lo cubre tests/unit/recipes-route.test.ts.
import { expect, test } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { signIn } from "./helpers";

test("R18: si todas las recetas llevaban alérgenos, se avisa en vez de mostrar una lista vacía", async ({ page }) => {
  await signIn(page, { profile: { ...lucia, allergies: { preset: ["frutos_secos"], custom: [] } } });
  await page.route("**/api/recipes", (route) => route.fulfill({ json: { recipes: [], droppedCount: 3 } }));
  await page.goto("/recetas");

  await page.getByRole("button", { name: /Generar|✨/ }).first().click();
  await expect(page.getByText("Ninguna receta era segura para tus alergias. Prueba de nuevo.")).toBeVisible();
});
