// Spec: docs/pm/17-sobras-batch-cooking/spec.md › Acceptance criteria R1–R10 y Flujos.
// Tech: docs/pm/17-sobras-batch-cooking/tech.md › UI y Test coverage › contrato de UI (textos acordados con Manuel):
//   - En cada franja con receta que no es una sobra, botón "Cocinar para varias comidas" (también en la cocinada, para editar).
//   - Ese botón abre un diálogo (role="dialog") con el campo "Raciones cocinadas" (N), una casilla "<Día> · <Comida>" por
//     franja elegible (las ocupadas, disabled) y el botón "Guardar". El diálogo de una sobra tiene "Quitar esta sobra". Un valor de N o una selección inválidos muestran un role="alert" en el diálogo.
//   - La cocinada muestra el texto "Cocinar ×N"; cada sobra, "Sobras · de <Día>" (nombre del día de la cocinada).
//   - Tocar la fila de una sobra abre el diálogo de su tanda (no hay select de receta).
//   - Borrar o cambiar la receta de una cocinada con sobras abre un diálogo con "Borrar todo", "Dejarlas como comidas
//     normales" y "Cancelar"; hasta elegir, el plan guardado no cambia.
//
// Datos: tests/fixtures/sobras.ts. Hoy = martes 2026-09-22 (signIn fija el reloj); Lucía hace Desayuno, Comida, Merienda y
// Cena, objetivo 1750 kcal. Construido en las tareas 3–5 del tech design.
import { expect, test, type Page } from "@playwright/test";
import type { DayPlanSlot, WeekPlan } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  BATCH_ID,
  BATCH_PLAN,
  CREMA_CALABAZA,
  ORPHAN_LEFTOVER_PLAN,
  PAST_BATCH_PLAN,
  PLAIN_PLAN,
  SOBRAS_RECIPES,
  THU,
  TUE,
  WED,
  allSlots,
} from "../fixtures/sobras";
import { readStored, signIn } from "./helpers";

async function openPlan(page: Page, weekplan: WeekPlan = PLAIN_PLAN) {
  await signIn(page, { profile: lucia, recipes: SOBRAS_RECIPES, weekplan, entries: [] });
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Martes", level: 2 })).toBeVisible();
}

/** Fila de una comida del día: su nombre accesible empieza por la comida (los iconos son aria-hidden). */
const row = (page: Page, meal: string) => page.getByRole("button", { name: new RegExp(`^${meal}( |$)`) });
const batchButton = (page: Page) => page.getByRole("button", { name: "Cocinar para varias comidas" });
const dialog = (page: Page) => page.getByRole("dialog");
const servingsField = (page: Page) => dialog(page).getByLabel("Raciones cocinadas");
const target = (page: Page, day: string, meal: string) => dialog(page).getByRole("checkbox", { name: `${day} · ${meal}`, exact: true });
const save = (page: Page) => dialog(page).getByRole("button", { name: "Guardar", exact: true });
const goToDay = (page: Page, day: string) => page.getByRole("tab", { name: new RegExp(`^${day}`) }).click();

const storedPlan = (page: Page) => readStored<WeekPlan>(page, "weekplan");
const slotsOf = async (page: Page) => allSlots(await storedPlan(page));
const isPlain = (s: DayPlanSlot) => s.batchId === undefined && s.cookedServings === undefined && s.leftover === undefined;

