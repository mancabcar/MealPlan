// Spec: docs/pm/55-mis-alimentos/spec.md › Acceptance criteria R1 (registrar), R2 (guardar desde una entrada y dedupe
// por nombre), R7 (ocultar en Recientes), R8 (orden por frecuencia en la franja) y Edge cases (receta de otra franja o
// borrada, alimento con otra cantidad, sin conexión).
// Tech: docs/pm/55-mis-alimentos/tech.md › Data model, APIs / interfaces y State & edge cases. Firmas acordadas con
// Manuel el 2026-10-10 (src/lib/mealFavorites.ts):
//   customNameKey(name) · sanitizeMealFavorites(raw) · favoriteFromEntry(e, id?) · favoriteEntry(fav, date, mealType, id?)
//   upsertCustom(list, fav) · hiddenInRecents(items, recipeIds) · rankFavorites({ items, recipeIds, recipes, entries, mealType })
//   RankedFavorite = { key, name, calories, label, fav?, recipe? }
// Fallan hasta la tarea 1 del tech design.
import { describe, expect, it } from "vitest";
import {
  customNameKey,
  favoriteEntry,
  favoriteFromEntry,
  hiddenInRecents,
  rankFavorites,
  sanitizeMealFavorites,
  upsertCustom,
  type MealFavorite,
} from "@/lib/mealFavorites";
import { foodEntry, recentMeals } from "@/lib/diary";
import type { MealEntry, MealType } from "@/lib/types";
import {
  AVENA,
  AVENA_FAV,
  CAFE_FAV,
  CREMA_FAV,
  FAV_RECIPES,
  HUEVOS_FAV,
  HUEVO_PER100,
  POLLO_CURRY,
  PORRIDGE,
  TODAY,
  TORTILLA_FAV,
  TOSTADA_FAV,
  TWO_DAYS_AGO,
  YESTERDAY,
  YOGUR,
  customEntry,
  foodEntryOf,
  recipeEntryOf,
} from "../fixtures/favoritos-anadir";

const rank = (items: MealFavorite[], entries: MealEntry[], mealType: MealType, recipeIds: string[] = []) =>
  rankFavorites({ items, recipeIds, recipes: FAV_RECIPES, entries, mealType }).map((f) => f.name);

// ---------------------------------------------------------------------------

describe("customNameKey: sin mayúsculas ni espacios extra (R2, R7, R8)", () => {
  it("«  Tortilla   FRANCESA » y «tortilla francesa» son la misma", () => {
    expect(customNameKey("  Tortilla   FRANCESA ")).toBe(customNameKey("tortilla francesa"));
  });
});

describe("sanitizeMealFavorites (Data model)", () => {
  it("lo que no es una lista → []", () => {
    expect(sanitizeMealFavorites(null)).toEqual([]);
    expect(sanitizeMealFavorites({})).toEqual([]);
  });

  it("conserva personalizadas y alimentos bien formados", () => {
    expect(sanitizeMealFavorites([TORTILLA_FAV, TOSTADA_FAV, AVENA_FAV, HUEVOS_FAV])).toEqual([TORTILLA_FAV, TOSTADA_FAV, AVENA_FAV, HUEVOS_FAV]);
  });

  it("descarta los mal formados: sin id, kind raro, NaN, gramos ≤ 0, per100 incompleto", () => {
    const bad = [
      { ...TORTILLA_FAV, id: "" },
      { ...TORTILLA_FAV, id: "x1", kind: "otra" },
      { ...TORTILLA_FAV, id: "x2", calories: Number.NaN },
      { ...TORTILLA_FAV, id: "x3", name: "" },
      { ...AVENA_FAV, id: "x4", grams: 0 },
      { ...AVENA_FAV, id: "x5", per100: { kcal: 375 } },
      "fav-tortilla",
    ];
    expect(sanitizeMealFavorites([...bad, CREMA_FAV])).toEqual([CREMA_FAV]);
  });
});

