// Spec: R17 + decisión de PM (2026-09-22): con rango, cualquier valor dentro de la banda cuenta como cumplido.
// Rediseño visual (docs/pm/design-refresh/tech.md tarea 6): el "cumplido" se marca con un icono Lucide
// (Check, role="img") con nombre accesible "Cumplido", ya no con el carácter "✓ " incrustado en el
// texto del número. La aserción del número en sí no depende de este indicador y no cambia con él.
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
  // Estable frente al rediseño: el número en sí no depende de cómo se represente el indicador de "cumplido".
  await expect(page.getByText("140 / 130–170")).toBeVisible();
  // El "cumplido" ahora se marca con un icono Lucide (Check, role="img") con nombre accesible,
  // no con el glifo "✓" incrustado en el texto.
  await expect(page.getByRole("img", { name: "Cumplido" })).toBeVisible();
});

test("R17: por debajo del mínimo no se marca como cumplido", async ({ page }) => {
  await signIn(page, { profile: manuel, entries: [entry(120)] });
  await page.goto("/");
  await expect(page.getByText("120 / 130–170", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Cumplido" })).toHaveCount(0);
});

// docs/pm/10-macros-plan/spec.md › R3 y tech.md › Spec feedback 1 (opción a) / tarea 4: `MacroBar` usa `macroStatus`,
// que redondea antes de comparar. Lo que se ve es lo que se juzga: "130 / 130–170" siempre cuenta como cumplido.
// Sin cambios visuales en el Diario. Los dos primeros fallan hasta la tarea 4 (hoy compara el valor sin redondear).
test.describe("Macros en el Plan · R3: el Diario redondea antes de juzgar el rango", () => {
  test("129,6 g se muestra 130 y se marca como cumplido", async ({ page }) => {
    await signIn(page, { profile: manuel, entries: [entry(129.6)] });
    await page.goto("/");
    await expect(page.getByText("130 / 130–170", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Cumplido" })).toBeVisible();
  });

  test("170,4 g se muestra 170 y se marca como cumplido", async ({ page }) => {
    await signIn(page, { profile: manuel, entries: [entry(170.4)] });
    await page.goto("/");
    await expect(page.getByText("170 / 130–170", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Cumplido" })).toBeVisible();
  });

  test("129,4 g se muestra 129 y no se marca", async ({ page }) => {
    await signIn(page, { profile: manuel, entries: [entry(129.4)] });
    await page.goto("/");
    await expect(page.getByText("129 / 130–170", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Cumplido" })).toHaveCount(0);
  });
});
