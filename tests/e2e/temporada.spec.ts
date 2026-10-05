// Spec: docs/pm/34-temporada/spec.md › R1–R8 (Acceptance criteria y User flows).
// Tech: docs/pm/34-temporada/tech.md › UI y Test coverage › «UI test contract» (nombres accesibles que dev-code debe respetar).
// Reloj: helpers.signIn fija septiembre de 2026; aquí se vuelve a fijar a OCTUBRE (2026-10-05) o MAYO (2026-05-15).
// La app añade siempre las recetas semilla, así que los casos se anclan a recetas propias con nombres únicos y a
// productos ancla: calabaza, caqui y membrillo (octubre), mandarina (empieza en octubre), fresa (mayo). «Membrillo» no está en ninguna receta semilla
// (como en despensa-recetas.spec.ts): su página arranca vacía.
//
// UI test contract (en /recetas):
//   - Franja: heading «De temporada · Octubre»; lista «Verduras» y lista «Frutas»; cada producto es un botón cuyo
//     nombre accesible EMPIEZA por el nombre del producto y, si procede, contiene «empieza» o «últimas».
//     Enlace/botón «Ver calendario completo» (→ ?vista=calendario).
//   - Destacadas: heading «Destacadas este mes» y región con ese nombre; cada receta es un botón con el nombre de la
//     receta. Sin coincidencias, ni heading ni región. Máximo 10.
//   - Franja y destacadas se ocultan con búsqueda o con cualquier filtro activo (incl. el chip «De temporada»).
//   - Filtro: botón «De temporada» (aria-pressed) junto a «Solo favoritas» y «Usa lo que tengo».
//   - Tarjeta de la lista: chip que empieza por «De temporada:» con hasta 2 nombres de producto y «+N» si hay más.
//   - Detalle de receta: botón «Ver producto: <Nombre>» por cada producto de temporada de la receta.
//   - Producto: ?producto=<id>. heading nivel 1 con el nombre; lista «Meses de temporada» con 12 elementos y
//     aria-current="date" en el mes actual; botón «Volver». Si hay recetas: sus tarjetas y botón «Más ideas con <Nombre>».
//     Si no hay: texto «Aún no hay recetas con <nombre>» y botón «Sugerir receta con <Nombre>».
//   - IA: POST /api/recipes con { …, count: 1, preferredIngredient: "<Nombre>" }; la receta se guarda y se abre su detalle.
//   - Calendario: ?vista=calendario. heading «Calendario de temporada»; tabla con 12 columnas de mes (la actual con
//     aria-current="date") y una fila por producto (cabecera de fila = nombre; los básicos incluidos). Botón «Volver».
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { recipe } from "../fixtures/shopping";
import { readStored, signIn } from "./helpers";

// Las ~107 recetas semilla compiten en «Destacadas» (en octubre hasta 4 productos, 81 recetas con alguno): para entrar
// seguro en el top 10 hacen falta 5 productos de octubre. «Membrillo» queda fuera de las fixtures: su página arranca vacía.
const CREMA_CINCO = recipe("t-crema-cinco", "Crema otoñal de calabaza y fruta", [
  "300g calabaza",
  "1 caqui",
  "1 granada",
  "1 castaña",
  "1 mandarina",
  "1 cebolla",
]);
const CREMA_DOS = recipe("t-crema-dos", "Crema dulce de calabaza y caqui", ["300g calabaza", "1 caqui"]);
const ASADO = recipe("t-asado-calabaza", "Asado sencillo de calabaza", ["400g calabaza", "1 cucharada de aceite de oliva"]);
const CON_NUECES = recipe("t-calabaza-nueces", "Calabaza con nueces", [
  "300g calabaza",
  "1 caqui",
  "1 granada",
  "1 castaña",
  "1 mandarina",
  "30g nueces",
]);
const SOFRITO = recipe("t-sofrito-basico", "Sofrito básico de cebolla y ajo", ["2 cebollas", "3 dientes de ajo", "1 zanahoria"]);
const BATIDO = recipe("t-batido-fresa", "Batido de fresas del huerto", ["250g fresas", "200 ml leche"]);
const RECIPES = [CREMA_CINCO, CREMA_DOS, ASADO, CON_NUECES, SOFRITO, BATIDO];

