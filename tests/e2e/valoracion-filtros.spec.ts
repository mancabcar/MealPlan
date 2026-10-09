// Spec: docs/pm/111-recetas-valoracion-filtros/spec.md › R1–R7 (Acceptance criteria y User flows).
// Tech: docs/pm/111-recetas-valoracion-filtros/tech.md › UI test contract (nombres accesibles fijados con el usuario):
//   - Detalle: 5 botones «Valorar <receta> con N estrellas» con aria-pressed en la nota actual; tocar la actual la quita.
//   - Tarjeta y detalle: «Valoración N de 5» (texto visible/accesible), nada sin nota.
//   - Botón «Filtros» (o «Filtros (N)» con N filtros activos) con aria-expanded; panel con chips «≤15 min», «≤30 min»,
//     «≤45 min», «≤300 kcal», «≤400 kcal», «≤500 kcal», «≥20 g», «≥30 g», «≥40 g» (aria-pressed, uno por tipo),
//     interruptor role="switch" «Ocultar mis alérgenos» (solo con alergias), select «Ordenar por» y botón «Quitar filtros».
//   - Sin resultados con filtros: «Ninguna receta coincide con los filtros» y un botón «Quitar filtros».
// Datos: tests/fixtures/valoracion.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). El store añade siempre las
// recetas semilla, así que los casos se anclan a las recetas «V1…V8» (nombres únicos). Fallan hasta las tareas 1–4.
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { V1_TOSTA, V2_BOWL, V3_POLLO, V4_SALMON, V5_TERNERA, V6_ESTOFADO, VAL_RATINGS, VAL_RECIPES } from "../fixtures/valoracion";
import { readStored, signIn } from "./helpers";

type Seed = { ratings?: Record<string, number>; allergies?: string[]; pantry?: unknown[]; favorites?: string[] };

async function seed(page: Page, { ratings = {}, allergies = [], pantry = [], favorites = [] }: Seed = {}) {
  await signIn(page, {
    profile: { ...lucia, allergies: { preset: allergies, custom: [] } },
    recipes: VAL_RECIPES,
    ratings,
    favorites,
    pantry,
    entries: [],
  });
}

async function openRecetas(page: Page, s: Seed = {}) {
  await seed(page, s);
  await page.goto("/recetas");
  await expect(page.getByRole("heading", { name: "Recetas", level: 1 })).toBeVisible();
}

const card = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
/** «V1»…«V8» de las tarjetas de la lista, en orden (las de «Destacadas este mes» no cuentan). */
const order = (page: Page) =>
  page
    .getByRole("button", { name: /^V\d /})
    .evaluateAll((els) =>
      els
        .filter((e) => !e.closest('section[aria-labelledby="featured-title"]'))
        .map((e) => /V\d/.exec(e.textContent ?? "")?.[0] ?? ""),
    );
const filtersButton = (page: Page) => page.getByRole("button", { name: /^Filtros/ });
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const sortBy = (page: Page, label: string) => page.getByLabel("Ordenar por").selectOption({ label });
const stars = (page: Page, recipe: string, n: number) => page.getByRole("button", { name: `Valorar ${recipe} con ${n} estrellas` });

async function openFilters(page: Page) {
  if ((await filtersButton(page).getAttribute("aria-expanded")) !== "true") await filtersButton(page).click();
}

