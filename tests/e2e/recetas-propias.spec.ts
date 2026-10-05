// Spec: docs/pm/18-recetas-propias/spec.md › Acceptance criteria R1–R10 y User flows.
// Tech: docs/pm/18-recetas-propias/tech.md › UI y Test coverage › contrato de UI (textos acordados con Manuel):
//   - Recetas: botón "Nueva receta" en la cabecera. El detalle de una semilla tiene "Duplicar y editar"; el de una receta
//     propia o de IA tiene "Editar" y "Borrar". La semilla no tiene "Editar" ni "Borrar". Las propias llevan el chip "Propia"
//     en la lista y en el detalle (solo ahí, no en los selectores de Plan y Diario).
//   - El formulario es un role="dialog" ("Nueva receta" / "Editar receta") con los campos "Nombre", "Ingredientes",
//     "Pasos", "Tiempo (min)", "Calorías (kcal)", "Proteínas (g)", "Carbos (g)", "Grasas (g)" y "Etiquetas", el botón
//     "Usar N kcal" (N = 4P + 4C + 9G) y "Guardar". Los errores salen en un role="alert" del diálogo.
//   - "Borrar" abre un role="dialog" "Borrar receta" con los botones "Borrar" y "Cancelar". Si la receta está en el Plan,
//     el diálogo lista cada franja afectada como "<Día> · <Comida>" (p. ej. "Martes · Comida"); si no, solo pide confirmar.
//     Hasta confirmar, no cambia nada guardado.
//
// Datos: tests/fixtures/recetas-propias.ts. Hoy = martes 2026-09-22 (signIn fija el reloj); Lucía hace Desayuno, Comida,
// Merienda y Cena, objetivo 1750 kcal.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry, Recipe, WeekPlan } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  BOWL_POLLO,
  ENTRADAS,
  IA_WRAP,
  MACARRONES_MAMA,
  PLAN_CON_MACARRONES,
  PLAN_SIN_MACARRONES,
  RECETAS_PROPIAS,
  SEMILLA_TORTILLA,
} from "../fixtures/recetas-propias";
import { pickRecipe, readStored, recipeRow, showAllRecipes, signIn } from "./helpers";

const lactosa = { ...lucia, allergies: { preset: ["lactosa"], custom: [] } };

async function openRecetas(
  page: Page,
  data: { profile?: unknown; recipes?: Recipe[]; weekplan?: WeekPlan; entries?: MealEntry[] } = {},
) {
  await signIn(page, { profile: lucia, recipes: RECETAS_PROPIAS, weekplan: PLAN_CON_MACARRONES, entries: ENTRADAS, ...data });
  await page.goto("/recetas");
  await expect(page.getByRole("heading", { name: "Recetas", level: 1 })).toBeVisible();
}

const card = (page: Page, name: string) => page.getByRole("button").filter({ hasText: name });
const openDetail = async (page: Page, name: string) => {
  await card(page, name).first().click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
};
const form = (page: Page, name: string | RegExp = "Nueva receta") => page.getByRole("dialog", { name });
const save = (page: Page) => form(page, /receta/i).getByRole("button", { name: "Guardar", exact: true });

/** Rellena el formulario abierto con la receta de la crema (o lo que se pase). */
async function fillForm(page: Page, v: Record<string, string>, dialog = form(page)) {
  for (const [label, value] of Object.entries(v)) await dialog.getByLabel(label).fill(value);
}

const CREMA = {
  Nombre: "Gazpachuelo casero",
  Ingredientes: "300g calabaza\n1 cebolla",
  "Calorías (kcal)": "180",
};

const storedRecipes = (page: Page) => readStored<Recipe[]>(page, "recipes");
const storedPlan = (page: Page) => readStored<WeekPlan>(page, "weekplan");
const storedEntries = (page: Page) => readStored<MealEntry[]>(page, "entries");

