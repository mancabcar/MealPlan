// Spec: docs/pm/onboarding-profile/spec.md › R14 (escenario 3: usuario existente tras la actualización).
import { expect, test } from "@playwright/test";
import { legacyProfile } from "../fixtures/profiles";
import { expectOnDashboard, readStored, signIn, TODAY } from "./helpers";

test("R14: un perfil v1 entra directo al diario, migrado y sin perder datos", async ({ page }) => {
  await signIn(page, {
    profile: legacyProfile,
    entries: [
      { id: "e1", date: TODAY, mealType: "Snack", customName: "Manzana", calories: 80, protein: 0, carbs: 20, fat: 0 },
    ],
    weekplan: { [TODAY]: [{ mealType: "Snack", recipeId: "r1" }] },
  });
  await page.goto("/");

  await expectOnDashboard(page);
  await expect(page.getByLabel("¿Cómo te llamas?")).toHaveCount(0);
  await expect(page.getByText("80 / 1980", { exact: true })).toBeVisible();

  const profile = await readStored<Record<string, unknown>>(page, "profile");
  expect(profile).toMatchObject({
    schemaVersion: 2,
    targetSource: "prescribed",
    allergies: { preset: ["frutos_secos"], custom: [] },
    diet: "vegetarian",
    calorieGoal: 1980,
    dislikedIngredients: ["Hígado"],
  });

  const entries = await readStored<{ mealType: string }[]>(page, "entries");
  expect(entries[0].mealType).toBe("Merienda");
  const plan = await readStored<Record<string, { mealType: string }[]>>(page, "weekplan");
  expect(plan[TODAY][0].mealType).toBe("Merienda");

  // Copia de seguridad antes de escribir (tech.md › Risks)
  expect(await readStored(page, "profile_v1_backup")).toEqual(legacyProfile);
});
