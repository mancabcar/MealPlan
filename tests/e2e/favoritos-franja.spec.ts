// Spec: docs/pm/20-recetas-filtros/spec.md › R1–R5 (Acceptance criteria y User flows).
// Tech: docs/pm/20-recetas-filtros/tech.md › UI (contrato de la prueba):
//   - Selector = grupo «Elegir receta» con un searchbox «Buscar» y listas con nombre: «★ Favoritas», el nombre de la
//     franja («Cena»…) y «Otras franjas». Cada fila es un botón cuyo nombre empieza por el de la receta; la receta ya
//     asignada lleva aria-current="true". Botones «Ver todas las recetas», «← Solo …» y «Quitar» (solo en el Plan).
//   - Estrella: botón «Marcar <receta> como favorita» / «Quitar <receta> de favoritas»; no cierra el selector.
//   - En Recetas: la misma estrella en la tarjeta y en el detalle, y un botón «Solo favoritas» (aria-pressed).
// Datos: tests/fixtures/favoritos.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). El store añade siempre las
// recetas semilla, así que los casos se anclan a recetas propias con nombres únicos. Fallan hasta las tareas 3–7.
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import {
  CENA_ALCACHOFAS,
  CENA_IA,
  CENA_PUERROS,
  CENA_PURE,
  CENA_QUESO,
  CENA_ZARZUELA,
  COMIDA_LENTEJAS,
  DESAYUNO_TOSTADA,
  FAV_RECIPES,
  SIN_FRANJA,
  SNACK_PUDIN,
  SNACK_YOGUR,
} from "../fixtures/favoritos";
import { favStar, pickRecipe, readStored, recipePicker, recipeRow, signIn, TODAY } from "./helpers";

type Seed = { favorites?: string[]; weekplan?: Record<string, unknown>; allergies?: string[] };

async function seed(page: Page, { favorites = [], weekplan = {}, allergies = [] }: Seed = {}) {
  await signIn(page, {
    profile: { ...lucia, allergies: { preset: allergies, custom: [] } },
    recipes: FAV_RECIPES,
    favorites,
    weekplan,
    entries: [],
  });
}

async function openPlanSlot(page: Page, meal: string) {
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Martes", level: 2 })).toBeVisible();
  // "Cocinar para varias comidas" (sobras) no debe coincidir con la comida
  await page.getByRole("button", { name: new RegExp(`^${meal}( |$)`) }).click();
  await expect(recipePicker(page)).toBeVisible();
}

const list = (page: Page, name: string) => recipePicker(page).getByRole("list", { name, exact: true });
const search = (page: Page) => recipePicker(page).getByRole("searchbox", { name: "Buscar" });
const verTodas = (page: Page) => recipePicker(page).getByRole("button", { name: "Ver todas las recetas" });

// ---------------------------------------------------------------------------

