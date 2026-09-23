// Spec: docs/pm/diario-desde-plan/spec.md › Acceptance criteria R1–R8, R10 y Edge cases.
// Tech: docs/pm/diario-desde-plan/tech.md › UI (cada tarjeta de comida es un <section aria-labelledby> con su h3,
// fila pendiente con chip "Pendiente" y botón "Hecho"; "Registrar todo el día" encima de las tarjetas con ≥ 2 pendientes)
// y Testing strategy (E2E).
//
// Datos: tests/fixtures/diario.ts. Hoy = martes 2026-09-22 (signIn fija el reloj). Lucía hace Desayuno, Comida,
// Merienda y Cena; objetivo 1750 kcal. Los kcal se comprueban en el anillo (img "N kcal") y en "N / 1750", nunca en el
// texto de la página: la fila pendiente también muestra los kcal de la receta (tech.md › Spec feedback 4).
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry, WeekPlan } from "@/lib/types";
import { lucia, manuel } from "../fixtures/profiles";
import {
  DIARIO_RECIPES,
  FULL_DAY_PLAN,
  KEFIR,
  LENTEJAS,
  MACARRONES,
  MERLUZA,
  TOMORROW,
  TORTILLA,
  YESTERDAY,
  slot,
} from "../fixtures/diario";
import { readStored, signIn, TODAY } from "./helpers";

const COMIDA_PLAN: WeekPlan = { [TODAY]: [slot("Comida", LENTEJAS)] };

