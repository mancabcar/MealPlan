// Spec: R17 + decisión de PM (2026-09-22): con rango, cualquier valor dentro de la banda cuenta como cumplido.
import { expect, test } from "@playwright/test";
import { manuel } from "../fixtures/profiles";
import { signIn, TODAY } from "./helpers";

const entry = (protein: number) => ({
  id: `e${protein}`,
  date: TODAY,
  mealType: "Comida",
  customName: "Pollo con arroz",
  calories: 600,
  protein,
  carbs: 60,
  fat: 15,
});

test("R17: 140 g con un rango 130–170 se marca como cumplido", async ({ page }) => {
  await signIn(page, { profile: manuel, entries: [entry(140)] });
  await page.goto("/");
  await expect(page.getByText("✓ 140 / 130–170", { exact: true })).toBeVisible();
});

test("R17: por debajo del mínimo no se marca como cumplido", async ({ page }) => {
  await signIn(page, { profile: manuel, entries: [entry(120)] });
  await page.goto("/");
  await expect(page.getByText("120 / 130–170", { exact: true })).toBeVisible();
  await expect(page.getByText("✓ 120 / 130–170")).toHaveCount(0);
});
