// Spec: docs/pm/onboarding-profile/spec.md › flujo "Prescribed path (scenario 2)", R5, R6, R8, R17.
import { expect, test, type Page } from "@playwright/test";
import { chooseMeals, expectOnDashboard, readStored, signIn, stepNameAndGoal } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await stepNameAndGoal(page, "Manuel");
  await page.getByRole("button", { name: "Tengo un plan de mi nutricionista" }).click();
});

async function fillManuelPlan(page: Page, min = "130", max = "170") {
  await page.getByLabel("Calorías (kcal)").fill("1980");
  await page.getByRole("checkbox", { name: "Es un rango" }).check();
  await page.getByLabel("Proteína mínima (g)").fill(min);
  await page.getByLabel("Proteína máxima (g)").fill(max);
  await page.getByLabel("Peso (kg)").fill("76");
}

test("R5: con rango, mínimo > máximo muestra error y desactiva 'Continuar'", async ({ page }) => {
  await fillManuelPlan(page, "170", "130");
  await expect(page.getByText(/mínim.*máxim/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
});

test("R5: kcal vacías o fuera de 800–6000 desactivan 'Continuar'", async ({ page }) => {
  await fillManuelPlan(page);
  await page.getByLabel("Calorías (kcal)").fill("");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.getByLabel("Calorías (kcal)").fill("700");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.getByLabel("Calorías (kcal)").fill("1980");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("Escenario 2 completo: Manuel guarda su plan, con 5 comidas, y el diario muestra la proteína como banda", async ({
  page,
}) => {
  await fillManuelPlan(page); // carbos y grasas vacíos (R6)
  await page.getByRole("button", { name: "Continuar" }).click();
  await chooseMeals(page, ["Desayuno", "Media mañana", "Comida", "Pre-entreno", "Cena"]);
  await page.getByRole("button", { name: "Empezar" }).click();

  await expectOnDashboard(page);
  await expect(page.getByText("0 / 130–170", { exact: true })).toBeVisible(); // R17

  const profile = await readStored<Record<string, unknown>>(page, "profile");
  expect(profile).toMatchObject({
    targetSource: "prescribed",
    weightKg: 76,
    calorieGoal: 1980,
    proteinGoal: 150,
    proteinRange: { min: 130, max: 170 },
    fatGoal: 68,
    carbsGoal: 192,
    meals: ["Desayuno", "Media mañana", "Comida", "Pre-entreno", "Cena"],
  });
  expect(profile).not.toHaveProperty("body");
});
