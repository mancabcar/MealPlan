// Spec: docs/pm/raciones/spec.md › Criterios de aceptación R1–R8, Flujo (paso 5) y Casos límite.
// Tech: docs/pm/raciones/tech.md › UI (campo "Raciones" con <label> visible, botones "Quitar 0,25 raciones" /
// "Añadir 0,25 raciones", error `SERVINGS_ERROR` con role="alert" y aria-invalid al pulsar "Añadir", vista previa
// "= N kcal", etiqueta "<Receta> × 0,5" en la fila, kcal de la fila con Math.round) y Testing strategy (E2E).
//
// Datos: tests/fixtures/diario.ts (Guiso 600/40/60/20, Caldo 150 kcal). Hoy = martes 2026-09-22 (signIn fija el
// reloj). Lucía hace Desayuno, Comida, Merienda y Cena, y el formulario abre en "Comida"; objetivo 1750 kcal. Sin
// plan por defecto, así que no hay pendientes (la fila pendiente también mostraría kcal). Los kcal del día se
// comprueban en el anillo (img "N kcal") y en "N / 1750".
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { CALDO, GUISO, LENTEJAS, RACIONES_RECIPES, slot } from "../fixtures/diario";
import { readStored, signIn, TODAY } from "./helpers";

const SERVINGS_ERROR = "Entre 0,25 y 4, en pasos de 0,25";

async function openDiario(page: Page, data: Record<string, unknown> = {}) {
  await signIn(page, { profile: lucia, recipes: RACIONES_RECIPES, weekplan: {}, entries: [], ...data });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

/** Tarjeta de una comida: <section aria-labelledby> cuyo h3 es el nombre de la comida. */
const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const ring = (page: Page, kcal: number) => page.getByRole("img", { name: `${kcal} kcal`, exact: true });
const totalText = (page: Page, kcal: number) => page.getByText(`${kcal} / ${lucia.calorieGoal}`, { exact: true });

const servingsInput = (page: Page) => page.getByLabel("Raciones", { exact: true });
const minus = (page: Page) => page.getByRole("button", { name: "Quitar 0,25 raciones" });
const plus = (page: Page) => page.getByRole("button", { name: "Añadir 0,25 raciones" });
const addButton = (page: Page) => page.getByRole("button", { name: "Añadir", exact: true });
const servingsError = (page: Page) => page.getByRole("alert").filter({ hasText: SERVINGS_ERROR });
/** El desplegable de recetas no tiene nombre accesible: es el que ofrece "Elige una receta...". */
const recipeSelect = (page: Page) =>
  page.getByRole("combobox").filter({ has: page.locator("option", { hasText: "Elige una receta..." }) });

async function openAddForm(page: Page) {
  await page.getByRole("button", { name: "Añadir comida" }).click();
  await expect(page.getByRole("heading", { name: "Añadir comida" })).toBeVisible();
}

/** Abre el formulario, elige la receta y, si se da, escribe las raciones. No pulsa "Añadir". */
async function fillRecipe(page: Page, recipeId: string, servings?: string) {
  await openAddForm(page);
  await recipeSelect(page).selectOption(recipeId);
  if (servings !== undefined) await servingsInput(page).fill(servings);
}

async function logRecipe(page: Page, recipeId: string, servings?: string) {
  await fillRecipe(page, recipeId, servings);
  await addButton(page).click();
}

// ---------------------------------------------------------------------------

test.describe("R1 · R2: registrar una fracción o un múltiplo de una receta", () => {
  test('al abrir el formulario, "Raciones" vale 1', async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    await expect(servingsInput(page)).toHaveValue("1");
  });

  test("0,5 raciones de Guiso (600/40/60/20) → entrada 300/20/30/10 y el total del día sube 300", async ({ page }) => {
    await openDiario(page);
    await expect(ring(page, 0)).toBeVisible();
    await logRecipe(page, GUISO.id, "0,5");

    await expect(ring(page, 300)).toBeVisible();
    await expect(totalText(page, 300)).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: TODAY,
      mealType: "Comida",
      recipeId: GUISO.id,
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
    });
  });

  test("1,5 raciones de Guiso → 900 kcal y 60 / 90 / 30 g", async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "1,5");

    await expect(ring(page, 900)).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ recipeId: GUISO.id, calories: 900, protein: 60, carbs: 90, fat: 30 });
  });

  test("sin tocar el campo → los macros exactos de la receta, sin multiplicador guardado", async ({ page }) => {
    await openDiario(page);
    await fillRecipe(page, GUISO.id);
    await expect(servingsInput(page)).toHaveValue("1");
    await addButton(page).click();

    await expect(ring(page, 600)).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ recipeId: GUISO.id, calories: 600, protein: 40, carbs: 60, fat: 20 });
    expect(entries[0]).not.toHaveProperty("servings");
  });

  test("los valores no enteros se muestran redondeados y el redondeo no acumula error (3 × 0,25 de 150 kcal → 113)", async ({
    page,
  }) => {
    await openDiario(page);
    await logRecipe(page, CALDO.id, "0,25");
    const comida = meal(page, "Comida");
    // 37,5 kcal guardadas; la fila las muestra redondeadas
    await expect(comida.getByText("38 kcal", { exact: true })).toBeVisible();
    await expect(ring(page, 38)).toBeVisible();

    await logRecipe(page, CALDO.id, "0,25");
    await logRecipe(page, CALDO.id, "0,25");
    await expect(comida.getByText("38 kcal", { exact: true })).toHaveCount(3);
    // 112,5 → 113, no 3 × 38 = 114
    await expect(ring(page, 113)).toBeVisible();
    await expect(totalText(page, 113)).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries.map((e) => e.calories)).toEqual([37.5, 37.5, 37.5]);
  });
});