/** Crea la tanda del escenario 1: guiso del martes ×3 con sobras el miércoles (Comida) y el jueves (Cena). */
async function cookThree(page: Page) {
  await batchButton(page).click();
  await servingsField(page).fill("3");
  await target(page, "Miércoles", "Comida").check();
  await target(page, "Jueves", "Cena").check();
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Botón de detalle de un ingrediente de la lista: "Nombre · cantidad". */
const item = (page: Page, name: string, amount: string) =>
  page
    .getByRole("region", { name: "Carne y pescado", exact: true })
    .getByRole("button", { name: new RegExp(`^${esc(name)} · ${esc(amount)}`) });

test.describe("R1 / R2: cocinar N raciones y elegir dónde se comen las sobras", () => {
  test("escenario 1: guiso del martes ×3 → 'Cocinar ×3' en la cocinada y 'Sobras · de Martes' el miércoles y el jueves", async ({ page }) => {
    await openPlan(page);
    await cookThree(page);

    await expect(page.getByText("Cocinar ×3", { exact: true })).toBeVisible();
    await goToDay(page, "Miércoles");
    await expect(row(page, "Comida")).toContainText("Guiso de lentejas");
    await expect(page.getByText("Sobras · de Martes", { exact: true })).toBeVisible();
    await goToDay(page, "Jueves");
    await expect(row(page, "Cena")).toContainText("Guiso de lentejas");
    await expect(page.getByText("Sobras · de Martes", { exact: true })).toBeVisible();
  });

  test("se guardan 3 franjas de la receta enlazadas por el mismo batchId, y siguen ahí tras recargar", async ({ page }) => {
    await openPlan(page);
    await cookThree(page);
    await page.reload();

    const plan = await storedPlan(page);
    const origin = plan[TUE].find((s) => s.mealType === "Comida")!;
    const wed = plan[WED].find((s) => s.mealType === "Comida")!;
    const thu = plan[THU].find((s) => s.mealType === "Cena")!;
    expect(origin).toMatchObject({ recipeId: "t-guiso-lentejas", cookedServings: 3 });
    expect(wed).toMatchObject({ recipeId: "t-guiso-lentejas", leftover: true });
    expect(thu).toMatchObject({ recipeId: "t-guiso-lentejas", leftover: true });
    expect(origin.batchId).toEqual(expect.any(String));
    expect([wed.batchId, thu.batchId]).toEqual([origin.batchId, origin.batchId]);
    await expect(page.getByText("Cocinar ×3", { exact: true })).toBeVisible();
  });

  test("N vale de 2 a 8 en enteros: 1, 9, 2,5 y vacío no guardan y muestran un aviso junto al campo", async ({ page }) => {
    await openPlan(page);
    await batchButton(page).click();
    for (const bad of ["1", "9", "2,5", ""]) {
      await servingsField(page).fill(bad);
      await save(page).click();
      await expect(dialog(page).getByRole("alert")).toBeVisible();
    }
    expect(await slotsOf(page)).toHaveLength(2); // sin cambios: solo las 2 franjas del plan de partida
    expect((await slotsOf(page)).every(isPlain)).toBe(true);

    await servingsField(page).fill("8");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("Cocinar ×8", { exact: true })).toBeVisible();
  });

  test("sin usar 'Cocinar para varias comidas', asignar una receta funciona como hoy (sin etiquetas ni campos nuevos)", async ({ page }) => {
    await openPlan(page, {});
    await row(page, "Cena").click();
    await page.getByRole("combobox").selectOption(CREMA_CALABAZA.id);

    await expect(row(page, "Cena")).toContainText("Crema de calabaza");
    await expect(page.getByText(/Cocinar ×|Sobras ·/)).toHaveCount(0);
    const slots = await slotsOf(page);
    expect(slots).toHaveLength(1);
    expect(isPlain(slots[0])).toBe(true);
  });
});

test.describe("R7: franjas que se pueden elegir", () => {
  test("las ocupadas aparecen deshabilitadas; la propia cocinada, lo anterior y otra semana no se ofrecen", async ({ page }) => {
    await openPlan(page);
    await batchButton(page).click();

    await expect(target(page, "Miércoles", "Cena")).toBeDisabled(); // ya tiene la crema de calabaza
    await expect(target(page, "Miércoles", "Comida")).toBeEnabled();
    await expect(target(page, "Martes", "Merienda")).toBeEnabled(); // mismo día, comida posterior
    await expect(target(page, "Domingo", "Cena")).toBeEnabled();
    await expect(target(page, "Martes", "Comida")).toHaveCount(0);
    await expect(target(page, "Martes", "Desayuno")).toHaveCount(0);
    await expect(target(page, "Lunes", "Comida")).toHaveCount(0);
    await expect(target(page, "Miércoles", "Media mañana")).toHaveCount(0); // no está entre las comidas del perfil
  });
});

test.describe("R3: la lista cuenta la tanda una vez, escalada", () => {
  test("cocinada ×3 con 1 sobra elegida → 'Pechuga de pollo · 450 g' (N raciones, no las franjas) y '2 comidas planificadas'", async ({ page }) => {
    const weekplan: WeekPlan = { [TUE]: BATCH_PLAN[TUE], [WED]: BATCH_PLAN[WED] };
    await signIn(page, { profile: lucia, recipes: SOBRAS_RECIPES, weekplan, pantry: [] });
    await page.goto("/plan/compra");
    await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();

    await expect(item(page, "Pechuga de pollo", "450 g")).toBeVisible();
    await expect(page.getByText(/^2 comidas planificadas/)).toBeVisible(); // la sobra cuenta como comida planificada
  });

  test("tras crear la tanda desde el Plan, la lista pasa de 150 g a 450 g", async ({ page }) => {
    await openPlan(page);
    await cookThree(page);
    await page.goto("/plan/compra");
    await expect(item(page, "Pechuga de pollo", "450 g")).toBeVisible();
  });
});

