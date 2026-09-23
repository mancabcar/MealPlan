// Spec: docs/pm/lista-compra/spec.md › Acceptance criteria R1–R14.
// Tech: docs/pm/lista-compra/tech.md › Testing strategy (E2E) y "Test notes › UI test contract" (selectores).
//
// Datos: tests/fixtures/shopping.ts. Hoy = martes 2026-09-22 (signIn fija el reloj); semana 21–27 sept.
// Con Lucía (Desayuno, Comida, Merienda, Cena) la lista tiene 10 por comprar y 2 "Ya lo tienes".
import { expect, test, type Locator, type Page } from "@playwright/test";
import { lucia, manuel } from "../fixtures/profiles";
import {
  CREMA_CALABAZA,
  LUCIA_EXPECTED,
  MONDAY,
  POLLO_BROCOLI,
  SHOPPING_PANTRY,
  SHOPPING_PLAN,
  SHOPPING_RECIPES,
} from "../fixtures/shopping";
import { readStored, signIn, TODAY, USER_ID } from "./helpers";

const LIST = "/plan/compra";
const N = LUCIA_EXPECTED.pending; // 10
const M = LUCIA_EXPECTED.haveIt; // 2

const SEED = { profile: lucia, recipes: SHOPPING_RECIPES, weekplan: SHOPPING_PLAN, pantry: SHOPPING_PANTRY };

async function openList(page: Page, data: Record<string, unknown> = {}) {
  await signIn(page, { ...SEED, ...data });
  await page.goto(LIST);
  await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Grupo de pasillo: <section aria-label="Frutas y verduras">. */
const aisle = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

/** Grupo plegable (<details>) cuyo <summary> empieza por el título. */
const group = (page: Page, title: string) =>
  page.locator("details").filter({ has: page.locator("summary", { hasText: new RegExp(`^\\s*${esc(title)}`) }) });

async function openGroup(page: Page, title: string): Promise<Locator> {
  const details = group(page, title);
  await expect(details).toHaveCount(1);
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open))) await details.locator("summary").click();
  return details;
}

/** Botón de detalle de un ingrediente: su nombre accesible empieza por "Nombre · cantidad". */
const itemButton = (scope: Page | Locator, name: string, amount = "") =>
  scope.getByRole("button", { name: new RegExp(`^${esc(name)} · ${esc(amount)}`) });

/** Casilla de comprado de un ingrediente: nombre accesible = nombre visible del ingrediente. */
const tick = (scope: Page | Locator, name: string) => scope.getByRole("checkbox", { name, exact: true });

/** Fila (<li>) de un ingrediente. */
const row = (scope: Page | Locator, page: Page, name: string) =>
  scope.getByRole("listitem").filter({ has: itemButton(page, name) });

const progress = (page: Page, bought: number, total: number) => page.getByText(`${bought} de ${total} comprados`);

// ---------------------------------------------------------------------------