test.describe("R3 · R4: la entrada guarda el multiplicador y la lista lo muestra", () => {
  test('tras 0,5 raciones, la entrada guarda servings: 0.5 y la lista muestra "Guiso × 0,5"', async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "0,5");

    await expect(meal(page, "Comida").getByText("Guiso × 0,5", { exact: true })).toBeVisible();
    await expect(meal(page, "Comida").getByText("300 kcal", { exact: true })).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries[0]).toMatchObject({ recipeId: GUISO.id, servings: 0.5 });
  });

  test('con 1,5 raciones la lista muestra "Guiso × 1,5"', async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "1,5");
    await expect(meal(page, "Comida").getByText("Guiso × 1,5", { exact: true })).toBeVisible();
  });

  test("tras 1 ración la lista muestra solo el nombre de la receta", async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "1");

    const comida = meal(page, "Comida");
    await expect(comida.getByText("Guiso", { exact: true })).toBeVisible();
    await expect(comida.getByText(/×/)).toHaveCount(0);
    await expect(ring(page, 600)).toBeVisible();
  });

  test("tras recargar, la etiqueta y los macros se conservan", async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "0,5");
    await expect(meal(page, "Comida").getByText("Guiso × 0,5", { exact: true })).toBeVisible();

    await page.reload();
    await expect(meal(page, "Comida").getByText("Guiso × 0,5", { exact: true })).toBeVisible();
    await expect(ring(page, 300)).toBeVisible();
    await expect(totalText(page, 300)).toBeVisible();
  });
});

test.describe("R5: las entradas anteriores (sin multiplicador) son 1 ración", () => {
  test("una entrada de receta guardada sin servings mantiene sus kcal y no muestra ninguna etiqueta ×", async ({ page }) => {
    await openDiario(page, {
      entries: [
        { id: "old-1", date: TODAY, mealType: "Comida", recipeId: GUISO.id, calories: 600, protein: 40, carbs: 60, fat: 20 },
        { id: "old-2", date: TODAY, mealType: "Cena", recipeId: LENTEJAS.id, calories: 520, protein: 30, carbs: 60, fat: 12 },
      ],
    });
    await expect(meal(page, "Comida").getByText("Guiso", { exact: true })).toBeVisible();
    await expect(meal(page, "Cena").getByText("Lentejas", { exact: true })).toBeVisible();
    await expect(meal(page, "Comida").getByText("600 kcal", { exact: true })).toBeVisible();
    await expect(meal(page, "Cena").getByText("520 kcal", { exact: true })).toBeVisible();
    await expect(page.getByRole("region").getByText(/×/)).toHaveCount(0);
    await expect(ring(page, 1120)).toBeVisible();
    // Sin reescritura de datos
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries.every((e) => !("servings" in e))).toBe(true);
  });
});