test.describe("R1: el selector del Plan se filtra por la franja elegida", () => {
  test("Cena → favorita en 2 toques: abrir la franja (1) y tocar la receta (2), sin buscar ni filtrar", async ({ page }) => {
    await seed(page, { favorites: [CENA_PUERROS.id] });
    await page.goto("/plan");
    await page.getByRole("button", { name: /^Cena( |$)/ }).click(); // toque 1
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) })).toBeVisible();
    await pickRecipe(page, CENA_PUERROS.name); // toque 2

    await expect(recipePicker(page)).toHaveCount(0);
    const plan = await readStored<Record<string, { mealType: string; recipeId: string }[]>>(page, "weekplan");
    expect(plan[TODAY]).toEqual([{ mealType: "Cena", recipeId: CENA_PUERROS.id }]);
  });

  test("Cena: solo recetas con tag cena (incluida la de IA con «Cena» capitalizado), no las de otras franjas", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    const cena = list(page, "Cena");
    await expect(cena.getByRole("button", { name: new RegExp(`^${CENA_ZARZUELA.name}`) })).toBeVisible();
    await expect(cena.getByRole("button", { name: new RegExp(`^${CENA_IA.name}`) })).toBeVisible();
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toHaveCount(0);
    await expect(recipeRow(page, SNACK_YOGUR.name)).toHaveCount(0);
    await expect(recipeRow(page, SIN_FRANJA.name)).toHaveCount(0);
  });

  test("Merienda usa las recetas con tag snack", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Merienda");
    await expect(recipeRow(page, SNACK_YOGUR.name)).toBeVisible();
    await expect(recipeRow(page, SNACK_PUDIN.name)).toBeVisible();
    await expect(recipeRow(page, CENA_ZARZUELA.name)).toHaveCount(0);
  });

  test("el buscador se combina con la franja y no distingue mayúsculas ni tildes", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    await search(page).fill("PURE");
    await expect(recipeRow(page, CENA_PURE.name)).toBeVisible();
    await expect(recipeRow(page, CENA_ZARZUELA.name)).toHaveCount(0);

    await search(page).fill("vegetariano"); // por etiqueta
    await expect(recipeRow(page, CENA_PUERROS.name)).toBeVisible();

    await search(page).fill("lentejas"); // es de comida: la franja manda
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toHaveCount(0);
  });

  test("una receta con tus alérgenos lleva el aviso en su fila", async ({ page }) => {
    await seed(page, { allergies: ["lactosa"] });
    await openPlanSlot(page, "Cena");
    await expect(recipeRow(page, CENA_QUESO.name)).toContainText("Lactosa");
    await expect(recipeRow(page, CENA_ZARZUELA.name)).not.toContainText("Lactosa");
  });

  test("la receta ya asignada sale resaltada y «Quitar» deja la franja sin asignar", async ({ page }) => {
    await seed(page, { weekplan: { [TODAY]: [{ mealType: "Cena", recipeId: CENA_ZARZUELA.id }] } });
    await openPlanSlot(page, "Cena");
    await expect(recipeRow(page, CENA_ZARZUELA.name)).toHaveAttribute("aria-current", "true");
    await expect(recipeRow(page, CENA_PUERROS.name)).not.toHaveAttribute("aria-current", "true");

    await recipePicker(page).getByRole("button", { name: "Quitar", exact: true }).click();
    await expect(recipePicker(page)).toHaveCount(0);
    const plan = await readStored<Record<string, unknown[]>>(page, "weekplan");
    expect(plan[TODAY] ?? []).toEqual([]);
  });

  test("«Añadir comida» del Diario usa el mismo selector, filtrado por la franja elegida", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await page.getByRole("combobox", { name: "Comida del día" }).selectOption("Merienda");

    await expect(recipePicker(page)).toBeVisible();
    await expect(recipeRow(page, SNACK_YOGUR.name)).toBeVisible();
    await expect(recipeRow(page, CENA_ZARZUELA.name)).toHaveCount(0);

    await pickRecipe(page, SNACK_YOGUR.name);
    await expect(recipeRow(page, SNACK_YOGUR.name)).toHaveAttribute("aria-current", "true");
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const entries = await readStored<{ mealType: string; recipeId?: string }[]>(page, "entries");
    expect(entries.map((e) => [e.mealType, e.recipeId])).toEqual([["Merienda", SNACK_YOGUR.id]]);
  });
});

test.describe("R1: el estado del selector no se arrastra entre franjas (review #89)", () => {
  test("Diario: al cambiar de franja la receta elegida se descarta y «Añadir» no la registra", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await pickRecipe(page, COMIDA_LENTEJAS.name);
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toHaveAttribute("aria-current", "true");

    await page.getByRole("combobox", { name: "Comida del día" }).selectOption("Merienda");
    await expect(recipePicker(page).locator('[aria-current="true"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    expect((await readStored<unknown[]>(page, "entries")) ?? []).toEqual([]);
  });

  test("Plan: al tocar otra franja con el selector abierto se reinician el buscador y «Ver todas»", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    await search(page).fill("lentejas");
    await verTodas(page).click();
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toBeVisible();

    await page.getByRole("button", { name: /^Desayuno( |$)/ }).click();
    await expect(search(page)).toHaveValue("");
    await expect(verTodas(page)).toBeVisible();
  });
});

