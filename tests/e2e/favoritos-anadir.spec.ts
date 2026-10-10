// Spec: docs/pm/55-mis-alimentos/spec.md › Acceptance criteria: camino feliz de cada Must (R1–R5), R10, R11 y R7.
// Tech: tech.md › UI, State & edge cases (Ver todos se pliega al cambiar de franja; Editar y el formulario abierto se
// mantienen; el aviso se va al cerrar «Añadir comida»; la casilla se desmarca) y Testing strategy (e2e).
// Nombres accesibles acordados con Manuel el 2026-10-10: lista «Favoritos», ☆ «Guardar <nombre> en Favoritos»,
// ★ «Quitar <nombre> de Favoritos», «Ver todos (N)», «Editar»/«Listo», lápiz «Editar <nombre>», casilla «Guardar en
// favoritos», «Guardar cambios», «Quitar de favoritos».
//
// Datos: tests/fixtures/favoritos-anadir.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). Lucía hace Desayuno,
// Comida, Merienda y Cena; el formulario abre en «Comida». Sin plan, así que no hay pendientes.
// Fallan hasta las tareas 4–7 del tech design.
import { expect, test, type Page } from "@playwright/test";
import type { MealFavorite } from "@/lib/mealFavorites";
import type { MealEntry } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  AVENA,
  AVENA_FAV,
  FAV_RECIPES,
  POLLO_CURRY,
  TORTILLA_FAV,
  TOSTADA_FAV,
  TWELVE_FAVS,
  YESTERDAY,
  customEntry,
  foodEntryOf,
  recipeEntryOf,
} from "../fixtures/favoritos-anadir";
import { readStored, signIn, TODAY } from "./helpers";

