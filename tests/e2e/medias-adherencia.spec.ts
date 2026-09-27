// Spec: docs/pm/11-medias-adherencia/spec.md › R1–R11 (Acceptance criteria) y User flows.
// Tech: docs/pm/11-medias-adherencia/tech.md › UI (contrato de la prueba):
//   - Tarjeta `<section>` con `<h2>` «Medias y adherencia», debajo de «Calorías esta semana».
//   - Selector: `radiogroup` «Periodo del resumen» con radios «7 días» / «30 días» (7 por defecto).
//   - Subtítulo «7 días · 15–21 sep» (sin «Últimos»: también vale con una fecha pasada); adherencia en un solo nodo: «2 de 3 días dentro del objetivo».
//   - Medias: `<ul aria-label="Medias del periodo">` de DayMacroSummary («N / objetivo» + estado).
//   - Vacío: «Sin registros en estos 7 días», sin lista de medias.
// Datos: tests/fixtures/medias-adherencia.ts (hoy = martes 2026-09-22). Falla hasta que exista la tarjeta (tareas 6–7).
import { expect, test, type Page } from "@playwright/test";
import { ALL_ENTRIES, MONTH_ENTRIES, TODAY_ENTRY, WEEK_ENTRIES, statsProfile } from "../fixtures/medias-adherencia";
import { signIn } from "./helpers";

const card = (page: Page) => page.getByRole("region", { name: "Medias y adherencia" });
const averages = (page: Page) => card(page).getByRole("list", { name: "Medias del periodo" });
const cell = (page: Page, label: "Calorías" | "Proteínas" | "Carbohidratos" | "Grasas") =>
  averages(page).getByRole("listitem").filter({ hasText: label });
const period = (page: Page, name: "7 días" | "30 días") =>
  card(page).getByRole("radiogroup", { name: "Periodo del resumen" }).getByRole("radio", { name, exact: true });

async function openDiary(page: Page, entries = ALL_ENTRIES) {
  await signIn(page, { profile: statsProfile, entries });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
}

test.describe("R1 · R2 · R3 · R8: medias y adherencia de los últimos 7 días", () => {
  test("3 días registrados de 15–21 sep: 2000 kcal de media y 2 de 3 días", async ({ page }) => {
    await openDiary(page);
    await expect(card(page).getByText("7 días · 15–21 sep", { exact: true })).toBeVisible();
    await expect(cell(page, "Calorías").getByText("2000 / 2000", { exact: true })).toBeVisible();
    await expect(cell(page, "Proteínas").getByText("132 / 130–160", { exact: true })).toBeVisible();
    await expect(cell(page, "Carbohidratos").getByText("223 / 230", { exact: true })).toBeVisible();
    await expect(cell(page, "Grasas").getByText("68 / 69", { exact: true })).toBeVisible();
    await expect(card(page).getByText("2 de 3 días dentro del objetivo", { exact: true })).toBeVisible();
  });

  test("la tarjeta va debajo de «Calorías esta semana»", async ({ page }) => {
    await openDiary(page);
    const chart = await page.getByRole("heading", { name: "Calorías esta semana" }).boundingBox();
    const summary = await card(page).boundingBox();
    expect(summary!.y).toBeGreaterThan(chart!.y);
  });
});

test.describe("R9: cada media con su objetivo y estado", () => {
  test("la media de kcal está «Dentro» y lo dice al lector de pantalla", async ({ page }) => {
    await openDiary(page);
    await expect(cell(page, "Calorías").getByText("Dentro", { exact: true })).toBeVisible();
    await expect(cell(page, "Calorías")).toContainText("Calorías 2000 de 2000 kcal, dentro");
  });
});

test.describe("R5: selector 7 / 30 días", () => {
  test("por defecto está marcado «7 días»", async ({ page }) => {
    await openDiary(page);
    await expect(period(page, "7 días")).toBeChecked();
    await expect(period(page, "30 días")).not.toBeChecked();
  });

  test("«30 días» recalcula rango, medias y adherencia; volver a 7 los restaura", async ({ page }) => {
    await openDiary(page);
    await period(page, "30 días").check();
    await expect(card(page).getByText("30 días · 23 ago–21 sep", { exact: true })).toBeVisible();
    await expect(cell(page, "Calorías").getByText("2120 / 2000", { exact: true })).toBeVisible();
    await expect(card(page).getByText("3 de 5 días dentro del objetivo", { exact: true })).toBeVisible();

    await period(page, "7 días").check();
    await expect(card(page).getByText("7 días · 15–21 sep", { exact: true })).toBeVisible();
    await expect(cell(page, "Calorías").getByText("2000 / 2000", { exact: true })).toBeVisible();
    await expect(card(page).getByText("2 de 3 días dentro del objetivo", { exact: true })).toBeVisible();
  });
});

