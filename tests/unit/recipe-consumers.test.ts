// Spec: docs/pm/18-recetas-propias/spec.md › R5 (la receta propia cuenta en la lista de la compra y en los macros del Plan).
// Follow-up del review (docs/pm/18-recetas-propias/review.md): estas dos piezas no cambian, pero leen `recipes` del store,
// así que una receta propia (id custom_, isCustom) tiene que sumar igual que una semilla.
import { describe, expect, it } from "vitest";
import { aggregate, collectSources } from "@/lib/shopping/aggregate";
import { dayPlanSummary } from "@/lib/planMacros";
import { withoutRecipe } from "@/lib/recipeEdit";
import { MEAL_TYPES } from "@/lib/types";
import { BOWL_POLLO, MACARRONES_MAMA, PLAN_CON_MACARRONES, RECETAS_PROPIAS, SAT, TUE, WED } from "../fixtures/recetas-propias";

const dates = [TUE, WED, SAT];
const input = { weekPlan: PLAN_CON_MACARRONES, recipes: RECETAS_PROPIAS, dates, meals: MEAL_TYPES };
const names = (i: typeof input) => aggregate(collectSources(i)).map((x) => x.name.toLowerCase());

describe("R5: lista de la compra con recetas propias", () => {
  it("los ingredientes de una receta propia planificada aparecen en la lista", () => {
    const n = names(input);
    expect(n).toEqual(expect.arrayContaining(["macarrones", "carne picada", "queso rallado"]));
    expect(n.some((x) => x.includes("pollo"))).toBe(true); // el bowl, también propio
  });

  it("al editar los ingredientes de la receta, la lista los refleja", () => {
    const edited = { ...MACARRONES_MAMA, ingredients: ["80g macarrones", "200g tomate frito"] };
    const n = names({ ...input, recipes: RECETAS_PROPIAS.map((r) => (r.id === edited.id ? edited : r)) });
    expect(n.some((x) => x.includes("tomate"))).toBe(true);
    expect(n).not.toContain("queso rallado");
  });

  it("al borrar la receta ya no aporta ingredientes (sus franjas se vacían)", () => {
    const { plan } = withoutRecipe({ entries: [], plan: PLAN_CON_MACARRONES, recipe: MACARRONES_MAMA });
    const n = names({ ...input, weekPlan: plan });
    expect(n).not.toContain("macarrones");
    expect(n.some((x) => x.includes("pollo"))).toBe(true);
  });
});

describe("R5: macros del Plan con recetas propias", () => {
  it("el resumen del día suma los macros de la receta propia", () => {
    const summary = dayPlanSummary({ slots: PLAN_CON_MACARRONES[TUE], recipes: RECETAS_PROPIAS, meals: MEAL_TYPES });
    expect(summary?.totals).toEqual({ calories: 480, protein: 32, carbs: 45, fat: 18 });
    expect(summary?.planned).toBe(1);
  });

  it("al editar los macros de la receta, el Plan muestra los nuevos", () => {
    const recipes = RECETAS_PROPIAS.map((r) => (r.id === MACARRONES_MAMA.id ? { ...r, calories: 500 } : r));
    expect(dayPlanSummary({ slots: PLAN_CON_MACARRONES[TUE], recipes, meals: MEAL_TYPES })?.totals.calories).toBe(500);
  });

  it("otra receta propia suma sus propios macros el día que se planifica", () => {
    const summary = dayPlanSummary({ slots: PLAN_CON_MACARRONES[WED], recipes: RECETAS_PROPIAS, meals: MEAL_TYPES });
    expect(summary?.totals.calories).toBe(BOWL_POLLO.calories);
  });
});
