// Spec: docs/pm/9-historial-medidas/spec.md › Acceptance criteria R1–R17 (escenarios 1–4) y Edge cases.
// Tech: docs/pm/9-historial-medidas/tech.md › UI y "UI test contract" (nombres accesibles, textos y formatos).
//
// Hoy = martes 2026-09-22 (signIn fija el reloj). Perfiles: Lucía (objetivos calculados, 62 kg, 1750 kcal) y Manuel
// (de la nutricionista, sin datos corporales, weightKg 76). Con Lucía a 58 kg el recálculo sugiere 1700 kcal y 104 g
// de proteína (mismos números que tests/e2e/perfil.spec.ts › R16).
import { expect, test, type Page } from "@playwright/test";
import type { Measurement, MetricKey, UserProfile } from "@/lib/types";
import { lucia, manuel } from "../fixtures/profiles";
import { FIELD_LABELS, HOME_WEIGHTS, measurement, NUTRI_JULY, NUTRI_JULY_TYPED, NUTRI_REPORTS } from "../fixtures/measurements";
import { readStored, signIn, TODAY } from "./helpers";

const EVOLUCION = "/perfil/evolucion";

async function openEvolucion(page: Page, data: { profile?: UserProfile; measurements?: Measurement[] } = {}) {
  await signIn(page, { profile: lucia, measurements: [], ...data });
  await page.goto(EVOLUCION);
  await expect(page.getByRole("heading", { name: "Evolución", level: 1 })).toBeVisible();
}

const dialog = (page: Page) => page.getByRole("dialog");
const field = (page: Page, key: MetricKey) => dialog(page).getByLabel(FIELD_LABELS[key], { exact: true });
const dateField = (page: Page) => dialog(page).getByLabel("Fecha", { exact: true });
const save = (page: Page) => dialog(page).getByRole("button", { name: "Guardar" });
const alert = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
const history = (page: Page) => page.getByRole("list", { name: "Historial" }).getByRole("listitem");
const recalcOffer = (page: Page) => page.getByRole("status").filter({ hasText: "¿Recalculamos?" });
const PRESCRIBED_NOTICE = "Tus objetivos son los de tu nutricionista y no cambian.";

async function openAdd(page: Page, mode: "Solo peso" | "Informe completo" = "Solo peso") {
  await page.getByRole("button", { name: "Añadir medición" }).click();
  await expect(dialog(page)).toHaveAccessibleName("Añadir medición");
  await dialog(page).getByRole("radio", { name: mode }).check();
}

async function addWeight(page: Page, weight: string, date?: string) {
  await openAdd(page, "Solo peso");
  if (date) await dateField(page).fill(date);
  await field(page, "weightKg").fill(weight);
  await save(page).click();
}

const stored = (page: Page) => readStored<Measurement[]>(page, "measurements");
const storedProfile = (page: Page) => readStored<UserProfile>(page, "profile");

// ---------------------------------------------------------------------------

