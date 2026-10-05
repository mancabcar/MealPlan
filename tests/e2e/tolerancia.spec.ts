// Spec: docs/pm/49-tolerancia-cumplido/spec.md › R1, R2, R4 (persistencia), R7 (User flows: Perfil → Plan).
// Tech: tech.md › UI (contrato de la prueba, mismo patrón que la fila de fibra):
//   - Perfil › región «Objetivos diarios»: fila «Tolerancia» con «10 %» y botón «Editar tolerancia»; abre el campo
//     «Tolerancia de cumplido (%)» con «Guardar» (deshabilitado si no es un entero de 5 a 20), «Cancelar» y el error
//     «Un número entero entre 5 y 20 %». Junto a la fila, una línea de ayuda que menciona el Plan y el Diario.
//   - El valor se guarda en `profile.tolerancePct`.
// Datos: tests/fixtures/plan-macros.ts (hoy = martes 2026-09-22): el martes suma 1700 kcal con objetivo 2000,
// «Por debajo» con 10 % y «Dentro» con 15 %.
// Falla hasta que exista la fila de Perfil y el Plan use la tolerancia (tareas 2 y 4).
import { expect, test, type Page } from "@playwright/test";
import { PLAN_SEED } from "../fixtures/plan-macros";
import { readStored, signIn } from "./helpers";

const section = (page: Page, name: string) => page.getByRole("region", { name });
const kcalCell = (page: Page) =>
  page.getByRole("list", { name: "Macros del día" }).getByRole("listitem").filter({ hasText: "Calorías" });

test("R1 · R2 · R7: cambiar la tolerancia en Perfil cambia el estado en el Plan", async ({ page }) => {
  await signIn(page, PLAN_SEED);
  await page.goto("/plan");
  await expect(kcalCell(page).getByText("Por debajo", { exact: true })).toBeVisible();

  await page.goto("/perfil");
  const targets = section(page, "Objetivos diarios");
  await expect(targets.getByText("10 %", { exact: true })).toBeVisible();
  await expect(targets.getByText(/Plan y .*Diario/)).toBeVisible();

  await targets.getByRole("button", { name: "Editar tolerancia" }).click();
  await targets.getByLabel("Tolerancia de cumplido (%)").fill("15");
  await targets.getByRole("button", { name: "Guardar" }).click();
  await expect(targets.getByText("15 %", { exact: true })).toBeVisible();

  await page.goto("/plan");
  await expect(kcalCell(page).getByText("Dentro", { exact: true })).toBeVisible();
});

test("R1: la tolerancia persiste tras recargar", async ({ page }) => {
  await signIn(page, PLAN_SEED);
  await page.goto("/perfil");
  const targets = section(page, "Objetivos diarios");
  await targets.getByRole("button", { name: "Editar tolerancia" }).click();
  await targets.getByLabel("Tolerancia de cumplido (%)").fill("7");
  await targets.getByRole("button", { name: "Guardar" }).click();

  await page.reload();
  expect((await readStored<{ tolerancePct?: number }>(page, "profile")).tolerancePct).toBe(7);
  await expect(section(page, "Objetivos diarios").getByText("7 %", { exact: true })).toBeVisible();
});

test("R1: fuera de 5–20 muestra el error y no deja guardar", async ({ page }) => {
  await signIn(page, PLAN_SEED);
  await page.goto("/perfil");
  const targets = section(page, "Objetivos diarios");
  await targets.getByRole("button", { name: "Editar tolerancia" }).click();
  for (const bad of ["4", "21", "7,5", ""]) {
    await targets.getByLabel("Tolerancia de cumplido (%)").fill(bad);
    await expect(targets.getByText("Un número entero entre 5 y 20 %")).toBeVisible();
    await expect(targets.getByRole("button", { name: "Guardar" })).toBeDisabled();
  }
});
