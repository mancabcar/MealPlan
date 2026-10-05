// Spec: docs/pm/29-raciones-plan/spec.md › Acceptance criteria R1–R9, User flows y Edge cases.
// Tech: docs/pm/29-raciones-plan/tech.md › UI y Testing strategy (E2E). Contrato de UI acordado con Manuel (2026-10-05):
//   - Tarjeta de asignación del Plan: campo con <label> "Raciones" (valor inicial 1, o el de la franja), botones
//     "Quitar 0,25 raciones" / "Añadir 0,25 raciones" y error `SERVINGS_ERROR` con role="alert" y aria-invalid, igual que el
//     Diario. Se valida al elegir la receta: si es inválido no se asigna.
//   - La franja con raciones ≠ 1 muestra el texto "× 0,5" (coma decimal); con 1 no muestra nada.
//   - Cada franja con receta (también las sobras) tiene un botón "Raciones: × 0,5 (Cena)" / "Raciones: 1 (Cena)" que abre
//     un diálogo (role="dialog") con el campo "Raciones" y los botones "Guardar" y "Cancelar".
//   - La tarjeta de un pendiente en el Diario muestra "× 0,5" si las raciones ≠ 1.
//
// Datos: tests/fixtures/raciones-plan.ts. Hoy = martes 2026-09-22 (signIn fija el reloj); Lucía hace Desayuno, Comida,
// Merienda y Cena, objetivo 1750 kcal. Fallan hasta que exista la UI (tech.md › Tasks 4–7).
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry, WeekPlan } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  CREMA_CALABAZA,
  GUISO,
  RACIONES_PLAN_RECIPES,
  TUE,
  WED,
  batchPlanWith,
  guisoTue,
} from "../fixtures/raciones-plan";
import { pickRecipe, readStored, signIn, TODAY } from "./helpers";

const SERVINGS_ERROR = "Entre 0,25 y 4, en pasos de 0,25";

async function openPlan(page: Page, weekplan: WeekPlan = {}) {
  await signIn(page, { profile: lucia, recipes: RACIONES_PLAN_RECIPES, weekplan, entries: [] });
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Martes", level: 2 })).toBeVisible();
}

