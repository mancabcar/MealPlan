// Spec: docs/pm/53-copiar-semana-anterior/spec.md › R1–R5 (Acceptance criteria) y Edge cases.
// Tech: docs/pm/53-copiar-semana-anterior/tech.md › UI y State & edge cases.
// Contrato de UI (lo que dev-code debe construir):
//   - Botón «Copiar semana anterior» bajo la navegación de semana; desactivado si la semana anterior no tiene nada,
//     con el texto de ayuda «La semana anterior no tiene nada que copiar» (aria-describedby).
//   - Con conflictos, un diálogo «N franjas ya tienen receta» («1 franja ya tiene receta») con los botones
//     «Conservar las que hay», «Reemplazarlas» y «Cancelar». Sin conflictos no hay diálogo.
//   - Tras copiar, un aviso (role="status") «Copiadas N franjas» («Copiada 1 franja») con el botón «Deshacer»; si no hay
//     nada que escribir, «No hay nada nuevo que copiar» sin Deshacer. Aviso y diálogo se cierran al cambiar de semana.
// Datos: tests/fixtures/copiar-semana.ts. Hoy = martes 2026-09-22 (signIn fija el reloj): destino 21–27 sept,
// origen 14–20 sept. Lucia hace Desayuno, Comida, Merienda y Cena.
// Pendiente (no se puede provocar desde la UI): que Deshacer restaure SOLO los 7 días de la semana destino y no el plan
// entero (R5): cambiar de semana cierra el aviso y no hay otra forma de editar otra semana con el aviso abierto.
// Lo cubre dev-review leyendo el código.
import { expect, test, type Page } from "@playwright/test";
import type { WeekPlan } from "../../src/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  COPY_RECIPES,
  DATILES,
  DST,
  GUISO,
  POLLO_BROCOLI,
  SRC,
  SRC_BATCH_ONLY,
  SRC_PLAN,
  SRC_SIMPLE,
  slotAt,
} from "../fixtures/copiar-semana";
import { readStored, signIn } from "./helpers";

const copyBtn = (page: Page) => page.getByRole("button", { name: "Copiar semana anterior" });
const dialog = (page: Page) => page.getByRole("dialog", { name: /ya tiene(n)? receta/ });
const notice = (page: Page, text: RegExp | string) => page.getByRole("status").filter({ hasText: text });
const stored = (page: Page) => readStored<WeekPlan>(page, "weekplan");
const next = (page: Page) => page.getByRole("navigation", { name: "Semana" }).getByRole("button", { name: "Semana siguiente" });

async function open(page: Page, plan: WeekPlan) {
  await signIn(page, { profile: lucia, recipes: COPY_RECIPES, weekplan: plan });
  await page.goto("/plan");
  await expect(page.getByRole("navigation", { name: "Semana" })).toBeVisible();
}

const merge = (...plans: WeekPlan[]): WeekPlan => Object.assign({}, ...plans);

// Dos franjas del destino que la copia de SRC_SIMPLE pisaría (lunes Comida y martes Cena)
const TWO_CONFLICTS = merge(SRC_SIMPLE, {
  [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }],
  [DST[1]]: [{ mealType: "Cena", recipeId: GUISO.id }],
});

test.describe("R1: copiar la semana anterior", () => {
  test("R1: copia las 8 franjas de la semana anterior a la semana actual", async ({ page }) => {
    await open(page, SRC_PLAN);
    await copyBtn(page).click();
    await expect(notice(page, "Copiadas 8 franjas")).toBeVisible();
    await expect.poll(async () => slotAt(await stored(page), DST[0], "Comida")?.recipeId).toBe(POLLO_BROCOLI.id);
    await page.getByRole("tab", { name: "Lunes 21" }).click();
    await expect(page.getByText("Pollo al horno con brócoli")).toBeVisible();
  });

  test("R1: conserva las raciones de cada franja", async ({ page }) => {
    await open(page, SRC_SIMPLE);
    await copyBtn(page).click();
    await expect.poll(async () => slotAt(await stored(page), DST[1], "Cena")?.servings).toBe(1.5);
  });

  test("R1: funciona en cualquier semana vista: copia la anterior a la que se ve", async ({ page }) => {
    await open(page, { [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }] });
    await next(page).click();
    await copyBtn(page).click();
    await expect(notice(page, "Copiada 1 franja")).toBeVisible();
    await expect.poll(async () => slotAt(await stored(page), "2026-09-28", "Comida")?.recipeId).toBe(DATILES.id);
  });
});