test.describe("R7 · R11: pantalla Evolución dentro de Perfil", () => {
  test("R7: Perfil tiene una tarjeta «Evolución» que lleva a la pantalla, sin pestaña nueva", async ({ page }) => {
    await signIn(page, { profile: lucia, measurements: HOME_WEIGHTS });
    await page.goto("/perfil");
    await page.getByRole("region", { name: "Evolución" }).getByRole("link", { name: "Ver evolución" }).click();
    await expect(page).toHaveURL(EVOLUCION);
    await expect(page.getByRole("heading", { name: "Evolución", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link")).toHaveCount(5);
  });

  test("R7: «Volver a Perfil» vuelve a Perfil", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    await page.getByRole("link", { name: "Volver a Perfil" }).click();
    await expect(page).toHaveURL("/perfil");
  });

  test("R11: sin mediciones, estado vacío con «Apuntar peso» y «Añadir informe completo», aunque el perfil tenga peso", async ({
    page,
  }) => {
    await openEvolucion(page, { profile: lucia, measurements: [] });
    await expect(page.getByText("Aún no hay mediciones")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apuntar peso" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir informe completo" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Historial" })).toHaveCount(0);
    await expect(page.getByRole("img", { name: /^Peso del/ })).toHaveCount(0);
  });

  test("R11: «Apuntar peso» abre el formulario rápido; «Añadir informe completo», el completo", async ({ page }) => {
    await openEvolucion(page);
    await page.getByRole("button", { name: "Apuntar peso" }).click();
    await expect(dialog(page).getByRole("radio", { name: "Solo peso" })).toBeChecked();
    await dialog(page).getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Añadir informe completo" }).click();
    await expect(dialog(page).getByRole("radio", { name: "Informe completo" })).toBeChecked();
    await expect(field(page, "waist")).toBeVisible();
  });

  test("R7: el historial va de la más reciente a la más antigua y marca las de la nutricionista", async ({ page }) => {
    await openEvolucion(page, { measurements: [NUTRI_JULY, ...HOME_WEIGHTS] });
    await expect(history(page)).toHaveCount(HOME_WEIGHTS.length + 1);
    await expect(history(page).first()).toContainText("22 sep 2026");
    await expect(history(page).first()).toContainText("75 kg");
    await expect(history(page).last()).toContainText("31 jul 2026");
    await expect(history(page).last()).toContainText("76 kg");
    await expect(history(page).last()).toContainText("Nutricionista");
    await expect(history(page).first()).not.toContainText("Nutricionista");
  });
});

// ---------------------------------------------------------------------------

test.describe("R1 · R2 · R6 · R8: pesada en casa (escenario 1)", () => {
  test("«Añadir medición» abre «Solo peso» con la fecha de hoy", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    await page.getByRole("button", { name: "Añadir medición" }).click();
    await expect(dialog(page).getByRole("radio", { name: "Solo peso" })).toBeChecked();
    await expect(dateField(page)).toHaveValue(TODAY);
    await expect(dialog(page)).toContainText("Última: 75 kg el 22 sep");
  });

  test("guardar 61,5 kg: aparece en el historial y en la gráfica, y se guarda como Casa", async ({ page }) => {
    await openEvolucion(page);
    await addWeight(page, "61,5");
    await expect(dialog(page)).toHaveCount(0);
    await expect(history(page)).toHaveCount(1);
    await expect(history(page).first()).toContainText("22 sep 2026");
    await expect(history(page).first()).toContainText("61,5 kg");
    await expect(page.getByRole("img", { name: /^Peso del/ })).toBeVisible();

    const [m] = await stored(page);
    expect(m).toMatchObject({ date: TODAY, source: "home", values: { weightKg: 61.5 } });
    expect(typeof m.id).toBe("string");
    expect(typeof m.savedAt).toBe("string");
  });

  test("R6: tras recargar la página, siguen ahí", async ({ page }) => {
    await openEvolucion(page);
    await addWeight(page, "61,5");
    await page.reload();
    await expect(history(page).first()).toContainText("61,5 kg");
  });

  test("R8: el resumen muestra el último peso y la tendencia de 7 días", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    // Tendencia el 22/09 = (75,1 + 74,9 + 75,0) / 3 = 75,0
    await expect(page.getByText("Tendencia 75 kg")).toBeVisible();
    await expect(page.getByRole("img", { name: /^Peso del 23 ago al 22 sep/ })).toBeVisible();
  });

  test("R1: una fecha futura no se guarda", async ({ page }) => {
    await openEvolucion(page);
    await addWeight(page, "61,5", "2026-09-23");
    await expect(alert(page, "La fecha no puede ser futura")).toBeVisible();
    await expect(dialog(page)).toBeVisible();
    expect(await stored(page)).toEqual([]);
  });

  test("R1: sin ningún valor no se guarda", async ({ page }) => {
    await openEvolucion(page);
    await openAdd(page, "Solo peso");
    await save(page).click();
    await expect(alert(page, "Añade al menos un valor")).toBeVisible();
    expect(await stored(page)).toEqual([]);
  });

  test("R4: algo que no es un número da error junto al campo", async ({ page }) => {
    await openEvolucion(page);
    await addWeight(page, "abc");
    await expect(alert(page, "Entre 30 y 250 kg")).toBeVisible();
    await expect(field(page, "weightKg")).toHaveAttribute("aria-invalid", "true");
    expect(await stored(page)).toEqual([]);
  });

  test("R4: coma o punto decimal", async ({ page }) => {
    await openEvolucion(page);
    await addWeight(page, "61.3");
    expect((await stored(page))[0].values).toEqual({ weightKg: 61.3 });
  });
});

// ---------------------------------------------------------------------------

test.describe("R3 · R4: informe de la nutricionista (escenario 2)", () => {
  /** Manuel con una pesada del 20/09: la toma del 31/07 es más antigua y no toca su perfil. */
  const MANUEL = { profile: { ...manuel, weightKg: 74.9 }, measurements: [HOME_WEIGHTS[5]] };

  test("«Informe completo» tiene los 22 campos agrupados, y el origen es Nutricionista por defecto", async ({ page }) => {
    await openEvolucion(page, MANUEL);
    await openAdd(page, "Informe completo");
    for (const label of Object.values(FIELD_LABELS)) await expect(dialog(page).getByLabel(label, { exact: true })).toBeVisible();
    for (const group of ["Bioimpedancia", "Perímetros", "Pliegues cutáneos"])
      await expect(dialog(page).getByRole("group", { name: group })).toBeVisible();
    await expect(dialog(page).getByRole("radio", { name: "Nutricionista" })).toBeChecked();
  });

  test("copiar la toma del 31/07 y reabrirla: cada campo tiene el valor introducido", async ({ page }) => {
    await openEvolucion(page, MANUEL);
    await openAdd(page, "Informe completo");
    await dateField(page).fill("2026-07-31");
    for (const [key, text] of Object.entries(NUTRI_JULY_TYPED)) await field(page, key as MetricKey).fill(text);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);

    const saved = (await stored(page)).find((m) => m.date === "2026-07-31");
    expect(saved).toMatchObject({ source: "nutritionist", values: NUTRI_JULY.values });

    await history(page).filter({ hasText: "31 jul 2026" }).getByRole("button").click();
    await expect(dialog(page)).toHaveAccessibleName("Editar medición");
    // Se muestran con coma y sin ceros de más: "76,0" → "76", "8,0" → "8" (mismo número)
    for (const [key, text] of Object.entries(NUTRI_JULY_TYPED))
      await expect(field(page, key as MetricKey)).toHaveValue(text.replace(/,0$/, ""));
  });

  test("R9: una toma más antigua que la última pesada no cambia el peso del perfil", async ({ page }) => {
    await openEvolucion(page, MANUEL);
    await openAdd(page, "Informe completo");
    await dateField(page).fill("2026-07-31");
    await field(page, "weightKg").fill("76,0");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await storedProfile(page)).weightKg).toBe(74.9);
    await expect(page.getByRole("status").filter({ hasText: PRESCRIBED_NOTICE })).toHaveCount(0);
  });

  test("solo cintura y cadera: se guarda sin peso y el perfil no cambia", async ({ page }) => {
    await openEvolucion(page, MANUEL);
    await openAdd(page, "Informe completo");
    await field(page, "waist").fill("84,5");
    await field(page, "hip").fill("87,6");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    const saved = (await stored(page)).find((m) => m.values.waist === 84.5);
    expect(saved?.values).toEqual({ waist: 84.5, hip: 87.6 });
    expect((await storedProfile(page)).weightKg).toBe(74.9);
  });

  test("R4: un IMC incoherente se guarda tal cual", async ({ page }) => {
    await openEvolucion(page, MANUEL);
    await openAdd(page, "Informe completo");
    await dateField(page).fill("2026-07-31");
    await field(page, "weightKg").fill("76,0");
    await field(page, "bmi").fill("29,3");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await stored(page)).find((m) => m.date === "2026-07-31")?.values).toEqual({ weightKg: 76, bmi: 29.3 });
  });

  test("R4: un pliegue fuera de rango bloquea el guardado con su mensaje", async ({ page }) => {
    await openEvolucion(page, MANUEL);
    await openAdd(page, "Informe completo");
    await field(page, "skinCalf").fill("81");
    await save(page).click();
    await expect(alert(page, "Entre 1 y 80 mm")).toBeVisible();
    expect(await stored(page)).toEqual(MANUEL.measurements);
  });
});