test.describe("R1: entrada desde Plan", () => {
  test('Plan muestra "Lista de la compra" con N por comprar · M ya los tienes, y coinciden con la lista', async ({ page }) => {
    await signIn(page, SEED);
    await page.goto("/plan");
    const entry = page.getByRole("link", { name: /Lista de la compra/ });
    await expect(entry).toContainText(`${N} por comprar · ${M} ya los tienes`);

    await entry.click();
    await expect(page).toHaveURL(new RegExp(`${LIST}$`));
    await expect(progress(page, 0, N)).toBeVisible();
    const haveIt = await openGroup(page, "Ya lo tienes");
    await expect(haveIt.getByRole("listitem")).toHaveCount(M);
  });

  test("N baja al marcar algo como comprado", async ({ page }) => {
    await openList(page);
    await tick(page, "Brócoli").click();
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Plan" }).click();
    await expect(page.getByRole("link", { name: /Lista de la compra/ })).toContainText(`${N - 1} por comprar · ${M} ya los tienes`);
  });

  test("la pestaña Plan sigue activa en /plan/compra", async ({ page }) => {
    await openList(page);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("R2: recetas de la semana en comidas activas", () => {
  test("la Merienda solo entra si está activa en el perfil", async ({ page }) => {
    await openList(page); // Lucía hace Merienda
    await expect(itemButton(page, "Kéfir", "200 ml")).toBeVisible();
  });

  test("con Merienda inactiva (Manuel), el batido de la Merienda del martes no aparece", async ({ page }) => {
    await openList(page, { profile: manuel });
    await expect(itemButton(page, "Brócoli")).toBeVisible();
    await expect(itemButton(page, "Kéfir")).toHaveCount(0);
    await expect(itemButton(page, "Plátano")).toHaveCount(0);
  });

  test("las recetas de la semana pasada y de la siguiente no aparecen", async ({ page }) => {
    await openList(page);
    await expect(itemButton(page, "Brócoli")).toBeVisible();
    await expect(page.getByText(/Dátiles/)).toHaveCount(0);
    await expect(page.getByText(/Nueces/)).toHaveCount(0);
  });

  test("la misma receta dos días cuenta dos veces", async ({ page }) => {
    await openList(page, {
      weekplan: {
        "2026-09-21": [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }],
        "2026-09-24": [{ mealType: "Cena", recipeId: POLLO_BROCOLI.id }],
      },
      pantry: [],
    });
    await expect(itemButton(aisle(page, "Frutas y verduras"), "Brócoli", "300 g")).toBeVisible();
    await expect(itemButton(aisle(page, "Carne y pescado"), "Pechuga de pollo", "300 g")).toBeVisible();
  });
});

test.describe("R3 · R4: ingredientes separados y sumados", () => {
  test('"1 bote pequeño de garbanzos cocidos (240g)" → "Garbanzos cocidos · 1 bote"', async ({ page }) => {
    await openList(page);
    await expect(itemButton(aisle(page, "Despensa y conservas"), "Garbanzos cocidos", "1 bote")).toBeVisible();
  });

  test('"sal, pimienta y orégano" → tres ingredientes', async ({ page }) => {
    await openList(page);
    const basics = await openGroup(page, "Especias y básicos");
    for (const name of ["Sal", "Pimienta", "Orégano"]) await expect(itemButton(basics, name)).toHaveCount(1);
  });

  test('"150g brócoli" en dos recetas → una sola "Brócoli · 300 g"', async ({ page }) => {
    await openList(page);
    await expect(itemButton(aisle(page, "Frutas y verduras"), "Brócoli", "300 g")).toBeVisible();
    await expect(tick(page, "Brócoli")).toHaveCount(1);
  });

  test('1 huevo + 1 huevo + 2 huevos → "Huevos · 4"', async ({ page }) => {
    await openList(page);
    await expect(itemButton(aisle(page, "Lácteos y huevos"), "Huevos", "4")).toBeVisible();
  });

  test('"1/2 cebolla" y "1/4 cebolla morada" son dos ingredientes', async ({ page }) => {
    await openList(page);
    const fruta = aisle(page, "Frutas y verduras");
    await expect(itemButton(fruta, "Cebolla", "½")).toBeVisible();
    await expect(itemButton(fruta, "Cebolla morada", "¼")).toBeVisible();
  });
});

test.describe("R5: Ya lo tienes", () => {
  test('Despensa "Arroz integral · 1 kg" + receta "60g arroz" → Ya lo tienes, no se cuenta', async ({ page }) => {
    await openList(page);
    const haveIt = await openGroup(page, "Ya lo tienes");
    await expect(row(haveIt, page, "Arroz")).toContainText("Tienes: Arroz integral · 1 kg");
    await expect(itemButton(aisle(page, "Despensa y conservas"), "Arroz")).toHaveCount(0);
    await expect(progress(page, 0, N)).toBeVisible();
  });

  test('Espárragos verdes caducados en la Despensa → por comprar, con "El de tu Despensa está caducado"', async ({ page }) => {
    await openList(page);
    await expect(row(aisle(page, "Frutas y verduras"), page, "Espárragos verdes")).toContainText("El de tu Despensa está caducado");
  });
});

test.describe("R6: detalle y 'Añadir a la lista de todos modos'", () => {
  test("el detalle de Pechuga de pollo muestra el total, las tres comidas y lo que hay en la Despensa", async ({ page }) => {
    await openList(page);
    const haveIt = await openGroup(page, "Ya lo tienes");
    await itemButton(haveIt, "Pechuga de pollo").click();

    const detail = page.getByRole("dialog", { name: "Pechuga de pollo" });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("420 g");
    const uses = detail.getByRole("listitem");
    await expect(uses).toHaveCount(3);
    const lunes = uses.filter({ hasText: "Pollo al horno con brócoli" });
    await expect(lunes).toContainText("Lunes");
    await expect(lunes).toContainText("Comida");
    await expect(lunes).toContainText("150");
    await expect(uses.filter({ hasText: "Salteado de pollo y brócoli" })).toContainText("120");
    await expect(uses.filter({ hasText: "Ensalada de pollo y garbanzos" })).toContainText("Miércoles");
    await expect(detail).toContainText("Pechuga de pollo · 3 filetes · Congelador");
  });

  test("al forzarlo pasa a Carne y pescado y sigue ahí tras recargar", async ({ page }) => {
    await openList(page);
    const haveIt = await openGroup(page, "Ya lo tienes");
    await itemButton(haveIt, "Pechuga de pollo").click();
    await page.getByRole("button", { name: "Añadir a la lista de todos modos" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(itemButton(aisle(page, "Carne y pescado"), "Pechuga de pollo", "420 g")).toBeVisible();
    await expect(progress(page, 0, N + 1)).toBeVisible();

    await page.reload();
    await expect(itemButton(aisle(page, "Carne y pescado"), "Pechuga de pollo", "420 g")).toBeVisible();
    await expect(itemButton(await openGroup(page, "Ya lo tienes"), "Pechuga de pollo")).toHaveCount(0);
  });
});

test.describe("R7: marcar como comprado", () => {
  test("marcar lo lleva a Comprados y sube el progreso; desmarcar lo devuelve", async ({ page }) => {
    await openList(page);
    await tick(page, "Brócoli").click();
    await expect(progress(page, 1, N)).toBeVisible();
    await expect(itemButton(aisle(page, "Frutas y verduras"), "Brócoli")).toHaveCount(0);

    const bought = await openGroup(page, "Comprados");
    await expect(tick(bought, "Brócoli")).toBeChecked();
    await tick(bought, "Brócoli").click();

    await expect(progress(page, 0, N)).toBeVisible();
    await expect(tick(aisle(page, "Frutas y verduras"), "Brócoli")).not.toBeChecked();
  });
});

test.describe("R8: lo comprado se guarda por usuario y por semana", () => {
  const FIVE = ["Brócoli", "Huevos", "Tomate", "Cebolla", "Plátano"];

  test("5 comprados siguen comprados tras recargar", async ({ page }) => {
    await openList(page);
    for (const name of FIVE) await tick(page, name).click();
    await expect(progress(page, 5, N)).toBeVisible();

    await page.reload();
    await expect(progress(page, 5, N)).toBeVisible();
    const bought = await openGroup(page, "Comprados");
    for (const name of FIVE) await expect(tick(bought, name)).toBeChecked();

    const stored = await readStored<{ current: { week: string; bought: Record<string, string> } }>(page, "shopping");
    expect(stored.current.week).toBe(MONDAY);
    expect(Object.keys(stored.current.bought)).toHaveLength(5);
  });

  test("dos usuarios en el mismo dispositivo: cada uno ve solo lo suyo", async ({ page }) => {
    const OTHER = "e2e-user-2";
    await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
    await page.addInitScript(
      ({ users, seed }) => {
        if (localStorage.getItem("mp_users")) return;
        localStorage.setItem(
          "mp_users",
          JSON.stringify(users.map(([id, username]) => ({ id, username, salt: "00", hash: "00", createdAt: "2026-09-01T00:00:00Z" }))),
        );
        localStorage.setItem("mp_session", JSON.stringify({ id: users[0][0], username: users[0][1] }));
        for (const [id] of users) for (const [k, v] of Object.entries(seed)) localStorage.setItem(`mp_${id}_${k}`, JSON.stringify(v));
      },
      { users: [[USER_ID, "lucia"], [OTHER, "manuel"]] as [string, string][], seed: SEED },
    );
    const switchTo = async (id: string, username: string) => {
      await page.evaluate((s) => localStorage.setItem("mp_session", JSON.stringify(s)), { id, username });
      await page.goto(LIST);
      await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
    };

    await page.goto(LIST);
    await tick(page, "Brócoli").click();
    await expect(progress(page, 1, N)).toBeVisible();

    await switchTo(OTHER, "manuel");
    await expect(progress(page, 0, N)).toBeVisible();
    await expect(tick(aisle(page, "Frutas y verduras"), "Brócoli")).not.toBeChecked();

    await switchTo(USER_ID, "lucia");
    await expect(progress(page, 1, N)).toBeVisible();
  });

  test("al empezar una semana nueva no hay nada comprado", async ({ page }) => {
    await openList(page, {
      weekplan: {
        "2026-09-21": [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }],
        "2026-09-28": [{ mealType: "Comida", recipeId: POLLO_BROCOLI.id }],
      },
      pantry: [],
    });
    await tick(page, "Brócoli").click();
    await expect(tick(await openGroup(page, "Comprados"), "Brócoli")).toBeChecked();

    await page.clock.setFixedTime(new Date("2026-09-28T10:00:00")); // lunes siguiente
    await page.reload();
    await expect(tick(aisle(page, "Frutas y verduras"), "Brócoli")).not.toBeChecked();
    await expect(page.getByText(/^0 de \d+ comprados$/)).toBeVisible();
  });
});

test.describe("R9: la lista sigue al plan", () => {
  test('"Brócoli · 300 g" comprado; quitar una receta en Plan → 150 g y sin marcar', async ({ page }) => {
    await openList(page);
    await tick(page, "Brócoli").click();

    await page.goto("/plan");
    await page.getByRole("tab", { name: /^Lunes/ }).click();
    await page.getByRole("button").filter({ hasText: "Pollo al horno con brócoli" }).click();
    await page.getByRole("combobox").selectOption("");

    await page.goto(LIST);
    const fruta = aisle(page, "Frutas y verduras");
    await expect(itemButton(fruta, "Brócoli", "150 g")).toBeVisible();
    await expect(tick(fruta, "Brócoli")).not.toBeChecked();
  });

  test('"Huevos" comprado; cambia un hueco no relacionado → sigue comprado', async ({ page }) => {
    await openList(page);
    await tick(page, "Huevos").click();

    await page.goto("/plan");
    await page.getByRole("tab", { name: /^Jueves/ }).click();
    await page.getByRole("button").filter({ hasText: "Comida" }).click();
    await page.getByRole("combobox").selectOption(CREMA_CALABAZA.id);

    await page.goto(LIST);
    await expect(itemButton(page, "Calabaza", "300 g")).toBeVisible(); // el cambio sí llegó a la lista
    await expect(tick(await openGroup(page, "Comprados"), "Huevos")).toBeChecked();
  });
});

test.describe("R10: semana sin recetas", () => {
  test('sin recetas → "Nada que comprar todavía" e "Ir al Plan" abre Plan', async ({ page }) => {
    await openList(page, { weekplan: {} });
    await expect(page.getByText("Nada que comprar todavía")).toBeVisible();
    await page.getByRole("link", { name: "Ir al Plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan semanal" })).toBeVisible();
  });

  test("solo recetas en comidas inactivas cuenta como semana vacía", async ({ page }) => {
    await openList(page, { profile: manuel, weekplan: { "2026-09-22": [{ mealType: "Merienda", recipeId: "t-batido-kefir" }] } });
    await expect(page.getByText("Nada que comprar todavía")).toBeVisible();
  });

  test("la tarjeta de Plan también lo dice", async ({ page }) => {
    await signIn(page, { ...SEED, weekplan: {} });
    await page.goto("/plan");
    await expect(page.getByRole("link", { name: /Lista de la compra/ })).toContainText("Nada que comprar todavía");
  });
});

test.describe("R11 · R12: pasillos y básicos (Should)", () => {
  test("brócoli en Frutas y verduras, huevos en Lácteos y huevos, aceite de oliva en Despensa y conservas", async ({ page }) => {
    await openList(page);
    await expect(itemButton(aisle(page, "Frutas y verduras"), "Brócoli")).toBeVisible();
    await expect(itemButton(aisle(page, "Lácteos y huevos"), "Huevos")).toBeVisible();
    await expect(itemButton(aisle(page, "Despensa y conservas"), "Aceite de oliva")).toBeVisible();
  });

  test("sal, pimienta, orégano y vinagre en Especias y básicos: plegado y fuera de los recuentos", async ({ page }) => {
    await openList(page);
    const basics = group(page, "Especias y básicos");
    expect(await basics.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(false);
    await openGroup(page, "Especias y básicos");
    for (const name of ["Sal", "Pimienta", "Orégano", "Vinagre"]) await expect(itemButton(basics, name)).toBeVisible();
    await expect(progress(page, 0, N)).toBeVisible(); // N = 10 no incluye los 4 básicos
  });
});

test.describe("R13 · R14: pasar comprados a la Despensa (Should)", () => {
  async function tickAndOpenMove(page: Page, names: string[]) {
    await openList(page);
    for (const name of names) await tick(page, name).click();
    await page.getByRole("button", { name: `Pasar ${names.length} comprados a la Despensa` }).click();
    const sheet = page.getByRole("dialog", { name: "Pasar a la Despensa" });
    await expect(sheet).toBeVisible();
    return sheet;
  }

  test("revisar ubicaciones, dejar fuera uno y añadir: crea artículos Nuevo y los quita de Comprados", async ({ page }) => {
    const sheet = await tickAndOpenMove(page, ["Brócoli", "Huevos", "Garbanzos cocidos"]);

    // Ubicación sugerida por pasillo
    await expect(sheet.getByLabel("Ubicación de Brócoli")).toHaveValue("Nevera");
    await expect(sheet.getByLabel("Ubicación de Huevos")).toHaveValue("Nevera");
    await expect(sheet.getByLabel("Ubicación de Garbanzos cocidos")).toHaveValue("Despensa");

    await sheet.getByLabel("Ubicación de Brócoli").selectOption("Congelador");
    await tick(sheet, "Huevos").uncheck();
    await sheet.getByRole("button", { name: "Añadir 2 a la Despensa" }).click();

    await expect(page).toHaveURL(/\/despensa$/);
    const toast = page.getByRole("status").filter({ hasText: "2 añadidos" });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Deshacer" })).toBeVisible();

    const congelador = page.getByRole("heading", { name: "Categoría Congelador" }).locator("..");
    const brocoli = congelador.getByText("Brócoli", { exact: true }).locator("..");
    await expect(brocoli).toContainText("300 g");
    await expect(brocoli).toContainText("Nuevo");
    const despensa = page.getByRole("heading", { name: "Categoría Despensa" }).locator("..");
    const garbanzos = despensa.getByText("Garbanzos cocidos", { exact: true }).locator("..");
    await expect(garbanzos).toContainText("1 bote");
    await expect(garbanzos).toContainText("Nuevo");
    await expect(despensa.getByText("Arroz integral", { exact: true }).locator("..")).not.toContainText("Nuevo");

    const pantry = await readStored<{ name: string; quantity: string; category: string; addedFromListAt?: string }[]>(page, "pantry");
    expect(pantry).toHaveLength(SHOPPING_PANTRY.length + 2);
    expect(pantry.filter((p) => p.addedFromListAt === TODAY).map((p) => [p.name, p.quantity, p.category])).toEqual(
      expect.arrayContaining([
        ["Brócoli", "300 g", "Congelador"],
        ["Garbanzos cocidos", "1 bote", "Despensa"],
      ]),
    );

    await page.goto(LIST);
    const bought = await openGroup(page, "Comprados");
    await expect(tick(bought, "Huevos")).toBeChecked();
    await expect(tick(page, "Brócoli")).toHaveCount(0);
    await expect(tick(page, "Garbanzos cocidos")).toHaveCount(0);
  });

  test("si ya existe uno con el mismo nombre, añade una línea nueva", async ({ page }) => {
    const sheet = await tickAndOpenMove(page, ["Espárragos verdes"]); // la Despensa ya tiene unos (caducados)
    await sheet.getByRole("button", { name: "Añadir 1 a la Despensa" }).click();
    await expect(page).toHaveURL(/\/despensa$/);
    const pantry = await readStored<{ name: string; quantity: string }[]>(page, "pantry");
    expect(pantry.filter((p) => p.name === "Espárragos verdes").map((p) => p.quantity)).toEqual(["1 manojo", "100 g"]);
  });

  test("Deshacer borra lo añadido y lo devuelve a Comprados", async ({ page }) => {
    const sheet = await tickAndOpenMove(page, ["Brócoli", "Garbanzos cocidos"]);
    await sheet.getByRole("button", { name: "Añadir 2 a la Despensa" }).click();
    await expect(page).toHaveURL(/\/despensa$/);

    await page.getByRole("status").getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByText("Brócoli", { exact: true })).toHaveCount(0);
    const pantry = await readStored<{ id: string }[]>(page, "pantry");
    expect(pantry.map((p) => p.id)).toEqual(SHOPPING_PANTRY.map((p) => p.id));

    await page.goto(LIST);
    const bought = await openGroup(page, "Comprados");
    await expect(tick(bought, "Brócoli")).toBeChecked();
    await expect(tick(bought, "Garbanzos cocidos")).toBeChecked();
  });

  // docs/pm/lista-compra/review.md › N2: antes quedaba "0 comidas planificadas · 0 de 0 comprados" y nada más.
  test("si todo pasa a la Despensa, la lista lo dice y conserva las comidas planificadas", async ({ page }) => {
    await openList(page, { weekplan: { "2026-09-21": [{ mealType: "Comida", recipeId: CREMA_CALABAZA.id }] }, pantry: [] });
    for (const name of ["Calabaza", "Puerro"]) await tick(page, name).click();
    await page.getByRole("button", { name: "Pasar 2 comprados a la Despensa" }).click();
    await page.getByRole("dialog", { name: "Pasar a la Despensa" }).getByRole("button", { name: "Añadir 2 a la Despensa" }).click();
    await expect(page).toHaveURL(/\/despensa$/);

    await page.goto(LIST);
    await expect(page.getByText("Todo comprado y guardado")).toBeVisible();
    await expect(page.getByText("1 comida planificada")).toBeVisible();
    await expect(page.getByText(/0 de 0 comprados/)).toHaveCount(0);
    await page.getByRole("link", { name: "Ver la Despensa" }).click();
    await expect(page.getByRole("heading", { name: "Despensa", exact: true })).toBeVisible();
  });
});
