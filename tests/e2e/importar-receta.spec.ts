// Spec: docs/pm/19-importar-receta-url/spec.md › R1–R6, R8, R9 y User flows. Tech: tech.md › UI y Testing strategy.
// Contrato de UI (textos acordados con Manuel):
//   - Recetas: botón "Importar desde URL" junto a "Nueva receta". Abre un role="dialog" "Importar receta" con el campo
//     "URL de la receta" y el botón "Importar". Mientras espera la respuesta muestra "Importando…" y el botón queda deshabilitado.
//   - Éxito: el diálogo se sustituye por el formulario "Nueva receta" (el de #18) prerrellenado. Avisos en role="status":
//       IA → "Macros estimados por IA: revísalos." · raciones → "La web indica N raciones: revisa que los macros sean por ración."
//   - Error: role="alert" en el diálogo con el mensaje de ERROR_TEXTS (el `message` de la respuesta; si la petición ni
//     llega, "No se pudo descargar la página.") y el botón "Crear a mano", que abre "Nueva receta" vacía.
//   - Detalle de una receta importada por IA sin tocar los macros: chip "Macros estimados". Con `sourceUrl`: enlace
//     "Ver receta original" cuyo href es esa URL.
//   - Nada se guarda hasta pulsar "Guardar" en el formulario.
// La ruta `POST /api/recipes/import` se intercepta con page.route: ningún test toca el servidor ni la web real.
// Datos: tests/fixtures/importar-receta.ts. Hoy = martes 2026-09-22 (signIn fija el reloj).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import type { Recipe } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  ERROR_STATUS,
  ERROR_TEXTS,
  RECIPE_URL,
  RESPONSE_AI,
  RESPONSE_JSONLD,
} from "../fixtures/importar-receta";
import { readStored, signIn } from "./helpers";

const IMPORT_ROUTE = "**/api/recipes/import";

async function openRecetas(page: Page) {
  await signIn(page, { profile: lucia });
  await page.goto("/recetas");
  await expect(page.getByRole("heading", { name: "Recetas", level: 1 })).toBeVisible();
}

/** Intercepta la ruta y guarda los cuerpos recibidos. */
async function mockImport(page: Page, handler: (route: Route) => Promise<void> | void) {
  const bodies: unknown[] = [];
  await page.route(IMPORT_ROUTE, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    bodies.push(route.request().postDataJSON());
    await handler(route);
  });
  return bodies;
}
const respondWith = (json: unknown, status = 200) => (route: Route) => route.fulfill({ status, json });
const respondError = (code: keyof typeof ERROR_TEXTS) =>
  respondWith({ error: code, message: ERROR_TEXTS[code] }, ERROR_STATUS[code]);

const importDialog = (page: Page) => page.getByRole("dialog", { name: "Importar receta" });
const form = (page: Page) => page.getByRole("dialog", { name: "Nueva receta" });
const card = (page: Page, name: string) => page.getByRole("button").filter({ hasText: name });
const storedRecipes = (page: Page) => readStored<Recipe[]>(page, "recipes");

async function startImport(page: Page, url = RECIPE_URL) {
  await page.getByRole("button", { name: "Importar desde URL" }).click();
  await importDialog(page).getByLabel("URL de la receta").fill(url);
  await importDialog(page).getByRole("button", { name: "Importar", exact: true }).click();
}

test.describe("R1: el botón y el flujo de importación", () => {
  test("'Importar desde URL' está junto a 'Nueva receta' y abre el diálogo con el campo de la URL", async ({ page }) => {
    await openRecetas(page);
    await expect(page.getByRole("button", { name: "Nueva receta" })).toBeVisible();
    await page.getByRole("button", { name: "Importar desde URL" }).click();
    await expect(importDialog(page)).toBeVisible();
    await expect(importDialog(page).getByLabel("URL de la receta")).toBeVisible();
    await expect(importDialog(page).getByRole("button", { name: "Importar", exact: true })).toBeVisible();
  });

  test("al importar envía la URL al servidor, muestra 'Importando…' y abre el formulario prerrellenado", async ({ page }) => {
    await openRecetas(page);
    const bodies = await mockImport(page, async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ json: RESPONSE_JSONLD });
    });
    await startImport(page);
    await expect(importDialog(page).getByText("Importando…")).toBeVisible();
    await expect(importDialog(page).getByRole("button", { name: /Importando|Importar/ }).first()).toBeDisabled();

    await expect(form(page)).toBeVisible();
    await expect(importDialog(page)).toHaveCount(0);
    expect(bodies).toEqual([{ url: RECIPE_URL }]);
    await expect(form(page).getByLabel("Nombre")).toHaveValue("Lentejas con verduras");
    await expect(form(page).getByLabel("Ingredientes")).toHaveValue(RESPONSE_JSONLD.recipe.ingredients.join("\n"));
    await expect(form(page).getByLabel("Pasos")).toHaveValue(RESPONSE_JSONLD.recipe.instructions.join("\n"));
    await expect(form(page).getByLabel("Tiempo (min)")).toHaveValue("45");
    await expect(form(page).getByLabel("Calorías (kcal)")).toHaveValue("420");
    await expect(form(page).getByLabel("Proteínas (g)")).toHaveValue("24");
  });
});

