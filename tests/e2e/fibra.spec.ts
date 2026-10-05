// Spec: docs/pm/23-agua-fibra-micros/spec.md › entrega 1 (fibra), R2–R5, R8, R9. Tech: tech.md › UI y Testing strategy.
// Contrato de la UI (acordado con Manuel):
//   - Diario, tarjeta de macros: una cuarta barra «Fibra» con el chip «28 / 38» (mismo formato que los macros) y, si el
//     día es parcial, el chip «parcial» y bajo la barra «Faltan datos de fibra en N de M entradas».
//     Cada entrada muestra «Fibra 9 g» (o «Fibra: sin dato»). Un día sin entradas no muestra «parcial» ni el aviso.
//   - «Añadir comida» › «Personalizada»: campo «fibra» junto a kcal/prot/carb/grasa (vacío = sin dato).
//   - «Añadir comida» › «Alimento»: la tarjeta del alimento muestra «Fibra» entre sus datos.
//   - Perfil › región «Objetivos diarios»: fila «Fibra» con «38 g» y botón «Editar fibra»; abre el campo
//     «Objetivo de fibra (g)» con «Guardar» (deshabilitado si no es un entero de 10 a 100) y «Cancelar».
//   - Recetas › detalle: celda «Fibra» en la fila de macros, con «14 g» o «—» si no hay dato.
// Datos: tests/fixtures/fibra.ts (hoy = martes 2026-09-22; Lucía no tiene objetivo de fibra guardado → 38 g).
// Fallan hasta construir la entrega 1 (tareas 2–7 del tech design).
import { expect, test, type Page } from "@playwright/test";
import foodsJson from "@/data/foods.json";
import { formatFiber } from "@/lib/fiber";
import type { LocalFood } from "@/lib/foods";
import type { MealEntry, Recipe, UserProfile } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  DIA_COMPLETO,
  DIA_PARCIAL,
  DIA_SIN_DATOS,
  ENTRADA_RECETA_ANTIGUA,
  FIBRA_RECIPES,
  LENTEJAS_FIBRA,
  POLLO_SIN_FIBRA,
} from "../fixtures/fibra";
import { readStored, signIn } from "./helpers";

const LENTEJAS_COCIDAS = (foodsJson as (LocalFood & { fiber?: number })[]).find((f) => f.id === "lentejas-cocidas")!;

async function openDiario(page: Page, entries: MealEntry[], extra: Record<string, unknown> = {}) {
  await signIn(page, { profile: lucia, weekplan: {}, recipes: FIBRA_RECIPES, entries, ...extra });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

const fiberLabel = (page: Page) => page.getByText("Fibra", { exact: true }).first();
const partialChip = (page: Page) => page.getByText("parcial", { exact: true });

test.describe("R2: total de fibra del día frente al objetivo", () => {
  test("día completo: «28 / 38» en la barra de fibra y sin chip «parcial»", async ({ page }) => {
    await openDiario(page, DIA_COMPLETO);
    await expect(fiberLabel(page)).toBeVisible();
    await expect(page.getByText("28 / 38", { exact: true })).toBeVisible();
    await expect(partialChip(page)).toHaveCount(0);
  });

  test("día parcial: «12 / 38» con chip «parcial»", async ({ page }) => {
    await openDiario(page, DIA_PARCIAL);
    await expect(page.getByText("12 / 38", { exact: true })).toBeVisible();
    await expect(partialChip(page)).toBeVisible();
  });

  test("entradas sin ningún dato: «0 / 38» con chip «parcial»", async ({ page }) => {
    await openDiario(page, DIA_SIN_DATOS);
    await expect(page.getByText("0 / 38", { exact: true })).toBeVisible();
    await expect(partialChip(page)).toBeVisible();
  });

  test("día sin entradas: «0 / 38», sin «parcial» ni aviso", async ({ page }) => {
    await openDiario(page, []);
    await expect(page.getByText("0 / 38", { exact: true })).toBeVisible();
    await expect(partialChip(page)).toHaveCount(0);
    await expect(page.getByText(/Faltan datos de fibra/)).toHaveCount(0);
  });

  test("una entrada de receta anterior a esta entrega suma la fibra de su receta (2 raciones × 14 g = 28 g)", async ({ page }) => {
    await openDiario(page, [ENTRADA_RECETA_ANTIGUA]);
    await expect(page.getByText("28 / 38", { exact: true })).toBeVisible();
    await expect(partialChip(page)).toHaveCount(0);
  });

  test("el total no desborda la barra cuando supera el objetivo", async ({ page }) => {
    const mucha: MealEntry[] = [{ ...DIA_COMPLETO[0], fiber: 60 }];
    await openDiario(page, mucha);
    await expect(page.getByText("60 / 38", { exact: true })).toBeVisible();
  });
});

test.describe("R9: aviso de entradas sin dato", () => {
  test("día parcial: «Faltan datos de fibra en 3 de 5 entradas» y cada entrada muestra su fibra o «sin dato»", async ({ page }) => {
    await openDiario(page, DIA_PARCIAL);
    await expect(page.getByText("Faltan datos de fibra en 3 de 5 entradas")).toBeVisible();
    await expect(page.getByText("Fibra 9 g", { exact: true })).toBeVisible();
    await expect(page.getByText("Fibra 3 g", { exact: true })).toBeVisible();
    await expect(page.getByText("Fibra: sin dato", { exact: true })).toHaveCount(3);
  });

  test("día completo: sin línea de aviso", async ({ page }) => {
    await openDiario(page, DIA_COMPLETO);
    await expect(page.getByText(/Faltan datos de fibra/)).toHaveCount(0);
  });
});

test.describe("R3: objetivo de fibra en Perfil", () => {
  const goals = (page: Page) => page.getByRole("region", { name: "Objetivos diarios" });

  test("sin objetivo guardado, Perfil muestra «38 g»", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await expect(goals(page).getByText("Fibra", { exact: true })).toBeVisible();
    await expect(goals(page).getByText("38 g", { exact: true })).toBeVisible();
  });

  test("editar el objetivo a 30 g lo guarda, lo muestra y el Diario lo usa", async ({ page }) => {
    await signIn(page, { profile: lucia, entries: DIA_COMPLETO, recipes: FIBRA_RECIPES });
    await page.goto("/perfil");
    await goals(page).getByRole("button", { name: "Editar fibra" }).click();
    await goals(page).getByLabel("Objetivo de fibra (g)").fill("30");
    await goals(page).getByRole("button", { name: "Guardar" }).click();
    await expect(goals(page).getByText("30 g", { exact: true })).toBeVisible();
    expect((await readStored<UserProfile & { fiberGoal?: number }>(page, "profile")).fiberGoal).toBe(30);

    await page.reload();
    await expect(goals(page).getByText("30 g", { exact: true })).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("28 / 30", { exact: true })).toBeVisible();
  });

  test("un valor fuera de 10–100 o con decimales no se puede guardar", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await goals(page).getByRole("button", { name: "Editar fibra" }).click();
    for (const bad of ["9", "101", "37,5"]) {
      await goals(page).getByLabel("Objetivo de fibra (g)").fill(bad);
      await expect(goals(page).getByRole("button", { name: "Guardar" }), bad).toBeDisabled();
    }
  });

  test("Cancelar deja el objetivo como estaba", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await goals(page).getByRole("button", { name: "Editar fibra" }).click();
    await goals(page).getByLabel("Objetivo de fibra (g)").fill("30");
    await goals(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(goals(page).getByText("38 g", { exact: true })).toBeVisible();
  });
});