describe("favoriteFromEntry (R2: guardar desde una fila de Recientes)", () => {
  it("R2: una personalizada guarda nombre, kcal, macros y fibra", () => {
    const fav = favoriteFromEntry(customEntry(YESTERDAY, "Cena", { customName: "Tostada con aceite", calories: 210, protein: 5, carbs: 28, fat: 11, fiber: 3 }), "nuevo");
    expect(fav).toEqual({ ...TOSTADA_FAV, id: "nuevo" });
  });

  it("una personalizada sin fibra no inventa el campo", () => {
    const fav = favoriteFromEntry(customEntry(YESTERDAY, "Cena"), "nuevo");
    expect(fav).not.toHaveProperty("fiber");
  });

  it("R2: un alimento guarda su alimento de origen y su cantidad («Yogur griego 125 g»)", () => {
    const fav = favoriteFromEntry(foodEntryOf(YESTERDAY, "Desayuno", YOGUR, 125), "nuevo");
    expect(fav).toMatchObject({ id: "nuevo", kind: "food", foodId: "local:yogur-griego", name: "Yogur griego", grams: 125 });
    expect(fav).not.toHaveProperty("units");
  });

  it("los valores por 100 g salen de la entrada (macro × 100 / gramos), fibra incluida", () => {
    const fav = favoriteFromEntry(foodEntryOf(YESTERDAY, "Desayuno", AVENA, 40), "nuevo");
    if (fav?.kind !== "food") throw new Error("se esperaba un alimento");
    expect(fav.per100.kcal).toBeCloseTo(375);
    expect(fav.per100.protein).toBeCloseTo(13.5);
    expect(fav.per100.carbs).toBeCloseTo(59);
    expect(fav.per100.fat).toBeCloseTo(7);
    expect(fav.per100.fiber).toBeCloseTo(10);
  });

  it("un alimento registrado en unidades guarda también las unidades", () => {
    const fav = favoriteFromEntry(foodEntryOf(YESTERDAY, "Desayuno", { foodId: "local:huevo", name: "Huevo", per100: HUEVO_PER100 }, 120, 2), "nuevo");
    expect(fav).toMatchObject({ kind: "food", grams: 120, units: 2 });
  });

  it("una receta no es un mealFavorite (va en `favorites`, #20) → null", () => {
    expect(favoriteFromEntry(recipeEntryOf(YESTERDAY, "Cena", POLLO_CURRY))).toBeNull();
  });

  it("Edge: un alimento sin gramos válidos → null (la fila no lleva ☆)", () => {
    const e = foodEntryOf(YESTERDAY, "Desayuno", AVENA, 40);
    expect(favoriteFromEntry({ ...e, grams: 0 })).toBeNull();
    expect(favoriteFromEntry({ ...e, grams: undefined })).toBeNull();
  });

  it("sin id, genera uno", () => {
    expect(favoriteFromEntry(customEntry(YESTERDAY, "Cena"))?.id).toEqual(expect.any(String));
  });
});

describe("favoriteEntry (R1: registrar un favorito)", () => {
  it("R1: una personalizada se registra con sus datos en la franja y el día pedidos", () => {
    expect(favoriteEntry(TOSTADA_FAV, TODAY, "Cena", "e1")).toEqual({
      id: "e1",
      date: TODAY,
      mealType: "Cena",
      customName: "Tostada con aceite",
      calories: 210,
      protein: 5,
      carbs: 28,
      fat: 11,
      fiber: 3,
    });
  });

  it("Edge: sin fibra en el favorito, la entrada no la lleva («sin dato»)", () => {
    expect(favoriteEntry(TORTILLA_FAV, TODAY, "Cena", "e1")).not.toHaveProperty("fiber");
  });

  it("R1: «Avena 40 g» se registra con los macros calculados como en el buscador de alimentos", () => {
    const expected = foodEntry({ foodId: "local:avena-copos", name: "Avena", per100: AVENA.per100 }, TODAY, "Desayuno", { grams: 40, id: "e1" });
    expect(favoriteEntry(AVENA_FAV, TODAY, "Desayuno", "e1")).toEqual(expected);
    expect(Math.round(expected.calories)).toBe(150);
  });

  it("un alimento en unidades conserva las unidades", () => {
    expect(favoriteEntry(HUEVOS_FAV, TODAY, "Desayuno", "e1")).toMatchObject({ grams: 120, units: 2, foodId: "local:huevo" });
  });
});

describe("upsertCustom (R2: sin duplicados por nombre)", () => {
  it("añade al final una personalizada nueva", () => {
    expect(upsertCustom([TORTILLA_FAV], TOSTADA_FAV)).toEqual([TORTILLA_FAV, TOSTADA_FAV]);
  });

  it("R2: con el mismo nombre (mayúsculas y espacios aparte) actualiza los macros de la existente, sin una segunda", () => {
    const nueva: MealFavorite = { ...TORTILLA_FAV, id: "otro", name: " tortilla  Francesa", calories: 200, fat: 16 };
    const result = upsertCustom([CREMA_FAV, TORTILLA_FAV, AVENA_FAV], nueva);
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({ id: "fav-tortilla", calories: 200, fat: 16 });
    expect(result[0]).toEqual(CREMA_FAV);
    expect(result[2]).toEqual(AVENA_FAV);
  });

  it("no toca la lista original", () => {
    const list = [TORTILLA_FAV];
    upsertCustom(list, { ...TORTILLA_FAV, id: "otro", calories: 1 });
    expect(list).toEqual([TORTILLA_FAV]);
  });
});