test.describe("R6: coma o punto decimal, y valores no válidos", () => {
  test('"0,75" y "0.75" se aceptan y dan el mismo resultado (450 kcal)', async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "0,75");
    await expect(ring(page, 450)).toBeVisible();
    await logRecipe(page, GUISO.id, "0.75");
    await expect(ring(page, 900)).toBeVisible();

    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(2);
    for (const e of entries) expect(e).toMatchObject({ calories: 450, protein: 30, carbs: 45, fat: 15, servings: 0.75 });
    await expect(meal(page, "Comida").getByText("Guiso × 0,75", { exact: true })).toHaveCount(2);
  });

  for (const value of ["0", "0,1", "4,25", "5", "abc", ""]) {
    test(`"${value}" no añade la entrada y muestra "${SERVINGS_ERROR}" junto al campo`, async ({ page }) => {
      await openDiario(page);
      await fillRecipe(page, GUISO.id, value);
      await addButton(page).click();

      await expect(servingsError(page)).toBeVisible();
      await expect(servingsInput(page)).toHaveAttribute("aria-invalid", "true");
      await expect(servingsInput(page)).toHaveAccessibleDescription(SERVINGS_ERROR);
      // El formulario sigue abierto y no se ha registrado nada
      await expect(servingsInput(page)).toBeVisible();
      await expect(ring(page, 0)).toBeVisible();
      expect(await readStored<MealEntry[]>(page, "entries")).toEqual([]);
    });
  }

  for (const [value, kcal] of [
    ["0,25", 150],
    ["4", 2400],
  ] as const) {
    test(`el extremo "${value}" se acepta (${kcal} kcal)`, async ({ page }) => {
      await openDiario(page);
      await logRecipe(page, GUISO.id, value);
      await expect(ring(page, kcal)).toBeVisible();
      await expect(servingsError(page)).toHaveCount(0);
      expect(await readStored<MealEntry[]>(page, "entries")).toHaveLength(1);
    });
  }

  // tech.md › Spec feedback 2: se valida al pulsar "Añadir" y el mensaje se borra al editar el campo
  test("el mensaje no sale al teclear, solo al pulsar \"Añadir\", y se borra al editar el campo", async ({ page }) => {
    await openDiario(page);
    await fillRecipe(page, GUISO.id, "5");
    await expect(servingsError(page)).toHaveCount(0);
    await addButton(page).click();
    await expect(servingsError(page)).toBeVisible();

    await servingsInput(page).fill("0,5");
    await expect(servingsError(page)).toHaveCount(0);
    await expect(servingsInput(page)).not.toHaveAttribute("aria-invalid", "true");
    await addButton(page).click();
    await expect(ring(page, 300)).toBeVisible();
  });
});

test.describe('R7: "Hecho" y "Registrar todo el día" registran 1 ración', () => {
  test('"Hecho" en un pendiente de Guiso crea una entrada de 600 kcal sin multiplicador ni etiqueta ×', async ({ page }) => {
    await openDiario(page, { weekplan: { [TODAY]: [slot("Comida", GUISO)] } });
    await meal(page, "Comida").getByRole("button", { name: "Hecho", exact: true }).click();

    const comida = meal(page, "Comida");
    await expect(comida.getByRole("button", { name: "Eliminar" })).toBeVisible();
    await expect(comida.getByText("Guiso", { exact: true })).toBeVisible();
    await expect(comida.getByText(/×/)).toHaveCount(0);
    await expect(ring(page, 600)).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ recipeId: GUISO.id, calories: 600, protein: 40, carbs: 60, fat: 20 });
    expect(entries[0]).not.toHaveProperty("servings");
  });

  test('"Registrar todo el día" registra cada receta con 1 ración', async ({ page }) => {
    await openDiario(page, { weekplan: { [TODAY]: [slot("Comida", GUISO), slot("Cena", LENTEJAS)] } });
    await page.getByRole("button", { name: "Registrar todo el día" }).click();

    await expect(ring(page, 1120)).toBeVisible();
    await expect(page.getByRole("region").getByText(/×/)).toHaveCount(0);
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(2);
    for (const e of entries) expect(e).not.toHaveProperty("servings");
  });
});

