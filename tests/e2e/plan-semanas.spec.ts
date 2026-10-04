// Spec: docs/pm/78-plan-navegar-semanas/spec.md › R1–R6 (Acceptance criteria) y Edge cases.
// Tech: docs/pm/78-plan-navegar-semanas/tech.md › UI y Testing strategy.
// Contrato de UI (lo que dev-code debe construir):
//   - `<nav aria-label="Semana">` en Plan y en la lista de la compra, con botones «Semana anterior» y
//     «Semana siguiente», un botón «Hoy» (solo si la semana vista no es la actual) y el rango de fechas.
//   - La semana vista va en `?semana=<lunes AAAA-MM-DD>`; sin parámetro o con uno no válido, la semana actual.
//   - «Lista de la compra» (enlace del Plan) y «← Plan» (de la lista) conservan la semana.
// Datos: tests/fixtures/shopping.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). Semana actual 21–27 sept;
// semana siguiente 28 sept–4 oct con «Dátiles rellenos» el lunes a la Comida; semana pasada 14–20 sept, igual.
// Pendiente (preguntas abiertas de la spec): texto del indicador de semana (R6) y deslizar (R7): sin test.
import { expect, test, type Page } from "@playwright/test";
import { addDays } from "../../src/lib/week";
import { lucia } from "../fixtures/profiles";
import { CREMA_CALABAZA, DATILES, SHOPPING_PANTRY, SHOPPING_PLAN, SHOPPING_RECIPES } from "../fixtures/shopping";
import { pickRecipe, readStored, signIn, TODAY } from "./helpers";

const SEED = { profile: lucia, recipes: SHOPPING_RECIPES, weekplan: SHOPPING_PLAN, pantry: SHOPPING_PANTRY };

const NEXT = "2026-09-28";
const LAST = "2026-09-14";

const weekNav = (page: Page) => page.getByRole("navigation", { name: "Semana" });
const next = (page: Page) => weekNav(page).getByRole("button", { name: "Semana siguiente" });
const prev = (page: Page) => weekNav(page).getByRole("button", { name: "Semana anterior" });
const today = (page: Page) => weekNav(page).getByRole("button", { name: "Hoy" });
const tick = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });

async function open(page: Page, url: string, seed: Record<string, unknown> = SEED) {
  await signIn(page, seed);
  await page.goto(url);
  await expect(weekNav(page)).toBeVisible();
}

const selectedDay = (page: Page) => page.getByRole("tab", { selected: true });

