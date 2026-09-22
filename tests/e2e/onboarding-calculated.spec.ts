// Spec: docs/pm/onboarding-profile/spec.md › flujo "Calculated path (scenario 1)", R1–R4, R7, R9–R12.
import { expect, test } from "@playwright/test";
import {
  chooseMeals,
  expectOnDashboard,
  fillBodyData,
  LUCIA_BODY,
  luciaThroughTargets,
  readStored,
  signIn,
  stepNameAndGoal,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/");
});

test("R1: 'Continuar' está desactivado sin nombre y 'Perder grasa' viene preseleccionado", async ({ page }) => {
  await page.getByLabel("¿Cómo te llamas?").fill("");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Perder grasa" })).toBeChecked();
  await page.getByLabel("¿Cómo te llamas?").fill("Lucía");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("R2: cada opción del paso 2 lleva a su paso (3a o 3b)", async ({ page }) => {
  await stepNameAndGoal(page, "Lucía");
  await page.getByRole("button", { name: "Calcúlalo por mí" }).click();
  await expect(page.getByLabel("Altura (cm)")).toBeVisible();

  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("button", { name: "Tengo un plan de mi nutricionista" }).click();
  await expect(page.getByRole("checkbox", { name: "Es un rango" })).toBeVisible();
});

test("R3: altura fuera de 120–230 cm muestra error y desactiva 'Calcular'", async ({ page }) => {
  await stepNameAndGoal(page, "Lucía");
  await page.getByRole("button", { name: "Calcúlalo por mí" }).click();
  await fillBodyData(page, { ...LUCIA_BODY, heightCm: "110" });
  await expect(page.getByText(/120.*230/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Calcular mis objetivos" })).toBeDisabled();

  await page.getByLabel("Altura (cm)").fill("165");
  await expect(page.getByRole("button", { name: "Calcular mis objetivos" })).toBeEnabled();
});

test("R4: Lucía ve 1750 / 112 / 200 / 56 y cómo se calcularon", async ({ page }) => {
  await stepNameAndGoal(page, "Lucía");
  await page.getByRole("button", { name: "Calcúlalo por mí" }).click();
  await fillBodyData(page, LUCIA_BODY); // peso con coma: "62,0"
  await page.getByRole("button", { name: "Calcular mis objetivos" }).click();

  await expect(page.getByLabel("Calorías (kcal)")).toHaveValue("1750");
  await expect(page.getByLabel("Proteínas (g)")).toHaveValue("112");
  await expect(page.getByLabel("Carbohidratos (g)")).toHaveValue("200");
  await expect(page.getByLabel("Grasas (g)")).toHaveValue("56");

  await expect(page.getByText("¿De dónde salen estas cifras?")).toBeVisible();
  for (const n of ["1320", "2046", "1750"]) await expect(page.getByText(n, { exact: false }).first()).toBeVisible();
});

test("R4: si edita un valor sugerido, se guarda el editado", async ({ page }) => {
  await stepNameAndGoal(page, "Lucía");
  await page.getByRole("button", { name: "Calcúlalo por mí" }).click();
  await fillBodyData(page, LUCIA_BODY);
  await page.getByRole("button", { name: "Calcular mis objetivos" }).click();
  await page.getByLabel("Calorías (kcal)").fill("1800");
  await page.getByRole("button", { name: "Usar estos objetivos" }).click();
  await chooseMeals(page, ["Desayuno", "Comida", "Cena"]);
  await page.getByRole("button", { name: "Empezar" }).click();

  await expectOnDashboard(page);
  expect((await readStored<{ calorieGoal: number }>(page, "profile")).calorieGoal).toBe(1800);
});

test("'Atrás' conserva lo que el usuario había escrito", async ({ page }) => {
  await stepNameAndGoal(page, "Lucía");
  await page.getByRole("button", { name: "Calcúlalo por mí" }).click();
  await fillBodyData(page, LUCIA_BODY);
  await page.getByRole("button", { name: "Calcular mis objetivos" }).click();
  await page.getByRole("button", { name: "Atrás" }).click();

  await expect(page.getByLabel("Año de nacimiento")).toHaveValue("1992");
  await expect(page.getByLabel("Altura (cm)")).toHaveValue("165");
  await expect(page.getByRole("radio", { name: "Bastante" })).toBeChecked();
});

test("R7: sin ninguna comida marcada no se puede continuar y se explica por qué", async ({ page }) => {
  await luciaThroughTargets(page);
  for (const meal of ["Desayuno", "Media mañana", "Comida", "Merienda", "Pre-entreno", "Cena"]) {
    await page.getByRole("checkbox", { name: meal }).uncheck();
  }
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByText(/al menos una/i)).toBeVisible();
});

test("Escenario 1 completo: Lucía acaba en el diario con sus objetivos, comidas, alergias y gustos", async ({ page }) => {
  await luciaThroughTargets(page);
  await chooseMeals(page, ["Desayuno", "Comida", "Merienda", "Cena"]);

  // Paso 6 (R9, R11, R12)
  await page.getByRole("checkbox", { name: "Frutos secos" }).check();
  await page.getByLabel("Otra alergia").fill("Kiwi");
  await page.getByLabel("Otra alergia").press("Enter");
  await page.getByRole("radio", { name: "Vegetariana" }).check();
  await page.getByLabel("No me gusta").fill("Hígado");
  await page.getByLabel("No me gusta").press("Enter");
  await page.getByLabel("No me gusta").fill("hígado"); // duplicado (sin distinguir mayúsculas): no hace nada
  await page.getByLabel("No me gusta").press("Enter");
  await expect(page.getByRole("button", { name: /Quitar hígado/i })).toHaveCount(1);
  await page.getByRole("button", { name: "Empezar" }).click();

  await expectOnDashboard(page);
  await expect(page.getByText("0 / 1750", { exact: true })).toBeVisible();

  const profile = await readStored<Record<string, unknown>>(page, "profile");
  expect(profile).toMatchObject({
    schemaVersion: 2,
    name: "Lucía",
    goal: "lose",
    targetSource: "calculated",
    body: { sex: "female", birthYear: 1992, heightCm: 165, weightKg: 62, activity: "bastante" },
    calorieGoal: 1750,
    proteinGoal: 112,
    carbsGoal: 200,
    fatGoal: 56,
    meals: ["Desayuno", "Comida", "Merienda", "Cena"],
    allergies: { preset: ["frutos_secos"], custom: ["Kiwi"] },
    diet: "vegetarian",
    dislikedIngredients: ["Hígado"],
  });
});
