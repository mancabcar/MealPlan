// Spec: docs/pm/57-editar-gramos-diario/spec.md › User flows (escenarios 1–4), Acceptance criteria R1–R8 y Edge cases.
// Tech: docs/pm/57-editar-gramos-diario/tech.md › UI (fila «Cambiar cantidad de <nombre>», editor en la fila con
// «Guardar cambios» / «Cancelar», vista previa «<etiqueta> → N kcal», aviso role="status" «Cantidad cambiada» con
// «Deshacer») y State & edge cases (editingId que se cierra al cambiar de día, abrir «Añadir comida» o tocar otra fila;
// un aviso a la vez; Deshacer que no pisa un cambio más nuevo).
//
// Datos: tests/fixtures/editar-cantidad.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). Lucía hace Desayuno,
// Comida, Merienda y Cena; sin plan, así que no hay pendientes. Total del día 1183 kcal (anillo img «N kcal»).
//
// Pendiente (no se puede provocar desde la UI): «la entrada desaparece por sync con el editor abierto» y el guard de
// Deshacer frente a un cambio por sync (lo cubre `undoEdit` en tests/unit/diary-rescale.test.ts). «Toques accidentales
// al desplazar en móvil»: prueba manual; aquí solo se comprueba que en 375 px el toque abre el editor.
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { DIARIO_RECIPES } from "../fixtures/diario";
import { ARROZ_ENTRY, DAY_ENTRIES, DAY_KCAL, GUISO, YESTERDAY } from "../fixtures/editar-cantidad";
import { readStored, signIn, TODAY } from "./helpers";

const ARROZ = "Arroz blanco, cocido";

const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const ring = (page: Page, kcal: number) => page.getByRole("img", { name: `${kcal} kcal`, exact: true });
const row = (page: Page, name: string) => page.getByRole("button", { name: `Cambiar cantidad de ${name}`, exact: true });
const grams = (page: Page) => page.getByLabel("Gramos", { exact: true });
const units = (page: Page) => page.getByLabel("Unidades", { exact: true });
const servings = (page: Page) => page.getByLabel("Raciones", { exact: true });
const save = (page: Page) => page.getByRole("button", { name: "Guardar cambios" });
const cancel = (page: Page) => page.getByRole("button", { name: "Cancelar" });
const notice = (page: Page, text: RegExp | string) => page.getByRole("status").filter({ hasText: text });
const edited = (page: Page) => notice(page, "Cantidad cambiada");
const dateInput = (page: Page) => page.getByLabel("Fecha", { exact: true });
const stored = (page: Page) => readStored<MealEntry[]>(page, "entries");

