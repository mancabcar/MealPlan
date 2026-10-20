// Spec: docs/pm/15-autocompletar-semana-ia/spec.md › R1, R2, R6, R15 (Acceptance criteria) y Edge cases.
// Tech: docs/pm/15-autocompletar-semana-ia/tech.md › UI y State & edge cases.
// Contrato de UI (lo que dev-code debe construir):
//   - Botón «Rellenar semana» en la misma fila que «Copiar semana anterior», solo en la semana actual y futuras.
//     Desactivado si no queda ninguna comida vacía de hoy en adelante, con el texto «No quedan comidas vacías desde hoy»
//     (aria-describedby).
//   - Tras rellenar, un aviso (role="status") «Rellenadas N franjas» («Rellenada 1 franja»), más « · K días no cumplen»
//     («1 día no cumple») si los hay, con el botón «Deshacer». El aviso se cierra al cambiar de semana.
// Datos: perfil `manuel` (5 tomas, 1980 kcal, proteína 130–170) y el recetario real. Hoy = martes 2026-09-22 (signIn
// fija el reloj): semana actual 21–27 sept.
// Pendiente (no se puede provocar desde la UI sin vaciar una franja a mano): que un segundo relleno sustituya al aviso
// y que Deshacer deshaga solo el último. Lo cubre dev-review leyendo el código (mismo patrón que #53).
import { expect, test, type Page } from "@playwright/test";
import type { WeekPlan } from "../../src/lib/types";
import seed from "../../src/data/recipes.json";
import { manuel } from "../fixtures/profiles";
import { WEEK, slotAt } from "../fixtures/rellenar-semana";
import { readStored, signIn } from "./helpers";

const fillBtn = (page: Page) => page.getByRole("button", { name: "Rellenar semana" });
const notice = (page: Page, text: RegExp | string) => page.getByRole("status").filter({ hasText: text });
const stored = (page: Page) => readStored<WeekPlan>(page, "weekplan");
const weekNav = (page: Page) => page.getByRole("navigation", { name: "Semana" });
const next = (page: Page) => weekNav(page).getByRole("button", { name: "Semana siguiente" });
const prev = (page: Page) => weekNav(page).getByRole("button", { name: "Semana anterior" });

const CATALOG = seed.recipes;
const id = (slot: string) => CATALOG.find((r) => r.tags.includes(slot))!.id;
const LENTEJAS = CATALOG.find((r) => r.name.startsWith("Lentejas estofadas con chorizo"))!.id;

async function open(page: Page, plan: WeekPlan = {}) {
  await signIn(page, { profile: manuel, weekplan: plan });
  await page.goto("/plan");
  await expect(weekNav(page)).toBeVisible();
}

/** Todas las comidas de manuel asignadas de martes a domingo (lunes vacío: es pasado y no cuenta). */
function fullFromToday(): WeekPlan {
  const bySlot = { Desayuno: "desayuno", "Media mañana": "snack", Comida: "comida", "Pre-entreno": "snack", Cena: "cena" } as const;
  return Object.fromEntries(
    WEEK.slice(1).map((date) => [date, manuel.meals.map((mealType) => ({ mealType, recipeId: id(bySlot[mealType as keyof typeof bySlot]) }))]),
  );
}

test.describe("R1: «Rellenar semana» en el Plan", () => {
  test("R1: se ve en la semana actual, junto a «Copiar semana anterior»", async ({ page }) => {
    await open(page);
    await expect(fillBtn(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: "Copiar semana anterior" })).toBeVisible();
  });

  test("R1: se ve en una semana futura", async ({ page }) => {
    await open(page);
    await next(page).click();
    await expect(fillBtn(page)).toBeEnabled();
  });

  test("R1: no se ve en una semana pasada", async ({ page }) => {
    await open(page);
    await prev(page).click();
    await expect(page.getByRole("button", { name: "Copiar semana anterior" })).toBeVisible();
    await expect(fillBtn(page)).toHaveCount(0);
  });

  test("R1: sin comidas vacías de hoy en adelante, desactivado con la explicación", async ({ page }) => {
    await open(page, fullFromToday());
    await expect(fillBtn(page)).toBeDisabled();
    await expect(fillBtn(page)).toHaveAccessibleDescription("No quedan comidas vacías desde hoy");
  });
});

test.describe("R2, R15: rellenar desde hoy sin tocar lo asignado", () => {
  test("R15: rellena las 30 franjas de martes a domingo y lo dice en el aviso", async ({ page }) => {
    await open(page);
    await fillBtn(page).click();
    await expect(notice(page, /^Rellenadas 30 franjas/)).toBeVisible();
    await expect(notice(page, /Rellenadas/).getByRole("button", { name: "Deshacer" })).toBeVisible();
    const plan = await stored(page);
    for (const date of WEEK.slice(1)) expect(plan[date]?.length, date).toBe(5);
  });

  test("R2: el lunes (pasado) y las franjas ya asignadas no cambian", async ({ page }) => {
    const before: WeekPlan = {
      [WEEK[0]]: [{ mealType: "Comida", recipeId: LENTEJAS }],
      [WEEK[2]]: [{ mealType: "Cena", recipeId: LENTEJAS, servings: 1.5 }],
    };
    await open(page, before);
    await fillBtn(page).click();
    await expect(notice(page, /^Rellenadas 29 franjas/)).toBeVisible();
    const plan = await stored(page);
    expect(plan[WEEK[0]]).toEqual(before[WEEK[0]]);
    expect(slotAt(plan, WEEK[2], "Cena")).toEqual(before[WEEK[2]][0]);
  });

  test("R2: tras rellenar, el botón queda desactivado (no queda nada vacío)", async ({ page }) => {
    await open(page);
    await fillBtn(page).click();
    await expect(notice(page, /Rellenadas/)).toBeVisible();
    await expect(fillBtn(page)).toBeDisabled();
  });
});

test.describe("R6: Deshacer", () => {
  test("R6: Deshacer devuelve la semana a como estaba", async ({ page }) => {
    const before: WeekPlan = { [WEEK[3]]: [{ mealType: "Comida", recipeId: LENTEJAS }] };
    await open(page, before);
    await fillBtn(page).click();
    await notice(page, /Rellenadas/).getByRole("button", { name: "Deshacer" }).click();
    await expect(notice(page, /Rellenadas/)).toHaveCount(0);
    await expect.poll(async () => stored(page)).toEqual(before);
    await expect(fillBtn(page)).toBeEnabled();
  });
});

test.describe("State: el aviso al cambiar de semana", () => {
  test("cambiar de semana cierra el aviso (y con él el Deshacer)", async ({ page }) => {
    await open(page);
    await fillBtn(page).click();
    await expect(notice(page, /Rellenadas/)).toBeVisible();
    await next(page).click();
    await expect(notice(page, /Rellenadas/)).toHaveCount(0);
  });
});