test.describe("R4: fibra por ración en la ficha de la receta", () => {
  const open = async (page: Page, name: string) => {
    await signIn(page, { profile: lucia, recipes: FIBRA_RECIPES });
    await page.goto("/recetas");
    await page.getByRole("button").filter({ hasText: name }).first().click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  };

  test("receta con fibra: celda «Fibra» con «14 g» junto a los macros", async ({ page }) => {
    await open(page, LENTEJAS_FIBRA.name);
    await expect(page.getByText("Fibra", { exact: true })).toBeVisible();
    await expect(page.getByText("14 g", { exact: true })).toBeVisible();
  });

  test("receta sin fibra: celda «Fibra» con «—»", async ({ page }) => {
    await open(page, POLLO_SIN_FIBRA.name);
    await expect(page.getByText("Fibra", { exact: true })).toBeVisible();
    await expect(page.getByText("—", { exact: true })).toBeVisible();
  });
});

test.describe("R8: «Personalizada» con fibra opcional", () => {
  async function openCustom(page: Page) {
    await openDiario(page, []);
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await page.getByRole("button", { name: "Personalizada", exact: true }).click();
    await page.getByPlaceholder("Nombre").fill("Bocadillo de lomo");
    await page.getByLabel("kcal", { exact: true }).fill("420");
  }

  test("con fibra 4,5 la entrada guarda fiber 4.5 y el Diario la muestra", async ({ page }) => {
    await openCustom(page);
    await page.getByLabel("fibra", { exact: true }).fill("4.5");
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const [entry] = await readStored<MealEntry[]>(page, "entries");
    expect(entry.fiber).toBe(4.5);
    await expect(page.getByText("4,5 / 38", { exact: true })).toBeVisible();
    await expect(page.getByText("Fibra 4,5 g", { exact: true })).toBeVisible();
  });

  test("con la fibra vacía la entrada no lleva fiber y el día es parcial", async ({ page }) => {
    await openCustom(page);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const [entry] = await readStored<MealEntry[]>(page, "entries");
    expect(entry).not.toHaveProperty("fiber");
    await expect(partialChip(page)).toBeVisible();
    await expect(page.getByText("Fibra: sin dato", { exact: true })).toBeVisible();
  });

  test("con fibra 0 escrita la entrada guarda 0 y el día no es parcial", async ({ page }) => {
    await openCustom(page);
    await page.getByLabel("fibra", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const [entry] = await readStored<MealEntry[]>(page, "entries");
    expect(entry.fiber).toBe(0);
    await expect(partialChip(page)).toHaveCount(0);
  });
});

test.describe("R5: un alimento local registra la fibra proporcional a los gramos", () => {
  test("150 g de «Lentejas, cocidas» guardan fibra = fibra/100 g × 1,5 y la tarjeta muestra su fibra", async ({ page }) => {
    await openDiario(page, []);
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await page.getByRole("button", { name: "Alimento", exact: true }).click();
    await page.getByLabel("Buscar alimento").fill("lentejas coc");
    await page.getByRole("button", { name: /^Lentejas, cocidas\b/ }).click();
    await page.getByLabel("Gramos", { exact: true }).and(page.locator("input:not([type=radio])")).fill("150");
    // La tarjeta muestra la fibra de los 150 g (en el Diario vacío no hay otro texto igual)
    await expect(page.getByText(`${formatFiber(LENTEJAS_COCIDAS.fiber! * 1.5)} g`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Añadir 150 g", exact: true }).click();

    const [entry] = await readStored<MealEntry[]>(page, "entries");
    expect(entry.fiber).toBeCloseTo(LENTEJAS_COCIDAS.fiber! * 1.5, 6);
  });
});
