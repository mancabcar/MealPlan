// Spec: docs/pm/18-recetas-propias/spec.md › Acceptance criteria R1, R3, R4, R6, R8, R9, R10.
// Tech: docs/pm/18-recetas-propias/tech.md › APIs / interfaces (`src/lib/recipeEdit.ts`, funciones puras) y Test coverage
// › contrato de las funciones:
//   - RecipeDraft: lo que escribe el usuario, todo en texto salvo las etiquetas:
//       { name, ingredients (una línea por ingrediente), instructions (una línea por paso), prepTimeMinutes, calories,
//         protein, carbs, fat, tags: string[] }.
//   - validateRecipeDraft(draft) → { ok: true, recipe: Omit<Recipe, "id" | "isCustom" | "isAIGenerated"> }
//                                | { ok: false, errors: Partial<Record<keyof RecipeDraft, string>> }
//     Obligatorios: nombre, ≥ 1 ingrediente (líneas vacías descartadas) y kcal. Cualquier número ≥ 0, con coma o punto;
//     P/C/G y tiempo vacíos valen 0. Negativos y texto → error en ese campo.
//   - suggestCalories(protein, carbs, fat) = 4·P + 4·C + 9·G, redondeado a entero.
//   - duplicateRecipe(recipe, id) → copia con id nuevo, isCustom: true, sin isAIGenerated, nombre "<nombre> (copia)".
//   - slotsUsingRecipe(plan, recipeId) → [{ date, mealType }], por fecha y, dentro del día, en orden canónico de comidas.
//   - withoutRecipe({ entries, plan, recipe }) → { entries, plan }: las entradas de esa receta pasan a customName (nombre de
//     la receta) sin recipeId, con macros y servings intactos; el plan pierde todas las franjas con ese recipeId
//     (cocinada y sobras); lo demás no cambia y las entradas/plan de entrada no se mutan.
//   - suggestedTags(recipes) → etiquetas ya usadas, sin repetir, las más usadas primero (empates por orden alfabético).
//
// Datos: tests/fixtures/recetas-propias.ts. Fallan hasta que exista src/lib/recipeEdit.ts (tarea 1 del tech design).
import { describe, expect, it } from "vitest";
import {
  duplicateRecipe,
  slotsUsingRecipe,
  suggestCalories,
  suggestedTags,
  validateRecipeDraft,
  withoutRecipe,
  type RecipeDraft,
} from "@/lib/recipeEdit";
import type { MealEntry } from "@/lib/types";
import {
  BATCH_ID,
  BOWL_POLLO,
  ENTRADAS,
  ENTRY_BOWL,
  ENTRY_MACARRONES,
  ENTRY_MACARRONES_MEDIA,
  ENTRY_SUELTA,
  IA_WRAP,
  MACARRONES_MAMA,
  PLAN_CON_MACARRONES,
  PLAN_SIN_MACARRONES,
  RECETAS_PROPIAS,
  SAT,
  SEMILLA_TORTILLA,
  THU,
  TUE,
} from "../fixtures/recetas-propias";

const DRAFT: RecipeDraft = {
  name: "Crema de calabaza",
  ingredients: "300g calabaza\n1 cebolla\n\n  sal  ",
  instructions: "Trocear.\nCocer.\nTriturar.",
  prepTimeMinutes: "30",
  calories: "180",
  protein: "5",
  carbs: "25",
  fat: "6",
  tags: ["cena", "vegano"],
};

const validated = (d: Partial<RecipeDraft>) => validateRecipeDraft({ ...DRAFT, ...d });