test.describe("R2: conflictos con franjas ocupadas", () => {
  test("R2: sin conflictos no aparece el diálogo", async ({ page }) => {
    await open(page, SRC_SIMPLE);
    await copyBtn(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
  });

  test("R2: con conflictos avisa con el número exacto y no cambia nada hasta elegir", async ({ page }) => {
    await open(page, TWO_CONFLICTS);
    await copyBtn(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "2 franjas ya tienen receta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conservar las que hay" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reemplazarlas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
    expect(await stored(page)).toEqual(TWO_CONFLICTS);
  });

  test("R2: con un solo conflicto el título va en singular", async ({ page }) => {
    await open(page, merge(SRC_SIMPLE, { [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }] }));
    await copyBtn(page).click();
    await expect(page.getByRole("dialog", { name: "1 franja ya tiene receta" })).toBeVisible();
  });

  test("R2: Conservar deja las ocupadas y rellena las vacías", async ({ page }) => {
    await open(page, TWO_CONFLICTS);
    await copyBtn(page).click();
    await page.getByRole("button", { name: "Conservar las que hay" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(notice(page, "Copiada 1 franja")).toBeVisible();
    await expect.poll(async () => slotAt(await stored(page), DST[4], "Desayuno")?.recipeId).toBeTruthy();
    const plan = await stored(page);
    expect(slotAt(plan, DST[0], "Comida")?.recipeId).toBe(DATILES.id);
    expect(slotAt(plan, DST[1], "Cena")?.recipeId).toBe(GUISO.id);
  });

  test("R2: Reemplazar pisa las ocupadas con las de origen", async ({ page }) => {
    await open(page, TWO_CONFLICTS);
    await copyBtn(page).click();
    await page.getByRole("button", { name: "Reemplazarlas" }).click();
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
    await expect.poll(async () => slotAt(await stored(page), DST[0], "Comida")?.recipeId).toBe(POLLO_BROCOLI.id);
    expect(slotAt(await stored(page), DST[1], "Cena")?.servings).toBe(1.5);
  });

  test("R2: Cancelar no cambia nada y no hay aviso", async ({ page }) => {
    await open(page, TWO_CONFLICTS);
    await copyBtn(page).click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(notice(page, /Copiad/)).toHaveCount(0);
    expect(await stored(page)).toEqual(TWO_CONFLICTS);
  });
});

test.describe("R3: tandas con sobras", () => {
  test("R3: la tanda llega entera: cocinada el martes y sobras el miércoles y el jueves", async ({ page }) => {
    await open(page, SRC_BATCH_ONLY);
    await copyBtn(page).click();
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
    await page.getByRole("tab", { name: "Martes 22" }).click();
    await expect(page.getByText("Cocinar ×3")).toBeVisible();
    await page.getByRole("tab", { name: "Miércoles 23" }).click();
    await expect(page.getByText("Sobras · de Martes")).toBeVisible();
    await page.getByRole("tab", { name: "Jueves 24" }).click();
    await expect(page.getByText("Sobras · de Martes")).toBeVisible();
  });

  test("R3: la tanda copiada tiene un `batchId` distinto del de origen", async ({ page }) => {
    await open(page, SRC_BATCH_ONLY);
    await copyBtn(page).click();
    await expect.poll(async () => slotAt(await stored(page), DST[1], "Comida")?.batchId).toBeTruthy();
    const plan = await stored(page);
    const copied = slotAt(plan, DST[1], "Comida")!.batchId;
    expect(copied).not.toBe(slotAt(plan, SRC[1], "Comida")!.batchId);
    expect(slotAt(plan, DST[2], "Comida")!.batchId).toBe(copied);
    expect(slotAt(plan, DST[3], "Cena")!.batchId).toBe(copied);
  });
});

test.describe("R4: semana anterior vacía", () => {
  test("R4: el botón está desactivado y el texto lo explica", async ({ page }) => {
    await open(page, { [DST[0]]: [{ mealType: "Comida", recipeId: DATILES.id }] });
    await expect(copyBtn(page)).toBeDisabled();
    await expect(page.getByText("La semana anterior no tiene nada que copiar")).toBeVisible();
    await expect(copyBtn(page)).toHaveAccessibleDescription("La semana anterior no tiene nada que copiar");
  });

  test("R4: con algo en la semana anterior el botón está activo y sin texto de ayuda", async ({ page }) => {
    await open(page, SRC_SIMPLE);
    await expect(copyBtn(page)).toBeEnabled();
    await expect(page.getByText("La semana anterior no tiene nada que copiar")).toHaveCount(0);
  });
});

test.describe("R5: aviso con Deshacer", () => {
  test("R5: Deshacer devuelve la semana a como estaba antes de copiar", async ({ page }) => {
    await open(page, TWO_CONFLICTS);
    await copyBtn(page).click();
    await page.getByRole("button", { name: "Reemplazarlas" }).click();
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
    await notice(page, "Copiadas 3 franjas").getByRole("button", { name: "Deshacer" }).click();
    await expect(notice(page, /Copiad/)).toHaveCount(0);
    await expect.poll(async () => slotAt(await stored(page), DST[0], "Comida")?.recipeId).toBe(DATILES.id);
    const plan = await stored(page);
    expect(slotAt(plan, DST[1], "Cena")?.recipeId).toBe(GUISO.id);
    expect(slotAt(plan, DST[4], "Desayuno")).toBeUndefined();
    expect(plan[SRC[0]]).toEqual(TWO_CONFLICTS[SRC[0]]); // la semana origen sigue igual
  });

  test("R5: Deshacer tras copiar sobre una semana vacía la deja vacía", async ({ page }) => {
    await open(page, SRC_PLAN);
    await copyBtn(page).click();
    await notice(page, "Copiadas 8 franjas").getByRole("button", { name: "Deshacer" }).click();
    await expect
      .poll(async () => {
        const plan = await stored(page);
        return DST.flatMap((d) => plan[d] ?? []).length;
      })
      .toBe(0);
  });

  test("R5: si no hay nada nuevo, «No hay nada nuevo que copiar» sin Deshacer y sin escribir", async ({ page }) => {
    await open(page, SRC_SIMPLE);
    await copyBtn(page).click();
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
    await copyBtn(page).click(); // segundo toque: todo idéntico
    const second = notice(page, "No hay nada nuevo que copiar");
    await expect(second).toBeVisible();
    await expect(second.getByRole("button", { name: "Deshacer" })).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
  });
});

test.describe("State & edge cases", () => {
  test("al cambiar de semana se cierra el aviso con Deshacer", async ({ page }) => {
    await open(page, SRC_SIMPLE);
    await copyBtn(page).click();
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
    await next(page).click();
    await expect(notice(page, /Copiad/)).toHaveCount(0);
  });

  test("al cambiar de semana se cierra el diálogo de conflictos", async ({ page }) => {
    await open(page, TWO_CONFLICTS);
    await copyBtn(page).click();
    await expect(dialog(page)).toBeVisible();
    // El diálogo cubre la pantalla: se lanza el clic sobre el botón sin pasar por el hit-test del fondo
    await next(page).dispatchEvent("click");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("al pulsar copiar se cierra el selector de receta que estuviera abierto", async ({ page }) => {
    await open(page, SRC_SIMPLE);
    await page.getByRole("button", { name: /Desayuno/ }).first().click();
    await expect(page.getByRole("group", { name: "Elegir receta" })).toBeVisible();
    await copyBtn(page).click();
    await expect(page.getByRole("group", { name: "Elegir receta" })).toHaveCount(0);
  });

  test("una receta borrada en el origen no se copia y no cuenta", async ({ page }) => {
    const plan = merge(SRC_SIMPLE, { [SRC[2]]: [{ mealType: "Comida", recipeId: "receta-borrada" }] });
    await open(page, plan);
    await copyBtn(page).click();
    await expect(notice(page, "Copiadas 3 franjas")).toBeVisible();
    expect(slotAt(await stored(page), DST[2], "Comida")).toBeUndefined();
  });
});
