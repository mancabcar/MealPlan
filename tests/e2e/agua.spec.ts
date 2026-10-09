// Spec: docs/pm/23-agua-fibra-micros/spec.md › entrega 2 (agua), R10, R11, R12. Tech: tech.md › UI y Testing strategy.
// Contrato de la UI (acordado con Manuel):
//   - Diario: una región «Agua» (tarjeta) justo debajo de la de macros y fibra, con el texto «1,25 / 2 L» (bebido / objetivo),
//     «5 de 8 vasos · vaso de 250 ml», los botones «Sumar un vaso» y «Quitar un vaso», y una fila de vasos: botones
//     «Vaso N» con aria-pressed (true si está lleno). Tocar el vaso N fija el total en N vasos (el último lleno, lo quita).
//     Al llegar al objetivo la región muestra «Objetivo cumplido» y los botones siguen activos hasta 6 L.
//     Sigue la fecha elegida en el Diario.
//   - Perfil › región «Objetivos diarios»: fila «Agua» con «2 L» y botón «Editar agua» → campo «Objetivo de agua (L)»
//     (0,5–6, coma o punto) con «Guardar» (deshabilitado si no vale) y «Cancelar».
//   - Perfil › región «Tamaño del vaso»: radios «200 ml», «250 ml», «330 ml», «500 ml» (grupo con nombre «Tamaño del vaso»)
//     que se guardan al tocarlos, sin botón Guardar.
// Datos: tests/fixtures/agua.ts (hoy = martes 2026-09-22; Lucía sin objetivo de agua ni vaso → 2 L y 250 ml).
// Fallan hasta construir la entrega 2 (tareas 9–12 del tech design).
import { expect, test, type Page } from "@playwright/test";
import type { UserProfile } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { AGUA_DOS_DIAS, TODAY, YESTERDAY } from "../fixtures/agua";
import { readStored, signIn } from "./helpers";

const card = (page: Page) => page.getByRole("region", { name: "Agua", exact: true });
const plus = (page: Page) => card(page).getByRole("button", { name: "Sumar un vaso" });
const minus = (page: Page) => card(page).getByRole("button", { name: "Quitar un vaso" });
const glass = (page: Page, n: number) => card(page).getByRole("button", { name: `Vaso ${n}`, exact: true });
const storedWater = (page: Page) => readStored<Record<string, number>>(page, "water");