describe("R7: lo que ya es favorito no aparece en Recientes", () => {
  const hidden = hiddenInRecents([TORTILLA_FAV, AVENA_FAV], [POLLO_CURRY.id]);

  it("R7: una personalizada favorita se oculta por nombre, con cualquier macro, mayúsculas o espacios", () => {
    expect(hidden(customEntry(YESTERDAY, "Cena"))).toBe(true);
    expect(hidden(customEntry(YESTERDAY, "Cena", { customName: "TORTILLA  francesa", calories: 260 }))).toBe(true);
    expect(hidden(customEntry(YESTERDAY, "Cena", { customName: "Tortilla de patatas" }))).toBe(false);
  });

  it("R7: «Avena 40 g» favorita oculta la avena de 40 g, no la de 60 g", () => {
    expect(hidden(foodEntryOf(YESTERDAY, "Desayuno", AVENA, 40))).toBe(true);
    expect(hidden(foodEntryOf(YESTERDAY, "Desayuno", AVENA, 60))).toBe(false);
  });

  it("R7: «Pollo al curry» favorita oculta la entrada × 1, no la × 0,5", () => {
    expect(hidden(recipeEntryOf(YESTERDAY, "Cena", POLLO_CURRY))).toBe(true);
    expect(hidden(recipeEntryOf(YESTERDAY, "Cena", POLLO_CURRY, 0.5))).toBe(false);
  });

  it("una receta que no es favorita no se oculta", () => {
    expect(hidden(recipeEntryOf(YESTERDAY, "Desayuno", PORRIDGE))).toBe(false);
  });

  it("R7: con la favorita oculta, Recientes sigue mostrando hasta 5 filas (su hueco lo ocupa la siguiente)", () => {
    const entries = [
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Ensalada" }),
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Sopa" }),
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Gazpacho" }),
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Hummus" }),
      customEntry(YESTERDAY, "Cena", { customName: "Pisto" }),
      customEntry(YESTERDAY, "Cena"), // Tortilla francesa, la más reciente
    ];
    const names = recentMeals({ entries, recipes: FAV_RECIPES, mealType: "Cena", exclude: hidden }).map((r) => r.name);
    expect(names).toEqual(["Pisto", "Hummus", "Gazpacho", "Sopa", "Ensalada"]);
  });

  it("sin exclude, Recientes no cambia", () => {
    const entries = [customEntry(YESTERDAY, "Cena")];
    expect(recentMeals({ entries, recipes: FAV_RECIPES, mealType: "Cena" }).map((r) => r.name)).toEqual(["Tortilla francesa"]);
  });
});