test.describe("R1: navegar entre semanas en el Plan", () => {
  test("R1: › muestra la semana siguiente (lunes–domingo) y aparece «Hoy»", async ({ page }) => {
    await open(page, "/plan");
    await expect(today(page)).toHaveCount(0); // en la semana actual no hace falta
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(`semana=${NEXT}`));
    await expect(page.getByRole("tab")).toHaveCount(7);
    await expect(page.getByRole("tab", { name: "Lunes 28" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Domingo 4" })).toBeVisible();
    await expect(today(page)).toBeVisible();
  });

  test("R1: ‹ muestra la semana anterior", async ({ page }) => {
    await open(page, "/plan");
    await prev(page).click();
    await expect(page).toHaveURL(new RegExp(`semana=${LAST}`));
    await expect(page.getByRole("tab", { name: "Lunes 14" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Domingo 20" })).toBeVisible();
  });

  test("R1: «Hoy» vuelve a la semana actual con el día de hoy seleccionado", async ({ page }) => {
    await open(page, "/plan");
    await next(page).click();
    await next(page).click();
    await today(page).click();
    await expect(page.getByRole("tab", { name: "Martes 22" })).toHaveAttribute("aria-selected", "true");
    await expect(today(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/semana=/);
  });

  test("R1: al cambiar de semana se selecciona el lunes", async ({ page }) => {
    await open(page, "/plan");
    await next(page).click();
    await expect(selectedDay(page)).toHaveAccessibleName("Lunes 28");
  });

  test("R1: se puede avanzar y retroceder sin límite", async ({ page }) => {
    await open(page, "/plan");
    // Un toque por semana, esperando a que la URL se actualice (como un usuario; el router es asíncrono)
    let monday = "2026-09-21";
    for (let i = 0; i < 30; i++) {
      monday = addDays(monday, 7);
      await next(page).click();
      await expect(page).toHaveURL(new RegExp(`semana=${monday}`));
    }
    expect(monday).toBe("2027-04-19");
    for (let i = 0; i < 60; i++) {
      monday = addDays(monday, -7);
      await prev(page).click();
      // La semana actual no lleva parámetro (R2)
      if (monday === "2026-09-21") await expect(page).not.toHaveURL(/semana=/);
      else await expect(page).toHaveURL(new RegExp(`semana=${monday}`));
    }
    expect(monday).toBe("2026-02-23");
  });

  test("R1/R2: la semana vista sobrevive a una recarga", async ({ page }) => {
    await open(page, `/plan?semana=${NEXT}`);
    await expect(page.getByRole("tab", { name: "Lunes 28" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("tab", { name: "Lunes 28" })).toBeVisible();
  });
});

test.describe("R2: URL de semana", () => {
  for (const raw of ["hola", "2026-13-40", "2026-02-30"]) {
    test(`R2: semana=${raw} (no válida) → semana actual`, async ({ page }) => {
      await open(page, `/plan?semana=${raw}`);
      await expect(page.getByRole("tab", { name: "Martes 22" })).toHaveAttribute("aria-selected", "true");
      await expect(today(page)).toHaveCount(0);
    });
  }

  test("R2: una fecha que no es lunes se normaliza al lunes de su semana", async ({ page }) => {
    await open(page, "/plan?semana=2026-09-30");
    await expect(page.getByRole("tab", { name: "Lunes 28" })).toBeVisible();
  });
});

test.describe("R2: la lista de la compra sigue la semana vista", () => {
  test("R2: Plan (semana siguiente) → lista de esa semana → volver al Plan en esa semana", async ({ page }) => {
    await open(page, `/plan?semana=${NEXT}`);
    await page.getByRole("link", { name: /Lista de la compra/ }).click();
    await expect(page).toHaveURL(new RegExp(`/plan/compra/?\\?semana=${NEXT}`));
    await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
    // Solo hay Dátiles rellenos (4 dátiles, 15 g de nueces) esa semana
    await expect(tick(page, "Dátiles")).toBeVisible();
    await expect(tick(page, "Brócoli")).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "Plan", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/plan/?\\?semana=${NEXT}`));
    await expect(page.getByRole("tab", { name: "Lunes 28" })).toBeVisible();
  });

  test("R2: desde la semana actual el enlace no lleva parámetro y la lista es la de siempre", async ({ page }) => {
    await open(page, "/plan");
    await page.getByRole("link", { name: /Lista de la compra/ }).click();
    await expect(page).not.toHaveURL(/semana=/);
    await expect(tick(page, "Brócoli")).toBeVisible();
  });

  test("R2/R1: la lista tiene su propia navegación de semanas", async ({ page }) => {
    await open(page, "/plan/compra");
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(`semana=${NEXT}`));
    await expect(tick(page, "Dátiles")).toBeVisible();
    await today(page).click();
    await expect(tick(page, "Brócoli")).toBeVisible();
  });

  test("R2: semana sin plan → «Nada que comprar todavía»", async ({ page }) => {
    await open(page, "/plan/compra?semana=2026-12-07");
    await expect(page.getByText("Nada que comprar todavía")).toBeVisible();
  });

  test("R2: el Plan muestra el recuento de la lista de la semana vista", async ({ page }) => {
    await open(page, "/plan?semana=2026-12-07");
    await expect(page.getByRole("link", { name: /Lista de la compra/ })).toContainText("Nada que comprar todavía");
  });
});

test.describe("R3: estado de la compra por semana", () => {
  test("R3: lo marcado en una semana no afecta a otra y se conserva al volver", async ({ page }) => {
    await open(page, `/plan/compra?semana=${NEXT}`);
    await tick(page, "Dátiles").click();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toBeVisible();

    await today(page).click();
    await expect(tick(page, "Brócoli")).toBeVisible();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toHaveCount(0);

    await next(page).click();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toBeVisible();
  });

  test("R3: persiste al recargar y queda guardado por lunes", async ({ page }) => {
    await open(page, `/plan/compra?semana=${NEXT}`);
    await tick(page, "Dátiles").click();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toBeVisible();
    const stored = await readStored<{ weeks: Record<string, { bought: Record<string, string> }> }>(page, "shopping");
    expect(Object.keys(stored.weeks[NEXT].bought)).toHaveLength(1);
    expect(stored.weeks["2026-09-21"]?.bought ?? {}).toEqual({});
  });

  test("R3: el estado de la semana actual guardado con el formato anterior se conserva", async ({ page }) => {
    const legacy = {
      current: { week: "2026-09-21", bought: {}, overrides: [], moved: {} },
      usage: { [LAST]: { bought: 2, overrides: 0 } },
    };
    await open(page, "/plan/compra", { ...SEED, shopping: legacy });
    await tick(page, "Brócoli").click();
    await page.reload();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toBeVisible();
    const stored = await readStored<{ weeks: Record<string, unknown>; current?: unknown }>(page, "shopping");
    expect(Object.keys(stored.weeks)).toContain("2026-09-21");
  });
});

test.describe("R4: editar el plan en cualquier semana", () => {
  test("R4: asignar y quitar receta en la semana siguiente y en la pasada", async ({ page }) => {
    await open(page, `/plan?semana=${NEXT}`);
    await page.getByRole("tab", { name: "Martes 29" }).click();
    await page.getByRole("button", { name: /^Cena( |$)/ }).click();
    await pickRecipe(page, CREMA_CALABAZA.name);
    const plan = await readStored<Record<string, { mealType: string; recipeId: string }[]>>(page, "weekplan");
    expect(plan["2026-09-29"]).toEqual([{ mealType: "Cena", recipeId: CREMA_CALABAZA.id }]);
    expect(plan[TODAY]).toEqual(SHOPPING_PLAN[TODAY]); // la semana actual no se toca

    await prev(page).click();
    await prev(page).click();
    await page.getByRole("tab", { name: "Lunes 14" }).click();
    await page.getByRole("button", { name: /^Comida( |$)/ }).click();
    await pickRecipe(page, CREMA_CALABAZA.name);
    const after = await readStored<Record<string, { mealType: string; recipeId: string }[]>>(page, "weekplan");
    expect(after[LAST]).toEqual([{ mealType: "Comida", recipeId: CREMA_CALABAZA.id }]);
  });

  test("R4: lo planificado en otra semana se ve al volver a ella", async ({ page }) => {
    await open(page, `/plan?semana=${NEXT}`);
    await expect(page.getByText(DATILES.name).first()).toBeVisible();
    await today(page).click();
    await expect(page.getByText(DATILES.name)).toHaveCount(0);
  });
});

test.describe("R5: «Se usa en» de la semana vista", () => {
  test("R5: el detalle muestra el día correcto de la semana siguiente", async ({ page }) => {
    await open(page, `/plan/compra?semana=${NEXT}`);
    await page.getByRole("button", { name: /^Dátiles/ }).click();
    await expect(page.getByText(/Lunes · Comida · Dátiles rellenos/)).toBeVisible();
  });
});

test.describe("R6: indicación de semana", () => {
  test("R6: la cabecera muestra el rango de fechas de la semana vista", async ({ page }) => {
    await open(page, `/plan?semana=${NEXT}`);
    await expect(weekNav(page)).toContainText("28");
    await expect(weekNav(page)).toContainText("4");
  });

  test("R6: en la semana actual no hay botón «Hoy»; en otra sí", async ({ page }) => {
    await open(page, "/plan");
    await expect(today(page)).toHaveCount(0);
    await prev(page).click();
    await expect(today(page)).toBeVisible();
  });
});

test("R3: el movimiento a la Despensa de otra semana se puede deshacer", async ({ page }) => {
  await open(page, `/plan/compra?semana=${NEXT}`);
  await tick(page, "Dátiles").click();
  await page.getByRole("button", { name: "Pasar 1 comprados a la Despensa" }).click();
  await page.getByRole("dialog", { name: "Pasar a la Despensa" }).getByRole("button", { name: "Añadir 1 a la Despensa" }).click();
  const stored = await readStored<{ weeks: Record<string, { moved: Record<string, string> }>; lastMove?: { week: string } }>(page, "shopping");
  expect(stored.lastMove?.week).toBe(NEXT);
  expect(Object.keys(stored.weeks[NEXT].moved)).toHaveLength(1);

  await page.getByRole("status").getByRole("button", { name: "Deshacer" }).click();
  const after = await readStored<{ weeks: Record<string, { moved: Record<string, string> }>; lastMove?: unknown }>(page, "shopping");
  expect(after.lastMove).toBeUndefined();
  expect(after.weeks[NEXT].moved).toEqual({});
});