test.describe("R8: botones − / + de 0,25", () => {
  test("con el valor en 1, pulsar − lo deja en 0,75", async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    await minus(page).click();
    await expect(servingsInput(page)).toHaveValue("0,75");
  });

  test("+ sube de 0,25 en 0,25", async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    await plus(page).click();
    await expect(servingsInput(page)).toHaveValue("1,25");
    await plus(page).click();
    await expect(servingsInput(page)).toHaveValue("1,5");
  });

  test("con 0,25, − está deshabilitado", async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    for (let i = 0; i < 3; i++) await minus(page).click();
    await expect(servingsInput(page)).toHaveValue("0,25");
    await expect(minus(page)).toBeDisabled();
    await expect(plus(page)).toBeEnabled();
  });

  test("con 4, + está deshabilitado", async ({ page }) => {
    await openDiario(page);
    await openAddForm(page);
    for (let i = 0; i < 12; i++) await plus(page).click();
    await expect(servingsInput(page)).toHaveValue("4");
    await expect(plus(page)).toBeDisabled();
    await expect(minus(page)).toBeEnabled();
  });

  test("registrar con − deja media ración sin teclear (1 → 0,75 → 0,5)", async ({ page }) => {
    await openDiario(page);
    await fillRecipe(page, GUISO.id);
    await minus(page).click();
    await minus(page).click();
    await expect(servingsInput(page)).toHaveValue("0,5");
    await addButton(page).click();
    await expect(meal(page, "Comida").getByText("Guiso × 0,5", { exact: true })).toBeVisible();
    await expect(ring(page, 300)).toBeVisible();
  });
});

test.describe("R9: vista previa de kcal en el formulario", () => {
  test('con Guiso y 0,5 raciones se ve "= 300 kcal" antes de pulsar "Añadir"', async ({ page }) => {
    await openDiario(page);
    await fillRecipe(page, GUISO.id, "0,5");
    await expect(page.getByText("= 300 kcal", { exact: true })).toBeVisible();
    await plus(page).click();
    await expect(page.getByText("= 450 kcal", { exact: true })).toBeVisible();
    // Aún no se ha registrado nada
    await expect(ring(page, 0)).toBeVisible();
    expect(await readStored<MealEntry[]>(page, "entries")).toEqual([]);
  });
});

test.describe("Flujo y casos límite", () => {
  test('flujo paso 5: tras añadir 0,5, al volver a abrir el formulario "Raciones" vale 1', async ({ page }) => {
    await openDiario(page);
    await logRecipe(page, GUISO.id, "0,5");
    await expect(ring(page, 300)).toBeVisible();
    await openAddForm(page);
    await expect(servingsInput(page)).toHaveValue("1");
  });

  test('cancelar y volver a abrir también deja "Raciones" en 1', async ({ page }) => {
    await openDiario(page);
    await fillRecipe(page, GUISO.id, "2");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await openAddForm(page);
    await expect(servingsInput(page)).toHaveValue("1");
  });

  test("cambiar de receta en el desplegable mantiene las raciones elegidas", async ({ page }) => {
    await openDiario(page);
    await fillRecipe(page, GUISO.id, "0,5");
    await recipeSelect(page).selectOption(LENTEJAS.id);
    await expect(servingsInput(page)).toHaveValue("0,5");
    await addButton(page).click();
    await expect(meal(page, "Comida").getByText("Lentejas × 0,5", { exact: true })).toBeVisible();
    await expect(ring(page, 260)).toBeVisible();
  });

  test('"Raciones" se ve sin receta elegida y no en modo "Personalizada"; la entrada personalizada no lleva servings', async ({
    page,
  }) => {
    await openDiario(page);
    await openAddForm(page);
    await expect(servingsInput(page)).toBeVisible();
    await servingsInput(page).fill("0,5");

    await page.getByRole("button", { name: "Personalizada" }).click();
    await expect(servingsInput(page)).toHaveCount(0);
    await page.getByPlaceholder("Nombre").fill("Ensalada");
    await page.getByLabel("kcal", { exact: true }).fill("250");
    await addButton(page).click();

    await expect(meal(page, "Comida").getByText("Ensalada", { exact: true })).toBeVisible();
    await expect(ring(page, 250)).toBeVisible();
    const entries = await readStored<MealEntry[]>(page, "entries");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ customName: "Ensalada", calories: 250 });
    expect(entries[0]).not.toHaveProperty("servings");
  });

  test("si la receta se borra después, la entrada conserva sus macros escalados y su etiqueta", async ({ page }) => {
    // La etiqueta sale de la entrada, no de la receta; el nombre cae a "Receta" como hoy
    await openDiario(page, {
      recipes: [LENTEJAS],
      entries: [
        { id: "e1", date: TODAY, mealType: "Comida", recipeId: GUISO.id, calories: 300, protein: 20, carbs: 30, fat: 10, servings: 0.5 },
      ],
    });
    await expect(meal(page, "Comida").getByText("Receta × 0,5", { exact: true })).toBeVisible();
    await expect(meal(page, "Comida").getByText("300 kcal", { exact: true })).toBeVisible();
    await expect(ring(page, 300)).toBeVisible();
  });
});