test.describe("R4: borrar la franja cocinada", () => {
  async function askDelete(page: Page) {
    await openPlan(page, BATCH_PLAN);
    await row(page, "Comida").click();
    await page.getByRole("combobox").selectOption(""); // "— Sin asignar —"
    await expect(dialog(page)).toBeVisible();
  }

  test("con sobras se pregunta, con las tres opciones, y hasta elegir no se borra nada", async ({ page }) => {
    await askDelete(page);
    await expect(dialog(page).getByRole("button", { name: "Borrar todo", exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Dejarlas como comidas normales", exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
    expect(await storedPlan(page)).toEqual(BATCH_PLAN);
  });

  test('"Cancelar" no cambia nada', async ({ page }) => {
    await askDelete(page);
    await dialog(page).getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(await storedPlan(page)).toEqual(BATCH_PLAN);
    await expect(page.getByText("Cocinar ×3", { exact: true })).toBeVisible();
  });

  test('"Borrar todo" elimina la cocinada y sus 2 sobras', async ({ page }) => {
    await askDelete(page);
    await dialog(page).getByRole("button", { name: "Borrar todo", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(await slotsOf(page)).toHaveLength(0);
    await expect(row(page, "Comida")).toContainText("Añadir");
  });

  test('"Dejarlas como comidas normales" deja 2 franjas ordinarias y la lista suma 2 raciones sin escalar', async ({ page }) => {
    await askDelete(page);
    await dialog(page).getByRole("button", { name: "Dejarlas como comidas normales", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);

    const slots = await slotsOf(page);
    expect(slots).toHaveLength(2);
    expect(slots.every(isPlain)).toBe(true);
    await goToDay(page, "Miércoles");
    await expect(page.getByText(/Sobras ·/)).toHaveCount(0);

    await page.goto("/plan/compra");
    await expect(item(page, "Pechuga de pollo", "300 g")).toBeVisible();
  });

  test("una cocinada sin sobras enlazadas se borra sin preguntar, como hoy", async ({ page }) => {
    await openPlan(page, { [TUE]: [{ mealType: "Comida", recipeId: "t-guiso-lentejas", batchId: "solo", cookedServings: 3 }] });
    await row(page, "Comida").click();
    await page.getByRole("combobox").selectOption("");
    await expect(dialog(page)).toHaveCount(0);
    expect(await slotsOf(page)).toHaveLength(0);
  });

  test("una franja normal se borra sin preguntar", async ({ page }) => {
    await openPlan(page);
    await row(page, "Comida").click();
    await page.getByRole("combobox").selectOption("");
    await expect(dialog(page)).toHaveCount(0);
    expect((await slotsOf(page)).map((s) => s.recipeId)).toEqual([CREMA_CALABAZA.id]);
  });
});

test.describe("R5: quitar una sobra", () => {
  test("tocar la sobra abre el diálogo de su tanda, sin select de receta; 'Quitar esta sobra' no cambia N ni la lista", async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    await goToDay(page, "Miércoles");
    await row(page, "Comida").click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Quitar esta sobra", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(row(page, "Comida")).toContainText("Añadir");
    const plan = await storedPlan(page);
    expect(plan[WED] ?? []).toHaveLength(0);
    expect(plan[TUE][0]).toMatchObject({ batchId: BATCH_ID, cookedServings: 3 });
    expect(plan[THU][0]).toMatchObject({ batchId: BATCH_ID, leftover: true });

    await page.goto("/plan/compra");
    await expect(item(page, "Pechuga de pollo", "450 g")).toBeVisible();
  });
});

test.describe("R6: cada franja vale 1 ración en macros y en el Diario", () => {
  test("el Plan suma 600 kcal el martes (cocinada) y 600 kcal el miércoles (sobra)", async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    const calories = () => page.getByRole("list", { name: "Macros del día" }).getByRole("listitem").filter({ hasText: "Calorías" });
    await expect(calories().getByText("600 / 1750", { exact: true })).toBeVisible();
    await goToDay(page, "Miércoles");
    await expect(calories().getByText("600 / 1750", { exact: true })).toBeVisible();
  });

  test('"Hecho" en la sobra de hoy registra 1 ración del guiso (600 kcal) sin etiqueta "×"', async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: SOBRAS_RECIPES, weekplan: PAST_BATCH_PLAN, entries: [] });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();

    const comida = page.getByRole("region", { name: "Comida", exact: true });
    await expect(comida.getByText("Pendiente", { exact: true })).toBeVisible();
    await comida.getByRole("button", { name: "Hecho", exact: true }).click();

    await expect(page.getByRole("img", { name: "600 kcal", exact: true })).toBeVisible();
    await expect(comida.getByText(/×/)).toHaveCount(0);
  });
});

test.describe("R8: editar la tanda desde la cocinada", () => {
  test("subir N a 4 y añadir el viernes a la Comida: 3 sobras y la lista pasa a 600 g", async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    await batchButton(page).click();
    await expect(servingsField(page)).toHaveValue("3");
    await expect(target(page, "Miércoles", "Comida")).toBeChecked();
    await expect(target(page, "Jueves", "Cena")).toBeChecked();

    await servingsField(page).fill("4");
    await target(page, "Viernes", "Comida").check();
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("Cocinar ×4", { exact: true })).toBeVisible();

    const slots = await slotsOf(page);
    expect(slots.filter((s) => s.leftover)).toHaveLength(3);
    expect(slots.find((s) => s.cookedServings)).toMatchObject({ cookedServings: 4, batchId: BATCH_ID });

    await page.goto("/plan/compra");
    await expect(item(page, "Pechuga de pollo", "600 g")).toBeVisible();
  });

  test("N no puede bajar de 1 + las sobras: con 2 sobras, 2 no se guarda y 3 sí", async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    await batchButton(page).click();
    await servingsField(page).fill("2");
    await save(page).click();
    await expect(dialog(page).getByRole("alert")).toBeVisible();
    expect(await storedPlan(page)).toEqual(BATCH_PLAN);

    await servingsField(page).fill("3");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test("quitar una sobra desmarcándola en la cocinada la borra sin cambiar N", async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    await batchButton(page).click();
    await target(page, "Jueves", "Cena").uncheck();
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);

    const plan = await storedPlan(page);
    expect(plan[THU] ?? []).toHaveLength(0);
    expect(plan[TUE][0]).toMatchObject({ cookedServings: 3 });
  });
});