/** Fila de una comida del día: su nombre accesible empieza por la comida (los iconos son aria-hidden). */
const row = (page: Page, meal: string) => page.getByRole("button", { name: new RegExp(`^${meal}( |$)`) });
const servingsInput = (page: Page) => page.getByLabel("Raciones", { exact: true });
const minus = (page: Page) => page.getByRole("button", { name: "Quitar 0,25 raciones" });
const plus = (page: Page) => page.getByRole("button", { name: "Añadir 0,25 raciones" });
const servingsError = (page: Page) => page.getByRole("alert").filter({ hasText: SERVINGS_ERROR });
const servingsButton = (page: Page, label: string, meal: string) =>
  page.getByRole("button", { name: `Raciones: ${label} (${meal})`, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const dialogField = (page: Page) => dialog(page).getByLabel("Raciones", { exact: true });
const save = (page: Page) => dialog(page).getByRole("button", { name: "Guardar", exact: true });
const calories = (page: Page, text: string) =>
  page.getByRole("list", { name: "Macros del día" }).getByRole("listitem").filter({ hasText: "Calorías" }).getByText(text, { exact: true });

const storedPlan = (page: Page) => readStored<WeekPlan>(page, "weekplan");
const comida = async (page: Page, date = TUE) => (await storedPlan(page))[date]?.find((s) => s.mealType === "Comida");

/** Abre la franja, escribe las raciones (si se dan) y elige la receta. */
async function assign(page: Page, meal: string, recipeName: string, servings?: string) {
  await row(page, meal).click();
  if (servings !== undefined) await servingsInput(page).fill(servings);
  await pickRecipe(page, recipeName);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Botón de detalle de un ingrediente de la lista de la compra: "Nombre · cantidad". */
const item = (page: Page, aisle: string, name: string, amount: string) =>
  page
    .getByRole("region", { name: aisle, exact: true })
    .getByRole("button", { name: new RegExp(`^${esc(name)} · ${esc(amount)}`) });

// ---------------------------------------------------------------------------

test.describe("R2: asignar una receta con raciones", () => {
  test('al abrir la franja, "Raciones" vale 1', async ({ page }) => {
    await openPlan(page);
    await row(page, "Comida").click();
    await expect(servingsInput(page)).toHaveValue("1");
  });

  test('escenario 1: 0,5 raciones de Guiso → la franja muestra "× 0,5" y se guarda servings 0,5', async ({ page }) => {
    await openPlan(page);
    await assign(page, "Comida", GUISO.name, "0,5");
    await expect(row(page, "Comida")).toContainText("Guiso de lentejas");
    await expect(row(page, "Comida")).toContainText("× 0,5");
    expect(await comida(page)).toEqual({ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 });
  });

  test('"0.5" (con punto) también vale', async ({ page }) => {
    await openPlan(page);
    await assign(page, "Comida", GUISO.name, "0.5");
    expect((await comida(page))?.servings).toBe(0.5);
  });

  test("los botones − / + cambian el valor de 0,25 en 0,25", async ({ page }) => {
    await openPlan(page);
    await row(page, "Comida").click();
    await plus(page).click();
    await expect(servingsInput(page)).toHaveValue("1,25");
    await minus(page).click();
    await minus(page).click();
    await expect(servingsInput(page)).toHaveValue("0,75");
  });

  test.describe("valores inválidos: no se asigna y se avisa junto al campo", () => {
    for (const bad of ["0,3", "5", "0", "abc"]) {
      test(`"${bad}"`, async ({ page }) => {
        await openPlan(page);
        await assign(page, "Comida", GUISO.name, bad);
        await expect(servingsError(page)).toBeVisible();
        await expect(servingsInput(page)).toHaveAttribute("aria-invalid", "true");
        expect(await comida(page)).toBeUndefined();
        // Corregir el valor y volver a elegir sí asigna
        await servingsInput(page).fill("1,5");
        await pickRecipe(page, GUISO.name);
        expect((await comida(page))?.servings).toBe(1.5);
      });
    }
  });

  test("R1: con 1 ración la franja guardada no tiene el campo servings y no muestra etiqueta", async ({ page }) => {
    await openPlan(page);
    await assign(page, "Comida", GUISO.name);
    const slot = await comida(page);
    expect(slot).toEqual({ mealType: "Comida", recipeId: GUISO.id });
    expect(slot && "servings" in slot).toBe(false);
    await expect(row(page, "Comida")).not.toContainText("×");
  });

  test("R7: un plan guardado antes de este cambio (sin servings) se ve y suma como 1 ración", async ({ page }) => {
    await openPlan(page, guisoTue());
    await expect(row(page, "Comida")).not.toContainText("×");
    await expect(calories(page, "600 / 1750")).toBeVisible();
    await expect(servingsButton(page, "1", "Comida")).toBeVisible();
  });
});

test.describe("R3: editar las raciones sin reasignar la receta", () => {
  test('escenario 5: "Raciones: × 0,5" abre la hoja con el valor actual; 0,75 y Guardar actualizan la franja', async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await servingsButton(page, "× 0,5", "Comida").click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialogField(page)).toHaveValue("0,5");
    await dialogField(page).fill("0,75");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(row(page, "Comida")).toContainText("Guiso de lentejas");
    await expect(row(page, "Comida")).toContainText("× 0,75");
    await expect(servingsButton(page, "× 0,75", "Comida")).toBeVisible();
    expect(await comida(page)).toEqual({ mealType: "Comida", recipeId: GUISO.id, servings: 0.75 });
  });

  test('desde "Raciones: 1" se puede subir a 2; el valor persiste al recargar', async ({ page }) => {
    await openPlan(page, guisoTue());
    await servingsButton(page, "1", "Comida").click();
    await dialogField(page).fill("2");
    await save(page).click();
    await expect(row(page, "Comida")).toContainText("× 2");

    await page.reload();
    await expect(row(page, "Comida")).toContainText("× 2");
    await expect(servingsButton(page, "× 2", "Comida")).toBeVisible();
  });

  test("volver a 1 en la hoja quita la etiqueta y el campo guardado", async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await servingsButton(page, "× 0,5", "Comida").click();
    await dialogField(page).fill("1");
    await save(page).click();
    await expect(row(page, "Comida")).not.toContainText("×");
    expect(await comida(page)).toEqual({ mealType: "Comida", recipeId: GUISO.id });
  });

  test("un valor inválido en la hoja avisa y no guarda; Cancelar deja todo como estaba", async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await servingsButton(page, "× 0,5", "Comida").click();
    await dialogField(page).fill("0,3");
    await save(page).click();
    await expect(dialog(page).getByRole("alert").filter({ hasText: SERVINGS_ERROR })).toBeVisible();
    expect((await comida(page))?.servings).toBe(0.5);

    await dialog(page).getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await comida(page))?.servings).toBe(0.5);
  });

  test("la hoja de una franja no cambia las demás", async ({ page }) => {
    const plan: WeekPlan = {
      [TUE]: [
        { mealType: "Comida", recipeId: GUISO.id },
        { mealType: "Cena", recipeId: CREMA_CALABAZA.id, servings: 2 },
      ],
    };
    await openPlan(page, plan);
    await servingsButton(page, "1", "Comida").click();
    await dialogField(page).fill("0,5");
    await save(page).click();
    await expect(servingsButton(page, "× 2", "Cena")).toBeVisible();
    expect((await storedPlan(page))[TUE].find((s) => s.mealType === "Cena")?.servings).toBe(2);
  });
});