// ---------------------------------------------------------------------------

test.describe("R5: editar y borrar (escenario 3)", () => {
  test("editar una pesada cambia el historial", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    await history(page).filter({ hasText: "18 sep 2026" }).getByRole("button").click();
    await expect(dialog(page)).toHaveAccessibleName("Editar medición");
    await field(page, "weightKg").fill("75,4");
    await save(page).click();
    await expect(history(page).filter({ hasText: "18 sep 2026" })).toContainText("75,4 kg");
    expect((await stored(page)).find((m) => m.id === "home-0918")?.values).toEqual({ weightKg: 75.4 });
  });

  test("corregir el 9,7 de la pierna derecha del 31/07 a 49,7", async ({ page }) => {
    const typo = { ...NUTRI_JULY, values: { ...NUTRI_JULY.values, legR: 9.7 } };
    await openEvolucion(page, { measurements: [typo] });
    await history(page).first().getByRole("button").click();
    await field(page, "legR").fill("49,7");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await stored(page))[0].values.legR).toBe(49.7);
  });

  test("borrar pide confirmación; al aceptar desaparece", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    await history(page).filter({ hasText: "20 sep 2026" }).getByRole("button").click();
    page.once("dialog", (d) => d.accept());
    await dialog(page).getByRole("button", { name: "Eliminar medición" }).click();
    await expect(history(page).filter({ hasText: "20 sep 2026" })).toHaveCount(0);
    expect((await stored(page)).map((m) => m.id)).not.toContain("home-0920");
  });

  test("borrar y cancelar la confirmación no cambia nada", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    await history(page).filter({ hasText: "20 sep 2026" }).getByRole("button").click();
    page.once("dialog", (d) => d.dismiss());
    await dialog(page).getByRole("button", { name: "Eliminar medición" }).click();
    expect(await stored(page)).toEqual(HOME_WEIGHTS);
  });

  test("Edge case: borrar la última pesada no cambia el peso del perfil", async ({ page }) => {
    const profile = { ...lucia, body: { ...lucia.body!, weightKg: 75 } };
    await openEvolucion(page, { profile, measurements: HOME_WEIGHTS });
    await history(page).first().getByRole("button").click();
    page.once("dialog", (d) => d.accept());
    await dialog(page).getByRole("button", { name: "Eliminar medición" }).click();
    await expect(history(page)).toHaveCount(HOME_WEIGHTS.length - 1);
    expect((await storedProfile(page)).body?.weightKg).toBe(75);
  });
});

