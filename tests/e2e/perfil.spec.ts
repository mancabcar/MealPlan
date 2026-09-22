// Spec: docs/pm/onboarding-profile/spec.md › R13, R15, R16 y "Later edits (scenario 4)".
// Cada sección de Perfil es una región con nombre (<section aria-labelledby>) y su propio "Editar".
import { expect, test, type Page } from "@playwright/test";
import { lucia, manuel } from "../fixtures/profiles";
import { readStored, signIn } from "./helpers";

type Stored = { calorieGoal: number; proteinGoal: number; meals: string[]; body?: { weightKg: number } };

const section = (page: Page, name: string) => page.getByRole("region", { name });

async function editWeight(page: Page, weight: string) {
  const body = section(page, "Datos corporales");
  await body.getByRole("button", { name: "Editar" }).click();
  await body.getByLabel("Peso (kg)").fill(weight);
  await body.getByRole("button", { name: "Guardar" }).click();
}

test("R13: un cambio en Perfil persiste tras recargar", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/perfil");
  const meals = section(page, "Comidas del día");
  await meals.getByRole("button", { name: "Editar" }).click();
  await meals.getByRole("checkbox", { name: "Media mañana" }).check();
  await meals.getByRole("button", { name: "Guardar" }).click();

  await page.reload();
  expect((await readStored<Stored>(page, "profile")).meals).toEqual(["Desayuno", "Media mañana", "Comida", "Merienda", "Cena"]);
  await expect(section(page, "Comidas del día").getByText("Media mañana")).toBeVisible();
});

test("R15: Perfil muestra de dónde salen los objetivos", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/perfil");
  await expect(section(page, "Objetivos diarios").getByText("Calculado")).toBeVisible();
});

test("R15: con plan del nutricionista, dice 'De tu nutricionista'", async ({ page }) => {
  await signIn(page, { profile: manuel });
  await page.goto("/perfil");
  await expect(section(page, "Objetivos diarios").getByText("De tu nutricionista")).toBeVisible();
});

test("R16: al cambiar el peso con objetivos calculados, ofrece recalcular y no cambia nada hasta confirmar", async ({
  page,
}) => {
  await signIn(page, { profile: lucia });
  await page.goto("/perfil");
  await editWeight(page, "58");

  // 58 kg: BMR 1280 × 1.55 = 1984, −15% → 1700 kcal; P = 1.8 × 58 = 104
  const banner = page.getByRole("status").filter({ hasText: "Recalcular" });
  await expect(banner).toContainText("1700");
  await expect(banner).toContainText("104");
  expect((await readStored<Stored>(page, "profile")).calorieGoal).toBe(1750);

  await banner.getByRole("button", { name: "Recalcular" }).click();
  const saved = await readStored<Stored>(page, "profile");
  expect(saved).toMatchObject({ calorieGoal: 1700, proteinGoal: 104, body: { weightKg: 58 } });
});

test("R16: 'Mantener los actuales' guarda el peso pero no los objetivos", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/perfil");
  await editWeight(page, "58");
  await page.getByRole("button", { name: "Mantener los actuales" }).click();

  await expect(page.getByRole("button", { name: "Recalcular" })).toHaveCount(0);
  expect(await readStored<Stored>(page, "profile")).toMatchObject({ calorieGoal: 1750, body: { weightKg: 58 } });
});

test("R16: con objetivos del nutricionista no aparece el aviso de recalcular", async ({ page }) => {
  await signIn(page, { profile: manuel });
  await page.goto("/perfil");
  await editWeight(page, "74");
  await expect(page.getByRole("button", { name: "Recalcular" })).toHaveCount(0);
});

test("R13: pasar de calculado a nutricionista rellena el formulario con los objetivos actuales", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.goto("/perfil");
  const targets = section(page, "Objetivos diarios");
  await targets.getByRole("button", { name: "Tengo un plan de mi nutricionista" }).click();
  await expect(targets.getByLabel("Calorías (kcal)")).toHaveValue("1750");
});