async function openDiario(page: Page, data: Record<string, unknown> = {}) {
  await signIn(page, { profile: lucia, recipes: DIARIO_RECIPES, weekplan: COMIDA_PLAN, entries: [], ...data });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

/** Tarjeta de una comida: <section aria-labelledby> cuyo h3 es el nombre de la comida. */
const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const ring = (page: Page, kcal: number) => page.getByRole("img", { name: `${kcal} kcal`, exact: true });
const totalText = (page: Page, kcal: number) => page.getByText(`${kcal} / ${lucia.calorieGoal}`, { exact: true });
const pendingLabels = (page: Page) => page.getByText("Pendiente", { exact: true });
const doneButtons = (page: Page) => page.getByRole("button", { name: "Hecho", exact: true });
const logAllButton = (page: Page) => page.getByRole("button", { name: "Registrar todo el día" });
const dateInput = (page: Page) => page.locator('input[type="date"]');

async function expectNoPending(page: Page) {
  await expect(pendingLabels(page)).toHaveCount(0);
  await expect(doneButtons(page)).toHaveCount(0);
  await expect(logAllButton(page)).toHaveCount(0);
}

// ---------------------------------------------------------------------------

test.describe("R1: el Diario muestra las franjas planificadas sin entrada", () => {
  test('"Comida" muestra "Lentejas" con sus kcal como pendiente, con "Hecho"', async ({ page }) => {
    await openDiario(page);
    const comida = meal(page, "Comida");
    await expect(comida.getByText("Lentejas", { exact: true })).toBeVisible();
    await expect(comida.getByText("520 kcal", { exact: true })).toBeVisible();
    await expect(comida.getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(comida.getByRole("button", { name: "Hecho", exact: true })).toBeVisible();
  });

  test("sin plan para la fecha no hay pendientes y el Diario se ve como hoy", async ({ page }) => {
    await openDiario(page, {
      weekplan: {},
      entries: [{ id: "e1", date: TODAY, mealType: "Cena", customName: "Pollo con arroz", calories: 600, protein: 40, carbs: 60, fat: 15 }],
    });
    await expectNoPending(page);
    // Solo la tarjeta con entradas, como antes
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Cena"]);
  });

  test("si todas las franjas planificadas ya tienen entrada, no hay pendientes", async ({ page }) => {
    await openDiario(page, {
      weekplan: FULL_DAY_PLAN,
      entries: [
        { id: "e1", date: TODAY, mealType: "Desayuno", recipeId: TORTILLA.id, calories: 300, protein: 20, carbs: 2, fat: 22 },
        { id: "e2", date: TODAY, mealType: "Comida", customName: "Ensalada", calories: 250, protein: 8, carbs: 20, fat: 14 },
        { id: "e3", date: TODAY, mealType: "Cena", recipeId: MERLUZA.id, calories: 410, protein: 35, carbs: 20, fat: 18 },
      ],
    });
    await expect(meal(page, "Comida").getByText("Ensalada")).toBeVisible();
    await expectNoPending(page);
  });
});

test.describe('R2: "Hecho" registra la receta planificada', () => {
  test("crea exactamente una entrada con fecha de hoy, Comida, Lentejas y sus cuatro macros", async ({ page }) => {
    await openDiario(page);
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();
    await expect(pendingLabels(page)).toHaveCount(0);

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: TODAY,
      mealType: "Comida",
      recipeId: LENTEJAS.id,
      calories: 520,
      protein: 30,
      carbs: 60,
      fat: 12,
    });
    expect(entries[0].customName).toBeUndefined();
    // docs/pm/raciones/spec.md › R7: "Hecho" registra 1 ración, sin multiplicador guardado
    expect(entries[0]).not.toHaveProperty("servings");
  });

  test("con ayer seleccionado, la entrada lleva la fecha de ayer", async ({ page }) => {
    await openDiario(page, { weekplan: { [YESTERDAY]: [slot("Comida", LENTEJAS)] } });
    await expectNoPending(page); // hoy no tiene plan
    await dateInput(page).fill(YESTERDAY);
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();
    await expect(pendingLabels(page)).toHaveCount(0);

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: YESTERDAY, mealType: "Comida", recipeId: LENTEJAS.id });
  });

  test("Edge case: doble toque en \"Hecho\" crea una sola entrada", async ({ page }) => {
    await openDiario(page);
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).dblclick();
    await expect(meal(page, "Comida").getByText("Lentejas", { exact: true })).toBeVisible();
    await expect(pendingLabels(page)).toHaveCount(0);
    expect(await readStored<MealEntry[]>(page, "entries")).toHaveLength(1);
  });

  // review.md › Non-blocking 2: con 2 pendientes, "Registrar todo el día" desaparece tras el primer toque y las
  // tarjetas suben; el segundo no debe registrar la otra franja.
  test("Edge case: doble toque en \"Hecho\" con 2 pendientes registra solo esa franja", async ({ page }) => {
    await openDiario(page, { weekplan: { [TODAY]: [slot("Comida", LENTEJAS), slot("Cena", MERLUZA)] } });
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).dblclick();
    await expect(meal(page, "Comida").getByRole("button", { name: "Eliminar" })).toBeVisible();
    await expect(meal(page, "Cena").getByText("Pendiente", { exact: true })).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ mealType: "Comida", recipeId: LENTEJAS.id });
  });

  // review.md › Non-blocking 1: la protección no depende de dónde caiga el segundo clic. Se envía un clic con
  // detail 2 (el segundo de un doble toque) directamente sobre la ✕ y sobre el "Hecho" de otra tarjeta.
  test("Edge case: el segundo clic de un doble toque no borra ni registra, caiga donde caiga", async ({ page }) => {
    await openDiario(page, { weekplan: { [TODAY]: [slot("Comida", LENTEJAS), slot("Cena", MERLUZA)] } });
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();

    for (const target of [
      meal(page, "Comida").getByRole("button", { name: "Eliminar" }),
      meal(page, "Cena").getByRole("button", { name: "Hecho", exact: true }),
    ]) {
      // Al centro de la pantalla: abajo lo taparía la barra de navegación fija
      await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      const [x, y] = [box!.x + box!.width / 2, box!.y + box!.height / 2];
      expect(await target.evaluate((el, [x, y]) => el.contains(document.elementFromPoint(x, y)), [x, y])).toBe(true);
      await page.mouse.move(x, y);
      await page.mouse.down({ clickCount: 2 });
      await page.mouse.up({ clickCount: 2 });
    }

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ mealType: "Comida", recipeId: LENTEJAS.id });
    await expect(meal(page, "Cena").getByText("Pendiente", { exact: true })).toBeVisible();
  });

  // review.md › Non-blocking 3: varios botones "Hecho" se distinguen por su descripción (la receta).
  test('cada "Hecho" se describe con el nombre de su receta', async ({ page }) => {
    await openDiario(page, { weekplan: { [TODAY]: [slot("Comida", LENTEJAS), slot("Cena", MERLUZA)] } });
    await expect(meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true })).toHaveAccessibleDescription("Lentejas");
    await expect(meal(page, "Cena").getByRole("button", { name: "Hecho", exact: true })).toHaveAccessibleDescription(
      "Merluza al horno",
    );
  });
});