test.describe("R9: cambiar la receta de una cocinada con sobras", () => {
  test("dispara el mismo aviso; hasta elegir, el plan no cambia", async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    await row(page, "Comida").click();
    await page.getByRole("combobox").selectOption(CREMA_CALABAZA.id);

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Borrar todo", exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Dejarlas como comidas normales", exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
    expect(await storedPlan(page)).toEqual(BATCH_PLAN);
  });

  test('"Dejarlas como comidas normales": la cocinada pasa a la nueva receta sin tanda y las sobras siguen con el guiso', async ({ page }) => {
    await openPlan(page, BATCH_PLAN);
    await row(page, "Comida").click();
    await page.getByRole("combobox").selectOption(CREMA_CALABAZA.id);
    await dialog(page).getByRole("button", { name: "Dejarlas como comidas normales", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);

    const plan = await storedPlan(page);
    expect(plan[TUE]).toEqual([{ mealType: "Comida", recipeId: CREMA_CALABAZA.id }]);
    expect(plan[WED]).toEqual([{ mealType: "Comida", recipeId: "t-guiso-lentejas" }]);
    expect(plan[THU]).toEqual([{ mealType: "Cena", recipeId: "t-guiso-lentejas" }]);
  });
});

test.describe("R10: planes guardados sin campos de tanda", () => {
  test("el Plan y la lista muestran lo de siempre, sin etiquetas", async ({ page }) => {
    await openPlan(page, PLAIN_PLAN);
    await expect(page.getByText(/Cocinar ×|Sobras ·/)).toHaveCount(0);
    await expect(row(page, "Comida")).toContainText("Guiso de lentejas");

    await page.goto("/plan/compra");
    await expect(item(page, "Pechuga de pollo", "150 g")).toBeVisible();
  });

  test("una sobra huérfana (sin su cocinada) se ve como franja normal y suma 1 ración", async ({ page }) => {
    await signIn(page, { profile: lucia, recipes: SOBRAS_RECIPES, weekplan: ORPHAN_LEFTOVER_PLAN, pantry: [] });
    await page.goto("/plan/compra");
    await expect(item(page, "Pechuga de pollo", "150 g")).toBeVisible();
  });
});