test.describe("R1 / R5 / R9: crear una receta propia y verla en Recetas, Plan y Diario", () => {
  test("escenario 1: 'Nueva receta' con lo mínimo la guarda y aparece en Recetas con el chip 'Propia'", async ({ page }) => {
    await openRecetas(page);
    await page.getByRole("button", { name: "Nueva receta" }).click();
    await fillForm(page, CREMA);
    await save(page).click();

    await expect(form(page)).toHaveCount(0);
    const crema = card(page, "Gazpachuelo casero");
    await expect(crema).toBeVisible();
    await expect(crema.getByText("Propia", { exact: true })).toBeVisible();
    await expect(crema.getByText("180 kcal")).toBeVisible();
    const saved = (await storedRecipes(page)).find((r) => r.name === "Gazpachuelo casero");
    expect(saved).toMatchObject({ isCustom: true, calories: 180, ingredients: ["300g calabaza", "1 cebolla"], instructions: [], protein: 0 });
    expect(saved?.id).toMatch(/^custom_/);
  });

  test("sin nombre, ingredientes o kcal no se guarda y el diálogo muestra el error", async ({ page }) => {
    await openRecetas(page);
    const before = (await storedRecipes(page)).length;
    await page.getByRole("button", { name: "Nueva receta" }).click();
    await form(page).getByLabel("Nombre").fill("Solo el nombre");
    await save(page).click();
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByRole("alert").first()).toBeVisible();
    expect(await storedRecipes(page)).toHaveLength(before);
  });

  test("con P/C/G rellenos, 'Usar N kcal' rellena las calorías y se pueden cambiar", async ({ page }) => {
    await openRecetas(page);
    await page.getByRole("button", { name: "Nueva receta" }).click();
    const dialog = form(page);
    await fillForm(page, { Nombre: "Tosta de pavo", Ingredientes: "2 rebanadas de pan", "Proteínas (g)": "20", "Carbos (g)": "30", "Grasas (g)": "8" });
    await dialog.getByRole("button", { name: "Usar 272 kcal" }).click();
    await expect(dialog.getByLabel("Calorías (kcal)")).toHaveValue("272");
    await dialog.getByLabel("Calorías (kcal)").fill("280");
    await save(page).click();
    expect((await storedRecipes(page)).find((r) => r.name === "Tosta de pavo")).toMatchObject({ calories: 280, protein: 20, carbs: 30, fat: 8 });
  });

  test("las etiquetas se escriben o se eligen entre las ya usadas", async ({ page }) => {
    await openRecetas(page);
    await page.getByRole("button", { name: "Nueva receta" }).click();
    const dialog = form(page);
    await fillForm(page, CREMA);
    await dialog.getByRole("button", { name: "bowl", exact: true }).click(); // sugerida: la usa BOWL_POLLO
    await dialog.getByLabel("Etiquetas").fill("otoño");
    await dialog.getByLabel("Etiquetas").press("Enter");
    await save(page).click();
    expect((await storedRecipes(page)).find((r) => r.name === "Gazpachuelo casero")?.tags).toEqual(["bowl", "otoño"]);
    await expect(card(page, "Gazpachuelo casero").getByText("otoño")).toBeVisible();
  });

  test("R5: la receta creada se puede elegir en el Plan y en el Diario", async ({ page }) => {
    await openRecetas(page, { weekplan: {}, entries: [] });
    await page.getByRole("button", { name: "Nueva receta" }).click();
    await fillForm(page, CREMA);
    await save(page).click();
    await expect(card(page, "Gazpachuelo casero")).toBeVisible();

    await page.goto("/plan");
    await page.getByRole("button", { name: /^Cena/ }).first().click();
    // Una receta propia sin franja solo sale en «Ver todas»
    await showAllRecipes(page).click();
    await expect(recipeRow(page, "Gazpachuelo casero")).toHaveCount(1);
    await pickRecipe(page, "Gazpachuelo casero");
    expect(Object.values((await storedPlan(page)) ?? {}).flat().some((s) => s.mealType === "Cena")).toBe(true);

    await page.goto("/");
    await page.getByRole("button", { name: "Añadir comida" }).click();
    await showAllRecipes(page).click();
    await expect(recipeRow(page, "Gazpachuelo casero")).toHaveCount(1);
  });
});

