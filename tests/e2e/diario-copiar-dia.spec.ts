// Spec: docs/pm/54-copiar-diario/spec.md › Acceptance criteria R1–R8, Edge cases y User flows (artboards 1–5).
// Tech: docs/pm/54-copiar-diario/tech.md › UI (botón de icono «Copiar día a otra fecha» junto al input «Fecha», hoja
// «Copiar el lun 21 sep a…» con atajos, campo «Otra fecha» y botón «Copiar a hoy»; aviso de conflicto «El mar 22 sep ya
// tiene 2 entradas»; aviso role="status" «Copiadas 5 entradas», marca «Copiada») y State & edge cases (hoja que se
// reinicia al reabrir, aviso que se cierra al cambiar de fecha, doble toque).
//
// Datos: tests/fixtures/copiar-dia.ts. Hoy = martes 2026-09-22 (signIn fija el reloj); el origen es ayer, lunes 21, con
// cinco entradas; el destino «hoy» ya tiene dos en los tests de conflicto. Lucía hace Desayuno, Comida, Merienda y Cena.
//
// Pendiente (no se puede provocar desde la UI): «0 entradas al confirmar» (origen que se vacía por sync con la hoja
// abierta; lo cubre `copyDay → []` en tests/unit/diary-copy.test.ts) y «aviso de copia vs aviso de Añadir comida»
// (exige el flujo completo de alimento; solo uno visible a la vez). Lo cubre dev-review leyendo el código.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { MealEntry } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { DIARIO_RECIPES, FULL_DAY_PLAN, GUISO } from "../fixtures/diario";
import { DESTINO_ENTRIES, ORIGEN_ENTRIES, ORIGEN_KCAL, TODAY, TOMORROW, YESTERDAY } from "../fixtures/copiar-dia";
import { readStored, signIn } from "./helpers";

const RECIPES = [...DIARIO_RECIPES, GUISO];

const copyBtn = (page: Page) => page.getByRole("button", { name: "Copiar día a otra fecha" });
const dateInput = (page: Page) => page.getByLabel("Fecha", { exact: true });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Copiar el lun 21 sep a…" });
const conflict = (page: Page) => page.getByRole("dialog", { name: /ya tiene/ });
const atajo = (page: Page, name: RegExp) => sheet(page).getByRole("button", { name });
const notice = (page: Page, text: RegExp | string) => page.getByRole("status").filter({ hasText: text });
const meal = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const stored = (page: Page) => readStored<MealEntry[]>(page, "entries");
const onDay = (entries: MealEntry[], date: string) => entries.filter((e) => e.date === date);

async function openDiario(page: Page, entries: MealEntry[], extra: Record<string, unknown> = {}) {
  await signIn(page, { profile: lucia, recipes: RECIPES, weekplan: {}, entries, ...extra });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario", level: 1 })).toBeVisible();
}

/** Abre el Diario y se pone en el lunes 21, el día de origen. */
async function openOrigen(page: Page, entries: MealEntry[] = ORIGEN_ENTRIES, extra: Record<string, unknown> = {}) {
  await openDiario(page, entries, extra);
  await dateInput(page).fill(YESTERDAY);
  await expect(meal(page, "Comida")).toBeVisible();
}

// ---------------------------------------------------------------------------

test.describe("R1: botón «Copiar día a otra fecha» en la cabecera", () => {
  test("R1: está junto al input de fecha, con zona táctil de al menos 44 px", async ({ page }) => {
    await openOrigen(page);
    const button = (await copyBtn(page).boundingBox())!;
    const date = (await dateInput(page).boundingBox())!;
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    // Misma fila: los centros verticales casi coinciden y el botón queda a la izquierda de la fecha
    expect(Math.abs(button.y + button.height / 2 - (date.y + date.height / 2))).toBeLessThan(20);
    expect(button.x).toBeLessThan(date.x);
  });

  test("R1: al tocarlo se abre la hoja con el día de origen, las entradas y las kcal", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByText(`5 entradas · ${ORIGEN_KCAL} kcal`)).toBeVisible();
  });
});

test.describe("R5: día sin entradas", () => {
  test("R5: el botón está desactivado (no oculto) y se activa en un día con entradas", async ({ page }) => {
    await openDiario(page, ORIGEN_ENTRIES); // hoy no tiene entradas
    await expect(copyBtn(page)).toBeVisible();
    await expect(copyBtn(page)).toBeDisabled();
    await dateInput(page).fill(YESTERDAY);
    await expect(copyBtn(page)).toBeEnabled();
  });
});