test.describe("R2: ★ Favoritas y la estrella de cada fila", () => {
  test("las favoritas de la franja salen arriba, A–Z, y no se repiten en la lista de la franja", async ({ page }) => {
    await seed(page, { favorites: [CENA_ZARZUELA.id, CENA_ALCACHOFAS.id] });
    await openPlanSlot(page, "Cena");
    const favs = list(page, "★ Favoritas").getByRole("listitem");
    await expect(favs).toHaveCount(2);
    await expect(favs.nth(0)).toContainText(CENA_ALCACHOFAS.name);
    await expect(favs.nth(1)).toContainText(CENA_ZARZUELA.name);
    await expect(list(page, "Cena").getByRole("button", { name: new RegExp(`^${CENA_ZARZUELA.name}`) })).toHaveCount(0);
  });

  test("la estrella marca sin cerrar el selector y la receta pasa a ★ Favoritas; otra vez la desmarca", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    await favStar(page, CENA_PUERROS.name).click();

    await expect(recipePicker(page)).toBeVisible(); // sigue abierto
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) })).toBeVisible();
    expect(await readStored<string[]>(page, "favorites")).toEqual([CENA_PUERROS.id]);

    await favStar(page, CENA_PUERROS.name, true).click();
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) })).toHaveCount(0);
    await expect(list(page, "Cena").getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) })).toBeVisible();
    expect(await readStored<string[]>(page, "favorites")).toEqual([]);
  });

  test("una favorita de otra franja no sale en ★ al elegir Cena", async ({ page }) => {
    await seed(page, { favorites: [SNACK_YOGUR.id] });
    await openPlanSlot(page, "Cena");
    await expect(recipeRow(page, SNACK_YOGUR.name)).toHaveCount(0);
  });

  test("sin favoritas en la franja, ★ muestra una pista de cómo marcarlas", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Merienda");
    await expect(recipePicker(page).getByText("Aún no tienes favoritas para esta franja")).toBeVisible();
  });

  test("sin límite: se pueden marcar muchas favoritas", async ({ page }) => {
    await seed(page, { favorites: FAV_RECIPES.map((r) => r.id) });
    await openPlanSlot(page, "Cena");
    await expect(list(page, "★ Favoritas").getByRole("listitem")).toHaveCount(7); // las 7 recetas con tag cena
  });
});