describe("R8: Favoritos por frecuencia en la franja elegida", () => {
  it("R8: en Desayuno, «Café con leche» (10 veces) va antes que «Avena 40 g» (3 veces)", () => {
    const entries = [
      ...Array.from({ length: 3 }, () => foodEntryOf(YESTERDAY, "Desayuno", AVENA, 40)),
      ...Array.from({ length: 10 }, () => customEntry(TWO_DAYS_AGO, "Desayuno", { customName: "Café con leche", calories: 90 })),
    ];
    expect(rank([AVENA_FAV, CAFE_FAV], entries, "Desayuno")).toEqual(["Café con leche", "Avena"]);
  });

  it("R8: a igualdad de frecuencia, primero el registrado más recientemente en la franja", () => {
    const entries = [
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Crema de calabacín" }),
      customEntry(YESTERDAY, "Cena", { customName: "Tostada con aceite" }),
    ];
    expect(rank([TOSTADA_FAV, CREMA_FAV], entries, "Cena")).toEqual(["Tostada con aceite", "Crema de calabacín"]);
    expect(rank([CREMA_FAV, TOSTADA_FAV], entries, "Cena")).toEqual(["Tostada con aceite", "Crema de calabacín"]);
  });

  it("R8: uno nunca registrado en la franja va detrás de los que sí", () => {
    const entries = [
      customEntry(YESTERDAY, "Comida", { customName: "Tostada con aceite" }),
      customEntry(YESTERDAY, "Comida", { customName: "Tostada con aceite" }),
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Crema de calabacín" }),
    ];
    expect(rank([TOSTADA_FAV, CREMA_FAV], entries, "Cena")).toEqual(["Crema de calabacín", "Tostada con aceite"]);
  });

  it("Desempate (tech): detrás, por su último registro en cualquier franja; al final, los nunca registrados", () => {
    const entries = [
      customEntry(TWO_DAYS_AGO, "Comida", { customName: "Crema de calabacín" }),
      customEntry(YESTERDAY, "Comida", { customName: "Tostada con aceite" }),
    ];
    // Ninguno en Cena: Tostada (ayer) antes que Crema (antes de ayer); Café nunca registrado, al final
    expect(rank([CAFE_FAV, CREMA_FAV, TOSTADA_FAV], entries, "Cena")).toEqual(["Tostada con aceite", "Crema de calabacín", "Café con leche"]);
  });

  it("Desempate (tech): nunca registrados → mealFavorites del último guardado al primero, luego recetas igual", () => {
    expect(rank([TORTILLA_FAV, CREMA_FAV], [], "Cena", [POLLO_CURRY.id])).toEqual(["Crema de calabacín", "Tortilla francesa", "Pollo al curry"]);
  });

  it("R8: cuenta las entradas anteriores a marcarlo; personalizada por nombre, aunque cambien los macros", () => {
    const entries = [
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "tostada con ACEITE", calories: 230, fat: 13 }),
      customEntry(TWO_DAYS_AGO, "Cena", { customName: "Tostada con aceite", calories: 230, fat: 13 }),
      customEntry(YESTERDAY, "Cena", { customName: "Crema de calabacín" }),
    ];
    expect(rank([CREMA_FAV, TOSTADA_FAV], entries, "Cena")).toEqual(["Tostada con aceite", "Crema de calabacín"]);
  });

  it("R8: alimento por alimento y cantidad: la avena de 60 g no cuenta para «Avena 40 g»", () => {
    const entries = [
      foodEntryOf(TWO_DAYS_AGO, "Desayuno", AVENA, 60),
      foodEntryOf(TWO_DAYS_AGO, "Desayuno", AVENA, 60),
      customEntry(YESTERDAY, "Desayuno", { customName: "Café con leche" }),
    ];
    expect(rank([AVENA_FAV, CAFE_FAV], entries, "Desayuno")).toEqual(["Café con leche", "Avena"]);
  });

  it("R8: receta por receta, con cualquier ración", () => {
    const entries = [
      recipeEntryOf(TWO_DAYS_AGO, "Cena", POLLO_CURRY, 0.5),
      recipeEntryOf(TWO_DAYS_AGO, "Cena", POLLO_CURRY),
      customEntry(YESTERDAY, "Cena", { customName: "Crema de calabacín" }),
    ];
    expect(rank([CREMA_FAV], entries, "Cena", [POLLO_CURRY.id])).toEqual(["Pollo al curry", "Crema de calabacín"]);
  });

  it("Edge: una receta favorita que no vale para la franja no aparece (filtro del selector de #20)", () => {
    expect(rank([], [], "Cena", [PORRIDGE.id, POLLO_CURRY.id])).toEqual(["Pollo al curry"]);
    expect(rank([], [], "Desayuno", [PORRIDGE.id, POLLO_CURRY.id])).toEqual(["Porridge de avena"]);
  });

  it("Edge: una receta favorita borrada no aparece", () => {
    expect(rank([], [], "Cena", ["t-borrada", POLLO_CURRY.id])).toEqual(["Pollo al curry"]);
  });

  it("Edge: «Avena 40 g» y «Avena 60 g» conviven como dos favoritos", () => {
    const avena60: MealFavorite = { ...AVENA_FAV, id: "fav-avena-60", grams: 60 };
    expect(rankFavorites({ items: [AVENA_FAV, avena60], recipeIds: [], recipes: FAV_RECIPES, entries: [], mealType: "Desayuno" })).toHaveLength(2);
  });

  it("cada fila trae lo que pinta: nombre, kcal redondeables y la cantidad de los alimentos", () => {
    const rows = rankFavorites({ items: [AVENA_FAV, HUEVOS_FAV, TORTILLA_FAV], recipeIds: [POLLO_CURRY.id], recipes: FAV_RECIPES, entries: [], mealType: "Cena" });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(Math.round(byName["Avena"].calories)).toBe(150);
    expect(byName["Avena"].label).toBe("40 g");
    expect(byName["Huevo"].label).toBe("2 ud · 120 g");
    expect(byName["Tortilla francesa"]).toMatchObject({ calories: 190, label: null, fav: TORTILLA_FAV });
    expect(byName["Pollo al curry"]).toMatchObject({ calories: 520, label: null, recipe: POLLO_CURRY });
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
});
