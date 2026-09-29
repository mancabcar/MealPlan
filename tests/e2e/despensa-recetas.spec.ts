// Spec: docs/pm/16-despensa-recetas/spec.md › R1–R8 (issue #16).
// Contrato de UI: docs/pm/16-despensa-recetas/tech.md › Test coverage › "UI test contract".
// Reloj fijo en TODAY = 2026-09-22 (helpers.signIn): requesón a 2 días, membrillo a 1, mascarpone a 3, ricotta caducada.
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { recipe } from "../fixtures/shopping";
import { signIn } from "./helpers";

// Ingredientes deliberadamente poco comunes: la app añade las ~90 recetas semilla al recetario y ninguna
// usa requesón, cuscús, membrillo, mascarpone ni remolacha, así que los resultados filtrados son exactos.
const TARTA = recipe("t-tarta", "Tarta de requesón", ["200g requesón", "80g cuscús", "1 limón"]);
const TARTA_NUECES = recipe("t-tarta-nueces", "Tarta de requesón con nueces", ["500g requesón", "200g ricotta", "30g nueces"]);
const CUSCUS_MEMBRILLO = recipe("t-cuscus-membrillo", "Cuscús con membrillo", ["150g membrillo", "60g cuscús", "1 brócoli"]);
const CANONIGOS = recipe("t-canonigos", "Ensalada de canónigos", ["1 canónigos", "1 tomate"]);
const BATIDO = recipe("t-batido", "Batido de cabra", ["250g requesón de cabra", "1 plátano"]);
const BOL_MASCARPONE = recipe("t-bol-mascarpone", "Bol de mascarpone", ["125g mascarpone", "30g avena"]);
const CUSCUS_TRES = recipe("t-cuscus-tres", "Cuscús con membrillo y mascarpone", [
  "150g membrillo",
  "60g cuscús",
  "125g mascarpone",
]);
// Van delante de las semilla en el recetario, en este orden.
const RECIPES = [TARTA, TARTA_NUECES, CUSCUS_MEMBRILLO, CANONIGOS, BATIDO, BOL_MASCARPONE, CUSCUS_TRES];

const item = (id: string, name: string, extra: Record<string, string> = {}) => ({
  id,
  name,
  quantity: "1",
  category: "Nevera",
  ...extra,
});
const PANTRY = [
  item("p-requeson", "Requesón", { expiryDate: "2026-09-24" }), // 2 días → caduca pronto
  item("p-mascarpone", "Mascarpone", { expiryDate: "2026-09-25" }), // 3 días → no
  item("p-cuscus", "Cuscús", { category: "Despensa" }), // sin fecha
  item("p-membrillo", "Membrillo", { expiryDate: "2026-09-23" }), // 1 día → caduca pronto
  item("p-ricotta", "Ricotta", { expiryDate: "2026-09-21" }), // caducada
];

const allergic = { ...lucia, allergies: { preset: ["frutos_secos"], custom: [] } };
const seed = (pantry = PANTRY, profile: unknown = lucia) => ({ profile, recipes: RECIPES, pantry });

/** Tarjetas del recetario (las únicas con kcal), en el orden en que se ven. */
const cards = (page: Page) => page.getByRole("button").filter({ hasText: "kcal" });
const card = (page: Page, name: string) => cards(page).filter({ hasText: name });
const expectOrder = async (page: Page, names: string[]) => {
  await expect(cards(page)).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(cards(page).nth(i)).toContainText(name);
};
const useWhatIHave = (page: Page) => page.getByRole("button", { name: "Usa lo que tengo" });
const withThis = (page: Page, name: string) => page.getByRole("button", { name: `Recetas con esto: ${name}` });

test.describe("R1: 'Recetas con esto' solo en ítems que caducan pronto", () => {
  test("aparece con 0–2 días y no con 3+, sin fecha o caducado", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/despensa");
    await expect(withThis(page, "Requesón")).toBeVisible();
    await expect(withThis(page, "Membrillo")).toBeVisible();
    for (const name of ["Mascarpone", "Cuscús", "Ricotta"]) await expect(withThis(page, name)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Recetas con esto/ })).toHaveCount(2);
  });
});

test.describe("R2: 'Recetas con esto' lleva a las recetas que usan el ítem", () => {
  test("requesón a 2 días → solo las recetas con requesón, con chip quitable", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/despensa");
    await withThis(page, "Requesón").click();

    await expect(page).toHaveURL(/\/recetas\/?$/);
    await expect(page.getByText("con: Requesón")).toBeVisible();
    await expectOrder(page, ["Tarta de requesón", "Tarta de requesón con nueces"]); // sin "requesón de cabra"

    await page.getByRole("button", { name: "Quitar filtro con: Requesón" }).click();
    await expect(page.getByText("con: Requesón")).toHaveCount(0);
    await expect(card(page, "Ensalada de canónigos")).toBeVisible(); // vuelve el recetario completo
    expect(await cards(page).count()).toBeGreaterThan(RECIPES.length);
  });

  test("el filtro por ítem y 'Usa lo que tengo' son independientes: se aplican los dos", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/despensa");
    await withThis(page, "Requesón").click();
    await useWhatIHave(page).click();
    // 2 coincidencias (requesón + cuscús) antes que 1 (requesón; la ricotta está caducada)
    await expectOrder(page, ["Tarta de requesón", "Tarta de requesón con nueces"]);
    await expect(card(page, "Tarta de requesón con nueces")).toContainText("Tienes 1 de 3 ingredientes");
  });

  test("sin pasar por la Despensa no hay chip", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/recetas");
    await expect(page.getByText(/^con: /)).toHaveCount(0);
    await expect(card(page, "Ensalada de canónigos")).toBeVisible();
  });
});