test.describe("R3: «Ver todas»", () => {
  test("muestra el resto con la etiqueta de su franja, y la receta sin franja sin etiqueta", async ({ page }) => {
    await seed(page, { favorites: [SNACK_YOGUR.id] });
    await openPlanSlot(page, "Cena");
    await verTodas(page).click();

    // ★ trae todas las favoritas, también las de otras franjas
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${SNACK_YOGUR.name}`) })).toBeVisible();
    const otras = list(page, "Otras franjas");
    await expect(otras.getByRole("listitem").filter({ hasText: COMIDA_LENTEJAS.name })).toContainText("Comida");
    await expect(otras.getByRole("listitem").filter({ hasText: DESAYUNO_TOSTADA.name })).toContainText("Desayuno");
    await expect(otras.getByRole("listitem").filter({ hasText: SIN_FRANJA.name })).toBeVisible();
    await expect(otras.getByRole("listitem").filter({ hasText: SIN_FRANJA.name })).not.toContainText(/Desayuno|Comida|Cena|Snack/);
    // La franja sigue primero
    await expect(list(page, "Cena").getByRole("button", { name: new RegExp(`^${CENA_ZARZUELA.name}`) })).toBeVisible();
  });

  test("se puede volver a la franja, y el buscador se mantiene al abrir «Ver todas»", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    await search(page).fill("lentejas");
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toHaveCount(0);

    await verTodas(page).click();
    await expect(search(page)).toHaveValue("lentejas");
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toBeVisible();

    await recipePicker(page).getByRole("button", { name: /^← Solo/ }).click();
    await expect(recipeRow(page, COMIDA_LENTEJAS.name)).toHaveCount(0);
  });

  test("elegir una receta de otra franja desde «Ver todas» la asigna", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    await verTodas(page).click();
    await pickRecipe(page, COMIDA_LENTEJAS.name);
    const plan = await readStored<Record<string, { mealType: string; recipeId: string }[]>>(page, "weekplan");
    expect(plan[TODAY]).toEqual([{ mealType: "Cena", recipeId: COMIDA_LENTEJAS.id }]);
  });
});

test.describe("R4: los favoritos persisten por usuario y viajan en la copia de seguridad", () => {
  test("tras recargar siguen marcadas", async ({ page }) => {
    await seed(page);
    await openPlanSlot(page, "Cena");
    await favStar(page, CENA_ZARZUELA.name).click();
    await page.reload();
    await page.getByRole("button", { name: /^Cena( |$)/ }).click();
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${CENA_ZARZUELA.name}`) })).toBeVisible();
  });

  test("las favoritas de otra cuenta del mismo navegador no se mezclan", async ({ page }) => {
    await seed(page, { favorites: [CENA_PUERROS.id] });
    await page.goto("/plan");
    await page.evaluate((id) => localStorage.setItem("mp_otra_favorites", JSON.stringify([id])), CENA_ZARZUELA.id);
    await page.reload();
    await page.getByRole("button", { name: /^Cena( |$)/ }).click();
    await expect(list(page, "★ Favoritas").getByRole("listitem")).toHaveCount(1);
    await expect(recipeRow(page, CENA_PUERROS.name)).toBeVisible();

    await favStar(page, CENA_ALCACHOFAS.name).click();
    expect(await page.evaluate(() => localStorage.getItem("mp_otra_favorites"))).toBe(JSON.stringify([CENA_ZARZUELA.id]));
  });

  test("«Exportar mis datos» incluye los favoritos", async ({ page }) => {
    await seed(page, { favorites: [CENA_PUERROS.id, SNACK_YOGUR.id] });
    await page.goto("/perfil");
    const downloading = page.waitForEvent("download");
    await page.getByRole("region", { name: "Tus datos" }).getByRole("button", { name: "Exportar mis datos" }).click();
    const file = JSON.parse(await readFile((await (await downloading).path())!, "utf8"));
    expect(file.schemaVersion).toBe(1);
    expect(file.data.favorites).toEqual([CENA_PUERROS.id, SNACK_YOGUR.id]);
  });

  test("«Importar datos» restaura los favoritos de la copia sin recargar la página", async ({ page }) => {
    await seed(page, { favorites: [] });
    await page.goto("/perfil");
    const backup = JSON.stringify({
      app: "mealplan",
      schemaVersion: 1,
      exportedAt: "2026-09-20T10:00:00.000Z",
      data: { profile: { ...lucia, allergies: { preset: [], custom: [] } }, recipes: FAV_RECIPES, favorites: [CENA_PURE.id] },
    });
    page.on("dialog", (d) => d.accept());
    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("region", { name: "Tus datos" }).getByRole("button", { name: "Importar datos" }).click();
    await (await choosing).setFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from(backup, "utf8") });

    await expect.poll(() => readStored<string[]>(page, "favorites")).toEqual([CENA_PURE.id]);
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Plan" }).click();
    await page.getByRole("button", { name: /^Cena( |$)/ }).click();
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${CENA_PURE.name}`) })).toBeVisible();
  });

  test("una copia anterior sin favoritos los deja vacíos, sin error", async ({ page }) => {
    await seed(page, { favorites: [CENA_PUERROS.id] });
    await page.goto("/perfil");
    const backup = JSON.stringify({
      app: "mealplan",
      schemaVersion: 1,
      exportedAt: "2026-08-20T10:00:00.000Z",
      data: { profile: { ...lucia, allergies: { preset: [], custom: [] } }, recipes: FAV_RECIPES },
    });
    page.on("dialog", (d) => d.accept());
    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("region", { name: "Tus datos" }).getByRole("button", { name: "Importar datos" }).click();
    await (await choosing).setFiles({ name: "vieja.json", mimeType: "application/json", buffer: Buffer.from(backup, "utf8") });
    await expect.poll(() => readStored<string[]>(page, "favorites")).toEqual([]);
  });
});

test.describe("R5: estrella y «Solo favoritas» en la página Recetas", () => {
  async function openRecetas(page: Page, favorites: string[] = []) {
    await seed(page, { favorites });
    await page.goto("/recetas");
    await expect(page.getByRole("heading", { name: "Recetas", level: 1 })).toBeVisible();
  }
  const star = (page: Page, name: string, marked = false) =>
    page.getByRole("button", { name: marked ? `Quitar ${name} de favoritas` : `Marcar ${name} como favorita` });

  test("la estrella de la tarjeta marca y desmarca, y se refleja en el selector del Plan", async ({ page }) => {
    await openRecetas(page);
    await page.getByPlaceholder(/Buscar/).fill(CENA_ZARZUELA.name);
    await star(page, CENA_ZARZUELA.name).click();
    await expect(star(page, CENA_ZARZUELA.name, true)).toBeVisible();
    expect(await readStored<string[]>(page, "favorites")).toEqual([CENA_ZARZUELA.id]);

    await page.goto("/plan");
    await page.getByRole("button", { name: /^Cena( |$)/ }).click();
    await expect(list(page, "★ Favoritas").getByRole("button", { name: new RegExp(`^${CENA_ZARZUELA.name}`) })).toBeVisible();
  });

  test("el detalle de la receta también lleva la estrella", async ({ page }) => {
    await openRecetas(page);
    await page.getByPlaceholder(/Buscar/).fill(CENA_PUERROS.name);
    await page.getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) }).click();
    await expect(page.getByRole("heading", { name: CENA_PUERROS.name, level: 1 })).toBeVisible();
    await star(page, CENA_PUERROS.name).click();
    await expect(star(page, CENA_PUERROS.name, true)).toBeVisible();
    expect(await readStored<string[]>(page, "favorites")).toEqual([CENA_PUERROS.id]);
  });

  test("«Solo favoritas» se combina con la búsqueda", async ({ page }) => {
    await openRecetas(page, [CENA_PUERROS.id, SNACK_YOGUR.id]);
    const chip = page.getByRole("button", { name: "Solo favoritas" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${SNACK_YOGUR.name}`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${CENA_ZARZUELA.name}`) })).toHaveCount(0);

    await page.getByPlaceholder(/Buscar/).fill("yogur");
    await expect(page.getByRole("button", { name: new RegExp(`^${CENA_PUERROS.name}`) })).toHaveCount(0);
    await expect(page.getByRole("button", { name: new RegExp(`^${SNACK_YOGUR.name}`) })).toBeVisible();
  });

  test("sin favoritas, «Solo favoritas» muestra un estado vacío que explica cómo marcarlas", async ({ page }) => {
    await openRecetas(page);
    await page.getByRole("button", { name: "Solo favoritas" }).click();
    await expect(page.getByText("Aún no tienes recetas favoritas")).toBeVisible();
  });
});

test.describe("Accesibilidad del selector", () => {
  test("el selector del Plan, con ★ y «Ver todas», no tiene violaciones de axe", async ({ page }) => {
    await seed(page, { favorites: [CENA_PUERROS.id] });
    await openPlanSlot(page, "Cena");
    await verTodas(page).click();
    const results = await new AxeBuilder({ page }).include('[role="group"][aria-label="Elegir receta"]').analyze();
    expect(results.violations).toEqual([]);
  });

  test("las filas y las estrellas miden al menos 44 px de alto", async ({ page }) => {
    await seed(page, { favorites: [CENA_PUERROS.id] });
    await openPlanSlot(page, "Cena");
    for (const loc of [recipeRow(page, CENA_PUERROS.name), favStar(page, CENA_PUERROS.name, true)]) {
      const box = await loc.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