test.describe("R6: días completos; hoy no cuenta", () => {
  test("lo registrado hoy no cambia medias ni adherencia", async ({ page }) => {
    await openDiary(page, [...WEEK_ENTRIES, TODAY_ENTRY]);
    await expect(cell(page, "Calorías").getByText("2000 / 2000", { exact: true })).toBeVisible();
    await expect(card(page).getByText("2 de 3 días dentro del objetivo", { exact: true })).toBeVisible();
  });

  test("con la fecha del Diario en 14 sep, el periodo es 8–14 sep", async ({ page }) => {
    await openDiary(page);
    await page.locator('input[type="date"]').fill("2026-09-14");
    await expect(card(page).getByText("7 días · 8–14 sep", { exact: true })).toBeVisible();
    await expect(cell(page, "Calorías").getByText("2600 / 2000", { exact: true })).toBeVisible();
    await expect(card(page).getByText("0 de 1 día dentro del objetivo", { exact: true })).toBeVisible();
  });
});

// review.md › no bloqueante 1: el check verde es una señal de éxito, solo cuando cumplen todos los días.
test.describe("R3: el check de la adherencia solo si cumplen todos los días", () => {
  const adherenceIcon = (page: Page, text: string) =>
    card(page).getByText(text, { exact: true }).locator("xpath=..").locator("svg");

  test("2 de 3 días: sin check", async ({ page }) => {
    await openDiary(page);
    await expect(card(page).getByText("2 de 3 días dentro del objetivo", { exact: true })).toBeVisible();
    await expect(adherenceIcon(page, "2 de 3 días dentro del objetivo")).toHaveCount(0);
  });

  test("2 de 2 días: con check", async ({ page }) => {
    await openDiary(page, WEEK_ENTRIES.slice(0, 3)); // 16 y 18 sep, los dos cumplen
    await expect(adherenceIcon(page, "2 de 2 días dentro del objetivo")).toHaveCount(1);
  });
});

test.describe("R7: sin registros en el periodo", () => {
  test("sin registros en 15–21 sep: mensaje, sin medias ni adherencia", async ({ page }) => {
    await openDiary(page, MONTH_ENTRIES);
    await expect(card(page).getByText("Sin registros en estos 7 días", { exact: true })).toBeVisible();
    await expect(averages(page)).toHaveCount(0);
    await expect(card(page).getByText(/días? dentro del objetivo/)).toHaveCount(0);
  });

  test("con registros solo hoy, el resumen está vacío", async ({ page }) => {
    await openDiary(page, [TODAY_ENTRY]);
    await expect(card(page).getByText("Sin registros en estos 7 días", { exact: true })).toBeVisible();
  });

  test("el mensaje vacío sigue el periodo elegido: «30 días»", async ({ page }) => {
    await openDiary(page, [TODAY_ENTRY]);
    await period(page, "30 días").check();
    await expect(card(page).getByText("Sin registros en estos 30 días", { exact: true })).toBeVisible();
  });
});

test.describe("R10: accesible con teclado y lector de pantalla", () => {
  test("el selector es un grupo de radios y la flecha cambia de periodo", async ({ page }) => {
    await openDiary(page);
    await period(page, "7 días").focus();
    await page.keyboard.press("ArrowRight");
    await expect(period(page, "30 días")).toBeChecked();
    await expect(card(page).getByText("3 de 5 días dentro del objetivo", { exact: true })).toBeVisible();
  });
});

test.describe("R11: se recuerda la opción elegida", () => {
  test("elegir 30 días y recargar: sigue en 30", async ({ page }) => {
    await openDiary(page);
    await period(page, "30 días").check();
    await page.reload();
    await expect(period(page, "30 días")).toBeChecked();
    await expect(card(page).getByText("30 días · 23 ago–21 sep", { exact: true })).toBeVisible();
  });
});