async function openDiario(page: Page, data: { entries?: MealEntry[]; mealFavorites?: MealFavorite[]; favorites?: string[] } = {}) {
  await signIn(page, { profile: lucia, recipes: FAV_RECIPES, weekplan: {}, entries: [], ...data });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

async function openAddForm(page: Page) {
  await page.getByRole("button", { name: "Añadir comida" }).click();
  await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeVisible();
}

const favList = (page: Page) => page.getByRole("list", { name: "Favoritos" });
const recentList = (page: Page) => page.getByRole("list", { name: "Recientes" });
const favRow = (page: Page, name: string) => favList(page).getByRole("button", { name: new RegExp(`^${name}`) });
const recentRow = (page: Page, name: string) => recentList(page).getByRole("button", { name: new RegExp(`^${name}`) });
const mealSelect = (page: Page) => page.getByRole("combobox", { name: "Comida del día" });
const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const toast = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const HINT = "Toca ☆ en lo que repites para tenerlo aquí";
const y = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!.y;

// ---------------------------------------------------------------------------

test.describe("R1: sección Favoritos en «Añadir comida»", () => {
  test("R1: entre el selector de franja y Recientes, en las tres pestañas", async ({ page }) => {
    await openDiario(page, { mealFavorites: [TOSTADA_FAV], entries: [customEntry(YESTERDAY, "Comida", { customName: "Ensalada" })] });
    await openAddForm(page);

    const favHeading = page.getByRole("heading", { name: "Favoritos" });
    expect(await y(mealSelect(page))).toBeLessThan(await y(favHeading));
    expect(await y(favHeading)).toBeLessThan(await y(page.getByRole("heading", { name: "Recientes" })));
    for (const tab of ["Alimento", "Personalizada", "Receta"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(favRow(page, "Tostada con aceite")).toBeVisible();
    }
  });

  test("R1: en Cena, tocar un favorito lo añade a Cena de hoy con sus datos y cierra «Añadir comida»", async ({ page }) => {
    await openDiario(page, { mealFavorites: [TOSTADA_FAV] });
    await openAddForm(page);
    await mealSelect(page).selectOption("Cena");
    await favRow(page, "Tostada con aceite").click();

    await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeHidden();
    await expect(meal(page, "Cena")).toContainText("Tostada con aceite");
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toEqual([expect.objectContaining({ date: TODAY, mealType: "Cena", customName: "Tostada con aceite", calories: 210, fat: 11, fiber: 3 })]);
  });

  test("R10: sin favoritos aparece la pista", async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    await expect(page.getByText(HINT)).toBeVisible();
    await expect(favList(page)).toHaveCount(0);
  });
});

test.describe("R2/R7/R11: ☆ en Recientes", () => {
  test("R2/R11: la fila sube a Favoritos, sale de Recientes y Deshacer la devuelve", async ({ page }) => {
    await openDiario(page, { entries: [customEntry(YESTERDAY, "Comida")] });
    await openAddForm(page);
    await expect(page.getByText(HINT)).toBeVisible();

    await recentList(page).getByRole("button", { name: "Guardar Tortilla francesa en Favoritos" }).click();
    await expect(favRow(page, "Tortilla francesa")).toBeVisible();
    await expect(recentList(page)).toHaveCount(0); // era la única reciente (R7)
    await expect(page.getByText(HINT)).toBeHidden();
    await expect(toast(page, "Guardado en Favoritos")).toBeVisible();
    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([
      expect.objectContaining({ kind: "custom", name: "Tortilla francesa", calories: 190, protein: 13, carbs: 1, fat: 15 }),
    ]);

    await toast(page, "Guardado en Favoritos").getByRole("button", { name: "Deshacer" }).click();
    await expect(recentRow(page, "Tortilla francesa")).toBeVisible();
    await expect(page.getByText(HINT)).toBeVisible();
    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([]);
  });

  test("R2: ☆ en una receta la marca favorita en la lista de #20; la fila × 0,5 no lleva ☆", async ({ page }) => {
    await openDiario(page, { entries: [recipeEntryOf(YESTERDAY, "Comida", POLLO_CURRY, 0.5), recipeEntryOf(YESTERDAY, "Comida", POLLO_CURRY)] });
    await openAddForm(page);
    await expect(recentList(page).getByRole("button", { name: "Guardar Pollo al curry en Favoritos" })).toHaveCount(1);

    await recentList(page).getByRole("button", { name: "Guardar Pollo al curry en Favoritos" }).click();
    await expect(favRow(page, "Pollo al curry")).toBeVisible();
    expect(await readStored<string[]>(page, "favorites")).toEqual([POLLO_CURRY.id]);
    // R7: la × 0,5 sigue en Recientes
    await expect(recentRow(page, "Pollo al curry × 0,5")).toBeVisible();
  });

  test("R2: un alimento guarda su cantidad («Avena 40 g»)", async ({ page }) => {
    await openDiario(page, { entries: [foodEntryOf(YESTERDAY, "Comida", AVENA, 40)] });
    await openAddForm(page);
    await recentList(page).getByRole("button", { name: "Guardar Avena en Favoritos" }).click();
    await expect(favRow(page, "Avena 40 g")).toBeVisible();
    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([expect.objectContaining({ kind: "food", foodId: AVENA.foodId, grams: 40 })]);
  });
});

test.describe("R3: «Guardar en favoritos» en Personalizada", () => {
  test("R3: registra, guarda la favorita, avisa y la casilla vuelve desmarcada al reabrir", async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    await page.getByRole("button", { name: "Personalizada", exact: true }).click();
    const box = page.getByRole("checkbox", { name: "Guardar en favoritos" });
    await expect(box).not.toBeChecked();

    await page.getByPlaceholder("Nombre").fill("Crema de calabacín");
    await page.getByLabel("kcal").fill("120");
    await page.getByLabel("grasa").fill("6");
    await box.check();
    await page.getByRole("button", { name: "Añadir", exact: true }).click();

    await expect(meal(page, "Comida")).toContainText("Crema de calabacín");
    await expect(toast(page, "Añadido a Comida · guardado en Favoritos")).toBeVisible();
    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([
      expect.objectContaining({ kind: "custom", name: "Crema de calabacín", calories: 120, fat: 6 }),
    ]);

    await openAddForm(page);
    await expect(favRow(page, "Crema de calabacín")).toBeVisible();
    await page.getByRole("button", { name: "Personalizada", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Guardar en favoritos" })).not.toBeChecked();
  });
});

test.describe("R4: editar una personalizada favorita", () => {
  test("R4: corregir la grasa no toca lo ya registrado y vale para el siguiente registro", async ({ page }) => {
    const old = customEntry(YESTERDAY, "Desayuno", { customName: "Tostada con aceite", calories: 210, protein: 5, carbs: 28, fat: 11 });
    await openDiario(page, { mealFavorites: [TOSTADA_FAV], entries: [old] });
    await openAddForm(page);

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("button", { name: "Editar Tostada con aceite" }).click();
    await page.getByLabel("grasa").fill("9");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.getByRole("button", { name: "Listo" }).click();

    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([{ ...TOSTADA_FAV, fat: 9 }]);
    await favRow(page, "Tostada con aceite").click();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries[0]).toEqual(old);
    expect(entries[1]).toMatchObject({ date: TODAY, customName: "Tostada con aceite", fat: 9 });
  });
});

test.describe("R5: quitar de Favoritos con Deshacer", () => {
  test("R5: la ★ la quita; Deshacer la devuelve en la misma posición", async ({ page }) => {
    await openDiario(page, { mealFavorites: [TORTILLA_FAV, TOSTADA_FAV, AVENA_FAV] });
    await openAddForm(page);
    const before = await favList(page).getByRole("listitem").allTextContents();

    await page.getByRole("button", { name: "Quitar Tostada con aceite de Favoritos" }).click();
    await expect(favRow(page, "Tostada con aceite")).toHaveCount(0);
    await expect(toast(page, "Quitado de Favoritos")).toBeVisible();

    await toast(page, "Quitado de Favoritos").getByRole("button", { name: "Deshacer" }).click();
    await expect(favList(page).getByRole("listitem")).toHaveText(before);
    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([TORTILLA_FAV, TOSTADA_FAV, AVENA_FAV]);
  });

  test("R5: al cerrar «Añadir comida» el aviso desaparece y el cambio queda hecho", async ({ page }) => {
    await openDiario(page, { mealFavorites: [TORTILLA_FAV, TOSTADA_FAV] });
    await openAddForm(page);
    await page.getByRole("button", { name: "Quitar Tostada con aceite de Favoritos" }).click();
    await expect(toast(page, "Quitado de Favoritos")).toBeVisible();

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(toast(page, "Quitado de Favoritos")).toHaveCount(0);
    expect(await readStored<MealFavorite[]>(page, "mealFavorites")).toEqual([TORTILLA_FAV]);
  });
});

test.describe("State & edge cases: cambiar de franja", () => {
  test("«Ver todos» se pliega al cambiar de franja", async ({ page }) => {
    await openDiario(page, { mealFavorites: TWELVE_FAVS });
    await openAddForm(page);
    await expect(favList(page).getByRole("listitem")).toHaveCount(5);
    await page.getByRole("button", { name: "Ver todos (12)" }).click();
    await expect(favList(page).getByRole("listitem")).toHaveCount(12);

    await mealSelect(page).selectOption("Cena");
    await expect(favList(page).getByRole("listitem")).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Ver todos (12)" })).toBeVisible();
  });

  test("«Editar» y el formulario abierto siguen al cambiar de franja, sin perder lo escrito", async ({ page }) => {
    await openDiario(page, { mealFavorites: [TOSTADA_FAV] });
    await openAddForm(page);
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("button", { name: "Editar Tostada con aceite" }).click();
    await page.getByLabel("grasa").fill("9");

    await mealSelect(page).selectOption("Cena");
    await expect(page.getByLabel("grasa")).toHaveValue("9");
    await expect(page.getByRole("button", { name: "Listo" })).toBeVisible();
  });
});