async function openDiario(page: Page, data: Record<string, unknown> = {}) {
  await signIn(page, { profile: lucia, weekplan: {}, entries: [], ...data });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

test.describe("R10: contador de vasos del día", () => {
  test("sin agua guardada: «0 / 2 L» y «0 de 8 vasos»", async ({ page }) => {
    await openDiario(page);
    await expect(card(page)).toContainText("0 / 2 L");
    await expect(card(page)).toContainText("0 de 8 vasos");
  });

  test("«+» suma un vaso de 250 ml: «0,25 / 2 L», «1 de 8 vasos» y se guarda en ml del día", async ({ page }) => {
    await openDiario(page);
    await plus(page).click();
    await expect(card(page)).toContainText("0,25 / 2 L");
    await expect(card(page)).toContainText("1 de 8 vasos");
    expect(await storedWater(page)).toEqual({ [TODAY]: 250 });
  });

  test("«−» quita un vaso y con 0 se queda en 0", async ({ page }) => {
    await openDiario(page, { water: { [TODAY]: 250 } });
    await minus(page).click();
    await expect(card(page)).toContainText("0 / 2 L");
    await minus(page).click();
    await expect(card(page)).toContainText("0 / 2 L");
    expect(await storedWater(page)).toEqual({});
  });

  test("tocar el vaso 5 con 0 ml deja 5 vasos (1,25 L) y marca del 1 al 5", async ({ page }) => {
    await openDiario(page);
    await glass(page, 5).click();
    await expect(card(page)).toContainText("1,25 / 2 L");
    await expect(card(page)).toContainText("5 de 8 vasos");
    for (const n of [1, 2, 3, 4, 5]) await expect(glass(page, n)).toHaveAttribute("aria-pressed", "true");
    for (const n of [6, 7, 8]) await expect(glass(page, n)).toHaveAttribute("aria-pressed", "false");
  });

  test("tocar de nuevo el último vaso lleno quita uno", async ({ page }) => {
    await openDiario(page, { water: { [TODAY]: 1250 } });
    await glass(page, 5).click();
    await expect(card(page)).toContainText("1 / 2 L");
    await expect(card(page)).toContainText("4 de 8 vasos");
  });

  test("el agua del día se conserva al recargar", async ({ page }) => {
    await openDiario(page);
    await plus(page).click();
    await plus(page).click();
    await page.reload();
    await expect(card(page)).toContainText("0,5 / 2 L");
    expect(await storedWater(page)).toEqual({ [TODAY]: 500 });
  });

  test("sigue la fecha del Diario: sumar en ayer no toca hoy", async ({ page }) => {
    await openDiario(page, { water: AGUA_DOS_DIAS });
    await page.getByLabel("Fecha", { exact: true }).fill(YESTERDAY);
    await expect(card(page)).toContainText("1,5 / 2 L");
    await plus(page).click();
    await expect(card(page)).toContainText("1,75 / 2 L");
    expect(await storedWater(page)).toEqual({ [YESTERDAY]: 1750, [TODAY]: 1250 });
  });

  test("tope de 6 L: con 5,9 L y vaso de 500 ml, «+» deja 6 L y no pasa de ahí", async ({ page }) => {
    await openDiario(page, { profile: { ...lucia, glassMl: 500 }, water: { [TODAY]: 5900 } });
    await plus(page).click();
    await expect(card(page)).toContainText("6 / 2 L");
    await plus(page).click();
    expect((await storedWater(page))[TODAY]).toBe(6000);
  });

  test("la tarjeta de agua va justo debajo de la de macros y fibra", async ({ page }) => {
    await openDiario(page);
    const fiber = await page.getByText("Fibra", { exact: true }).first().boundingBox();
    const water = await card(page).boundingBox();
    expect(water!.y).toBeGreaterThan(fiber!.y);
  });
});

test.describe("R12: objetivo cumplido", () => {
  test("al llegar a 2 L aparece «Objetivo cumplido» y se puede seguir sumando", async ({ page }) => {
    await openDiario(page, { water: { [TODAY]: 1750 } });
    await expect(card(page)).not.toContainText("Objetivo cumplido");
    await plus(page).click();
    await expect(card(page)).toContainText("Objetivo cumplido");
    await expect(card(page)).toContainText("2 / 2 L");
    await plus(page).click();
    await expect(card(page)).toContainText("2,25 / 2 L");
    await expect(card(page)).toContainText("Objetivo cumplido");
  });
});

test.describe("R11: objetivo y tamaño del vaso en Perfil", () => {
  const goals = (page: Page) => page.getByRole("region", { name: "Objetivos diarios" });
  const glassSize = (page: Page) => page.getByRole("region", { name: "Tamaño del vaso" });
  type Stored = UserProfile & { waterGoalMl?: number; glassMl?: number };

  test("sin objetivo guardado, Perfil muestra «2 L» y el vaso de 250 ml marcado", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await expect(goals(page).getByText("Agua", { exact: true })).toBeVisible();
    await expect(goals(page).getByText("2 L", { exact: true })).toBeVisible();
    await expect(glassSize(page).getByRole("radio", { name: "250 ml" })).toBeChecked();
  });

  test("editar el objetivo a 2,5 L lo guarda y el Diario lo usa (10 vasos de 250 ml)", async ({ page }) => {
    await signIn(page, { profile: lucia, water: { [TODAY]: 1250 } });
    await page.goto("/perfil");
    await goals(page).getByRole("button", { name: "Editar agua" }).click();
    await goals(page).getByLabel("Objetivo de agua (L)").fill("2,5");
    await goals(page).getByRole("button", { name: "Guardar" }).click();
    await expect(goals(page).getByText("2,5 L", { exact: true })).toBeVisible();
    expect((await readStored<Stored>(page, "profile")).waterGoalMl).toBe(2500);

    await page.goto("/");
    await expect(card(page)).toContainText("1,25 / 2,5 L");
    await expect(card(page)).toContainText("5 de 10 vasos");
  });

  test("un objetivo fuera de 0,5–6 L o ilegible no se puede guardar", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await goals(page).getByRole("button", { name: "Editar agua" }).click();
    for (const bad of ["0,4", "6,1", "abc", "1,255"]) {
      await goals(page).getByLabel("Objetivo de agua (L)").fill(bad);
      await expect(goals(page).getByRole("button", { name: "Guardar" }), bad).toBeDisabled();
    }
  });

  test("Cancelar deja el objetivo como estaba", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await goals(page).getByRole("button", { name: "Editar agua" }).click();
    await goals(page).getByLabel("Objetivo de agua (L)").fill("3");
    await goals(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(goals(page).getByText("2 L", { exact: true })).toBeVisible();
  });

  test("elegir el vaso de 330 ml lo guarda al instante y el Diario cuenta 7 vasos para 2 L", async ({ page }) => {
    await signIn(page, { profile: lucia, water: { [TODAY]: 990 } });
    await page.goto("/perfil");
    await glassSize(page).getByRole("radio", { name: "330 ml" }).check();
    expect((await readStored<Stored>(page, "profile")).glassMl).toBe(330);

    await page.goto("/");
    await expect(card(page)).toContainText("0,99 / 2 L");
    await expect(card(page)).toContainText("3 de 7 vasos");
  });

  test("cambiar el vaso no altera los ml ya bebidos: 1 L con 250 ml = 4 vasos, con 500 ml = 2 de 4", async ({ page }) => {
    await signIn(page, { profile: lucia, water: { [TODAY]: 1000 } });
    await page.goto("/perfil");
    await glassSize(page).getByRole("radio", { name: "500 ml" }).check();
    await page.goto("/");
    await expect(card(page)).toContainText("1 / 2 L");
    await expect(card(page)).toContainText("2 de 4 vasos");
    expect(await storedWater(page)).toEqual({ [TODAY]: 1000 });
  });
});