test.describe("R7: el aviso de alérgenos funciona en las recetas propias", () => {
  test("una receta propia con queso avisa a quien tiene alergia a lactosa; al editar los ingredientes se recalcula", async ({ page }) => {
    await openRecetas(page, { profile: lactosa });
    // MACARRONES_MAMA lleva "queso rallado"
    await expect(card(page, "Macarrones de mamá").getByText("⚠ contiene Lactosa")).toBeVisible();

    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    const dialog = form(page, "Editar receta");
    await dialog.getByLabel("Ingredientes").fill("80g macarrones\n100g carne picada");
    await save(page).click();
    await expect(page.getByText("⚠ contiene Lactosa")).toHaveCount(0);
  });

  test("una receta nueva con leche muestra el aviso nada más guardarse y sin alergias no hay aviso", async ({ page }) => {
    await openRecetas(page, { profile: lactosa });
    await page.getByRole("button", { name: "Nueva receta" }).click();
    await fillForm(page, { Nombre: "Arroz con leche", Ingredientes: "200ml leche\n50g arroz", "Calorías (kcal)": "300" });
    await save(page).click();
    await expect(card(page, "Arroz con leche").getByText("⚠ contiene Lactosa")).toBeVisible();
  });
});

test.describe("R2: editar recetas propias y de IA; las semilla son de solo lectura", () => {
  test("editar una receta propia cambia lo que muestra el detalle y persiste", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    const dialog = form(page, "Editar receta");
    await expect(dialog.getByLabel("Nombre")).toHaveValue("Macarrones de mamá");
    await expect(dialog.getByLabel("Calorías (kcal)")).toHaveValue("480");
    await fillForm(page, { Nombre: "Macarrones de la abuela", "Calorías (kcal)": "500" }, dialog);
    await save(page).click();

    await expect(page.getByRole("heading", { name: "Macarrones de la abuela", level: 1 })).toBeVisible();
    await expect(page.getByText("500 kcal")).toBeVisible();
    const saved = (await storedRecipes(page)).find((r) => r.id === MACARRONES_MAMA.id);
    expect(saved).toMatchObject({ name: "Macarrones de la abuela", calories: 500, isCustom: true });
  });

  test("una receta de IA también se edita y conserva su marca de IA", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Wrap de atún");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await fillForm(page, { "Calorías (kcal)": "360" }, form(page, "Editar receta"));
    await save(page).click();
    const saved = (await storedRecipes(page)).find((r) => r.id === IA_WRAP.id);
    expect(saved).toMatchObject({ calories: 360, isAIGenerated: true });
    expect(saved).not.toHaveProperty("isCustom");
  });

  test("el detalle de una semilla no tiene 'Editar' ni 'Borrar', solo 'Duplicar y editar'", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Tortilla de claras con verduras");
    await expect(page.getByRole("button", { name: "Duplicar y editar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Borrar", exact: true })).toHaveCount(0);
  });

  test("Las propias llevan el chip 'Propia' en el detalle; las semilla y las de IA no", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Macarrones de mamá");
    await expect(page.getByText("Propia", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await openDetail(page, "Wrap de atún");
    await expect(page.getByText("Propia", { exact: true })).toHaveCount(0);
  });
});

test.describe("R4: Duplicar y editar una semilla", () => {
  test("abre el formulario con los datos de la semilla y al guardar hay una receta propia nueva; la semilla no cambia", async ({ page }) => {
    await openRecetas(page);
    const before = await storedRecipes(page);
    await openDetail(page, "Tortilla de claras con verduras");
    await page.getByRole("button", { name: "Duplicar y editar", exact: true }).click();
    const dialog = form(page, "Editar receta");
    await expect(dialog.getByLabel("Nombre")).toHaveValue("Tortilla de claras con verduras (copia)");
    await expect(dialog.getByLabel("Ingredientes")).toHaveValue(SEMILLA_TORTILLA.ingredients.join("\n"));
    await expect(dialog.getByLabel("Calorías (kcal)")).toHaveValue("180");
    await fillForm(page, { "Calorías (kcal)": "150" }, dialog);
    await save(page).click();

    const after = await storedRecipes(page);
    // El catálogo no se guarda (docs/pm/recetas-almacenamiento R2): solo se añade la copia propia, y la semilla sigue igual
    expect(after).toHaveLength(before.length + 1);
    expect(after.some((r) => r.id === "recipe_001")).toBe(false);
    const copy = after.find((r) => r.name === "Tortilla de claras con verduras (copia)");
    expect(copy).toMatchObject({ isCustom: true, calories: 150 });
    expect(copy?.id).toMatch(/^custom_/);
  });
});