test.describe("R3: tras registrar, la franja deja de estar pendiente y cuenta en los totales", () => {
  test("la fila pendiente desaparece, Comida lista Lentejas con ✕ y el total sube 520", async ({ page }) => {
    await openDiario(page);
    await expect(ring(page, 0)).toBeVisible();
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();

    const comida = meal(page, "Comida");
    await expect(comida.getByText("Pendiente", { exact: true })).toHaveCount(0);
    await expect(comida.getByRole("button", { name: "Hecho", exact: true })).toHaveCount(0);
    await expect(comida.getByText("Lentejas", { exact: true })).toBeVisible();
    await expect(comida.getByRole("button", { name: "Eliminar" })).toBeVisible();
    await expect(ring(page, 520)).toBeVisible();
    await expect(totalText(page, 520)).toBeVisible();
  });

  test("al recargar después de \"Hecho\", sigue sin estar pendiente", async ({ page }) => {
    await openDiario(page);
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();
    await expect(pendingLabels(page)).toHaveCount(0);

    await page.reload();
    await expect(meal(page, "Comida").getByText("Lentejas", { exact: true })).toBeVisible();
    await expect(meal(page, "Comida").getByRole("button", { name: "Eliminar" })).toBeVisible();
    await expectNoPending(page);
    await expect(ring(page, 520)).toBeVisible();
  });
});

test.describe("R4: registrar algo distinto a lo planificado", () => {
  test('una entrada personalizada "Ensalada" en Comida quita Lentejas de pendientes y no toca el plan', async ({ page }) => {
    await openDiario(page);
    await expect(meal(page, "Comida").getByText("Pendiente", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Añadir comida" }).click();
    await page.getByLabel("Comida del día").selectOption("Comida");
    await page.getByRole("button", { name: "Personalizada" }).click();
    await page.getByPlaceholder("Nombre").fill("Ensalada");
    await page.getByLabel("kcal", { exact: true }).fill("250");
    await page.getByRole("button", { name: "Añadir", exact: true }).click();

    const comida = meal(page, "Comida");
    await expect(comida.getByText("Ensalada", { exact: true })).toBeVisible();
    await expect(comida.getByText("Lentejas", { exact: true })).toHaveCount(0);
    await expectNoPending(page);
    await expect(ring(page, 250)).toBeVisible(); // solo cuenta la Ensalada
    expect(await readStored<WeekPlan>(page, "weekplan")).toEqual(COMIDA_PLAN);

    // Plan sigue mostrando Lentejas en la Comida de hoy (Plan abre el día de hoy)
    await page.goto("/plan");
    await expect(page.getByRole("button", { name: "Comida Lentejas" })).toBeVisible();
  });

  test("una entrada en Cena no quita la Comida pendiente", async ({ page }) => {
    await openDiario(page);
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await page.getByLabel("Comida del día").selectOption("Cena");
    await page.getByRole("button", { name: "Personalizada" }).click();
    await page.getByPlaceholder("Nombre").fill("Ensalada");
    await page.getByRole("button", { name: "Añadir", exact: true }).click();

    await expect(meal(page, "Cena").getByText("Ensalada", { exact: true })).toBeVisible();
    await expect(meal(page, "Comida").getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true })).toBeVisible();
  });
});

test.describe("R5: sin pendientes en días futuros", () => {
  test("mañana, con plan, no muestra pendientes ni \"Hecho\" ni \"Registrar todo el día\"", async ({ page }) => {
    const twoSlots = [slot("Comida", LENTEJAS), slot("Cena", MERLUZA)];
    await openDiario(page, { weekplan: { [TODAY]: twoSlots, [TOMORROW]: twoSlots } });
    await expect(logAllButton(page)).toBeVisible(); // hoy sí (control: el mismo plan)

    await dateInput(page).fill(TOMORROW);
    await expectNoPending(page);
    await expect(page.getByText("Lentejas", { exact: true })).toHaveCount(0);
  });
});