test.describe("R2 / R8 / R9: importación con JSON-LD", () => {
  test("no hay aviso de macros estimados, sí la pista de raciones; al guardar la receta queda en Recetas con su origen", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, respondWith(RESPONSE_JSONLD));
    await startImport(page);

    await expect(form(page).getByRole("status").filter({ hasText: "La web indica 4 raciones: revisa que los macros sean por ración." })).toBeVisible();
    await expect(form(page).getByText(/estimados/i)).toHaveCount(0);

    await form(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(form(page)).toHaveCount(0);
    await expect(card(page, "Lentejas con verduras")).toBeVisible();

    const saved = (await storedRecipes(page)).find((r) => r.name === "Lentejas con verduras");
    expect(saved).toMatchObject({ isCustom: true, calories: 420, protein: 24, sourceUrl: RECIPE_URL, tags: [] });
    expect(saved).not.toHaveProperty("macrosEstimated");

    await card(page, "Lentejas con verduras").first().click();
    await expect(page.getByRole("heading", { name: "Lentejas con verduras", level: 1 })).toBeVisible();
    await expect(page.getByText("Macros estimados", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver receta original" })).toHaveAttribute("href", RECIPE_URL);
  });

  test("R2: si la web no trae macros quedan vacíos y hay que indicar las kcal para guardar", async ({ page }) => {
    await openRecetas(page);
    const { name, ingredients, instructions, prepTimeMinutes } = RESPONSE_JSONLD.recipe;
    const sinMacros = { name, ingredients, instructions, prepTimeMinutes };
    await mockImport(page, respondWith({ ...RESPONSE_JSONLD, recipe: sinMacros }));
    await startImport(page);

    await expect(form(page).getByLabel("Calorías (kcal)")).toHaveValue("");
    await expect(form(page).getByLabel("Proteínas (g)")).toHaveValue("");
    await form(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(form(page).getByRole("alert").first()).toBeVisible();
    expect((await storedRecipes(page) ?? []).some((r) => r.name === "Lentejas con verduras")).toBe(false);

    await form(page).getByLabel("Calorías (kcal)").fill("400");
    await form(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(card(page, "Lentejas con verduras")).toBeVisible();
  });
});

test.describe("R3 / R4: importación con IA", () => {
  test("avisa de que los macros son estimados y, tras guardar, la receta lleva el chip 'Macros estimados'", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, respondWith(RESPONSE_AI));
    await startImport(page);

    await expect(form(page).getByRole("status").filter({ hasText: "Macros estimados por IA: revísalos." })).toBeVisible();
    await expect(form(page).getByLabel("Calorías (kcal)")).toHaveValue("180");

    await form(page).getByRole("button", { name: "Guardar", exact: true }).click();
    const saved = (await storedRecipes(page)).find((r) => r.name === "Sopa de calabaza al curry");
    expect(saved).toMatchObject({ macrosEstimated: true, sourceUrl: RECIPE_URL, isCustom: true });

    await card(page, "Sopa de calabaza al curry").first().click();
    await expect(page.getByRole("heading", { name: "Sopa de calabaza al curry", level: 1 })).toBeVisible();
    await expect(page.getByText("Macros estimados", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver receta original" })).toHaveAttribute("href", RECIPE_URL);
  });

  test("si el usuario cambia un macro antes de guardar, la receta ya no se marca como estimada", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, respondWith(RESPONSE_AI));
    await startImport(page);
    await form(page).getByLabel("Proteínas (g)").fill("8");
    await form(page).getByRole("button", { name: "Guardar", exact: true }).click();

    const saved = (await storedRecipes(page)).find((r) => r.name === "Sopa de calabaza al curry");
    expect(saved?.protein).toBe(8);
    expect(saved).not.toHaveProperty("macrosEstimated");
    await card(page, "Sopa de calabaza al curry").first().click();
    await expect(page.getByText("Macros estimados", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver receta original" })).toBeVisible();
  });

  test("editar después una receta estimada: cambiar un macro quita el chip; cambiar solo el nombre lo conserva", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, respondWith(RESPONSE_AI));
    await startImport(page);
    await form(page).getByRole("button", { name: "Guardar", exact: true }).click();

    await card(page, "Sopa de calabaza al curry").first().click();
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("dialog", { name: "Editar receta" }).getByLabel("Nombre").fill("Sopa de calabaza al curry casera");
    await page.getByRole("dialog", { name: "Editar receta" }).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Macros estimados", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("dialog", { name: "Editar receta" }).getByLabel("Carbos (g)").fill("25");
    await page.getByRole("dialog", { name: "Editar receta" }).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Macros estimados", { exact: true })).toHaveCount(0);
  });
});

test.describe("R5: nada se guarda sin confirmar", () => {
  test("cerrar el formulario importado no deja ninguna receta ni cambia lo guardado", async ({ page }) => {
    await openRecetas(page);
    const before = await storedRecipes(page);
    await mockImport(page, respondWith(RESPONSE_AI));
    await startImport(page);
    await expect(form(page)).toBeVisible();
    expect(await storedRecipes(page)).toEqual(before); // ya importado y aún sin guardar

    await form(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(form(page)).toHaveCount(0);
    await expect(card(page, "Sopa de calabaza al curry")).toHaveCount(0);
    expect(await storedRecipes(page)).toEqual(before);

    await page.reload();
    await expect(card(page, "Sopa de calabaza al curry")).toHaveCount(0);
  });

  test("cerrar el diálogo de importar sin importar tampoco llama al servidor", async ({ page }) => {
    await openRecetas(page);
    const bodies = await mockImport(page, respondWith(RESPONSE_AI));
    await page.getByRole("button", { name: "Importar desde URL" }).click();
    await importDialog(page).getByLabel("URL de la receta").fill(RECIPE_URL);
    await importDialog(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(importDialog(page)).toHaveCount(0);
    expect(bodies).toEqual([]);
  });
});

test.describe("R5: cerrar con la importación en curso", () => {
  test("cerrar el diálogo mientras importa cancela la petición y no abre el formulario después", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.fulfill({ json: RESPONSE_AI }).catch(() => {}); // el navegador ya abortó la petición
    });
    await startImport(page);
    await expect(importDialog(page).getByText("Importando…")).toBeVisible();
    await importDialog(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(importDialog(page)).toHaveCount(0);

    await page.waitForTimeout(1200);
    await expect(form(page)).toHaveCount(0);
    await expect(card(page, "Sopa de calabaza al curry")).toHaveCount(0);
  });
});

test.describe("R6: errores", () => {
  for (const code of ["fetch_failed", "no_recipe", "invalid_url", "blocked", "rate_limited"] as const) {
    test(`${code}: muestra '${ERROR_TEXTS[code]}' y permite crear la receta a mano`, async ({ page }) => {
      await openRecetas(page);
      await mockImport(page, respondError(code));
      await startImport(page);

      await expect(importDialog(page).getByRole("alert")).toContainText(ERROR_TEXTS[code]);
      await expect(form(page)).toHaveCount(0);

      await importDialog(page).getByRole("button", { name: "Crear a mano" }).click();
      await expect(form(page)).toBeVisible();
      for (const label of ["Nombre", "Ingredientes", "Pasos", "Calorías (kcal)"]) {
        await expect(form(page).getByLabel(label), label).toHaveValue("");
      }
    });
  }

  test("si la petición ni llega al servidor (sin conexión) dice que no se pudo descargar", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, (route) => route.abort("failed"));
    await startImport(page);
    await expect(importDialog(page).getByRole("alert")).toContainText(ERROR_TEXTS.fetch_failed);
    await expect(importDialog(page).getByRole("button", { name: "Crear a mano" })).toBeVisible();
  });

  test("tras un error se puede corregir la URL y volver a importar", async ({ page }) => {
    await openRecetas(page);
    let calls = 0;
    await mockImport(page, (route) => (calls++ === 0 ? respondError("no_recipe")(route) : respondWith(RESPONSE_AI)(route)));
    await startImport(page);
    await expect(importDialog(page).getByRole("alert")).toBeVisible();
    await importDialog(page).getByLabel("URL de la receta").fill("https://www.recetas-ejemplo.es/otra");
    await importDialog(page).getByRole("button", { name: "Importar", exact: true }).click();
    await expect(form(page).getByLabel("Nombre")).toHaveValue("Sopa de calabaza al curry");
  });
});

test.describe("Accesibilidad", () => {
  test("el diálogo de importar y el formulario importado no tienen violaciones de axe", async ({ page }) => {
    await openRecetas(page);
    await mockImport(page, respondWith(RESPONSE_AI));
    await page.getByRole("button", { name: "Importar desde URL" }).click();
    await expect(importDialog(page)).toBeVisible();
    let results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);

    await importDialog(page).getByLabel("URL de la receta").fill(RECIPE_URL);
    await importDialog(page).getByRole("button", { name: "Importar", exact: true }).click();
    await expect(form(page)).toBeVisible();
    results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