async function openDetail(page: Page, name: string) {
  await page.getByPlaceholder(/Buscar/).fill(name);
  await card(page, name).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test.describe("R1: puntuar en el detalle", () => {
  test("tocar 4★ puntúa, tocar la nota actual la quita y tocar otra la cambia", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, V3_POLLO.name);

    await stars(page, V3_POLLO.name, 4).click();
    await expect(stars(page, V3_POLLO.name, 4)).toHaveAttribute("aria-pressed", "true");
    expect(await readStored<Record<string, number>>(page, "ratings")).toEqual({ [V3_POLLO.id]: 4 });

    await stars(page, V3_POLLO.name, 2).click();
    await expect(stars(page, V3_POLLO.name, 2)).toHaveAttribute("aria-pressed", "true");
    await expect(stars(page, V3_POLLO.name, 4)).toHaveAttribute("aria-pressed", "false");

    await stars(page, V3_POLLO.name, 2).click();
    await expect(stars(page, V3_POLLO.name, 2)).toHaveAttribute("aria-pressed", "false");
    expect(await readStored<Record<string, number>>(page, "ratings")).toEqual({});
  });

  test("las estrellas miden al menos 44 px de alto", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, V3_POLLO.name);
    for (let n = 1; n <= 5; n++) {
      const box = await stars(page, V3_POLLO.name, n).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("R2: persistencia, aislamiento y copia de seguridad", () => {
  test("la nota sigue tras recargar", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, V1_TOSTA.name);
    await stars(page, V1_TOSTA.name, 5).click();
    await page.reload();
    await openDetail(page, V1_TOSTA.name);
    await expect(stars(page, V1_TOSTA.name, 5)).toHaveAttribute("aria-pressed", "true");
  });

  test("las notas de otra cuenta del mismo navegador no se mezclan", async ({ page }) => {
    await openRecetas(page, { ratings: { [V1_TOSTA.id]: 3 } });
    await page.evaluate((id) => localStorage.setItem("mp_otra_ratings", JSON.stringify({ [id]: 1 })), V2_BOWL.id);
    await page.reload();
    await openDetail(page, V2_BOWL.name);
    await expect(stars(page, V2_BOWL.name, 1)).toHaveAttribute("aria-pressed", "false");
    await stars(page, V2_BOWL.name, 4).click();
    expect(await page.evaluate(() => localStorage.getItem("mp_otra_ratings"))).toBe(JSON.stringify({ [V2_BOWL.id]: 1 }));
  });

  test("«Exportar mis datos» incluye las valoraciones", async ({ page }) => {
    await seed(page, { ratings: VAL_RATINGS });
    await page.goto("/perfil");
    const downloading = page.waitForEvent("download");
    await page.getByRole("region", { name: "Tus datos" }).getByRole("button", { name: "Exportar mis datos" }).click();
    const file = JSON.parse(await readFile((await (await downloading).path())!, "utf8"));
    expect(file.schemaVersion).toBe(1);
    expect(file.data.ratings).toEqual(VAL_RATINGS);
  });

  test("«Importar datos» restaura las valoraciones de la copia sin recargar la página", async ({ page }) => {
    await seed(page, { ratings: {} });
    await page.goto("/perfil");
    const backup = JSON.stringify({
      app: "mealplan",
      schemaVersion: 1,
      exportedAt: "2026-10-04T10:00:00.000Z",
      data: { profile: { ...lucia, allergies: { preset: [], custom: [] } }, recipes: VAL_RECIPES, ratings: VAL_RATINGS },
    });
    page.on("dialog", (d) => d.accept());
    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("region", { name: "Tus datos" }).getByRole("button", { name: "Importar datos" }).click();
    await (await choosing).setFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from(backup, "utf8") });
    await expect.poll(() => readStored<Record<string, number>>(page, "ratings")).toEqual(VAL_RATINGS);
  });

  test("una copia anterior sin valoraciones las deja vacías, sin error", async ({ page }) => {
    await seed(page, { ratings: { [V1_TOSTA.id]: 4 } });
    await page.goto("/perfil");
    const backup = JSON.stringify({
      app: "mealplan",
      schemaVersion: 1,
      exportedAt: "2026-08-20T10:00:00.000Z",
      data: { profile: { ...lucia, allergies: { preset: [], custom: [] } }, recipes: VAL_RECIPES },
    });
    page.on("dialog", (d) => d.accept());
    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("region", { name: "Tus datos" }).getByRole("button", { name: "Importar datos" }).click();
    await (await choosing).setFiles({ name: "vieja.json", mimeType: "application/json", buffer: Buffer.from(backup, "utf8") });
    await expect.poll(() => readStored<Record<string, number>>(page, "ratings")).toEqual({});
  });
});

test.describe("R6: la nota se ve en la tarjeta y en el detalle", () => {
  test("la tarjeta con nota la muestra y la que no tiene, no", async ({ page }) => {
    await openRecetas(page, { ratings: VAL_RATINGS });
    await page.getByPlaceholder(/Buscar/).fill("V3 Pollo");
    await expect(card(page, V3_POLLO.name).getByText("Valoración 4 de 5")).toBeVisible();
    await page.getByPlaceholder(/Buscar/).fill("V4 Salmón");
    await expect(card(page, V4_SALMON.name)).toBeVisible();
    await expect(card(page, V4_SALMON.name).getByText(/Valoración \d de 5/)).toHaveCount(0);
  });

  test("el detalle también la muestra", async ({ page }) => {
    await openRecetas(page, { ratings: VAL_RATINGS });
    await openDetail(page, V5_TERNERA.name);
    await expect(page.getByText("Valoración 5 de 5")).toBeVisible();
  });
});

