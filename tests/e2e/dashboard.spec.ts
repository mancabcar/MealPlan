// Spec: R17 + decisión de PM (2026-09-22): con rango, cualquier valor dentro de la banda cuenta como cumplido.
// NOTE (rediseño visual, docs/pm/design-refresh/tech.md tarea 6): hoy el "cumplido" se marca con el
// carácter "✓ " incrustado en el mismo nodo de texto que el número. La tarea 6 sustituye ese indicador
// por un icono Lucide (Check) para preservar "la lógica del ✓" (tech.md) con el nuevo lenguaje visual.
// Cuando esa tarea aterrice, la aserción marcada FRÁGIL más abajo dejará de encontrar el texto y debe
// actualizarse para comprobar el icono (o un texto accesible equivalente) — no borrar la comprobación,
// solo cambiar su forma. La aserción del número por sí solo no depende del icono y no debería cambiar.
import { expect, test } from "@playwright/test";
import { manuel } from "../fixtures/profiles";
import { signIn, TODAY } from "./helpers";

const entry = (protein: number) => ({
  id: `e${protein}`,
  date: TODAY,
  mealType: "Comida",
  customName: "Pollo con arroz",
  calories: 600,
  protein,
  carbs: 60,
  fat: 15,
});

test("R17: 140 g con un rango 130–170 se marca como cumplido", async ({ page }) => {
  await signIn(page, { profile: manuel, entries: [entry(140)] });
  await page.goto("/");
  // Estable frente al rediseño: el número en sí no depende de cómo se represente el indicador de "cumplido".
  await expect(page.getByText("140 / 130–170")).toBeVisible();
  // El "cumplido" ahora se marca con un icono Lucide (Check) con nombre accesible, no con el glifo "✓" en texto.
  await expect(page.getByLabel("Cumplido")).toBeVisible();
});

test("R17: por debajo del mínimo no se marca como cumplido", async ({ page }) => {
  await signIn(page, { profile: manuel, entries: [entry(120)] });
  await page.goto("/");
  await expect(page.getByText("120 / 130–170", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Cumplido")).toHaveCount(0);
});
