// Spec: docs/pm/onboarding-profile/spec.md › R8 y edge case "Diary entries for a meal the user later deselects".
import { expect, test } from "@playwright/test";
import { manuel } from "../fixtures/profiles";
import { signIn, TODAY } from "./helpers";

const MANUEL_MEALS = ["Desayuno", "Media mañana", "Comida", "Pre-entreno", "Cena"];

test("R8: el plan semanal muestra exactamente las 5 comidas de Manuel, en orden", async ({ page }) => {
  await signIn(page, { profile: manuel });
  await page.goto("/plan");

  // Rediseño visual (docs/pm/design-refresh, R8): el selector de días horizontal sustituyó la lista
  // vertical de 7 secciones — solo se muestran las franjas del día seleccionado. Se selecciona el
  // lunes de la semana actual explícitamente (por defecto se muestra el día de hoy).
  await page.getByRole("tab", { name: /^Lunes/ }).click();
  await expect(page.getByRole("heading", { name: "Lunes", level: 2 })).toBeVisible();
  const rows = await page
    .getByRole("button")
    .filter({ hasText: /Desayuno|Media mañana|Comida|Merienda|Pre-entreno|Cena/ })
    .allTextContents();
  expect(rows.map((r) => MANUEL_MEALS.find((m) => r.includes(m)) ?? r)).toEqual(MANUEL_MEALS);
  await expect(page.getByText("Merienda")).toHaveCount(0);
});

test("R8: al añadir al diario solo se ofrecen las 5 comidas de Manuel, en orden", async ({ page }) => {
  await signIn(page, { profile: manuel });
  await page.goto("/");
  // Rediseño visual (docs/pm/design-refresh): el "+" pasa a ser un icono Lucide, el texto ya no lo incluye.
  await page.getByRole("button", { name: "Añadir comida" }).click();

  const select = page.getByLabel("Comida del día");
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  expect(options.map((o) => o.trim())).toEqual(MANUEL_MEALS);
});

test("Edge case: una entrada de una comida ya desmarcada sigue visible en el diario", async ({ page }) => {
  await signIn(page, {
    profile: manuel, // sin Merienda
    entries: [
      { id: "e1", date: TODAY, mealType: "Merienda", customName: "Manzana", calories: 80, protein: 0, carbs: 20, fat: 0 },
    ],
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Merienda/ })).toBeVisible();
  await expect(page.getByText("Manzana")).toBeVisible();
});
