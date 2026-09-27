// Spec: docs/pm/13-base-alimentos/spec.md › Acceptance criteria R1–R12, R14 y Edge cases. R13 (Recientes) queda
// pendiente de #12. Tech: docs/pm/13-base-alimentos/tech.md › UI, "UI test contract" y Testing strategy (E2E).
//
// `/api/foods/search` se intercepta: ningún test llama a Open Food Facts (la ruta la cubre tests/unit/foods-route.test.ts).
// Los básicos salen de la tabla REAL (src/data/foods.json): los valores esperados se leen de ella, no se escriben a mano.
// Hoy = martes 2026-09-22 (signIn fija el reloj). Lucía hace Desayuno, Comida, Merienda y Cena; el formulario abre en "Comida".
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import foodsJson from "@/data/foods.json";
import type { LocalFood } from "@/lib/foods";
import type { MealEntry } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { YOGUR_GRIEGO, YOGUR_LIGERO } from "../fixtures/foods";
import { readStored, signIn, TODAY } from "./helpers";

const FOODS = foodsJson as LocalFood[];
const byName = (name: string) => {
  const f = FOODS.find((x) => x.name === name);
  if (!f) throw new Error(`Falta «${name}» en src/data/foods.json`);
  return f;
};
const ARROZ_COCIDO = byName("Arroz blanco, cocido");
const HUEVO = byName("Huevo");

const SEARCH_ROUTE = "**/api/foods/search**";

// ---------------------------------------------------------------------------
// Contrato de la UI (tech.md › UI test contract)
// ---------------------------------------------------------------------------
const tab = (page: Page, name: "Receta" | "Alimento" | "Personalizada") => page.getByRole("button", { name, exact: true });
const searchBox = (page: Page) => page.getByLabel("Buscar alimento");
const basicsHeading = (page: Page) => page.getByRole("heading", { name: "Básicos" });
const brandsHeading = (page: Page) => page.getByRole("heading", { name: "Productos de marca" });
const brandButton = (page: Page, q: string) => page.getByRole("button", { name: `Buscar «${q}» en productos de marca` });
/** Fila de resultado: un botón cuyo nombre empieza por el nombre del alimento. */
const result = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) });
const back = (page: Page) => page.getByRole("button", { name: "Otro alimento" });
/** Campo de cantidad: el input (no el radio) con etiqueta "Gramos" o "Unidades". */
const qtyInput = (page: Page, mode: "Gramos" | "Unidades") =>
  page.getByLabel(mode, { exact: true }).and(page.locator("input:not([type=radio])"));
const modeRadio = (page: Page, mode: "Gramos" | "Unidades") => page.getByRole("radio", { name: mode, exact: true });
const chip = (page: Page, label: string) => page.getByRole("button", { name: label, exact: true });
const addBtn = (page: Page, qty: string) => page.getByRole("button", { name: `Añadir ${qty}`, exact: true });
const retry = (page: Page) => page.getByRole("button", { name: "Reintentar" });
const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const toast = (page: Page) => page.getByRole("status");