// ---------------------------------------------------------------------------

test.describe("R9 · R10: el peso nuevo actualiza el perfil", () => {
  const LUCIA_BEFORE = [measurement("l-0915", "2026-09-15", { weightKg: 62 })];

  test("objetivos calculados: ofrece recalcular y «Recalcular» aplica los objetivos del nuevo peso", async ({ page }) => {
    await openEvolucion(page, { profile: lucia, measurements: LUCIA_BEFORE });
    await addWeight(page, "58");
    await expect(recalcOffer(page)).toContainText("1700");
    await expect(recalcOffer(page)).toContainText("104");
    const before = await storedProfile(page);
    expect(before.body?.weightKg).toBe(58);
    expect(before.calorieGoal).toBe(1750);

    await recalcOffer(page).getByRole("button", { name: "Recalcular" }).click();
    expect(await storedProfile(page)).toMatchObject({ calorieGoal: 1700, proteinGoal: 104, body: { weightKg: 58 } });
    await expect(recalcOffer(page)).toHaveCount(0);
  });

  test("«Mantener los actuales» guarda el peso pero no toca los objetivos", async ({ page }) => {
    await openEvolucion(page, { profile: lucia, measurements: LUCIA_BEFORE });
    await addWeight(page, "58");
    await recalcOffer(page).getByRole("button", { name: "Mantener los actuales" }).click();
    await expect(recalcOffer(page)).toHaveCount(0);
    expect(await storedProfile(page)).toMatchObject({ calorieGoal: 1750, body: { weightKg: 58 } });
  });

  test("objetivos de la nutricionista: se guarda el peso, los objetivos no cambian y un aviso lo dice", async ({ page }) => {
    await openEvolucion(page, { profile: manuel, measurements: [] });
    await addWeight(page, "74,8");
    await expect(page.getByRole("status").filter({ hasText: PRESCRIBED_NOTICE })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recalcular" })).toHaveCount(0);
    const p = await storedProfile(page);
    expect(p.weightKg).toBe(74.8);
    expect(p).toMatchObject({ calorieGoal: manuel.calorieGoal, proteinGoal: manuel.proteinGoal, carbsGoal: manuel.carbsGoal, fatGoal: manuel.fatGoal });
  });

  test("una pesada anterior a la última no cambia el perfil ni ofrece recalcular", async ({ page }) => {
    await openEvolucion(page, { profile: lucia, measurements: LUCIA_BEFORE });
    await addWeight(page, "58", "2026-09-01");
    await expect(dialog(page)).toHaveCount(0);
    await expect(history(page)).toHaveCount(2);
    await expect(recalcOffer(page)).toHaveCount(0);
    expect((await storedProfile(page)).body?.weightKg).toBe(62);
  });

  test("el mismo peso que ya tiene el perfil no ofrece recalcular", async ({ page }) => {
    await openEvolucion(page, { profile: lucia, measurements: [] });
    await addWeight(page, "62");
    await expect(history(page)).toHaveCount(1);
    await expect(recalcOffer(page)).toHaveCount(0);
  });

  test("editar la última pesada con otro peso también actualiza el perfil", async ({ page }) => {
    await openEvolucion(page, { profile: lucia, measurements: LUCIA_BEFORE });
    await history(page).first().getByRole("button").click();
    await field(page, "weightKg").fill("58");
    await save(page).click();
    await expect(recalcOffer(page)).toBeVisible();
    expect((await storedProfile(page)).body?.weightKg).toBe(58);
  });
});

test.describe("R17: «Datos corporales» también apunta la pesada", () => {
  async function editBody(page: Page, weight: string) {
    const body = page.getByRole("region", { name: "Datos corporales" });
    await body.getByRole("button", { name: "Editar" }).click();
    await body.getByLabel("Peso (kg)").fill(weight);
    await body.getByRole("button", { name: "Guardar" }).click();
  }

  test("un peso distinto crea una medición de hoy, origen Casa, y la oferta de Perfil sigue igual", async ({ page }) => {
    await signIn(page, { profile: lucia, measurements: [] });
    await page.goto("/perfil");
    await editBody(page, "58");
    await expect(page.getByRole("status").filter({ hasText: "Recalcular" })).toContainText("1700");
    const ms = await stored(page);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ date: TODAY, source: "home", values: { weightKg: 58 } });
  });

  test("guardar sin cambiar el peso no crea ninguna medición", async ({ page }) => {
    await signIn(page, { profile: lucia, measurements: [] });
    await page.goto("/perfil");
    await editBody(page, "62");
    await expect(page.getByRole("button", { name: "Editar" }).first()).toBeVisible();
    expect(await stored(page)).toEqual([]);
  });

  test("con objetivos de la nutricionista (solo peso) también", async ({ page }) => {
    await signIn(page, { profile: manuel, measurements: [] });
    await page.goto("/perfil");
    await editBody(page, "74");
    await expect.poll(async () => (await stored(page)).length).toBe(1);
    expect((await stored(page))[0]).toMatchObject({ date: TODAY, source: "home", values: { weightKg: 74 } });
  });
});