test.describe("R2 · R4 · R7: copiar un día sin conflicto", () => {
  test("R2/R7: copia el lunes a hoy en 3 toques: icono, atajo, «Copiar a hoy»", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();

    // R4: salta al día de destino con el aviso
    await expect(dateInput(page)).toHaveValue(TODAY);
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
    await expect(sheet(page)).toBeHidden();
  });

  test("R2: las cinco entradas aparecen hoy en su franja, con raciones, unidades y kcal intactas", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();

    await expect(meal(page, "Desayuno")).toContainText("Guiso × 0,5");
    await expect(meal(page, "Desayuno")).toContainText("300 kcal");
    await expect(meal(page, "Desayuno")).toContainText("Huevo 2 ud · 120 g");
    await expect(meal(page, "Desayuno")).toContainText("168 kcal");
    await expect(meal(page, "Comida")).toContainText("Lentejas");
    await expect(meal(page, "Comida")).toContainText("520 kcal");
    await expect(meal(page, "Cena")).toContainText("Ensalada de la casa");
    await expect(meal(page, "Cena")).toContainText("Fibra 4,5 g");
    // Franja que el perfil de Lucía no muestra: se copia igualmente
    await expect(meal(page, "Pre-entreno")).toContainText("Barrita de avena");
    await expect(meal(page, "Pre-entreno")).toContainText("Fibra: sin dato");
  });

  test("R2: guarda 5 entradas nuevas con ids distintos y deja intactas las del lunes", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();

    await expect.poll(async () => onDay(await stored(page), TODAY).length).toBe(5);
    const all = await stored(page);
    expect(all).toHaveLength(10);
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(10);
    // El lunes sigue con sus cinco entradas, sin cambios
    expect(onDay(all, YESTERDAY)).toEqual(ORIGEN_ENTRIES);
    // Mismas franjas y macros, orden de registro del origen
    const copied = onDay(all, TODAY);
    expect(copied.map((e) => e.mealType)).toEqual(ORIGEN_ENTRIES.map((e) => e.mealType));
    expect(copied.map((e) => e.calories)).toEqual(ORIGEN_ENTRIES.map((e) => e.calories));
  });

  test("R2: no copia el agua del día", async ({ page }) => {
    await openOrigen(page, ORIGEN_ENTRIES, { water: { [YESTERDAY]: 750 } });
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
    expect(await readStored(page, "water")).toEqual({ [YESTERDAY]: 750 });
  });

  test("R4: con una sola entrada el aviso habla en singular: «Copiada 1 entrada»", async ({ page }) => {
    await openOrigen(page, [ORIGEN_ENTRIES[2]]);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(notice(page, "Copiada 1 entrada")).toBeVisible();
  });

  test("R4: la franja pendiente del Plan desaparece si la copia trae entradas de esa franja", async ({ page }) => {
    // Hoy: Desayuno, Comida y Cena planificados; el lunes solo tiene Desayuno y Comida
    await openOrigen(page, ORIGEN_ENTRIES.slice(0, 3), { weekplan: FULL_DAY_PLAN });
    await dateInput(page).fill(TODAY);
    await expect(page.getByText("Pendiente", { exact: true })).toHaveCount(3);

    await dateInput(page).fill(YESTERDAY);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(notice(page, "Copiadas 3 entradas")).toBeVisible();
    await expect(page.getByText("Pendiente", { exact: true })).toHaveCount(1);
    await expect(meal(page, "Cena").getByText("Pendiente", { exact: true })).toBeVisible();
  });
});

