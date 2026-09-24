// Spec: docs/pm/backup-datos/spec.md › Criterios de aceptación R1–R11 y Casos límite.
// Tech: docs/pm/backup-datos/tech.md › UI (sección "Tus datos" en Perfil: región con h2, texto R11, botones
// "Exportar mis datos" / "Importar datos" que abre un <input type="file">, confirmación con window.confirm con la
// fecha dd/mm/aaaa, error role="alert", éxito "Datos importados" role="status") y Testing strategy (E2E).
//
// Datos: tests/fixtures/backup.ts. Hoy = martes 2026-09-22 (reloj fijo). La cuenta A ("Lucía", usuario "lucia") y la
// cuenta B ("Manuel", usuario "manuel") tienen ids y credenciales propias, sembradas aquí (no con signIn) para poder
// comprobar que el fichero no las contiene y que la importación escribe en la cuenta con sesión.
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ACCOUNT_A,
  ACCOUNT_A_DATA,
  ACCOUNT_B,
  ACCOUNT_B_DATA,
  AI_RECIPE,
  B_ENTRY_NAME,
  B_PANTRY_ITEM,
  backupText,
  BACKUP_TODAY_KCAL,
  LEGACY_V1_PROFILE,
  OTHER_ACCOUNT,
  OTHER_MARKER,
  SNACK_ENTRY,
  TODAY,
} from "../fixtures/backup";
import { POLLO_BROCOLI } from "../fixtures/shopping";
import { lucia, manuel } from "../fixtures/profiles";

const USER_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping"] as const;

type Account = { id: string; username: string; salt: string; hash: string };

/**
 * Sesión iniciada en `account`, con otras cuentas del mismo navegador y sus datos. Igual que signIn (helpers.ts):
 * fija el reloj y solo siembra una vez por contexto, así que reload() conserva lo que la app haya guardado.
 */
async function seedBrowser(
  page: Page,
  account: Account,
  data: Record<string, Record<string, unknown>>,
  others: Account[] = [],
) {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.addInitScript(
    ({ account, accounts, data }) => {
      if (localStorage.getItem("mp_users")) return;
      localStorage.setItem("mp_users", JSON.stringify(accounts.map((a) => ({ ...a, createdAt: "2026-09-01T00:00:00Z" }))));
      localStorage.setItem("mp_session", JSON.stringify({ id: account.id, username: account.username }));
      localStorage.setItem("mp_remembered", JSON.stringify(accounts.map((a) => a.username)));
      for (const [id, values] of Object.entries(data))
        for (const [k, v] of Object.entries(values)) localStorage.setItem(`mp_${id}_${k}`, JSON.stringify(v));
    },
    { account, accounts: [account, ...others], data },
  );
}

const readKey = (page: Page, userId: string, key: string) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), `mp_${userId}_${key}`);

/** Todo el localStorage, cadena a cadena, para comprobar "byte a byte igual". */
const snapshot = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));

const dataSection = (page: Page) => page.getByRole("region", { name: "Tus datos" });
const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
const goTo = (page: Page, tab: string) => nav(page).getByRole("link", { name: tab }).click();

async function openPerfil(page: Page) {
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
  await expect(dataSection(page)).toBeVisible();
}

/** "Exportar mis datos" → fichero descargado (nombre sugerido y contenido parseado). */
async function exportBackup(page: Page) {
  const downloading = page.waitForEvent("download");
  await dataSection(page).getByRole("button", { name: "Exportar mis datos" }).click();
  const download = await downloading;
  const path = await download.path();
  const text = await readFile(path, "utf8");
  return { name: download.suggestedFilename(), path, text, json: JSON.parse(text) };
}

type FileArg = string | { name: string; mimeType: string; buffer: Buffer };
const jsonFile = (text: string, name = "copia.json"): FileArg => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(text, "utf8"),
});

/** "Importar datos" abre el selector de ficheros y se elige `file`. */
async function chooseFile(page: Page, file: FileArg) {
  const choosing = page.waitForEvent("filechooser");
  await dataSection(page).getByRole("button", { name: "Importar datos" }).click();
  const chooser = await choosing;
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles(file);
}