async function openDiario(page: Page, entries: MealEntry[] = DAY_ENTRIES) {
  await signIn(page, { profile: lucia, recipes: [...DIARIO_RECIPES, GUISO], weekplan: {}, entries });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

async function editArroz(page: Page, value: string) {
  await row(page, ARROZ).click();
  await grams(page).fill(value);
  await save(page).click();
}

// ---------------------------------------------------------------------------

test.describe("Escenario 1 · R1 · R2 · R3 · R6: corregir los gramos de un alimento", () => {
  test("R1: tocar la fila abre el editor con «Gramos» = 150, «Guardar cambios» y «Cancelar»", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await expect(grams(page)).toHaveValue("150");
    await expect(save(page)).toBeVisible();
    await expect(cancel(page)).toBeVisible();
  });

  test("R6: mientras se escribe se ve «100 g → 130 kcal» y el total del día no cambia hasta guardar", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("100");
    await expect(meal(page, "Comida").getByText("100 g → 130 kcal")).toBeVisible();
    await expect(ring(page, DAY_KCAL)).toBeVisible();
  });

  test("R3: al guardar 100 g la fila muestra «100 g · 130 kcal» y el total baja 65", async ({ page }) => {
    await openDiario(page);
    await editArroz(page, "100");
    await expect(grams(page)).toBeHidden();
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 100 g`);
    await expect(meal(page, "Comida")).toContainText("130 kcal");
    await expect(ring(page, DAY_KCAL - 65)).toBeVisible();
  });

  test("R3: se guarda la misma entrada (misma id, fecha, franja y alimento) con 100 g", async ({ page }) => {
    await openDiario(page);
    await editArroz(page, "100");
    await expect(edited(page)).toBeVisible();
    const entries = await stored(page);
    expect(entries.map((e) => e.id)).toEqual(DAY_ENTRIES.map((e) => e.id));
    const arroz = entries.find((e) => e.id === ARROZ_ENTRY.id)!;
    expect(arroz).toMatchObject({ date: TODAY, mealType: "Comida", foodId: ARROZ_ENTRY.foodId, grams: 100 });
    expect(arroz.calories).toBeCloseTo(130, 6);
    expect(arroz.fiber).toBeCloseTo(4 / 3, 6);
  });

  test("R2: un valor no válido muestra el error y no deja guardar", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("2001");
    await expect(page.getByRole("alert").filter({ hasText: "Entre 1 y 2000 g, sin decimales" })).toBeVisible();
    await expect(save(page)).toBeDisabled();
  });

  test("Edge: guardar el mismo valor cierra el editor sin aviso", async ({ page }) => {
    await openDiario(page);
    await editArroz(page, "150");
    await expect(grams(page)).toBeHidden();
    await expect(edited(page)).toHaveCount(0);
  });
});

test.describe("Escenario 2 · R2: corregir las unidades", () => {
  test("R2: de 2 a 3 huevos → «Huevo 3 ud · 180 g · 252 kcal»", async ({ page }) => {
    await openDiario(page);
    await row(page, "Huevo").click();
    await expect(units(page)).toHaveValue("2");
    await units(page).fill("3");
    await expect(meal(page, "Desayuno").getByText("3 ud · 180 g → 252 kcal")).toBeVisible();
    await save(page).click();
    await expect(meal(page, "Desayuno")).toContainText("Huevo 3 ud · 180 g");
    await expect(meal(page, "Desayuno")).toContainText("252 kcal");
    await expect(ring(page, DAY_KCAL + 84)).toBeVisible();
  });
});

test.describe("Escenario 3 · R8: corregir las raciones de una receta", () => {
  test("R8: Guiso de 1 a 0,5 raciones con − → «Guiso × 0,5 · 300 kcal»", async ({ page }) => {
    await openDiario(page);
    await row(page, "Guiso").click();
    await expect(servings(page)).toHaveValue("1");
    const minus = page.getByRole("button", { name: "Quitar 0,25 raciones" });
    await minus.click();
    await minus.click();
    await expect(meal(page, "Cena").getByText("× 0,5 → 300 kcal")).toBeVisible();
    await save(page).click();
    await expect(meal(page, "Cena")).toContainText("Guiso × 0,5");
    await expect(meal(page, "Cena")).toContainText("300 kcal");
    await expect(ring(page, DAY_KCAL - 300)).toBeVisible();
  });

  test("R8: volver a 1 ración quita la etiqueta «×»", async ({ page }) => {
    await openDiario(page);
    await row(page, "Guiso").click();
    await servings(page).fill("0,5");
    await save(page).click();
    await row(page, "Guiso").click();
    await servings(page).fill("1");
    await save(page).click();
    await expect(meal(page, "Cena")).toContainText("600 kcal");
    await expect(meal(page, "Cena").getByText(/×/)).toHaveCount(0);
  });
});

test.describe("R5: personalizadas no editables", () => {
  test("R5: el yogur no tiene botón «Cambiar cantidad» y la ✕ sigue ahí", async ({ page }) => {
    await openDiario(page);
    await expect(meal(page, "Merienda")).toContainText("Yogur con nueces");
    await expect(row(page, "Yogur con nueces")).toHaveCount(0);
    await expect(meal(page, "Merienda").getByRole("button", { name: "Eliminar" })).toBeVisible();
  });
});

test.describe("R4: una sola fila en edición y lo no guardado se descarta", () => {
  test("R4: «Cancelar» cierra sin guardar", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("100");
    await cancel(page).click();
    await expect(grams(page)).toBeHidden();
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 150 g`);
    await expect(ring(page, DAY_KCAL)).toBeVisible();
  });

  test("R4: tocar otra fila abre su editor y descarta el anterior", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("100");
    await row(page, "Huevo").click();
    await expect(units(page)).toBeVisible();
    await expect(grams(page)).toHaveCount(0);
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 150 g`);
  });

  test("R4: al volver a abrir la misma fila el campo vuelve a su valor guardado", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("100");
    await cancel(page).click();
    await row(page, ARROZ).click();
    await expect(grams(page)).toHaveValue("150");
  });

  test("R4: abrir «Añadir comida» cierra el editor sin guardar", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("100");
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeVisible();
    await expect(meal(page, "Comida").getByLabel("Gramos", { exact: true })).toHaveCount(0);
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 150 g`);
  });

  test("State: cambiar de día cierra el editor; al volver sigue cerrado y sin cambios", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await grams(page).fill("100");
    await dateInput(page).fill(YESTERDAY);
    await dateInput(page).fill(TODAY);
    await expect(grams(page)).toHaveCount(0);
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 150 g`);
  });

  test("State: borrar la entrada con el editor abierto lo cierra", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await meal(page, "Comida").getByRole("button", { name: "Eliminar" }).click();
    await expect(grams(page)).toHaveCount(0);
    await expect(page.getByText(`${ARROZ} 150 g`)).toHaveCount(0);
  });
});

test.describe("Escenario 4 · R7: aviso «Cantidad cambiada · Deshacer»", () => {
  test("R7: Deshacer devuelve 150 g, 195 kcal y el total del día", async ({ page }) => {
    await openDiario(page);
    await editArroz(page, "100");
    await edited(page).getByRole("button", { name: "Deshacer" }).click();
    await expect(edited(page)).toHaveCount(0);
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 150 g`);
    await expect(meal(page, "Comida")).toContainText("195 kcal");
    await expect(ring(page, DAY_KCAL)).toBeVisible();
    const arroz = (await stored(page)).find((e) => e.id === ARROZ_ENTRY.id);
    expect(arroz).toEqual(ARROZ_ENTRY);
  });

  test("R7: volver a editar esa entrada cierra el aviso anterior; Deshacer solo revierte el último cambio", async ({ page }) => {
    await openDiario(page);
    await editArroz(page, "100");
    await editArroz(page, "120");
    await expect(edited(page)).toHaveCount(1);
    await edited(page).getByRole("button", { name: "Deshacer" }).click();
    await expect(meal(page, "Comida")).toContainText(`${ARROZ} 100 g`);
  });

  test("R7: borrar la entrada cierra el aviso", async ({ page }) => {
    await openDiario(page);
    await editArroz(page, "100");
    await expect(edited(page)).toBeVisible();
    await meal(page, "Comida").getByRole("button", { name: "Eliminar" }).click();
    await expect(edited(page)).toHaveCount(0);
  });

  test("R7: un aviso a la vez: copiar el día cierra «Cantidad cambiada»", async ({ page }) => {
    const ayer = DAY_ENTRIES.map((e) => ({ ...e, date: YESTERDAY }));
    await openDiario(page, ayer);
    await dateInput(page).fill(YESTERDAY);
    await editArroz(page, "100");
    await expect(edited(page)).toBeVisible();
    await page.getByRole("button", { name: "Copiar día a otra fecha" }).click();
    const sheet = page.getByRole("dialog", { name: /^Copiar el / });
    await sheet.getByRole("button", { name: /^Hoy/ }).click();
    await sheet.getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(notice(page, /Copiadas/)).toBeVisible();
    await expect(edited(page)).toHaveCount(0);
  });
});

test.describe("Edge: móvil", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("Edge: en 375 px tocar la fila abre el editor sin desbordar", async ({ page }) => {
    await openDiario(page);
    await row(page, ARROZ).click();
    await expect(grams(page)).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
  });
});