async function openDiario(page: Page, data: Record<string, unknown> = {}) {
  await signIn(page, { profile: lucia, weekplan: {}, entries: [], ...data });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

async function openFoodTab(page: Page) {
  await page.getByRole("button", { name: "Añadir comida" }).click();
  await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeVisible();
  await tab(page, "Alimento").click();
  await expect(searchBox(page)).toBeVisible();
}

/** Intercepta la ruta de marcas y cuenta las llamadas. */
async function mockBrands(page: Page, handler: (route: Route) => Promise<void> | void) {
  const calls: string[] = [];
  await page.route(SEARCH_ROUTE, async (route) => {
    calls.push(route.request().url());
    await handler(route);
  });
  return calls;
}

const productsResponse = (products: unknown[]) => (route: Route) => route.fulfill({ json: { products } });

// ---------------------------------------------------------------------------

test.describe("R1: pestaña Alimento", () => {
  test("las pestañas van en el orden Receta / Alimento / Personalizada", async ({ page }) => {
    await openDiario(page);
    await page.getByRole("button", { name: "Añadir comida" }).click();
    const names = await page
      .getByRole("button", { name: /^(Receta|Alimento|Personalizada)$/ })
      .allTextContents();
    expect(names.map((n) => n.trim())).toEqual(["Receta", "Alimento", "Personalizada"]);
  });
});

test.describe("R2 · R3: búsqueda en los básicos", () => {
  test("con 1 letra no se muestra el bloque Básicos", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("a");
    await expect(basicsHeading(page)).toHaveCount(0);
  });

  test("«arroz coc» muestra «Arroz blanco, cocido» con sus kcal/100 g y no el crudo", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz coc");
    await expect(basicsHeading(page)).toBeVisible();
    await expect(result(page, "Arroz blanco, cocido")).toContainText(`${Math.round(ARROZ_COCIDO.kcal)} kcal`);
    await expect(result(page, "Arroz blanco, crudo")).toHaveCount(0);
  });

  test("«platano» encuentra «Plátano» (sin tildes)", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("platano");
    await expect(result(page, "Plátano")).toBeVisible();
  });

  test("«arroz» muestra crudo y cocido como filas distintas", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz blanco");
    await expect(result(page, "Arroz blanco, crudo")).toBeVisible();
    await expect(result(page, "Arroz blanco, cocido")).toBeVisible();
  });

  test("sin coincidencias: «Ningún básico coincide» y, debajo, el botón de marcas", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("tortilla de mi abuela");
    await expect(page.getByText("Ningún básico coincide")).toBeVisible();
    await expect(brandButton(page, "tortilla de mi abuela")).toBeVisible();
  });

  test("el pie de Básicos cita las fuentes (CIQUAL/USDA)", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz");
    await expect(page.getByText(/CIQUAL/)).toBeVisible();
  });

  test("sin red, los básicos salen igual", async ({ page, context }) => {
    await openDiario(page);
    await openFoodTab(page);
    await context.setOffline(true);
    await searchBox(page).fill("arroz coc");
    await expect(result(page, "Arroz blanco, cocido")).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe("R4: productos de marca", () => {
  test("escribir no llama a OFF", async ({ page }) => {
    const calls = await mockBrands(page, productsResponse([YOGUR_GRIEGO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).pressSequentially("yogur griego");
    await expect(brandButton(page, "yogur griego")).toBeVisible();
    expect(calls).toEqual([]);
  });

  test("el botón busca y muestra «Productos de marca» debajo de Básicos, con marca, kcal/100 g y el pie ODbL", async ({
    page,
  }) => {
    const calls = await mockBrands(page, productsResponse([YOGUR_GRIEGO, YOGUR_LIGERO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();

    await expect(brandsHeading(page)).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]).searchParams.get("q")).toBe("yogur griego");

    const row = result(page, "Yogur griego ligero");
    await expect(row).toContainText("Valle Blanco");
    await expect(row).toContainText("78 kcal");
    await expect(page.getByText(/ODbL/)).toBeVisible();
    await expect(page.getByText(/revisa la etiqueta/i)).toBeVisible();

    // Debajo de Básicos
    const basicsBox = await basicsHeading(page).boundingBox();
    const brandsBox = await brandsHeading(page).boundingBox();
    expect(brandsBox!.y).toBeGreaterThan(basicsBox!.y);
  });

  test("si OFF no devuelve productos válidos, el bloque lo dice", async ({ page }) => {
    await mockBrands(page, productsResponse([]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("zzzz");
    await brandButton(page, "zzzz").click();
    await expect(brandsHeading(page)).toBeVisible();
    await expect(page.getByText(/ningún producto|no hay|sin resultados/i)).toBeVisible();
  });
});

test.describe("R5: tarjeta del alimento", () => {
  test("al tocar un resultado se ve la tarjeta; «Otro alimento» vuelve con la misma búsqueda", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz blanco");
    await result(page, "Arroz blanco, cocido").click();
    await expect(basicsHeading(page)).toHaveCount(0);
    await expect(qtyInput(page, "Gramos")).toBeVisible();

    await back(page).click();
    await expect(searchBox(page)).toHaveValue("arroz blanco");
    await expect(result(page, "Arroz blanco, crudo")).toBeVisible();
    await expect(result(page, "Arroz blanco, cocido")).toBeVisible();
  });

  test("Edge case: la búsqueda y las marcas se conservan al cambiar de pestaña y volver", async ({ page }) => {
    await mockBrands(page, productsResponse([YOGUR_LIGERO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await expect(result(page, "Yogur griego ligero")).toBeVisible();

    await tab(page, "Personalizada").click();
    await tab(page, "Alimento").click();
    await expect(searchBox(page)).toHaveValue("yogur griego");
    await expect(result(page, "Yogur griego ligero")).toBeVisible();
  });

  test("Edge case: cambiar el texto oculta el bloque de marcas", async ({ page }) => {
    await mockBrands(page, productsResponse([YOGUR_LIGERO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await expect(brandsHeading(page)).toBeVisible();
    await searchBox(page).fill("yogur");
    await expect(brandsHeading(page)).toHaveCount(0);
  });
});

test.describe("R6 · R8 · R9: registrar en gramos", () => {
  test("150 g de «Arroz blanco, cocido» → entrada con gramos y macros; el Diario muestra «150 g»", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz coc");
    await result(page, "Arroz blanco, cocido").click();
    await chip(page, "150 g").click();
    await expect(qtyInput(page, "Gramos")).toHaveValue("150");
    await expect(page.getByText(`${Math.round(ARROZ_COCIDO.kcal * 1.5)} kcal`).first()).toBeVisible();
    await addBtn(page, "150 g").click();

    // El formulario se cierra
    await expect(page.getByRole("heading", { name: "Añadir comida" })).toHaveCount(0);

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: TODAY,
      mealType: "Comida",
      customName: "Arroz blanco, cocido",
      foodId: `local:${ARROZ_COCIDO.id}`,
      grams: 150,
    });
    expect(entries[0].calories).toBeCloseTo(ARROZ_COCIDO.kcal * 1.5, 6);
    expect(entries[0]).not.toHaveProperty("units");

    const row = meal(page, "Comida");
    await expect(row).toContainText("Arroz blanco, cocido");
    await expect(row).toContainText("150 g");
    await expect(row).not.toContainText(/CIQUAL|USDA/);
  });

  test("los chips cambian el campo y recalculan", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz coc");
    await result(page, "Arroz blanco, cocido").click();
    await chip(page, "200 g").click();
    await expect(qtyInput(page, "Gramos")).toHaveValue("200");
    await expect(page.getByText(`${Math.round(ARROZ_COCIDO.kcal * 2)} kcal`).first()).toBeVisible();
    await expect(addBtn(page, "200 g")).toBeEnabled();
  });

  for (const bad of ["0", "2001", "12,5"]) {
    test(`«${bad}» g desactiva el botón de añadir y muestra un aviso`, async ({ page }) => {
      await openDiario(page);
      await openFoodTab(page);
      await searchBox(page).fill("arroz coc");
      await result(page, "Arroz blanco, cocido").click();
      await qtyInput(page, "Gramos").fill(bad);
      await expect(page.getByRole("button", { name: /^Añadir / })).toBeDisabled();
      // El aviso: el campo marcado como inválido y descrito por el mensaje (como "Raciones")
      await expect(qtyInput(page, "Gramos")).toHaveAttribute("aria-invalid", "true");
      await expect(qtyInput(page, "Gramos")).toHaveAttribute("aria-describedby", /.+/);
    });
  }

  test("doble toque en «Añadir 150 g» crea una sola entrada", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz coc");
    await result(page, "Arroz blanco, cocido").click();
    await chip(page, "150 g").click();
    await addBtn(page, "150 g").dblclick();
    await expect(meal(page, "Comida")).toContainText("150 g");
    expect(await readStored<MealEntry[]>(page, "entries")).toHaveLength(1);
  });

  test("las entradas de receta y personalizadas se ven como antes (sin cantidad)", async ({ page }) => {
    await openDiario(page, {
      entries: [{ id: "e1", date: TODAY, mealType: "Cena", customName: "Yogur con nueces", calories: 250, protein: 10, carbs: 12, fat: 16 }],
    });
    await expect(meal(page, "Cena")).toContainText("Yogur con nueces");
    await expect(meal(page, "Cena")).not.toContainText(/\d+ g\b/);
  });
});

test.describe("R7: registrar en unidades", () => {
  test("«Huevo» abre en Unidades; 2 ud → «2 ud · N g» en el Diario", async ({ page }) => {
    const grams = 2 * HUEVO.unitGrams!;
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("huevo");
    await result(page, "Huevo").click();
    await expect(modeRadio(page, "Unidades")).toBeChecked();
    await chip(page, "2 ud").click();
    await expect(page.getByText(`${Math.round(grams)} g`).first()).toBeVisible();
    await addBtn(page, "2 ud").click();

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries[0]).toMatchObject({ foodId: `local:${HUEVO.id}`, units: 2, grams });
    await expect(meal(page, "Comida")).toContainText(`2 ud · ${Math.round(grams)} g`);
  });

  test("se puede pasar a Gramos", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("huevo");
    await result(page, "Huevo").click();
    await modeRadio(page, "Gramos").check();
    await expect(qtyInput(page, "Gramos")).toBeVisible();
  });

  test("un alimento sin unidad no tiene selector", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz coc");
    await result(page, "Arroz blanco, cocido").click();
    await expect(modeRadio(page, "Unidades")).toHaveCount(0);
  });

  test("un producto de OFF con ración en gramos tiene unidades", async ({ page }) => {
    await mockBrands(page, productsResponse([YOGUR_GRIEGO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await result(page, "Yogur griego natural").click();
    await expect(modeRadio(page, "Unidades")).toBeChecked();
  });
});

test.describe("R8: producto de marca", () => {
  test("se guarda como «Producto · Marca» con foodId off:<código>", async ({ page }) => {
    await mockBrands(page, productsResponse([YOGUR_LIGERO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await result(page, "Yogur griego ligero").click();
    await chip(page, "200 g").click();
    await addBtn(page, "200 g").click();

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries[0]).toMatchObject({
      customName: "Yogur griego ligero · Valle Blanco",
      foodId: `off:${YOGUR_LIGERO.code}`,
      grams: 200,
    });
    expect(entries[0].calories).toBeCloseTo(156, 6);
    await expect(meal(page, "Comida")).toContainText("Yogur griego ligero · Valle Blanco");
  });
});

test.describe("R10: aviso con Deshacer", () => {
  test("«Añadido a Comida · 150 g» y Deshacer quita la entrada", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz coc");
    await result(page, "Arroz blanco, cocido").click();
    await chip(page, "150 g").click();
    await addBtn(page, "150 g").click();

    await expect(toast(page)).toContainText("Añadido a Comida · 150 g");
    await toast(page).getByRole("button", { name: "Deshacer" }).click();
    await expect(meal(page, "Comida")).toHaveCount(0);
    expect(await readStored<MealEntry[]>(page, "entries")).toEqual([]);
  });
});

test.describe("R11: errores de OFF", () => {
  test("sin red: error en el bloque de marcas con Reintentar; los básicos siguen; al reintentar salen los productos", async ({
    page,
  }) => {
    let fail = true;
    await mockBrands(page, (route) =>
      fail ? route.abort("internetdisconnected") : route.fulfill({ json: { products: [YOGUR_LIGERO] } }),
    );
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("arroz");
    await brandButton(page, "arroz").click();

    await expect(retry(page)).toBeVisible();
    await expect(result(page, "Arroz blanco, cocido")).toBeVisible();
    await result(page, "Arroz blanco, cocido").click();
    await expect(qtyInput(page, "Gramos")).toBeVisible();
    await back(page).click();

    fail = false;
    await retry(page).click();
    await expect(result(page, "Yogur griego ligero")).toBeVisible();
  });

  test("OFF responde con error (502): mismo bloque de error con Reintentar", async ({ page }) => {
    await mockBrands(page, (route) => route.fulfill({ status: 502, json: { error: "unavailable" } }));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await expect(retry(page)).toBeVisible();
  });

  test("con el error a la vista, Personalizada sigue funcionando", async ({ page }) => {
    await mockBrands(page, (route) => route.abort("internetdisconnected"));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await expect(retry(page)).toBeVisible();

    await tab(page, "Personalizada").click();
    await page.getByPlaceholder("Nombre").fill("Yogur de la nevera");
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(meal(page, "Comida")).toContainText("Yogur de la nevera");
  });
});

test.describe("R12: límite de búsquedas", () => {
  test("429: el botón de marcas se desactiva con la cuenta atrás y se reactiva al acabar", async ({ page }) => {
    await mockBrands(page, (route) => route.fulfill({ status: 429, json: { error: "rate_limited", retryAfter: 30 } }));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();

    // El botón sigue siendo el de marcas, desactivado y con los segundos que faltan
    const btn = page.getByRole("button", { name: /productos de marca/ });
    await expect(btn).toBeDisabled();
    await expect(page.getByText(/\b30\b/).first()).toBeVisible();

    // signIn congela Date.now (los timers siguen): se adelanta el reloj 31 s
    await page.clock.setFixedTime(new Date(`${TODAY}T10:00:31`));
    await expect(btn).toBeEnabled({ timeout: 3_000 });
  });
});

test.describe("R14: no lo encuentro → Personalizada", () => {
  test("abre Personalizada con el nombre ya escrito", async ({ page }) => {
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("tortilla de mi abuela");
    await page.getByText("¿No lo encuentras? Añádelo a mano").click();
    await expect(page.getByPlaceholder("Nombre")).toHaveValue("tortilla de mi abuela");
  });
});

test.describe("Accesibilidad de la pestaña Alimento", () => {
  test("sin infracciones de contraste, etiquetas ni nombres de botón (básicos + marcas + tarjeta)", async ({ page }) => {
    await mockBrands(page, productsResponse([YOGUR_GRIEGO, YOGUR_LIGERO]));
    await openDiario(page);
    await openFoodTab(page);
    await searchBox(page).fill("yogur griego");
    await brandButton(page, "yogur griego").click();
    await expect(brandsHeading(page)).toBeVisible();

    const rules = ["color-contrast", "label", "button-name", "aria-allowed-attr", "aria-required-children"];
    let results = await new AxeBuilder({ page }).withRules(rules).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);

    await result(page, "Yogur griego natural").click();
    results = await new AxeBuilder({ page }).withRules(rules).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