/** Importa aceptando (o cancelando) la confirmación; devuelve los mensajes de los diálogos que hayan salido. */
async function importFile(page: Page, file: FileArg, answer: "accept" | "dismiss" = "accept") {
  const dialogs: string[] = [];
  const handler = async (d: import("@playwright/test").Dialog) => {
    dialogs.push(`${d.type()}: ${d.message()}`);
    await (answer === "accept" ? d.accept() : d.dismiss());
  };
  page.on("dialog", handler);
  await chooseFile(page, file);
  return {
    dialogs,
    done: () => page.off("dialog", handler),
  };
}

/** Deja una marca en window: si la página se recarga, desaparece. */
const markNoReload = (page: Page) => page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
const expectNoReload = async (page: Page) =>
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

async function signInA(page: Page) {
  await seedBrowser(
    page,
    ACCOUNT_A,
    {
      [ACCOUNT_A.id]: ACCOUNT_A_DATA,
      [OTHER_ACCOUNT.id]: { profile: { ...lucia, name: OTHER_MARKER }, pantry: [{ id: "o1", name: OTHER_MARKER, quantity: "1", category: "Nevera" }] },
    },
    [OTHER_ACCOUNT],
  );
}

async function signInB(page: Page, data: Record<string, unknown> = ACCOUNT_B_DATA) {
  await seedBrowser(page, ACCOUNT_B, { [ACCOUNT_B.id]: data });
}

/** En la cuenta A: marca "Brócoli" en la lista de la compra y exporta desde Perfil. */
async function exportFromA(browser: Browser) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await signInA(page);
  await page.goto("/plan/compra");
  await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
  await page.getByRole("checkbox", { name: "Brócoli", exact: true }).click();
  const progressText = page.getByText(/^1 de \d+ comprados$/);
  await expect(progressText).toBeVisible();
  const progress = await progressText.textContent();
  await openPerfil(page); // otro contexto, sin el viewport del proyecto: sin depender de la barra de navegación
  const file = await exportBackup(page);
  const storedA = Object.fromEntries(
    await Promise.all(USER_KEYS.map(async (k) => [k, await readKey(page, ACCOUNT_A.id, k)] as const)),
  );
  await ctx.close();
  return { file, progress: progress!, storedA };
}

// ---------------------------------------------------------------------------

test.describe("R1–R4: exportar mis datos", () => {
  test.beforeEach(async ({ page }) => {
    await signInA(page);
    await openPerfil(page);
  });

  test("R1: descarga mealplan-backup-<fecha de hoy>.json", async ({ page }) => {
    const { name } = await exportBackup(page);
    expect(name).toBe(`mealplan-backup-${TODAY}.json`);
  });

  test("R2: contiene los seis datos del usuario tal como están guardados", async ({ page }) => {
    const { json } = await exportBackup(page);
    for (const k of USER_KEYS) {
      const stored = await readKey(page, ACCOUNT_A.id, k);
      if (stored === null) expect(json.data[k] ?? null, k).toBeNull();
      else expect(json.data[k], k).toEqual(stored);
    }
    expect(json.data.profile.name).toBe("Lucía");
    expect(json.data.recipes).toEqual(expect.arrayContaining([AI_RECIPE]));
    expect(json.data.entries).toEqual(ACCOUNT_A_DATA.entries);
    expect(json.data.pantry).toEqual(ACCOUNT_A_DATA.pantry);
    expect(json.data.weekplan).toEqual(ACCOUNT_A_DATA.weekplan);
  });

  test("R2: incluye el estado de la lista de la compra", async ({ page }) => {
    await page.goto("/plan/compra");
    await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
    await page.getByRole("checkbox", { name: "Brócoli", exact: true }).click();
    await expect(page.getByText(/^1 de \d+ comprados$/)).toBeVisible();
    await goTo(page, "Perfil");
    const { json } = await exportBackup(page);
    expect(json.data.shopping).toEqual(await readKey(page, ACCOUNT_A.id, "shopping"));
    expect(Object.keys(json.data.shopping.current.bought)).toHaveLength(1);
  });

  test("R3: identificador de la app, schemaVersion 1 y fecha de exportación", async ({ page }) => {
    const { json } = await exportBackup(page);
    expect(json.app).toBe("mealplan");
    expect(json.schemaVersion).toBe(1);
    expect(new Date(json.exportedAt).getTime()).toBe(new Date(`${TODAY}T10:00:00`).getTime());
  });

  test("R4: sin hash, sal, id de cuenta ni nombre de usuario", async ({ page }) => {
    const { text } = await exportBackup(page);
    expect(text).not.toContain(ACCOUNT_A.hash);
    expect(text).not.toContain(ACCOUNT_A.salt);
    expect(text).not.toContain(ACCOUNT_A.id);
    expect(text).not.toContain(ACCOUNT_A.username); // "lucia"; el perfil se llama "Lucía"
    expect(text).toContain("Lucía");
  });

  test("R4: sin usuarios recordados ni datos de otra cuenta del navegador", async ({ page }) => {
    const { text } = await exportBackup(page);
    expect(text).not.toContain(OTHER_ACCOUNT.username);
    expect(text).not.toContain(OTHER_ACCOUNT.id);
    expect(text).not.toContain(OTHER_ACCOUNT.hash);
    expect(text).not.toContain(OTHER_MARKER);
  });

  test("R4: exportar no cambia nada guardado", async ({ page }) => {
    const before = await snapshot(page);
    await exportBackup(page);
    expect(await snapshot(page)).toEqual(before);
  });
});