test.describe("R4: el total del día multiplica por las raciones", () => {
  test("0,5 raciones de Guiso (600 kcal) → Calorías 300 / 1750; con 1,5 → 900 / 1750", async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await expect(calories(page, "300 / 1750")).toBeVisible();
    await servingsButton(page, "× 0,5", "Comida").click();
    await dialogField(page).fill("1,5");
    await save(page).click();
    await expect(calories(page, "900 / 1750")).toBeVisible();
  });

  test("al asignar con 0,5 el resumen del día se actualiza al instante", async ({ page }) => {
    await openPlan(page);
    await assign(page, "Comida", GUISO.name, "0,5");
    await expect(calories(page, "300 / 1750")).toBeVisible();
  });
});

test.describe("R5: la lista de la compra escala por las raciones", () => {
  test("Guiso con 0,5 raciones → 75 g de pechuga (150 g por ración)", async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await page.goto("/plan/compra");
    await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
    await expect(item(page, "Carne y pescado", "Pechuga de pollo", "75 g")).toBeVisible();
  });

  test("cambiar las raciones desde el Plan cambia la lista: 0,5 → 75 g, 1,5 → 225 g", async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await servingsButton(page, "× 0,5", "Comida").click();
    await dialogField(page).fill("1,5");
    await save(page).click();
    await page.goto("/plan/compra");
    await expect(item(page, "Carne y pescado", "Pechuga de pollo", "225 g")).toBeVisible();
  });

  test("dos franjas de la misma receta (0,5 y 1) suman: 225 g", async ({ page }) => {
    const plan: WeekPlan = {
      [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }],
      [WED]: [{ mealType: "Cena", recipeId: GUISO.id }],
    };
    await openPlan(page, plan);
    await page.goto("/plan/compra");
    await expect(item(page, "Carne y pescado", "Pechuga de pollo", "225 g")).toBeVisible();
  });
});

test.describe("R6: Hecho y Registrar todo el día usan las raciones planificadas", () => {
  async function openDiario(page: Page, weekplan: WeekPlan) {
    await signIn(page, { profile: lucia, recipes: RACIONES_PLAN_RECIPES, weekplan, entries: [] });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
  }
  const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
  const entries = (page: Page) => readStored<MealEntry[]>(page, "entries");

  test('la tarjeta del pendiente muestra "× 0,5"; con 1 ración no muestra nada', async ({ page }) => {
    const plan: WeekPlan = {
      [TODAY]: [
        { mealType: "Comida", recipeId: GUISO.id, servings: 0.5 },
        { mealType: "Cena", recipeId: CREMA_CALABAZA.id },
      ],
    };
    await openDiario(page, plan);
    await expect(meal(page, "Comida").getByText(/× 0,5/)).toBeVisible();
    await expect(meal(page, "Cena").getByText(/×/)).toHaveCount(0);
  });

  test('escenario 4: "Hecho" en una franja de 0,5 → entrada con servings 0,5 y macros a la mitad', async ({ page }) => {
    await openDiario(page, { [TODAY]: [{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }] });
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();
    const [entry] = await entries(page);
    expect(entry).toMatchObject({ recipeId: GUISO.id, mealType: "Comida", servings: 0.5, calories: 300, protein: 20, carbs: 30, fat: 10 });
    await expect(meal(page, "Comida").getByText(/× 0,5/)).toBeVisible();
  });

  test('"Registrar todo el día" crea una entrada por franja con sus raciones', async ({ page }) => {
    const plan: WeekPlan = {
      [TODAY]: [
        { mealType: "Comida", recipeId: GUISO.id, servings: 0.5 },
        { mealType: "Cena", recipeId: CREMA_CALABAZA.id, servings: 1.5 },
      ],
    };
    await openDiario(page, plan);
    await page.getByRole("button", { name: "Registrar todo el día" }).click();
    const all = await entries(page);
    expect(all).toHaveLength(2);
    expect(all.find((e) => e.mealType === "Comida")).toMatchObject({ servings: 0.5, calories: 300 });
    expect(all.find((e) => e.mealType === "Cena")).toMatchObject({ servings: 1.5, calories: 600 });
  });

  test("una franja de 1 ración se registra como siempre: sin campo servings", async ({ page }) => {
    await openDiario(page, { [TODAY]: [{ mealType: "Comida", recipeId: GUISO.id }] });
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();
    const [entry] = await entries(page);
    expect(entry.calories).toBe(600);
    expect("servings" in entry).toBe(false);
  });
});