// ---------------------------------------------------------------------------

test.describe("R12 (Should): tarjeta «Evolución» en Perfil", () => {
  test("último peso, cambio de tendencia en 30 días y minigráfica", async ({ page }) => {
    await signIn(page, { profile: lucia, measurements: HOME_WEIGHTS });
    await page.goto("/perfil");
    const card = page.getByRole("region", { name: "Evolución" });
    await expect(card).toContainText("75 kg");
    await expect(card).toContainText("−1,1 kg en 30 días");
    await expect(card.getByRole("img")).toBeVisible();
  });

  test("sin mediciones invita a añadir la primera", async ({ page }) => {
    await signIn(page, { profile: lucia, measurements: [] });
    await page.goto("/perfil");
    await expect(page.getByRole("region", { name: "Evolución" })).toContainText("Aún no hay mediciones");
  });
});

test.describe("R13 · R14 (Should): otras métricas (escenario 4)", () => {
  test("el selector solo ofrece métricas con datos", async ({ page }) => {
    await openEvolucion(page, { measurements: HOME_WEIGHTS });
    const metrics = page.getByRole("radiogroup", { name: "Métrica" }).getByRole("radio");
    await expect(metrics).toHaveCount(1);
    await expect(metrics.first()).toHaveAccessibleName("Peso");
  });

  test("cintura: gráfica, valor actual e historial con la diferencia respecto a la anterior", async ({ page }) => {
    await openEvolucion(page, { measurements: NUTRI_REPORTS });
    await page.getByRole("radio", { name: "Cintura" }).check();
    await expect(page.getByRole("img", { name: /^Cintura del 5 may al 31 jul/ })).toBeVisible();
    await expect(history(page).first()).toContainText("84,5 cm");
    await expect(history(page).first()).toContainText("−8,5 cm");
    await expect(history(page).last()).toContainText("99,4 cm");
  });

  test("las bilaterales tienen una sola opción (dos líneas, izq. y der.)", async ({ page }) => {
    await openEvolucion(page, { measurements: NUTRI_REPORTS });
    await expect(page.getByRole("radio", { name: "Pierna", exact: true })).toHaveCount(1);
    await expect(page.getByRole("radio", { name: /Pierna (izq|der)/ })).toHaveCount(0);
    await page.getByRole("radio", { name: "Pierna", exact: true }).check();
    await expect(page.getByRole("img", { name: /^Pierna del/ })).toBeVisible();
  });

  test("R14: «Suma de pliegues» como métrica, con las sumas del informe", async ({ page }) => {
    await openEvolucion(page, { measurements: NUTRI_REPORTS });
    await page.getByRole("radio", { name: "Suma de pliegues" }).check();
    await expect(history(page).first()).toContainText("56 mm");
    await expect(history(page).last()).toContainText("87 mm");
  });

  test("R14: en el formulario, la suma aparece con los seis pliegues", async ({ page }) => {
    await openEvolucion(page);
    await openAdd(page, "Informe completo");
    const sum = dialog(page).getByLabel("Suma de pliegues");
    const skin = ["skinBiceps", "skinTriceps", "skinAbdominal", "skinSuprailiac", "skinQuadriceps"] as const;
    for (const k of skin) await field(page, k).fill(NUTRI_JULY_TYPED[k]);
    await expect(sum).toHaveText("—");
    await field(page, "skinCalf").fill(NUTRI_JULY_TYPED.skinCalf);
    await expect(sum).toHaveText("56 mm");
  });
});