test.describe("R3: filtros de tiempo, kcal y proteína", () => {
  test("≤30 min y ≥30 g se alcanzan en ≤3 toques y dejan solo las recetas que cumplen", async ({ page }) => {
    await openRecetas(page);
    let taps = 0;
    await filtersButton(page).click();
    taps++;
    await chip(page, "≤30 min").click();
    taps++;
    await chip(page, "≥30 g").click();
    taps++;
    expect(taps).toBeLessThanOrEqual(3);

    await expect(chip(page, "≤30 min")).toHaveAttribute("aria-pressed", "true");
    await expect(filtersButton(page)).toHaveAccessibleName("Filtros (2)");
    // V3 (30 min, 30 g), V4 (30 min, 35 g) y V8 (20 min, 30 g) cumplen; el resto de V no
    await expect.poll(() => order(page)).toEqual(["V3", "V4", "V8"]);
  });

  test("solo hay un tramo activo por tipo y tocarlo de nuevo lo quita", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    await chip(page, "≤30 min").click();
    await chip(page, "≤15 min").click();
    await expect(chip(page, "≤15 min")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "≤30 min")).toHaveAttribute("aria-pressed", "false");
    await chip(page, "≤15 min").click();
    await expect(chip(page, "≤15 min")).toHaveAttribute("aria-pressed", "false");
    await expect(filtersButton(page)).toHaveAccessibleName("Filtros");
  });

  test("≤400 kcal incluye el borde", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    await chip(page, "≤400 kcal").click();
    // V1 (250), V2 (300), V3 (400) y V7 (sin dato: 0); V8 tiene 420
    await expect.poll(() => order(page)).toEqual(["V1", "V2", "V3", "V7"]);
  });

  test("se combina con la búsqueda de texto y con «Solo favoritas»", async ({ page }) => {
    await openRecetas(page, { favorites: [V3_POLLO.id, V6_ESTOFADO.id] });
    await openFilters(page);
    await chip(page, "≥30 g").click();
    await page.getByRole("button", { name: "Solo favoritas" }).click();
    await expect.poll(() => order(page)).toEqual(["V3"]);

    await page.getByRole("button", { name: "Solo favoritas" }).click();
    await page.getByPlaceholder(/Buscar/).fill("Salmón");
    await expect.poll(() => order(page)).toEqual(["V4"]);
  });
});

test.describe("R4: ocultar mis alérgenos", () => {
  test("apagado se avisa como hoy; encendido, la receta con el alérgeno desaparece", async ({ page }) => {
    await openRecetas(page, { allergies: ["frutos_secos"] });
    await page.getByPlaceholder(/Buscar/).fill("V4 Salmón");
    await expect(card(page, V4_SALMON.name)).toContainText("contiene");

    await page.getByPlaceholder(/Buscar/).fill("");
    await openFilters(page);
    const toggle = page.getByRole("switch", { name: "Ocultar mis alérgenos" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(filtersButton(page)).toHaveAccessibleName("Filtros (1)");
    await expect.poll(() => order(page)).toEqual(["V1", "V2", "V3", "V5", "V6", "V7", "V8"]);
  });

  test("sin alergias en el perfil el interruptor no aparece", async ({ page }) => {
    await openRecetas(page, { allergies: [] });
    await openFilters(page);
    await expect(page.getByRole("switch", { name: "Ocultar mis alérgenos" })).toHaveCount(0);
    await expect(page.getByLabel("Ordenar por")).toBeVisible();
  });
});

test.describe("R5: orden", () => {
  test("por defecto A–Z y el selector ofrece las cinco opciones", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    const select = page.getByLabel("Ordenar por");
    await expect(select.locator("option")).toHaveText(["A–Z", "Proteína", "Calorías", "Tiempo", "Valoración"]);
    await expect.poll(() => order(page)).toEqual(["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"]);
  });

  test("por proteína de mayor a menor, con empate por nombre", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    await sortBy(page, "Proteína");
    await expect.poll(() => order(page)).toEqual(["V5", "V4", "V3", "V8", "V2", "V1", "V6", "V7"]);
  });

  test("por calorías y por tiempo, de menor a mayor", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    await sortBy(page, "Calorías");
    await expect.poll(() => order(page)).toEqual(["V7", "V1", "V2", "V3", "V8", "V4", "V5", "V6"]);
    await sortBy(page, "Tiempo");
    await expect.poll(() => order(page)).toEqual(["V7", "V1", "V2", "V8", "V3", "V4", "V5", "V6"]);
  });

  test("por valoración: las valoradas de mayor a menor y las sin valorar al final", async ({ page }) => {
    await openRecetas(page, { ratings: VAL_RATINGS });
    await openFilters(page);
    await sortBy(page, "Valoración");
    await expect.poll(() => order(page)).toEqual(["V5", "V1", "V3", "V2", "V4", "V6", "V7", "V8"]);
  });

  test("con «Usa lo que tengo» manda el ranking de la Despensa, no el orden elegido", async ({ page }) => {
    const pantry = [
      { id: "p-quinoa", name: "Quinoa", quantity: "1", category: "Despensa" },
      { id: "p-tamarindo", name: "Tamarindo", quantity: "1", category: "Despensa" },
    ];
    await openRecetas(page, { pantry });
    await openFilters(page);
    await sortBy(page, "Proteína"); // V5 (40 g) antes que V3 (30 g) si mandara el orden
    await page.getByRole("button", { name: "Usa lo que tengo" }).click();
    // V3 casa con 2 ingredientes de la Despensa y V5 con 1: el ranking los pone V3, V5
    await expect.poll(() => order(page)).toEqual(["V3", "V5"]);
  });
});

