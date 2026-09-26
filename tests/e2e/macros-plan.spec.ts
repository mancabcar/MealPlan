// Spec: docs/pm/10-macros-plan/spec.md › R1–R7 (Acceptance criteria) y User flows ("Cuadrar un día", "Día a medias").
// Tech: docs/pm/10-macros-plan/tech.md › UI (contrato de la prueba):
//   - Lista `<ul aria-label="Macros del día">` con cuatro `<li>`: Calorías, Proteínas, Carbohidratos, Grasas.
//   - Cada celda muestra "N / objetivo" o "N / min–max" (N redondeado) y el estado visible "Dentro" / "Por debajo" /
//     "Por encima"; la parte visual es aria-hidden y una frase sr-only la resume: "Grasas 80 de 69, por encima",
//     "Proteínas 142 de 130 a 160, dentro".
//   - Aviso "N de M comidas planificadas" solo si faltan comidas. La cabecera de la tarjeta ya no muestra "N kcal".
// Datos: tests/fixtures/plan-macros.ts (hoy = martes 2026-09-22). Falla hasta que exista el resumen (tareas 2–3).
import { expect, test, type Page } from "@playwright/test";
import { CENA_SEPIA, PLAN_SEED, planProfileNoRange } from "../fixtures/plan-macros";
import { signIn } from "./helpers";

const summary = (page: Page) => page.getByRole("list", { name: "Macros del día" });
const cell = (page: Page, label: "Calorías" | "Proteínas" | "Carbohidratos" | "Grasas") =>
  summary(page).getByRole("listitem").filter({ hasText: label });

async function openPlan(page: Page, seed: Record<string, unknown> = PLAN_SEED) {
  await signIn(page, seed);
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Martes", level: 2 })).toBeVisible();
}

/** Toca la fila de una comida del día y elige receta (value "" = "— Sin asignar —"). */
async function assign(page: Page, meal: string, recipeId: string) {
  await page.getByRole("button").filter({ hasText: meal }).click();
  await page.getByRole("combobox").selectOption(recipeId);
}