test.describe("R15 (Should): periodo de la gráfica", () => {
  test("por defecto «Todo»; «1M» deja los últimos 30 días", async ({ page }) => {
    await openEvolucion(page, { measurements: [...NUTRI_REPORTS, ...HOME_WEIGHTS] });
    await expect(page.getByRole("radio", { name: "Todo" })).toBeChecked();
    await expect(page.getByRole("img", { name: /^Peso del 5 may al 22 sep/ })).toBeVisible();
    await page.getByRole("radio", { name: "1M" }).check();
    await expect(page.getByRole("img", { name: /^Peso del 23 ago al 22 sep/ })).toBeVisible();
  });

  test("un periodo sin datos lo dice", async ({ page }) => {
    await openEvolucion(page, { measurements: NUTRI_REPORTS });
    await page.getByRole("radio", { name: "1M" }).check();
    await expect(page.getByText("No hay mediciones en este periodo")).toBeVisible();
  });
});

test.describe("R16 (Could): aviso de valores raros", () => {
  test("pierna derecha 9,7 con la izquierda a 49,6: avisa pero deja guardar", async ({ page }) => {
    await openEvolucion(page);
    await openAdd(page, "Informe completo");
    await field(page, "legL").fill("49,6");
    await field(page, "legR").fill("9,7");
    await expect(dialog(page)).toContainText("Muy distinto de la izquierda (49,6)");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await stored(page))[0].values).toEqual({ legL: 49.6, legR: 9.7 });
  });
});
