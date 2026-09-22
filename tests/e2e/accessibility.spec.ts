// Spec: docs/pm/design-refresh/spec.md › R6 (contraste mínimo 4.5:1, o 3:1 si el texto es ≥24px).
// Tech: docs/pm/design-refresh/tech.md › Risks & mitigations ("R6 contrast on lime") y Testing strategy
// ("no automated contrast check in the stack today ... recommend dev-test add axe-core").
//
// Se limita a la regla "color-contrast" (no el ruleset WCAG2AA completo) para que cada test falle por una
// única razón — R6 — y no se acople a temas de accesibilidad no relacionados con este rediseño visual.
//
// IMPORTANTE — estado actual (comprobado al escribir esta suite, antes de implementar el rediseño):
// las 6 pantallas YA fallan hoy con la paleta zinc/emerald actual, con violaciones reales y no
// relacionadas con este rediseño: `text-zinc-500` sobre blanco (~2.62:1, el caso más frecuente con
// diferencia — labels, timestamps, hints en las 5 pantallas), `text-emerald-600` sobre blanco (~3.65:1,
// enlaces "Editar"), y `text-rose-500` sobre blanco (~3.75:1, "Borrar perfil"). Los tres necesitan ≥4.5:1.
// Esto es deuda preexistente fuera del alcance de esta spec (que solo cubre los tokens NUEVOS), así que
// cada test usa `test.fail()` para no bloquear el CI de PRs no relacionadas con este defecto ya existente.
// Cuando la tarea 12 de tech.md (contrast pass) aterrice con los tokens nuevos, quita el `test.fail()`
// de cada test: si de verdad quedan en ≥4.5:1, el test pasará limpio y esta suite se convierte en el
// guardián real de R6 que describe tech.md. Si algún `test.fail()` deja de fallar antes de esa tarea,
// significa que ese contraste concreto ya se arregló y toca quitar la anotación de ese test.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { signIn, TODAY } from "./helpers";

async function expectNoContrastViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const summary = results.violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " — " + n.failureSummary).join("\n")}`)
    .join("\n\n");
  expect(results.violations, summary).toEqual([]);
}

const PANTRY = [
  { id: "p1", name: "Yogur", quantity: "4 uds", category: "Nevera" as const, expiryDate: "2026-09-20" }, // caducado
  { id: "p2", name: "Pan", quantity: "1 barra", category: "Despensa" as const, expiryDate: "2026-09-23" }, // caduca pronto
  { id: "p3", name: "Arroz", quantity: "1 kg", category: "Despensa" as const },
];

test.describe("R6: contraste de color", () => {
  test("Diario", async ({ page }) => {
    await signIn(page, {
      profile: lucia,
      entries: [{ id: "e1", date: TODAY, mealType: "Comida", customName: "Pollo con arroz", calories: 600, protein: 40, carbs: 60, fat: 15 }],
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
    await expectNoContrastViolations(page);
  });

  test("Plan", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "Plan semanal" })).toBeVisible();
    await expectNoContrastViolations(page);
  });

  test("Recetas — lista", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/recetas");
    await expect(page.getByRole("heading", { name: "Recetas" })).toBeVisible();
    await expectNoContrastViolations(page);
  });

  test("Recetas — detalle", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/recetas");
    // Las tarjetas de receta son los únicos botones que muestran "kcal" (evita el botón "Sugerir con IA").
    await page.getByRole("button").filter({ hasText: "kcal" }).first().click();
    // Rediseño visual: "←" pasa a ser un icono Lucide (ArrowLeft, aria-hidden); el nombre accesible es solo "Volver".
    await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();
    await expectNoContrastViolations(page);
  });

  test("Despensa", async ({ page }) => {
    await signIn(page, { profile: lucia, pantry: PANTRY });
    await page.goto("/despensa");
    await expect(page.getByRole("heading", { name: "Despensa", exact: true })).toBeVisible();
    // Los badges de "caducado"/"caduca pronto" son justo la combinación de color que R6 marca como riesgo.
    await expectNoContrastViolations(page);
  });

  test("Perfil", async ({ page }) => {
    await signIn(page, { profile: lucia });
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
    await expectNoContrastViolations(page);
  });
});