test.describe("R11: aviso de que los datos solo viven en este navegador", () => {
  test("la sección 'Tus datos' lo explica junto a los botones", async ({ page }) => {
    await signInA(page);
    await openPerfil(page);
    const section = dataSection(page);
    await expect(section.getByText(/solo se guardan en este navegador/)).toBeVisible();
    await expect(section.getByText(/Exporta una copia de vez en cuando/)).toBeVisible();
    await expect(section.getByRole("button", { name: "Exportar mis datos" })).toBeVisible();
    await expect(section.getByRole("button", { name: "Importar datos" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------

test.describe("R5, R6, R10: importar en otro navegador deja la app idéntica", () => {
  test("de la cuenta A a una cuenta B en otro navegador, sin recargar, y sigue tras recargar", async ({ browser, page }) => {
    const { file, progress, storedA } = await exportFromA(browser);

    // Cuenta B, en otro contexto (otro localStorage): perfil y datos distintos.
    await signInB(page);
    await openPerfil(page);
    await expect(page.getByRole("region", { name: "Tu objetivo" }).getByText("Manuel")).toBeVisible();
    await markNoReload(page);

    // R5: confirmación con la fecha de exportación (el fichero se exportó el 22/09/2026 con el reloj fijo).
    const dialogs: string[] = [];
    page.once("dialog", (d) => {
      dialogs.push(d.message());
      void d.accept();
    });
    await chooseFile(page, jsonFile(file.text, file.name)); // el contexto de A ya se cerró y borró su descarga

    // R6: mensaje de éxito, sin recargar ni volver a iniciar sesión.
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toContain("22/09/2026");
    expect(dialogs[0]).toMatch(/todos tus datos/i);

    // Lo guardado en B es lo de A.
    for (const k of USER_KEYS) expect(await readKey(page, ACCOUNT_B.id, k), k).toEqual(storedA[k]);

    const checkScreens = async () => {
      // Perfil
      await goTo(page, "Perfil");
      await expect(page.getByRole("region", { name: "Tu objetivo" }).getByText("Lucía")).toBeVisible();
      await expect(page.getByRole("region", { name: "Tu objetivo" }).getByText("Manuel")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Objetivos diarios" })).toContainText(String(lucia.calorieGoal));
      // Diario
      await goTo(page, "Diario");
      await expect(page.getByText("Tostada con aguacate")).toBeVisible();
      await expect(page.getByText(`${AI_RECIPE.name} × 0,5`)).toBeVisible();
      await expect(page.getByText(`${BACKUP_TODAY_KCAL} / ${lucia.calorieGoal}`, { exact: true })).toBeVisible();
      await expect(page.getByText(B_ENTRY_NAME)).toHaveCount(0);
      // Plan (hoy)
      await goTo(page, "Plan");
      await expect(page.getByRole("heading", { name: "Plan semanal" })).toBeVisible();
      await expect(page.getByRole("button").filter({ hasText: POLLO_BROCOLI.name })).toBeVisible();
      // Lista de la compra: lo marcado en A sigue marcado
      await page.getByRole("link", { name: /Lista de la compra/ }).click();
      await expect(page.getByRole("heading", { name: "Lista de la compra", level: 1 })).toBeVisible();
      await expect(page.getByText(progress, { exact: true })).toBeVisible();
      // Recetas: la generada con IA
      await goTo(page, "Recetas");
      await expect(page.getByText(AI_RECIPE.name)).toBeVisible();
      // Despensa
      await goTo(page, "Despensa");
      await expect(page.getByText("Yogur natural")).toBeVisible();
      await expect(page.getByText("Lentejas pardinas")).toBeVisible();
      await expect(page.getByText(B_PANTRY_ITEM)).toHaveCount(0);
    };

    await checkScreens();
    await expectNoReload(page);

    // Tras recargar, siguen los datos importados.
    await page.reload();
    await checkScreens();
    for (const k of USER_KEYS) expect(await readKey(page, ACCOUNT_B.id, k), k).toEqual(storedA[k]);
  });

  test("en el mismo navegador: exportar e importar la propia copia no cambia nada", async ({ page }) => {
    await signInA(page);
    await openPerfil(page);
    const file = await exportBackup(page);
    const before = await snapshot(page);
    const { dialogs, done } = await importFile(page, file.path);
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    done();
    expect(dialogs).toHaveLength(1);
    expect(await snapshot(page)).toEqual(before);
  });

  test("R5: el selector solo pide ficheros .json", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const choosing = page.waitForEvent("filechooser");
    await dataSection(page).getByRole("button", { name: "Importar datos" }).click();
    const chooser = await choosing;
    expect(await chooser.element().getAttribute("accept")).toMatch(/\.json|application\/json/);
  });

  test("se puede importar el mismo fichero dos veces seguidas", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const file = jsonFile(backupText({ ...ACCOUNT_A_DATA }));
    const first = await importFile(page, file);
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    first.done();
    const second = await importFile(page, file);
    await expect.poll(() => second.dialogs.length).toBe(1);
    second.done();
  });
});

test.describe("R9: cancelar la confirmación no cambia nada", () => {
  test("los datos de B siguen igual, en pantalla y guardados", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const before = await snapshot(page);

    const { dialogs, done } = await importFile(page, jsonFile(backupText({ ...ACCOUNT_A_DATA })), "dismiss");
    await expect.poll(() => dialogs.length).toBe(1);
    done();

    expect(dialogs[0]).toContain("24/09/2026"); // EXPORTED_AT de la fixture
    await expect(dataSection(page).getByRole("status")).toHaveCount(0);
    expect(await snapshot(page)).toEqual(before);
    await expect(page.getByRole("region", { name: "Tu objetivo" }).getByText("Manuel")).toBeVisible();
    await goTo(page, "Despensa");
    await expect(page.getByText(B_PANTRY_ITEM)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------

test.describe("R7: una copia antigua pasa por las migraciones", () => {
  test("perfil v1 → dieta vegetariana y alergia al gluten; 'Snack' → 'Merienda'", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const { done } = await importFile(
      page,
      jsonFile(backupText({ profile: LEGACY_V1_PROFILE, entries: [SNACK_ENTRY], weekplan: { [TODAY]: [{ mealType: "Snack", recipeId: POLLO_BROCOLI.id }] } })),
    );
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    done();

    const prefs = page.getByRole("region", { name: "Alergias y dieta" });
    await expect(prefs.getByText("Gluten")).toBeVisible();
    await expect(prefs.getByText("Vegetariana")).toBeVisible();
    expect(await readKey(page, ACCOUNT_B.id, "profile")).toMatchObject({
      schemaVersion: 2,
      diet: "vegetarian",
      allergies: { preset: ["gluten"], custom: [] },
    });

    await goTo(page, "Diario");
    await expect(page.getByRole("region", { name: "Merienda", exact: true }).getByText("Manzana")).toBeVisible();
    expect((await readKey(page, ACCOUNT_B.id, "entries"))[0].mealType).toBe("Merienda");
    expect((await readKey(page, ACCOUNT_B.id, "weekplan"))[TODAY][0].mealType).toBe("Merienda");
    // Spec feedback 5: el fichero es la copia; importar no crea *_v1_backup.
    expect(await readKey(page, ACCOUNT_B.id, "profile_v1_backup")).toBeNull();
  });

  test("las recetas de ejemplo siguen ahí aunque la copia no las traiga", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const { done } = await importFile(page, jsonFile(backupText({ profile: manuel, recipes: [AI_RECIPE] })));
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    done();
    const recipes: { id: string }[] = await readKey(page, ACCOUNT_B.id, "recipes");
    expect(recipes[0].id).toBe(AI_RECIPE.id);
    expect(recipes.length).toBeGreaterThan(1);
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
  });
});

test.describe("R8: un fichero no válido muestra un error y no toca nada", () => {
  const CASES: [string, FileArg, RegExp][] = [
    ["no es JSON", jsonFile("esto no es una copia {", "notas.json"), /no es un JSON válido/],
    ["JSON sin el identificador de la app", jsonFile(JSON.stringify({ schemaVersion: 1, exportedAt: "2026-09-24T12:00:00.000Z", data: {} })), /no es una copia de MealPlan/],
    ["schemaVersion mayor que el conocido", jsonFile(backupText({ ...ACCOUNT_A_DATA }, { schemaVersion: 99 })), /versión más nueva/],
    ["entries que no es una lista", jsonFile(backupText({ ...ACCOUNT_A_DATA, entries: {} })), /«entries».*formato esperado/],
  ];

  for (const [label, file, message] of CASES) {
    test(`${label}: error con el motivo, sin confirmación y datos byte a byte iguales`, async ({ page }) => {
      await signInB(page);
      await openPerfil(page);
      const before = await snapshot(page);

      const { dialogs, done } = await importFile(page, file, "dismiss");
      await expect(dataSection(page).getByRole("alert")).toHaveText(message);
      done();

      expect(dialogs, "no debe aparecer la confirmación").toEqual([]);
      await expect(dataSection(page).getByRole("status")).toHaveCount(0);
      expect(await snapshot(page)).toEqual(before);
      await expect(page.getByRole("region", { name: "Tu objetivo" }).getByText("Manuel")).toBeVisible();
    });
  }

  test("un error previo desaparece al importar bien después", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const bad = await importFile(page, jsonFile("roto"));
    await expect(dataSection(page).getByRole("alert")).toBeVisible();
    bad.done();
    const good = await importFile(page, jsonFile(backupText({ ...ACCOUNT_A_DATA })));
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    good.done();
    await expect(dataSection(page).getByRole("alert")).toHaveCount(0);
  });
});

test.describe("Casos límite", () => {
  test("una copia con profile: null lleva al onboarding", async ({ page }) => {
    await signInB(page);
    await openPerfil(page);
    const { done } = await importFile(page, jsonFile(backupText({ profile: null, entries: [] })));
    await expect(page.getByLabel("¿Cómo te llamas?")).toBeVisible();
    done();
    expect(await readKey(page, ACCOUNT_B.id, "profile")).toBeNull();
  });

  test("importar no toca las otras cuentas del navegador ni las credenciales", async ({ page }) => {
    await signInA(page);
    await openPerfil(page);
    const before = await snapshot(page);
    const { done } = await importFile(page, jsonFile(backupText({ profile: manuel })));
    await expect(dataSection(page).getByRole("status")).toHaveText(/Datos importados/);
    done();
    const after = await snapshot(page);
    const ownKeys = new Set(USER_KEYS.map((k) => `mp_${ACCOUNT_A.id}_${k}`));
    for (const [k, v] of Object.entries(before)) if (!ownKeys.has(k)) expect(after[k], k).toBe(v);
  });
});
