import { expect, type Page } from "@playwright/test";

export const USER_ID = "e2e-user";

/** Misma fecha que tests/fixtures/profiles.ts: edad y "hoy" deterministas. */
export const TODAY = "2026-09-22";

/**
 * Deja al navegador con una sesión local iniciada (sin pasar por el login y su PBKDF2).
 * La sesión solo comprueba que el id exista en mp_users, así que el hash no importa.
 * Solo siembra una vez por contexto: los reload() conservan lo que la app haya guardado.
 */
export async function signIn(page: Page, data: Record<string, unknown> = {}) {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.addInitScript(
    ({ userId, data }) => {
      if (localStorage.getItem("mp_users")) return;
      localStorage.setItem(
        "mp_users",
        JSON.stringify([{ id: userId, username: "lucia", salt: "00", hash: "00", createdAt: "2026-09-01T00:00:00Z" }]),
      );
      localStorage.setItem("mp_session", JSON.stringify({ id: userId, username: "lucia" }));
      for (const [k, v] of Object.entries(data)) localStorage.setItem(`mp_${userId}_${k}`, JSON.stringify(v));
    },
    { userId: USER_ID, data },
  );
}

export async function readStored<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(([k]) => JSON.parse(localStorage.getItem(k) ?? "null"), [`mp_${USER_ID}_${key}`]);
}

// ---------------------------------------------------------------------------
// Pasos del onboarding. Los nombres accesibles salen del copy del spec/prototipo
// (ver tech.md › "UI test contract"): elección única = radio, multiselección = checkbox.
// ---------------------------------------------------------------------------

export async function stepNameAndGoal(page: Page, name: string, goal = "Perder grasa") {
  await page.getByLabel("¿Cómo te llamas?").fill(name);
  await page.getByRole("radio", { name: goal }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
}

export async function fillBodyData(
  page: Page,
  d: { sex: "Hombre" | "Mujer"; birthYear: string; heightCm: string; weightKg: string; activity: string },
) {
  await page.getByRole("radio", { name: d.sex }).check();
  await page.getByLabel("Año de nacimiento").fill(d.birthYear);
  await page.getByLabel("Altura (cm)").fill(d.heightCm);
  await page.getByLabel("Peso (kg)").fill(d.weightKg);
  await page.getByRole("radio", { name: d.activity }).check();
}

export const LUCIA_BODY = { sex: "Mujer", birthYear: "1992", heightCm: "165", weightKg: "62,0", activity: "Bastante" } as const;

/** Pasos 1 → 2 → 3a → 4a con los datos de Lucía, aceptando lo sugerido. Termina en el paso 5. */
export async function luciaThroughTargets(page: Page) {
  await stepNameAndGoal(page, "Lucía");
  await page.getByRole("button", { name: "Calcúlalo por mí" }).click();
  await fillBodyData(page, LUCIA_BODY);
  await page.getByRole("button", { name: "Calcular mis objetivos" }).click();
  await page.getByRole("button", { name: "Usar estos objetivos" }).click();
}

/** Paso 5: deja marcadas exactamente estas comidas y continúa. */
export async function chooseMeals(page: Page, meals: string[]) {
  for (const meal of ["Desayuno", "Media mañana", "Comida", "Merienda", "Pre-entreno", "Cena"]) {
    await page.getByRole("checkbox", { name: meal }).setChecked(meals.includes(meal));
  }
  await page.getByRole("button", { name: "Continuar" }).click();
}

export async function expectOnDashboard(page: Page) {
  await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
}