test.describe("R6 · R7: destino futuro, pasado y atajos", () => {
  test("R6/R7: «Mañana» copia a una fecha futura", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^Mañana/).click();
    await sheet(page).getByRole("button", { name: "Copiar a mañana", exact: true }).click();
    await expect(dateInput(page)).toHaveValue(TOMORROW);
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
    await expect.poll(async () => onDay(await stored(page), TOMORROW).length).toBe(5);
  });

  test("R6/R7: «En 7 días» y el botón nombra la fecha", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^En 7 días/).click();
    await sheet(page).getByRole("button", { name: "Copiar al mar 29 sep", exact: true }).click();
    await expect(dateInput(page)).toHaveValue("2026-09-29");
    await expect.poll(async () => onDay(await stored(page), "2026-09-29").length).toBe(5);
  });

  test("R6: una fecha pasada elegida en «Otra fecha» también vale", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await sheet(page).getByLabel("Otra fecha").fill("2026-08-18");
    await sheet(page).getByRole("button", { name: "Copiar al mar 18 ago", exact: true }).click();
    await expect(dateInput(page)).toHaveValue("2026-08-18");
    await expect.poll(async () => onDay(await stored(page), "2026-08-18").length).toBe(5);
  });

  test("R6: con la fecha del propio origen o vacía, «Copiar» está desactivado", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    const principal = sheet(page).getByRole("button", { name: "Copiar", exact: true });
    await expect(principal).toBeDisabled(); // al abrir no hay destino
    await sheet(page).getByLabel("Otra fecha").fill(YESTERDAY);
    await expect(principal).toBeDisabled();
    await atajo(page, /^Hoy/).click();
    await expect(sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true })).toBeEnabled();
    await sheet(page).getByLabel("Otra fecha").fill("");
    await expect(principal).toBeDisabled();
  });

  test("R7: si el día de origen es hoy, no se ofrece «Hoy»", async ({ page }) => {
    await openDiario(page, DESTINO_ENTRIES);
    await copyBtn(page).click();
    const hoja = page.getByRole("dialog", { name: "Copiar el mar 22 sep a…" });
    await expect(hoja.getByRole("button", { name: /^Hoy/ })).toHaveCount(0);
    await expect(hoja.getByRole("button", { name: /^Mañana/ })).toBeVisible();
  });
});