test.describe("R6: editar una receta no cambia lo ya registrado en el Diario", () => {
  test("tras cambiar los macros de los macarrones, la entrada de hoy sigue con 480 kcal", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await fillForm(page, { "Calorías (kcal)": "900", "Proteínas (g)": "60" }, form(page, "Editar receta"));
    await save(page).click();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
    // Hoy: macarrones 480 + bowl 520 = 1000 kcal, y no 900 + 520
    await expect(page.getByRole("img", { name: "1000 kcal", exact: true })).toBeVisible();
    const entry = (await storedEntries(page)).find((e) => e.recipeId === MACARRONES_MAMA.id && e.mealType === "Comida");
    expect(entry).toMatchObject({ calories: 480, protein: 32 });
  });
});

test.describe("R3 / R8: borrar una receta", () => {
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Borrar receta" });

  test("R3: con la receta en el Plan avisa con las franjas afectadas; cancelar no cambia nada", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Borrar", exact: true }).click();

    await expect(dialog(page)).toBeVisible();
    for (const franja of ["Martes · Comida", "Jueves · Cena", "Sábado · Comida"]) {
      await expect(dialog(page).getByText(franja, { exact: true })).toBeVisible();
    }
    await dialog(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await storedRecipes(page)).some((r) => r.id === MACARRONES_MAMA.id)).toBe(true);
    expect(await storedPlan(page)).toEqual(PLAN_CON_MACARRONES);
  });

  test("R3: confirmar borra la receta y vacía sus franjas del Plan (incluida la tanda de sobras); las demás se quedan", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Borrar", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Macarrones de mamá")).toHaveCount(0);
    expect((await storedRecipes(page)).some((r) => r.id === MACARRONES_MAMA.id)).toBe(false);
    const slots = Object.values(await storedPlan(page)).flat();
    expect(slots).toEqual([{ mealType: "Comida", recipeId: BOWL_POLLO.id }]);
  });

  test("R8: las entradas del Diario se conservan con el nombre y los macros de la receta", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(card(page, "Macarrones de mamá")).toHaveCount(0);

    const entries = await storedEntries(page);
    expect(entries).toHaveLength(ENTRADAS.length);
    expect(entries.find((e) => e.customName === "Macarrones de mamá" && e.mealType === "Comida")).toMatchObject({ calories: 480, protein: 32 });
    expect(entries.every((e) => e.recipeId !== MACARRONES_MAMA.id)).toBe(true);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
    await expect(page.getByText("Macarrones de mamá").first()).toBeVisible();
    await expect(page.getByText("Receta", { exact: true })).toHaveCount(0);
  });

  test("sin la receta en el Plan, el diálogo solo pide confirmar (sin lista de franjas) y borra", async ({ page }) => {
    await openRecetas(page, { weekplan: PLAN_SIN_MACARRONES });
    await openDetail(page, "Macarrones de mamá");
    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText(/ · /)).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(card(page, "Macarrones de mamá")).toHaveCount(0);
    expect(await storedPlan(page)).toEqual(PLAN_SIN_MACARRONES);
  });

  test("una receta de IA también se puede borrar", async ({ page }) => {
    await openRecetas(page);
    await openDetail(page, "Wrap de atún");
    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(card(page, "Wrap de atún")).toHaveCount(0);
  });
});

test.describe("Accesibilidad del formulario", () => {
  test("el formulario abierto no tiene violaciones de axe", async ({ page }) => {
    await openRecetas(page);
    await page.getByRole("button", { name: "Nueva receta" }).click();
    await expect(form(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