describe("R1: validar el borrador de una receta", () => {
  it("un borrador completo es válido y se convierte en receta: líneas recortadas, sin líneas vacías, números", () => {
    const result = validated({});
    expect(result).toEqual({
      ok: true,
      recipe: {
        name: "Crema de calabaza",
        ingredients: ["300g calabaza", "1 cebolla", "sal"],
        instructions: ["Trocear.", "Cocer.", "Triturar."],
        prepTimeMinutes: 30,
        calories: 180,
        protein: 5,
        carbs: 25,
        fat: 6,
        tags: ["cena", "vegano"],
      },
    });
  });

  it("solo nombre, ≥ 1 ingrediente y kcal son obligatorios: pasos, tiempo, P/C/G y tags vacíos valen 0 o vacío", () => {
    const result = validated({ instructions: "", prepTimeMinutes: "", protein: "", carbs: "", fat: "", tags: [] });
    expect(result).toMatchObject({
      ok: true,
      recipe: { instructions: [], prepTimeMinutes: 0, protein: 0, carbs: 0, fat: 0, tags: [] },
    });
  });

  it("sin nombre, sin ingredientes o sin kcal no es válido y el error apunta al campo que falta", () => {
    for (const [patch, field] of [
      [{ name: "   " }, "name"],
      [{ ingredients: " \n \n" }, "ingredients"],
      [{ calories: "" }, "calories"],
    ] as const) {
      const result = validated(patch);
      expect(result.ok, field).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors), field).toEqual([field]);
    }
  });

  it("acepta decimales con coma o punto y 0 kcal", () => {
    expect(validated({ calories: "0", protein: "12,5", carbs: "3.5" })).toMatchObject({
      ok: true,
      recipe: { calories: 0, protein: 12.5, carbs: 3.5 },
    });
  });

  it("rechaza negativos y texto en los campos numéricos, con el error en ese campo", () => {
    for (const [patch, field] of [
      [{ calories: "-10" }, "calories"],
      [{ protein: "mucho" }, "protein"],
      [{ carbs: "-1" }, "carbs"],
      [{ fat: "1,2,3" }, "fat"],
      [{ prepTimeMinutes: "-5" }, "prepTimeMinutes"],
    ] as const) {
      const result = validated(patch);
      expect(result.ok, field).toBe(false);
      if (!result.ok) expect(result.errors, field).toHaveProperty(field);
    }
  });

  it("permite nombres duplicados (edge case)", () => {
    expect(validated({ name: MACARRONES_MAMA.name }).ok).toBe(true);
  });
});

describe("R10: sugerencia de kcal a partir de P/C/G", () => {
  it("kcal = 4·P + 4·C + 9·G", () => {
    expect(suggestCalories(32, 45, 18)).toBe(4 * 32 + 4 * 45 + 9 * 18); // 470
    expect(suggestCalories(0, 0, 0)).toBe(0);
  });

  it("redondea a entero cuando hay decimales", () => {
    expect(suggestCalories(12.5, 3.5, 1)).toBe(Math.round(4 * 12.5 + 4 * 3.5 + 9)); // 73
  });
});

describe("R4: duplicar una receta para editarla", () => {
  it("una semilla se copia con id nuevo, isCustom y nombre '(copia)', sin tocar el original", () => {
    const copy = duplicateRecipe(SEMILLA_TORTILLA, "custom_nueva");
    expect(copy).toEqual({ ...SEMILLA_TORTILLA, id: "custom_nueva", name: "Tortilla de claras con verduras (copia)", isCustom: true });
    expect(SEMILLA_TORTILLA.id).toBe("recipe_001");
    expect(SEMILLA_TORTILLA).not.toHaveProperty("isCustom");
  });

  it("la copia no comparte arrays con el original", () => {
    const copy = duplicateRecipe(SEMILLA_TORTILLA, "custom_nueva");
    copy.ingredients.push("extra");
    expect(SEMILLA_TORTILLA.ingredients).not.toContain("extra");
  });

  it("una copia se puede volver a duplicar y una de IA pierde la marca de IA", () => {
    const first = duplicateRecipe(MACARRONES_MAMA, "custom_a");
    expect(duplicateRecipe(first, "custom_b")).toMatchObject({ id: "custom_b", name: "Macarrones de mamá (copia) (copia)", isCustom: true });
    const ia = duplicateRecipe(IA_WRAP, "custom_c");
    expect(ia.isCustom).toBe(true);
    expect(ia).not.toHaveProperty("isAIGenerated");
  });
});

describe("R3: franjas del Plan que usan una receta", () => {
  it("lista todas las franjas con esa receta (cocinada, sobras y sueltas), por fecha y comida", () => {
    expect(slotsUsingRecipe(PLAN_CON_MACARRONES, MACARRONES_MAMA.id)).toEqual([
      { date: TUE, mealType: "Comida" },
      { date: THU, mealType: "Cena" },
      { date: SAT, mealType: "Comida" },
    ]);
  });

  it("una receta que no está en el Plan devuelve una lista vacía", () => {
    expect(slotsUsingRecipe(PLAN_SIN_MACARRONES, MACARRONES_MAMA.id)).toEqual([]);
    expect(slotsUsingRecipe({}, MACARRONES_MAMA.id)).toEqual([]);
  });
});