const OCTUBRE = new Date("2026-10-05T10:00:00");
const MAYO = new Date("2026-05-15T10:00:00");
const allergic = { ...lucia, allergies: { preset: ["frutos_secos"], custom: [] } };

async function open(page: Page, url = "/recetas", { when = OCTUBRE, profile = lucia as unknown, favorites = [] as string[] } = {}) {
  await signIn(page, { profile, recipes: RECIPES, favorites });
  await page.clock.setFixedTime(when);
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

const strip = (page: Page) => page.getByRole("heading", { name: /^De temporada · / });
const featured = (page: Page) => page.getByRole("region", { name: "Destacadas este mes" });
const featuredCard = (page: Page, name: string) => featured(page).getByRole("button").filter({ hasText: name });
const productButton = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
/** Tarjetas del recetario completo (las únicas con kcal fuera de «Destacadas»). */
const listCards = (page: Page) => page.getByRole("button").filter({ hasText: "kcal" });
const listCard = (page: Page, name: string) => listCards(page).filter({ hasText: name });
const seasonalFilter = (page: Page) => page.getByRole("button", { name: "De temporada", exact: true });

test.describe("R1: franja «De temporada · <mes>»", () => {
  test("en octubre muestra los productos del mes en verduras y frutas, con «empieza» en la mandarina", async ({ page }) => {
    await open(page);
    await expect(strip(page)).toHaveText("De temporada · Octubre");
    const verduras = page.getByRole("list", { name: "Verduras" });
    const frutas = page.getByRole("list", { name: "Frutas" });
    await expect(verduras.getByRole("button", { name: /^Calabaza/ })).toBeVisible();
    await expect(frutas.getByRole("button", { name: /^Caqui/ })).toBeVisible();
    await expect(frutas.getByRole("button", { name: /^Mandarina.*empieza/ })).toBeVisible();
    await expect(frutas.getByRole("button", { name: /^Fresa/ })).toHaveCount(0);
  });

  test("al cambiar de mes cambian los productos, sin tocar los datos de las recetas", async ({ page }) => {
    await open(page, "/recetas", { when: MAYO });
    await expect(strip(page)).toHaveText("De temporada · Mayo");
    await expect(page.getByRole("list", { name: "Frutas" }).getByRole("button", { name: /^Fresa/ })).toBeVisible();
    await expect(productButton(page, "Membrillo")).toHaveCount(0);
  });

  test("los básicos (cebolla, ajo…) no salen en la franja", async ({ page }) => {
    await open(page);
    for (const name of ["Cebolla", "Ajo", "Patata", "Limón", "Zanahoria", "Champiñón"]) {
      await expect(page.getByRole("list", { name: /Verduras|Frutas/ }).getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
    }
  });
});

test.describe("R2: «Destacadas este mes»", () => {
  test("lista recetas con productos de octubre, la de más productos primero, y no las de solo básicos o de otro mes", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Destacadas este mes" })).toBeVisible();
    await expect(featuredCard(page, CREMA_CINCO.name)).toBeVisible();
    // Las dos fixtures de 5 productos (los básicos no cuentan) van las primeras, y entre ellas por nombre A–Z
    await expect(featured(page).getByRole("button").nth(0)).toContainText(CON_NUECES.name);
    await expect(featured(page).getByRole("button").nth(1)).toContainText(CREMA_CINCO.name);
    await expect(featuredCard(page, SOFRITO.name)).toHaveCount(0);
    await expect(featuredCard(page, BATIDO.name)).toHaveCount(0);
  });

  test("nunca más de 10", async ({ page }) => {
    await open(page);
    expect(await featured(page).getByRole("button").count()).toBeLessThanOrEqual(10);
  });

  test("en mayo destaca el batido de fresas y no la crema de calabaza", async ({ page }) => {
    await open(page, "/recetas", { when: MAYO });
    await expect(featuredCard(page, BATIDO.name)).toBeVisible();
    await expect(featuredCard(page, CREMA_CINCO.name)).toHaveCount(0);
  });

  test("con búsqueda o con cualquier filtro activo se ocultan la franja y las destacadas", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Solo favoritas" }).click();
    await expect(strip(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Destacadas este mes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Solo favoritas" }).click();
    await expect(strip(page)).toBeVisible();
    await page.getByPlaceholder("Buscar por nombre o etiqueta...").fill("crema");
    await expect(strip(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Destacadas este mes" })).toHaveCount(0);
  });
});

test.describe("R3: filtro «De temporada» e indicadores en cada receta", () => {
  test("el filtro deja solo las recetas con productos de octubre (sin límite de 10) y oculta la cabecera", async ({ page }) => {
    await open(page);
    await seasonalFilter(page).click();
    await expect(seasonalFilter(page)).toHaveAttribute("aria-pressed", "true");
    for (const r of [CREMA_CINCO, CREMA_DOS, ASADO, CON_NUECES]) await expect(listCard(page, r.name)).toBeVisible();
    await expect(listCard(page, SOFRITO.name)).toHaveCount(0);
    await expect(listCard(page, BATIDO.name)).toHaveCount(0);
    await expect(strip(page)).toHaveCount(0);
  });

  test("se combina con «Solo favoritas»", async ({ page }) => {
    await open(page, "/recetas", { favorites: [ASADO.id, SOFRITO.id] });
    await seasonalFilter(page).click();
    await page.getByRole("button", { name: "Solo favoritas" }).click();
    await expect(listCard(page, ASADO.name)).toBeVisible();
    await expect(listCards(page)).toHaveCount(1); // SOFRITO es favorita pero solo lleva básicos
  });

  test("la tarjeta indica los productos de temporada (hasta 2 y +N)", async ({ page }) => {
    await open(page);
    await expect(listCard(page, CREMA_DOS.name)).toContainText(/De temporada:.*calabaza.*caqui/i);
    await expect(listCard(page, CREMA_CINCO.name)).toContainText(/De temporada:.*\+3/);
    await expect(listCard(page, SOFRITO.name)).not.toContainText("De temporada:");
  });

  test("el detalle muestra todos los productos de temporada, cada uno abre su página", async ({ page }) => {
    await open(page);
    await listCard(page, CREMA_CINCO.name).click();
    for (const n of ["Calabaza", "Caqui", "Granada", "Castaña", "Mandarina"]) await expect(page.getByRole("button", { name: `Ver producto: ${n}` })).toBeVisible();
    await page.getByRole("button", { name: "Ver producto: Calabaza" }).click();
    await expect(page.getByRole("heading", { name: "Calabaza", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/producto=calabaza/);
  });
});

test.describe("R4: página de producto", () => {
  test("?producto=calabaza muestra 12 meses (el actual resaltado) y las recetas que la llevan", async ({ page }) => {
    await open(page, "/recetas?producto=calabaza");
    await expect(page.getByRole("heading", { name: "Calabaza", level: 1 })).toBeVisible();
    const months = page.getByRole("list", { name: "Meses de temporada" }).getByRole("listitem");
    await expect(months).toHaveCount(12);
    await expect(page.getByRole("list", { name: "Meses de temporada" }).locator('[aria-current="date"]')).toHaveCount(1);
    for (const r of [CREMA_CINCO, CREMA_DOS, ASADO]) await expect(listCard(page, r.name)).toBeVisible();
    await expect(listCard(page, BATIDO.name)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Más ideas con Calabaza" })).toBeVisible();
    await expect(page.getByText("Aún no hay recetas con calabaza")).toHaveCount(0);
  });

  test("tocar un producto de la franja abre su página y «Volver» regresa a la lista", async ({ page }) => {
    await open(page);
    await productButton(page, "Caqui").click();
    await expect(page).toHaveURL(/producto=caqui/);
    await expect(page.getByRole("heading", { name: "Caqui", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(strip(page)).toBeVisible();
    await expect(page).not.toHaveURL(/producto=/);
  });
});

test.describe("R5: producto sin recetas y sugerencia con IA", () => {
  const IA = {
    // 5 productos de octubre: así entra seguro en «Destacadas» entre las semilla
    ...recipe("ai_e2e_0", "Membrillo asado con fruta de otoño", ["2 membrillos", "1 caqui", "1 granada", "1 castaña", "1 mandarina", "150g yogur"]),
    isAIGenerated: true,
  };

  test("estado vacío con «Sugerir receta con Membrillo» como acción; sin «Más ideas»", async ({ page }) => {
    await open(page, "/recetas?producto=membrillo");
    await expect(page.getByText("Aún no hay recetas con membrillo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sugerir receta con Membrillo" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Más ideas con/ })).toHaveCount(0);
  });

  test("genera una receta con el producto como preferido, la guarda, la abre y queda destacada", async ({ page }) => {
    let body: { count?: number; preferredIngredient?: string } | undefined;
    await page.route("**/api/recipes", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { recipes: [IA], droppedCount: 0 } });
    });
    await open(page, "/recetas?producto=membrillo");
    await page.getByRole("button", { name: "Sugerir receta con Membrillo" }).click();

    await expect(page.getByRole("heading", { name: IA.name, level: 1 })).toBeVisible(); // se abre su detalle
    expect(body?.preferredIngredient).toBe("Membrillo");
    expect(body?.count).toBe(1);
    const stored = await readStored<{ id: string }[]>(page, "recipes");
    expect(stored.some((r) => r.id === IA.id)).toBe(true);

    // R6: la receta nueva queda destacada sin tocar nada más
    await page.goto("/recetas");
    await expect(featuredCard(page, IA.name)).toBeVisible();
  });

  test("si la generación falla se avisa y no se guarda nada", async ({ page }) => {
    await page.route("**/api/recipes", (route) => route.fulfill({ status: 502, json: { error: "Error de la API de Claude (HTTP 529)." } }));
    await open(page, "/recetas?producto=membrillo");
    await page.getByRole("button", { name: "Sugerir receta con Membrillo" }).click();
    await expect(page.getByText("Error de la API de Claude (HTTP 529).")).toBeVisible();
    await expect(page.getByText("Aún no hay recetas con membrillo")).toBeVisible();
  });
});

test.describe("R7: el aviso de alérgenos sigue en las vistas nuevas", () => {
  test("en destacadas, en el filtro y en la página de producto", async ({ page }) => {
    await open(page, "/recetas", { profile: allergic });
    await expect(featuredCard(page, CON_NUECES.name)).toContainText(/Frutos secos/i);
    await seasonalFilter(page).click();
    await expect(listCard(page, CON_NUECES.name)).toContainText(/Frutos secos/i);
    await page.goto("/recetas?producto=calabaza");
    await expect(listCard(page, CON_NUECES.name)).toContainText(/Frutos secos/i);
  });
});

test.describe("R8: calendario completo", () => {
  test("?vista=calendario muestra la tabla anual con el mes actual y los básicos", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Ver calendario completo" }).or(page.getByRole("link", { name: "Ver calendario completo" })).first().click();
    await expect(page).toHaveURL(/vista=calendario/);
    await expect(page.getByRole("heading", { name: "Calendario de temporada" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveCount(13); // producto + 12 meses
    await expect(table.locator('[aria-current="date"]').first()).toBeVisible();
    for (const name of ["Calabaza", "Caqui", "Fresa", "Cebolla"]) await expect(table.getByRole("rowheader", { name })).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(strip(page)).toBeVisible();
  });
});

test.describe("Accesibilidad de las vistas nuevas (axe)", () => {
  for (const [label, url] of [
    ["lista con franja y destacadas", "/recetas"],
    ["página de producto", "/recetas?producto=calabaza"],
    ["producto sin recetas", "/recetas?producto=membrillo"],
    ["calendario completo", "/recetas?vista=calendario"],
  ] as const) {
    test(`${label}: sin violaciones`, async ({ page }) => {
      await open(page, url);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

});