test.describe("R6: borrar la entrada vuelve a dejarla pendiente", () => {
  test('"Hecho" y luego ✕ → Comida vuelve a mostrar Lentejas como pendiente', async ({ page }) => {
    await openDiario(page);
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();
    await meal(page, "Comida").getByRole("button", { name: "Eliminar" }).click();

    const comida = meal(page, "Comida");
    await expect(comida.getByText("Lentejas", { exact: true })).toBeVisible();
    await expect(comida.getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(comida.getByRole("button", { name: "Hecho", exact: true })).toBeVisible();
    expect(await readStored<MealEntry[]>(page, "entries")).toEqual([]);
    await expect(ring(page, 0)).toBeVisible();
  });
});

test.describe("R7: las pendientes se distinguen de las entradas y no cuentan", () => {
  test("2 pendientes y ninguna entrada → anillo a 0 y ambas marcadas \"Pendiente\"", async ({ page }) => {
    await openDiario(page, { weekplan: { [TODAY]: [slot("Comida", LENTEJAS), slot("Cena", MERLUZA)] } });
    await expect(meal(page, "Comida").getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(meal(page, "Cena").getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(ring(page, 0)).toBeVisible();
    await expect(totalText(page, 0)).toBeVisible();
    // No se leen como entradas registradas: sin ✕
    await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  });
});

test.describe('R8: "Registrar todo el día"', () => {
  test("con 3 pendientes registra las 3, cada una con los macros de su receta, y no queda ninguna", async ({ page }) => {
    await openDiario(page, { weekplan: FULL_DAY_PLAN });
    await expect(doneButtons(page)).toHaveCount(3);
    await logAllButton(page).click();

    await expectNoPending(page);
    const entries = await readStored<MealEntry[]>(page, "entries");
    const byMeal = (mt: string) => entries.find((e) => e.mealType === mt);
    expect(entries).toHaveLength(3);
    expect(byMeal("Desayuno")).toMatchObject({ date: TODAY, recipeId: TORTILLA.id, calories: 300, protein: 20, carbs: 2, fat: 22 });
    expect(byMeal("Comida")).toMatchObject({ date: TODAY, recipeId: LENTEJAS.id, calories: 520, protein: 30, carbs: 60, fat: 12 });
    expect(byMeal("Cena")).toMatchObject({ date: TODAY, recipeId: MERLUZA.id, calories: 410, protein: 35, carbs: 20, fat: 18 });
    await expect(ring(page, 1230)).toBeVisible();
  });

  test("es un botón encima de las tarjetas de comida", async ({ page }) => {
    await openDiario(page, { weekplan: FULL_DAY_PLAN });
    const button = await logAllButton(page).boundingBox();
    const firstCard = await meal(page, "Desayuno").boundingBox();
    expect(button && firstCard && button.y + button.height <= firstCard.y).toBe(true);
  });

  test("con una sola pendiente no se muestra", async ({ page }) => {
    await openDiario(page);
    await expect(doneButtons(page)).toHaveCount(1);
    await expect(logAllButton(page)).toHaveCount(0);
  });
});

test.describe("R9: orden de las comidas", () => {
  test("las pendientes salen en el orden canónico aunque el plan esté desordenado", async ({ page }) => {
    await openDiario(page, {
      weekplan: { [TODAY]: [slot("Cena", MERLUZA), slot("Merienda", KEFIR), slot("Desayuno", TORTILLA), slot("Comida", LENTEJAS)] },
    });
    await expect(doneButtons(page)).toHaveCount(4);
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Desayuno", "Comida", "Merienda", "Cena"]);
  });
});

test.describe("R10: aviso de alérgenos en la pendiente", () => {
  test('con alergia a la lactosa, "Macarrones con queso" pendiente muestra "⚠ contiene Lactosa"', async ({ page }) => {
    await openDiario(page, {
      profile: { ...lucia, allergies: { preset: ["lactosa"], custom: [] } },
      weekplan: { [TODAY]: [slot("Comida", MACARRONES), slot("Cena", MERLUZA)] },
    });
    await expect(meal(page, "Comida").getByText("⚠ contiene Lactosa")).toBeVisible();
    await expect(meal(page, "Cena").getByText(/contiene/)).toHaveCount(0);
  });
});

test.describe("Edge cases", () => {
  test("una comida que ya no está en el perfil (Merienda para Manuel) no sale como pendiente", async ({ page }) => {
    await openDiario(page, { profile: manuel, weekplan: { [TODAY]: [slot("Merienda", KEFIR), slot("Comida", LENTEJAS)] } });
    await expect(meal(page, "Comida").getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(meal(page, "Merienda")).toHaveCount(0);
    await expect(page.getByText("Batido de kéfir")).toHaveCount(0);
  });
});