describe("R3 / R8: borrar una receta en las entradas del Diario y el Plan", () => {
  const input = { entries: ENTRADAS, plan: PLAN_CON_MACARRONES, recipe: MACARRONES_MAMA };

  it("R3: el Plan pierde todas las franjas con esa receta (cocinada y sobras incluidas) y conserva las demás", () => {
    const { plan } = withoutRecipe(input);
    expect(slotsUsingRecipe(plan, MACARRONES_MAMA.id)).toEqual([]);
    expect(Object.values(plan).flat().some((s) => s.batchId === BATCH_ID)).toBe(false);
    expect(Object.values(plan).flat()).toEqual([{ mealType: "Comida", recipeId: BOWL_POLLO.id }]);
  });

  it("R8: las entradas de esa receta se conservan con nombre y macros, sin recipeId", () => {
    const { entries } = withoutRecipe(input);
    expect(entries).toHaveLength(ENTRADAS.length);
    const converted = entries.find((e) => e.id === ENTRY_MACARRONES.id) as MealEntry;
    expect(converted).toEqual({
      id: ENTRY_MACARRONES.id,
      date: ENTRY_MACARRONES.date,
      mealType: ENTRY_MACARRONES.mealType,
      customName: "Macarrones de mamá",
      calories: 480,
      protein: 32,
      carbs: 45,
      fat: 18,
    });
    expect(converted).not.toHaveProperty("recipeId");
  });

  it("R8: una entrada con raciones conserva servings y sus macros ya multiplicados", () => {
    const { entries } = withoutRecipe(input);
    expect(entries.find((e) => e.id === ENTRY_MACARRONES_MEDIA.id)).toEqual({
      id: ENTRY_MACARRONES_MEDIA.id,
      date: ENTRY_MACARRONES_MEDIA.date,
      mealType: ENTRY_MACARRONES_MEDIA.mealType,
      customName: "Macarrones de mamá",
      servings: 0.5,
      calories: 240,
      protein: 16,
      carbs: 22.5,
      fat: 9,
    });
  });

  it("las entradas de otras recetas y las sueltas no cambian", () => {
    const { entries } = withoutRecipe(input);
    expect(entries.find((e) => e.id === ENTRY_BOWL.id)).toEqual(ENTRY_BOWL);
    expect(entries.find((e) => e.id === ENTRY_SUELTA.id)).toEqual(ENTRY_SUELTA);
  });

  it("no muta las entradas ni el plan de entrada", () => {
    const entries = structuredClone(ENTRADAS);
    const plan = structuredClone(PLAN_CON_MACARRONES);
    withoutRecipe({ entries, plan, recipe: MACARRONES_MAMA });
    expect(entries).toEqual(ENTRADAS);
    expect(plan).toEqual(PLAN_CON_MACARRONES);
  });

  it("sin entradas ni franjas de esa receta no cambia nada", () => {
    const { entries, plan } = withoutRecipe({ entries: [ENTRY_BOWL, ENTRY_SUELTA], plan: PLAN_SIN_MACARRONES, recipe: MACARRONES_MAMA });
    expect(entries).toEqual([ENTRY_BOWL, ENTRY_SUELTA]);
    expect(plan).toEqual(PLAN_SIN_MACARRONES);
  });
});

describe("R9: etiquetas sugeridas", () => {
  it("devuelve las etiquetas ya usadas, sin repetir, las más usadas primero y los empates por orden alfabético", () => {
    // comida ×2 (propias) → primero; el resto ×1 por orden alfabético
    expect(suggestedTags([MACARRONES_MAMA, BOWL_POLLO])).toEqual(["comida", "alto proteína", "bowl", "pasta"]);
  });

  it("incluye las etiquetas de semilla y de IA, y sin recetas no hay sugerencias", () => {
    expect(suggestedTags(RECETAS_PROPIAS)).toEqual(
      expect.arrayContaining(["desayuno", "rápido", "vegetariano", "alto proteína", "comida"]),
    );
    expect(new Set(suggestedTags(RECETAS_PROPIAS)).size).toBe(suggestedTags(RECETAS_PROPIAS).length);
    expect(suggestedTags([])).toEqual([]);
  });
});