test.describe("R7: panel de filtros, vacío y reinicio", () => {
  test("«Filtros» abre y cierra el panel (aria-expanded)", async ({ page }) => {
    await openRecetas(page);
    await expect(filtersButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(chip(page, "≤30 min")).toHaveCount(0);
    await filtersButton(page).click();
    await expect(filtersButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(chip(page, "≤30 min")).toBeVisible();
  });

  test("sin resultados: mensaje con «Quitar filtros», que limpia los filtros y no toca búsqueda ni orden", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    await sortBy(page, "Calorías");
    await chip(page, "≥40 g").click();
    await page.getByPlaceholder(/Buscar/).fill("V6 Estofado");

    await expect(page.getByText("Ninguna receta coincide con los filtros")).toBeVisible();
    await page.getByRole("button", { name: "Quitar filtros" }).first().click();

    await expect(filtersButton(page)).toHaveAccessibleName("Filtros");
    await expect(page.getByPlaceholder(/Buscar/)).toHaveValue("V6 Estofado");
    await expect(page.getByLabel("Ordenar por").locator("option:checked")).toHaveText("Calorías");
    await expect.poll(() => order(page)).toEqual(["V6"]);
  });

  test("con cualquier filtro, búsqueda u orden distinto de A–Z se oculta «Destacadas este mes»", async ({ page }) => {
    await openRecetas(page);
    const featured = page.getByRole("region", { name: "Destacadas este mes" });
    await expect(featured).toBeVisible();

    await openFilters(page);
    await chip(page, "≤45 min").click();
    await expect(featured).toHaveCount(0);
    await chip(page, "≤45 min").click();
    await expect(featured).toBeVisible();

    await sortBy(page, "Tiempo");
    await expect(featured).toHaveCount(0);
    await sortBy(page, "A–Z");
    await expect(featured).toBeVisible();
  });

  test("filtros y orden se reinician al salir de Recetas y volver", async ({ page }) => {
    await openRecetas(page);
    await openFilters(page);
    await chip(page, "≥30 g").click();
    await sortBy(page, "Proteína");

    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Plan" }).click();
    await page.waitForURL(/[/]plan/); // sin esto, en dev el segundo clic puede cancelar la navegación aún en curso
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Recetas" }).click();
    await expect(page.getByRole("heading", { name: "Recetas", level: 1 })).toBeVisible();
    await expect(filtersButton(page)).toHaveAccessibleName("Filtros");
    await openFilters(page);
    await expect(chip(page, "≥30 g")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByLabel("Ordenar por").locator("option:checked")).toHaveText("A–Z");
  });
});

test.describe("Accesibilidad", () => {
  test("el panel de filtros abierto y las estrellas del detalle no tienen violaciones de axe", async ({ page }) => {
    await openRecetas(page, { allergies: ["frutos_secos"], ratings: VAL_RATINGS });
    await openFilters(page);
    await chip(page, "≤30 min").click();
    const panel = await new AxeBuilder({ page }).analyze();
    expect(panel.violations).toEqual([]);

    await openDetail(page, V3_POLLO.name);
    const detail = await new AxeBuilder({ page }).analyze();
    expect(detail.violations).toEqual([]);
  });
});
