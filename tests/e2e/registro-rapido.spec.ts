// Spec: docs/pm/12-registro-rapido/spec.md › Acceptance criteria R1, R3–R7 (R2 y el detalle de R3 van en unit).
// Tech: docs/pm/12-registro-rapido/tech.md › UI (título «Recientes» y lista con ese nombre accesible, un botón por
// fila con nombre + «× raciones» + kcal, entre el selector de franja y las pestañas; singleClick en la fila y en
// «Añadir comida») y Testing strategy (E2E).
//
// Datos: tests/fixtures/diario.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). Lucía hace Desayuno, Comida,
// Merienda y Cena, y el formulario abre en «Comida». Sin plan, así que no hay pendientes.
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { DIARIO_RECIPES, GUISO, KEFIR, LENTEJAS, MERLUZA, TORTILLA, YESTERDAY, entry } from "../fixtures/diario";
import { recipeEntry } from "@/lib/diary";
import { readStored, signIn, TODAY } from "./helpers";

const RECIPES = [...DIARIO_RECIPES, GUISO];

async function openDiario(page: Page, entries: MealEntry[]) {
  await signIn(page, { profile: lucia, recipes: RECIPES, weekplan: {}, entries });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

async function openAddForm(page: Page) {
  await page.getByRole("button", { name: "Añadir comida" }).click();
  await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeVisible();
}

const recentList = (page: Page) => page.getByRole("list", { name: "Recientes" });
const rows = (page: Page) => recentList(page).getByRole("button");
const mealSelect = (page: Page) => page.getByRole("combobox", { name: "Comida del día" });
const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

const rec = (r: (typeof RECIPES)[number], mealType: MealEntry["mealType"], servings = 1, date = YESTERDAY) =>
  recipeEntry(r, date, mealType, { servings });

// ---------------------------------------------------------------------------

test.describe("R1: sección Recientes en «Añadir comida»", () => {
  test("aparece debajo del selector de franja y encima de las pestañas, también en Personalizada", async ({ page }) => {
    await openDiario(page, [rec(LENTEJAS, "Comida")]);
    await openAddForm(page);

    const heading = page.getByRole("heading", { name: "Recientes" });
    await expect(heading).toBeVisible();
    const y = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!.y;
    const select = await y(mealSelect(page));
    const recientes = await y(heading);
    const tabs = await y(page.getByRole("button", { name: "Receta", exact: true }));
    expect(select).toBeLessThan(recientes);
    expect(recientes).toBeLessThan(tabs);

    await page.getByRole("button", { name: "Personalizada", exact: true }).click();
    await expect(recentList(page)).toBeVisible();
  });

  test("con más de 5 comidas distintas muestra exactamente 5 filas", async ({ page }) => {
    await openDiario(page, [
      rec(LENTEJAS, "Comida"),
      rec(TORTILLA, "Comida"),
      rec(MERLUZA, "Comida"),
      rec(KEFIR, "Comida"),
      rec(GUISO, "Comida"),
      entry(YESTERDAY, "Comida", { customName: "Yogur con nueces" }),
    ]);
    await openAddForm(page);
    await expect(rows(page)).toHaveCount(5);
  });
});

test.describe("R3: franja elegida primero", () => {
  test("A (Desayuno), B (Cena), C (Desayuno): Desayuno → C, A, B; Cena → B, C, A", async ({ page }) => {
    await openDiario(page, [rec(LENTEJAS, "Desayuno"), rec(TORTILLA, "Cena"), rec(MERLUZA, "Desayuno")]);
    await openAddForm(page);

    await mealSelect(page).selectOption("Desayuno");
    await expect(rows(page)).toHaveText([/^Merluza al horno/, /^Lentejas/, /^Tortilla francesa/]);
    await mealSelect(page).selectOption("Cena");
    await expect(rows(page)).toHaveText([/^Tortilla francesa/, /^Merluza al horno/, /^Lentejas/]);
  });
});

test.describe("R4: un toque añade y cierra", () => {
  test("añade en la fecha y franja elegidas, con los macros y raciones de la reciente y un id nuevo", async ({ page }) => {
    const src = rec(GUISO, "Cena", 0.5);
    await openDiario(page, [src]);
    await openAddForm(page);
    await mealSelect(page).selectOption("Desayuno");
    await rows(page).filter({ hasText: "Guiso" }).click();

    await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeHidden();
    await expect(meal(page, "Desayuno").getByText("Guiso")).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ ...src, id: entries[1].id, date: TODAY, mealType: "Desayuno" });
    expect(entries[1].id).not.toBe(src.id);
  });

  test("un doble toque añade una sola entrada y no vuelve a abrir el formulario", async ({ page }) => {
    await openDiario(page, [rec(LENTEJAS, "Comida")]);
    await openAddForm(page);
    await rows(page).filter({ hasText: "Lentejas" }).dblclick();

    await expect(page.getByRole("button", { name: "Añadir comida" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeHidden();
    expect(await readStored<MealEntry[]>(page, "entries")).toHaveLength(2);
  });
});

test.describe("R5: contenido de la fila", () => {
  test("receta con 0,5 raciones → «Guiso × 0,5» y «300 kcal»; con 1 ración, sin «× 1»", async ({ page }) => {
    await openDiario(page, [rec(GUISO, "Comida", 0.5), rec(LENTEJAS, "Comida")]);
    await openAddForm(page);
    await expect(rows(page).filter({ hasText: "Guiso" })).toHaveText(/^Guiso × 0,5\s*300 kcal$/);
    await expect(rows(page).filter({ hasText: "Lentejas" })).toHaveText(/^Lentejas\s*520 kcal$/);
  });

  test("kcal no enteras se redondean (37,5 → 38)", async ({ page }) => {
    await openDiario(page, [entry(YESTERDAY, "Comida", { customName: "Caldo", calories: 37.5 })]);
    await openAddForm(page);
    await expect(rows(page)).toHaveText([/^Caldo\s*38 kcal$/]);
  });
});

test.describe("R6 · R7", () => {
  test("R6: sin ninguna entrada no hay sección Recientes", async ({ page }) => {
    await openDiario(page, []);
    await openAddForm(page);
    await expect(page.getByRole("heading", { name: "Recientes" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Receta", exact: true })).toBeVisible();
  });

  test("R7: al borrar la única entrada de una comida, deja de estar en Recientes", async ({ page }) => {
    await openDiario(page, [rec(TORTILLA, "Comida"), rec(LENTEJAS, "Comida", 1, TODAY)]);
    await meal(page, "Comida").getByRole("button", { name: "Eliminar" }).click();
    await openAddForm(page);
    await expect(rows(page)).toHaveText([/^Tortilla francesa/]);
  });

  test("R7: una entrada de una receta que no existe no aparece", async ({ page }) => {
    await openDiario(page, [rec(TORTILLA, "Comida"), { ...rec(LENTEJAS, "Comida"), recipeId: "no-existe" }]);
    await openAddForm(page);
    await expect(rows(page)).toHaveText([/^Tortilla francesa/]);
  });
});

test.describe("Review de #12: fecha borrada", () => {
  test("con el campo de fecha vacío, tocar una reciente no guarda una entrada sin fecha", async ({ page }) => {
    await openDiario(page, [rec(LENTEJAS, "Comida")]);
    await page.locator('input[type="date"]').fill("");
    await openAddForm(page);
    await rows(page).filter({ hasText: "Lentejas" }).click();
    expect(await readStored<MealEntry[]>(page, "entries")).toHaveLength(1);
  });
});