test.describe("R1: el resumen suma las recetas de las comidas del perfil", () => {
  test("desayuno P 30 + comida P 50 + cena P 40 → proteínas 120, y kcal, hidratos y grasas con su suma", async ({ page }) => {
    await openPlan(page); // el batido de Media mañana (comida desmarcada) no suma
    await expect(summary(page).getByRole("listitem")).toHaveCount(4);
    await expect(cell(page, "Calorías").getByText("1700 / 2000", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas").getByText("120 / 130–160", { exact: true })).toBeVisible();
    await expect(cell(page, "Carbohidratos").getByText("180 / 230", { exact: true })).toBeVisible();
    await expect(cell(page, "Grasas").getByText("57 / 69", { exact: true })).toBeVisible();
  });

  test("una cena con la receta borrada no suma y la página no se rompe", async ({ page }) => {
    await openPlan(page);
    await page.getByRole("tab", { name: /^Miércoles/ }).click();
    await expect(cell(page, "Calorías").getByText("700 / 2000", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas").getByText("50 / 130–160", { exact: true })).toBeVisible();
  });

  test("un día sin recetas no muestra el resumen", async ({ page }) => {
    await openPlan(page);
    await page.getByRole("tab", { name: /^Jueves/ }).click();
    await expect(page.getByRole("heading", { name: "Jueves", level: 2 })).toBeVisible();
    await expect(summary(page)).toHaveCount(0);
  });

  // tech.md › Spec feedback 3: el "N kcal" de la cabecera pasa a la celda Calorías.
  test('la cabecera de la tarjeta ya no muestra "N kcal"', async ({ page }) => {
    await openPlan(page);
    await expect(cell(page, "Calorías")).toBeVisible();
    await expect(page.getByText("1700 kcal", { exact: true })).toHaveCount(0);
  });
});

test.describe("R2: cada valor junto a su objetivo del perfil", () => {
  test('sin rango de proteína se muestra "N / proteinGoal"', async ({ page }) => {
    await openPlan(page, { ...PLAN_SEED, profile: planProfileNoRange });
    await expect(cell(page, "Proteínas").getByText("120 / 145", { exact: true })).toBeVisible();
  });
});

test.describe("R3 · R4 · R5: estado de cada valor, sin depender del color", () => {
  test("día completo del lunes: Calorías Dentro, Proteínas y Carbohidratos Por debajo, Grasas Por encima", async ({ page }) => {
    await openPlan(page);
    await page.getByRole("tab", { name: /^Lunes/ }).click();
    await expect(cell(page, "Calorías").getByText("Dentro", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas").getByText("Por debajo", { exact: true })).toBeVisible();
    await expect(cell(page, "Carbohidratos").getByText("Por debajo", { exact: true })).toBeVisible();
    await expect(cell(page, "Grasas").getByText("80 / 69", { exact: true })).toBeVisible();
    await expect(cell(page, "Grasas").getByText("Por encima", { exact: true })).toBeVisible();
  });

  // R5: el lector de pantalla oye una frase por celda ("Grasas 80 de 69, por encima"), sin iconos ni textos duplicados.
  // Las unidades tras el objetivo son opcionales (el tech solo fija los ejemplos de Grasas y Proteínas).
  test('R5: un lector de pantalla anuncia "Grasas 80 de 69, por encima"', async ({ page }) => {
    await openPlan(page);
    await page.getByRole("tab", { name: /^Lunes/ }).click();
    await expect(summary(page)).toMatchAriaSnapshot(`
      - list "Macros del día":
        - listitem: /^Calorías 2030 de 2000( kcal)?, dentro$/
        - listitem: /^Proteínas 128 de 130 a 160( g)?, por debajo$/
        - listitem: /^Carbohidratos 205 de 230( g)?, por debajo$/
        - listitem: /^Grasas 80 de 69( g)?, por encima$/
    `);
  });
});

test.describe("R6: el resumen se recalcula al momento", () => {
  test("Cuadrar un día: cambiar la cena por una más proteica pasa Proteínas de Por debajo (120) a Dentro (142)", async ({ page }) => {
    await openPlan(page);
    await expect(cell(page, "Proteínas").getByText("Por debajo", { exact: true })).toBeVisible();

    await assign(page, "Cena", CENA_SEPIA.id);

    await expect(cell(page, "Proteínas").getByText("142 / 130–160", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas").getByText("Dentro", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas")).toContainText("Proteínas 142 de 130 a 160, dentro");
  });

  test('dejar la comida "Sin asignar" actualiza los totales y el aviso', async ({ page }) => {
    await openPlan(page);
    await assign(page, "Comida", "");
    await expect(cell(page, "Calorías").getByText("1000 / 2000", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas").getByText("70 / 130–160", { exact: true })).toBeVisible();
    await expect(page.getByText("2 de 4 comidas planificadas", { exact: true })).toBeVisible();
  });

  test("cambiar de día en el selector muestra el resumen del día nuevo", async ({ page }) => {
    await openPlan(page);
    await expect(cell(page, "Grasas").getByText("57 / 69", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: /^Lunes/ }).click();
    await expect(cell(page, "Grasas").getByText("80 / 69", { exact: true })).toBeVisible();
    await expect(cell(page, "Grasas").getByText("57 / 69", { exact: true })).toHaveCount(0);
  });
});

test.describe("R7: aviso de comidas sin asignar", () => {
  test('3 de 4 comidas asignadas → "3 de 4 comidas planificadas"', async ({ page }) => {
    await openPlan(page);
    await expect(page.getByText("3 de 4 comidas planificadas", { exact: true })).toBeVisible();
  });

  test('Día a medias: solo la comida (y una cena borrada) → todo Por debajo y "1 de 4 comidas planificadas"', async ({ page }) => {
    await openPlan(page);
    await page.getByRole("tab", { name: /^Miércoles/ }).click();
    await expect(page.getByText("1 de 4 comidas planificadas", { exact: true })).toBeVisible();
    await expect(summary(page).getByText("Por debajo", { exact: true })).toHaveCount(4);
  });

  test("con todas las comidas asignadas el aviso no aparece", async ({ page }) => {
    await openPlan(page);
    await page.getByRole("tab", { name: /^Lunes/ }).click();
    await expect(cell(page, "Grasas").getByText("80 / 69", { exact: true })).toBeVisible();
    await expect(page.getByText(/comidas planificadas/)).toHaveCount(0);
  });
});