test.describe("R3: el destino ya tiene entradas", () => {
  const CON_DESTINO = [...ORIGEN_ENTRIES, ...DESTINO_ENTRIES];

  async function hastaConflicto(page: Page) {
    await openOrigen(page, CON_DESTINO);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
  }

  test("R3: avisa, lista las que ya hay y todavía no copia nada", async ({ page }) => {
    await hastaConflicto(page);
    const aviso = page.getByRole("dialog", { name: "El mar 22 sep ya tiene 2 entradas" });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByText("Tostadas con aguacate")).toBeVisible();
    await expect(aviso.getByText("Desayuno · 290 kcal")).toBeVisible();
    await expect(aviso.getByText("Ensalada mixta")).toBeVisible();
    await expect(aviso.getByText("Comida · 210 kcal")).toBeVisible();
    await expect(aviso).toContainText("No se borra nada");
    expect(await stored(page)).toHaveLength(7);
    await expect(dateInput(page)).toHaveValue(YESTERDAY);
  });

  test("R3: «Cancelar» cierra todo, no crea ninguna entrada y sigue en el día de origen", async ({ page }) => {
    await hastaConflicto(page);
    await conflict(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(conflict(page)).toBeHidden();
    await expect(sheet(page)).toBeHidden();
    await expect(dateInput(page)).toHaveValue(YESTERDAY);
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(await stored(page)).toHaveLength(7);
  });

  test("R3: «Sumar las 5 entradas» deja las 2 de hoy y añade las 5, sin borrar nada", async ({ page }) => {
    await hastaConflicto(page);
    await conflict(page).getByRole("button", { name: "Sumar las 5 entradas" }).click();
    await expect(dateInput(page)).toHaveValue(TODAY);
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();

    await expect.poll(async () => (await stored(page)).length).toBe(12);
    const all = await stored(page);
    expect(onDay(all, TODAY)).toHaveLength(7);
    // Las dos de antes siguen, con su id, delante de las copiadas
    expect(onDay(all, TODAY).slice(0, 2)).toEqual(DESTINO_ENTRIES);
    await expect(meal(page, "Desayuno")).toContainText("Tostadas con aguacate");
    await expect(meal(page, "Desayuno")).toContainText("Guiso × 0,5");
    await expect(meal(page, "Comida")).toContainText("Ensalada mixta");
    await expect(meal(page, "Comida")).toContainText("Lentejas");
  });

  test("R3: con un destino sin entradas (mañana) no hay aviso aunque hoy sí tenga", async ({ page }) => {
    await openOrigen(page, CON_DESTINO);
    await copyBtn(page).click();
    await atajo(page, /^Mañana/).click();
    await sheet(page).getByRole("button", { name: "Copiar a mañana", exact: true }).click();
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
    await expect(conflict(page)).toBeHidden();
  });

  test("Estado: al reabrir la hoja tras cancelar vuelve a «elegir», sin destino ni aviso", async ({ page }) => {
    await hastaConflicto(page);
    await conflict(page).getByRole("button", { name: "Cancelar" }).click();
    await copyBtn(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(conflict(page)).toBeHidden();
    await expect(atajo(page, /^Hoy/)).toHaveAttribute("aria-pressed", "false");
    await expect(sheet(page).getByLabel("Otra fecha")).toHaveValue("");
    await expect(sheet(page).getByRole("button", { name: "Copiar", exact: true })).toBeDisabled();
  });
});

test.describe("R4 · R8: aviso «Copiadas N entradas» y marca «Copiada»", () => {
  async function copiarAHoy(page: Page) {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
  }

  test("R8: las 5 entradas nuevas llevan la marca «Copiada» mientras dura el aviso", async ({ page }) => {
    await copiarAHoy(page);
    await expect(page.getByText("Copiada", { exact: true })).toHaveCount(5);
  });

  test("R4: el aviso no tiene acción «Deshacer» (fuera de v1)", async ({ page }) => {
    await copiarAHoy(page);
    await expect(notice(page, "Copiadas 5 entradas").getByRole("button")).toHaveCount(0);
  });

  test("Estado: al cambiar de fecha se cierran el aviso y las marcas, y no vuelven al regresar", async ({ page }) => {
    await copiarAHoy(page);
    await dateInput(page).fill(TOMORROW);
    await expect(notice(page, "Copiadas 5 entradas")).toBeHidden();
    await dateInput(page).fill(TODAY);
    await expect(meal(page, "Desayuno")).toContainText("Guiso × 0,5");
    await expect(page.getByText("Copiada", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("R4: el aviso se cierra solo a los 10 s", async ({ page }) => {
    test.setTimeout(30_000);
    await copiarAHoy(page);
    // El reloj de los tests solo fija la fecha, no los temporizadores: espera real
    await expect(notice(page, "Copiadas 5 entradas")).toBeHidden({ timeout: 13_000 });
    await expect(page.getByText("Copiada", { exact: true })).toHaveCount(0);
    // Las entradas siguen
    await expect(meal(page, "Comida")).toContainText("Lentejas");
  });
});

test.describe("Edge case: doble toque", () => {
  test("un doble toque en «Copiar a hoy» copia una sola vez y no borra nada", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).dblclick();
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
    await expect.poll(async () => (await stored(page)).length).toBe(10);
    expect(onDay(await stored(page), TODAY)).toHaveLength(5);
  });

  test("un doble toque en «Sumar» suma una sola vez y no borra nada", async ({ page }) => {
    await openOrigen(page, [...ORIGEN_ENTRIES, ...DESTINO_ENTRIES]);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await conflict(page).getByRole("button", { name: "Sumar las 5 entradas" }).dblclick();
    await expect(notice(page, "Copiadas 5 entradas")).toBeVisible();
    await expect.poll(async () => (await stored(page)).length).toBe(12);
    expect(onDay(await stored(page), TODAY)).toHaveLength(7);
  });
});

test.describe("Accesibilidad de la hoja (axe, WCAG A y AA)", () => {
  async function expectNoViolations(page: Page) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .include('[role="dialog"]')
      .analyze();
    const summary = results.violations
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " — " + n.failureSummary).join("\n")}`)
      .join("\n\n");
    expect(results.violations, summary).toEqual([]);
  }

  test("paso «elegir»", async ({ page }) => {
    await openOrigen(page);
    await copyBtn(page).click();
    await expect(sheet(page)).toBeVisible();
    await expectNoViolations(page);
  });

  test("paso «conflicto»", async ({ page }) => {
    await openOrigen(page, [...ORIGEN_ENTRIES, ...DESTINO_ENTRIES]);
    await copyBtn(page).click();
    await atajo(page, /^Hoy/).click();
    await sheet(page).getByRole("button", { name: "Copiar a hoy", exact: true }).click();
    await expect(conflict(page)).toBeVisible();
    await expectNoViolations(page);
  });
});