test.describe("R8: raciones en cocinada y sobras (batch de #17)", () => {
  test("una sobra de 0,5 raciones suma 0,5 al día del miércoles y la compra del batch sigue en 450 g", async ({ page }) => {
    await openPlan(page, batchPlanWith({}));
    await page.getByRole("tab", { name: /^Miércoles/ }).click();
    await servingsButton(page, "1", "Comida").click();
    await dialogField(page).fill("0,5");
    await save(page).click();
    await expect(calories(page, "300 / 1750")).toBeVisible();
    expect((await storedPlan(page))[WED][0]).toMatchObject({ leftover: true, servings: 0.5 });

    await page.goto("/plan/compra");
    await expect(item(page, "Carne y pescado", "Pechuga de pollo", "450 g")).toBeVisible();
  });

  test("la cocinada ×3 con 0,5 raciones suma 0,5 el martes y su compra sigue siendo la de 3 raciones", async ({ page }) => {
    await openPlan(page, batchPlanWith({}));
    await servingsButton(page, "1", "Comida").click();
    await dialogField(page).fill("0,5");
    await save(page).click();
    await expect(row(page, "Comida")).toContainText("Cocinar ×3");
    await expect(row(page, "Comida")).toContainText("× 0,5");
    await expect(calories(page, "300 / 1750")).toBeVisible();
    await page.goto("/plan/compra");
    await expect(item(page, "Carne y pescado", "Pechuga de pollo", "450 g")).toBeVisible();
  });
});

test.describe("R9: cambiar la receta o dejar las sobras como normales conserva las raciones", () => {
  test("reasignar otra receta a una franja de 0,5 deja 0,5 en el campo y en la franja", async ({ page }) => {
    await openPlan(page, guisoTue(0.5));
    await row(page, "Comida").click();
    await expect(servingsInput(page)).toHaveValue("0,5");
    await pickRecipe(page, CREMA_CALABAZA.name);
    await expect(row(page, "Comida")).toContainText("Crema de calabaza");
    await expect(row(page, "Comida")).toContainText("× 0,5");
    expect(await comida(page)).toEqual({ mealType: "Comida", recipeId: CREMA_CALABAZA.id, servings: 0.5 });
  });

  test('"Dejarlas como comidas normales": cada sobra de 0,5 queda como franja normal de 0,5 y suma a la compra escalada', async ({ page }) => {
    await openPlan(page, batchPlanWith({ leftover: 0.5 }));
    // Borrar la cocinada (Quitar) con sobras abre el aviso
    await row(page, "Comida").click();
    await page.getByRole("button", { name: "Quitar", exact: true }).click();
    await page.getByRole("button", { name: "Dejarlas como comidas normales" }).click();

    const plan = await storedPlan(page);
    expect(plan[WED]).toEqual([{ mealType: "Comida", recipeId: GUISO.id, servings: 0.5 }]);
    await page.goto("/plan/compra");
    // 2 sobras normales × 0,5 × 150 g = 150 g
    await expect(item(page, "Carne y pescado", "Pechuga de pollo", "150 g")).toBeVisible();
  });
});
