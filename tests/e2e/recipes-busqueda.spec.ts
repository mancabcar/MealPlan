// Spec: docs/pm/combobox-recetas/spec.md › R1–R3 y R5 (Acceptance criteria y User flows). R4 lo cubren los e2e existentes
// (favoritos-franja.spec.ts y despensa-recetas.spec.ts) sin tocarlos.
// Tech: docs/pm/combobox-recetas/tech.md › Testing strategy. Hoy = martes 2026-09-22 (signIn fija el reloj). El store
// añade siempre las recetas semilla, así que los casos se anclan a recetas propias con nombres únicos (fixtures/favoritos).
// Fallan hasta las tareas 4–5.
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { CENA_PURE, CENA_ZARZUELA, favRecipe } from "../fixtures/favoritos";
import { recipePicker, recipeRow, signIn } from "./helpers";

// Guardadas fuera de orden alfabético a propósito: el recetario debe salir A–Z, no en este orden.
const NOQUIS = favRecipe("b-noquis", "Ñoquis de remolacha morada", ["comida"]);
const AGUACATES = favRecipe("b-aguacates", "Aguacates rellenos de la casa", ["cena", "vegetariano"]);
const RECIPES = [CENA_ZARZUELA, NOQUIS, CENA_PURE, AGUACATES];

const BUSCAR = "Buscar por nombre o etiqueta...";
const cards = (page: Page) => page.getByRole("button").filter({ hasText: "kcal" });
const card = (page: Page, name: string) => cards(page).filter({ hasText: name });
const cardNames = (page: Page) =>
  cards(page).evaluateAll((els) => els.map((e) => e.querySelector(".truncate")?.textContent ?? ""));

test.describe("R2: la pantalla Recetas sale en orden A–Z", () => {
  test("sin buscar, las tarjetas van de la A a la Z (en español) y no en orden de guardado", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES });
    await page.goto("/recetas");
    await expect(card(page, "Zarzuela de pescado")).toBeVisible();

    const names = await cardNames(page);
    expect(names.length).toBeGreaterThan(RECIPES.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "es")));
    expect(names.indexOf("Aguacates rellenos de la casa")).toBeLessThan(names.indexOf("Zarzuela de pescado"));
  });

  test("con «Usa lo que tengo» manda el ranking de la Despensa, no el A–Z", async ({ page }) => {
    // Ingredientes poco comunes (como en despensa-recetas.spec.ts): ninguna receta semilla los usa.
    const pantry = [
      { id: "p1", name: "Membrillo", quantity: "1", category: "Nevera" },
      { id: "p2", name: "Mascarpone", quantity: "1", category: "Nevera" },
    ];
    // A–Z pondría «Aguacate…» primero; el ranking (2 coincidencias antes que 1) pone «Zapallo…» primero.
    const zapallo = favRecipe("r-zapallo", "Zapallo con membrillo y mascarpone", ["cena"], {
      ingredients: ["150g membrillo", "125g mascarpone"],
    });
    const aguacate = favRecipe("r-aguacate", "Aguacate con mascarpone", ["cena"], {
      ingredients: ["1 aguacate", "125g mascarpone"],
    });
    await signIn(page, { profile: lucia, recipes: [aguacate, zapallo], pantry });
    await page.goto("/recetas");
    await page.getByRole("button", { name: "Usa lo que tengo" }).click();
    await expect(page.getByRole("button", { name: "Usa lo que tengo" })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).nth(0)).toContainText("Zapallo con membrillo y mascarpone");
    await expect(cards(page).nth(1)).toContainText("Aguacate con mascarpone");
  });
});

test.describe("R3: la búsqueda de Recetas ignora tildes y mayúsculas, por nombre o etiqueta", () => {
  test("«pure» encuentra «Puré de calabaza asada»", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES });
    await page.goto("/recetas");
    await page.getByPlaceholder(BUSCAR).fill("pure");
    await expect(card(page, "Puré de calabaza asada")).toBeVisible();
    await expect(card(page, "Zarzuela de pescado")).toHaveCount(0);
  });

  test("«VEGETARIANO» encuentra por etiqueta", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES });
    await page.goto("/recetas");
    await page.getByPlaceholder(BUSCAR).fill("VEGETARIANO");
    await expect(card(page, "Aguacates rellenos de la casa")).toBeVisible();
  });

});

test.describe("R5: Recetas avisa cuando una búsqueda de texto no encuentra nada", () => {
  test("«zzzxqj» → «Sin resultados para «zzzxqj»» y ninguna tarjeta; al borrar el texto vuelve la lista", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES });
    await page.goto("/recetas");
    await page.getByPlaceholder(BUSCAR).fill("zzzxqj");
    await expect(page.getByText("Sin resultados para «zzzxqj»")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);

    await page.getByPlaceholder(BUSCAR).fill("");
    await expect(page.getByText(/^Sin resultados/)).toHaveCount(0);
    await expect(card(page, "Zarzuela de pescado")).toBeVisible();
  });
});

test.describe("R1: el texto que coincide sale resaltado", () => {
  test("Recetas: «pure» resalta «Puré» (con su tilde) en el nombre", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES });
    await page.goto("/recetas");
    await expect(card(page, "Puré de calabaza asada").locator("mark")).toHaveCount(0); // sin búsqueda, sin resaltado
    await page.getByPlaceholder(BUSCAR).fill("pure");
    const mark = card(page, "Puré de calabaza asada").locator("mark");
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveText("Puré");
  });

  test("Recetas: si solo coincide la etiqueta, la receta sale sin resaltado", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES });
    await page.goto("/recetas");
    await page.getByPlaceholder(BUSCAR).fill("vegetariano");
    await expect(card(page, "Aguacates rellenos de la casa")).toBeVisible();
    await expect(card(page, "Aguacates rellenos de la casa").locator("mark")).toHaveCount(0);
  });

  test("Plan: el selector resalta «Puré» y su nombre accesible no cambia", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: RECIPES, weekplan: {}, entries: [] });
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "Martes", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: /^Cena( |$)/ }).click();
    await expect(recipePicker(page)).toBeVisible();

    await recipePicker(page).getByRole("searchbox", { name: "Buscar" }).fill("pure");
    const row = recipeRow(page, "Puré de calabaza asada");
    await expect(row).toBeVisible();
    await expect(row.locator("mark")).toHaveText("Puré");
  });
});