test.describe("R3 / R4: 'Usa lo que tengo' ordena por ingredientes que ya tengo, desempatando por caducidad", () => {
  test("solo recetas con ≥1 ingrediente en la Despensa, por nº de coincidencias y luego caducidad", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/recetas");
    await expect(useWhatIHave(page)).toHaveAttribute("aria-pressed", "false");
    await useWhatIHave(page).click();
    await expect(useWhatIHave(page)).toHaveAttribute("aria-pressed", "true");

    // 3 coincidencias; 2 (membrillo caduca el 23); 2 (requesón el 24); 1 (requesón el 24); 1 (mascarpone el 25).
    // Fuera: Canónigos y Batido (0 coincidencias; "requesón de cabra" no es "requesón").
    await expectOrder(page, [
      "Cuscús con membrillo y mascarpone",
      "Cuscús con membrillo",
      "Tarta de requesón",
      "Tarta de requesón con nueces",
      "Bol de mascarpone",
    ]);
  });

  test("los ingredientes caducados no cuentan: la ricotta caducada deja la tarta con nueces en 1 coincidencia", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/recetas");
    await useWhatIHave(page).click();
    await expect(card(page, "Tarta de requesón con nueces")).toContainText("Tienes 1 de 3 ingredientes");
  });

  test("desactivar el filtro restaura el recetario completo", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/recetas");
    await useWhatIHave(page).click();
    await useWhatIHave(page).click();
    await expect(useWhatIHave(page)).toHaveAttribute("aria-pressed", "false");
    await expect(card(page, "Ensalada de canónigos")).toBeVisible();
    await expect(card(page, "Batido de cabra")).toBeVisible();
  });
});

test.describe("R5: los avisos de alérgenos se mantienen", () => {
  test("la tarta con nueces conserva el aviso desde 'Recetas con esto' y con el filtro", async ({ page }) => {
    await signIn(page, seed(PANTRY, allergic));
    await page.goto("/despensa");
    await withThis(page, "Requesón").click();
    await expect(card(page, "Tarta de requesón con nueces").getByText("⚠ contiene Frutos secos")).toBeVisible();
    await expect(card(page, "Tarta de requesón").first().getByText("⚠ contiene")).toHaveCount(0);

    await page.getByRole("button", { name: "Quitar filtro con: Requesón" }).click();
    await useWhatIHave(page).click();
    await expect(card(page, "Tarta de requesón con nueces").getByText("⚠ contiene Frutos secos")).toBeVisible();
  });
});

test.describe("R6: estados vacíos con salida a la generación con IA", () => {
  test("ítem que ninguna receta usa", async ({ page }) => {
    await signIn(page, seed([item("p-remolacha", "Remolacha", { expiryDate: "2026-09-23" })]));
    await page.goto("/despensa");
    await withThis(page, "Remolacha").click();
    await expect(page.getByText("Ninguna receta usa Remolacha")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Sugerir con IA/i }).first()).toBeVisible();
  });

  test("'Usa lo que tengo' con la Despensa vacía", async ({ page }) => {
    await signIn(page, seed([]));
    await page.goto("/recetas");
    await useWhatIHave(page).click();
    await expect(page.getByText("Nada que aprovechar todavía")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Sugerir con IA/i }).first()).toBeVisible();
  });
});

test.describe("R7: 'Usa lo que tengo' se combina con la búsqueda por texto", () => {
  test("filtro + 'mascarpone' → solo las que cumplen ambas, en orden", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/recetas");
    await useWhatIHave(page).click();
    await page.getByPlaceholder("Buscar por nombre o etiqueta...").fill("mascarpone");
    await expectOrder(page, ["Cuscús con membrillo y mascarpone", "Bol de mascarpone"]);
  });
});

test.describe("R8: con el filtro activo, cada tarjeta muestra cuánto tengo", () => {
  test("'Tienes N de M ingredientes' y chip 'caduca pronto' solo si algún coincidente caduca en 0–2 días", async ({ page }) => {
    await signIn(page, seed());
    await page.goto("/recetas");
    await expect(page.getByText(/Tienes \d+ de \d+ ingredientes/)).toHaveCount(0); // sin filtro no hay texto

    await useWhatIHave(page).click();
    const tres = card(page, "Cuscús con membrillo y mascarpone");
    await expect(tres).toContainText("Tienes 3 de 3 ingredientes");
    await expect(tres).toContainText("caduca pronto"); // membrillo a 1 día

    const bol = card(page, "Bol de mascarpone");
    await expect(bol).toContainText("Tienes 1 de 2 ingredientes");
    await expect(bol).not.toContainText("caduca pronto"); // mascarpone a 3 días
  });
});
