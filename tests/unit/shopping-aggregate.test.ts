// Spec: docs/pm/lista-compra/spec.md › R2, R4, Edge cases (fracciones, varias unidades, receta borrada).
// Tech: docs/pm/lista-compra/tech.md › aggregate.ts (`collectSources`, `aggregate`, `formatAmount`, `amountSignature`).
import { describe, expect, it } from "vitest";
import { aggregate, amountSignature, collectSources, formatAmount, type ShoppingItem } from "@/lib/shopping/aggregate";
import { normalizeKey } from "@/lib/shopping/parse";
import { MEAL_TYPES, type MealType, type Recipe, type WeekPlan } from "@/lib/types";
import seed from "@/data/recipes.json";
import {
  LAST_WEEK_MONDAY,
  NEXT_MONDAY,
  POLLO_BROCOLI,
  SALTEADO_POLLO,
  SHOPPING_PLAN,
  SHOPPING_RECIPES,
  WEEK,
  recipe,
} from "../fixtures/shopping";
import { lucia, manuel } from "../fixtures/profiles";
import { BATCH_PLAN, GUISO, ORPHAN_LEFTOVER_PLAN, SOBRAS_RECIPES, THU, TUE, WED } from "../fixtures/sobras";

function itemsFor(weekPlan: WeekPlan, { recipes = SHOPPING_RECIPES, meals = MEAL_TYPES }: { recipes?: Recipe[]; meals?: MealType[] } = {}) {
  return aggregate(collectSources({ weekPlan, recipes, dates: WEEK, meals }));
}

function find(items: ShoppingItem[], name: string): ShoppingItem | undefined {
  return items.find((i) => i.key === normalizeKey(name));
}

function get(items: ShoppingItem[], name: string): ShoppingItem {
  const item = find(items, name);
  expect(item, `falta "${name}" en la lista`).toBeDefined();
  return item!;
}

/** Una receta por comida del lunes al domingo, en Comida. */
function planOf(...recipes: Recipe[]): WeekPlan {
  const plan: WeekPlan = {};
  recipes.forEach((r, i) => {
    plan[WEEK[i]] = [{ mealType: "Comida", recipeId: r.id }];
  });
  return plan;
}

describe("R2: qué recetas entran en la lista", () => {
  it("una Merienda con receta no aparece si la Merienda no está activa en el perfil", () => {
    // Manuel no hace Merienda; Lucía sí. El martes hay un batido de kéfir en Merienda.
    expect(find(itemsFor(SHOPPING_PLAN, { meals: manuel.meals }), "kéfir")).toBeUndefined();
    expect(find(itemsFor(SHOPPING_PLAN, { meals: lucia.meals }), "kéfir")).toBeDefined();
  });

  it("las recetas de la semana pasada o de la siguiente no aparecen", () => {
    const items = itemsFor(SHOPPING_PLAN, { meals: lucia.meals });
    expect(find(items, "dátiles")).toBeUndefined();
    expect(find(items, "nueces")).toBeUndefined();
    // …aunque esas fechas sí estén en el plan
    expect(SHOPPING_PLAN[LAST_WEEK_MONDAY]).toHaveLength(1);
    expect(SHOPPING_PLAN[NEXT_MONDAY]).toHaveLength(1);
  });

  it("la misma receta planificada dos días cuenta dos veces", () => {
    const items = itemsFor(planOf(POLLO_BROCOLI, POLLO_BROCOLI));
    expect(formatAmount(get(items, "pechuga de pollo"))).toBe("300 g");
    expect(get(items, "pechuga de pollo").sources).toHaveLength(2);
  });

  it("una receta borrada después de planificarla se ignora (edge case)", () => {
    const plan: WeekPlan = { [WEEK[0]]: [{ mealType: "Comida", recipeId: "receta-borrada" }] };
    expect(collectSources({ weekPlan: plan, recipes: SHOPPING_RECIPES, dates: WEEK, meals: MEAL_TYPES })).toEqual([]);
  });

  it("cada fuente recuerda día, comida, receta y la línea original (para el detalle, R6)", () => {
    const sources = collectSources({ weekPlan: planOf(SALTEADO_POLLO), recipes: SHOPPING_RECIPES, dates: WEEK, meals: MEAL_TYPES });
    expect(sources).toContainEqual(
      expect.objectContaining({
        date: WEEK[0],
        mealType: "Comida",
        recipeId: SALTEADO_POLLO.id,
        recipeName: "Salteado de pollo y brócoli",
        raw: "120g pechuga de pollo",
        qty: 120,
        unit: "g",
      }),
    );
  });

  it("una línea con varios ingredientes da una fuente por ingrediente", () => {
    const sources = collectSources({ weekPlan: planOf(POLLO_BROCOLI), recipes: SHOPPING_RECIPES, dates: WEEK, meals: MEAL_TYPES });
    expect(sources.filter((s) => s.raw === "sal, pimienta y orégano")).toHaveLength(3);
  });
});

describe("R4: ingredientes iguales se suman", () => {
  it('"150g brócoli" en dos recetas → una "Brócoli · 300 g"', () => {
    const items = itemsFor(SHOPPING_PLAN, { meals: lucia.meals });
    const brocoli = items.filter((i) => i.key === normalizeKey("brócoli"));
    expect(brocoli).toHaveLength(1);
    expect(brocoli[0].name).toBe("Brócoli");
    expect(formatAmount(brocoli[0])).toBe("300 g");
  });

  it('"1 huevo" dos veces y "2 huevos" una → "Huevos · 4"', () => {
    const rs = [
      recipe("h1", "Tostada con huevo", ["1 huevo"]),
      recipe("h2", "Huevo a la plancha", ["1 huevo"]),
      recipe("h3", "Revuelto", ["2 huevos"]),
    ];
    const items = itemsFor(planOf(...rs), { recipes: rs });
    const huevos = get(items, "huevo");
    expect(huevos.name).toBe("Huevos");
    expect(formatAmount(huevos)).toBe("4");
  });

  it('"200g X" y "1 bote de X" → una "X · 200 g + 1 bote" (sin sumar unidades distintas)', () => {
    const rs = [recipe("x1", "Hummus", ["200g garbanzos cocidos"]), recipe("x2", "Ensalada", ["1 bote de garbanzos cocidos"])];
    const items = itemsFor(planOf(...rs), { recipes: rs });
    const x = items.filter((i) => i.key === normalizeKey("garbanzos cocidos"));
    expect(x).toHaveLength(1);
    expect(formatAmount(x[0])).toBe("200 g + 1 bote");
  });

  it('"1 patata pequeña" y "200g patata" → "Patata · 200 g + 1" (orden de aparición)', () => {
    // El orden de aparición manda (edge case "varias unidades"): la receta de 200 g se planifica primero.
    const rs = [recipe("p1", "Patatas asadas", ["200g patata"]), recipe("p2", "Tortilla", ["1 patata pequeña"])];
    const patata = get(itemsFor(planOf(...rs), { recipes: rs }), "patata");
    expect(patata.name).toBe("Patata");
    expect(formatAmount(patata)).toBe("200 g + 1");
    expect(patata.amounts).toEqual([
      { unit: "g", qty: 200 },
      { unit: null, qty: 1 },
    ]);
  });

  it('"1/2 cebolla" y "1/4 cebolla morada" → dos ingredientes', () => {
    const rs = [recipe("c1", "Sofrito", ["1/2 cebolla"]), recipe("c2", "Ensalada", ["1/4 cebolla morada"])];
    const items = itemsFor(planOf(...rs), { recipes: rs });
    expect(formatAmount(get(items, "cebolla"))).toBe("½");
    expect(formatAmount(get(items, "cebolla morada"))).toBe("¼");
  });

  it("no suma g con kg (no hay conversión de unidades)", () => {
    const rs = [recipe("k1", "A", ["1 kg de patata"]), recipe("k2", "B", ["200g patata"])];
    expect(formatAmount(get(itemsFor(planOf(...rs), { recipes: rs }), "patata"))).toBe("1 kg + 200 g");
  });

  it('sin ninguna cantidad → "al gusto"', () => {
    const rs = [recipe("s1", "A", ["perejil fresco"]), recipe("s2", "B", ["perejil fresco"])];
    expect(formatAmount(get(itemsFor(planOf(...rs), { recipes: rs }), "perejil fresco"))).toBe("al gusto");
  });

  it("mezcla de fuentes con y sin cantidad → se muestra la suma de las que la tienen", () => {
    const rs = [recipe("l1", "Salmón", ["limón, sal y eneldo"]), recipe("l2", "Aliño", ["zumo de 1/2 limón"])];
    expect(formatAmount(get(itemsFor(planOf(...rs), { recipes: rs }), "limón"))).toBe("½");
  });

  it('"(opcional)" se conserva como etiqueta del ingrediente', () => {
    const rs = [recipe("o1", "Yogur", ["1 cucharadita de miel (opcional)"])];
    expect(get(itemsFor(planOf(...rs), { recipes: rs }), "miel").optional).toBe(true);
  });

  it("con todas las recetas semilla planificadas no hay dos ingredientes con el mismo nombre normalizado (issue #5)", () => {
    const all = seed.recipes as Recipe[];
    const plan: WeekPlan = {};
    all.forEach((r, i) => {
      const date = WEEK[i % 7];
      const mealType = MEAL_TYPES[Math.floor(i / 7) % MEAL_TYPES.length];
      plan[date] = [...(plan[date] ?? []), { mealType, recipeId: r.id }];
    });
    const items = itemsFor(plan, { recipes: all });
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    // Las 107 recetas se reparten en los 7×6 huecos (alguno lleva dos): salen los 181 ingredientes del corpus
    expect(items).toHaveLength(181);
  });
});

describe("Edge cases: formato de cantidades", () => {
  const amountOf = (...lines: string[]) => {
    const rs = lines.map((l, i) => recipe(`f${i}`, `R${i}`, [l]));
    const items = itemsFor(planOf(...rs), { recipes: rs });
    expect(items).toHaveLength(1);
    return formatAmount(items[0]);
  };

  it("½ + ½ se muestra como 1", () => {
    expect(amountOf("1/2 aguacate", "1/2 aguacate")).toBe("1");
  });

  it("½ × 3 se muestra como 1½", () => {
    expect(amountOf("1/2 aguacate", "1/2 aguacate", "1/2 aguacate")).toBe("1½");
  });

  it("¼ + ½ se muestra como ¾", () => {
    expect(amountOf("1/4 lechuga", "1/2 lechuga")).toBe("¾");
  });

  it("los decimales se redondean a un decimal, con coma", () => {
    expect(amountOf("1,2 l de caldo de pollo", "0,13 l de caldo de pollo")).toBe("1,3 l");
  });

  it("enteros sin decimales", () => {
    expect(amountOf("150g brócoli", "150g brócoli")).toBe("300 g");
  });
});

describe("amountSignature (R9: detectar que el total cambió)", () => {
  const itemOf = (...lines: string[]) => {
    const rs = lines.map((l, i) => recipe(`g${i}`, `R${i}`, [l]));
    return itemsFor(planOf(...rs), { recipes: rs })[0];
  };

  it("mismo total → misma firma, aunque venga de recetas distintas", () => {
    expect(amountSignature(itemOf("150g brócoli", "150g brócoli"))).toBe(amountSignature(itemOf("300g brócoli")));
  });

  it("total distinto → firma distinta", () => {
    expect(amountSignature(itemOf("150g brócoli", "150g brócoli"))).not.toBe(amountSignature(itemOf("150g brócoli")));
    expect(amountSignature(itemOf("200g patata"))).not.toBe(amountSignature(itemOf("200g patata", "1 patata")));
  });

  it("es un string estable", () => {
    const s = amountSignature(itemOf("150g brócoli"));
    expect(typeof s).toBe("string");
    expect(amountSignature(itemOf("150g brócoli"))).toBe(s);
  });
});

// Spec: docs/pm/17-sobras-batch-cooking/spec.md › R3, R10 y Casos límite.
// Tech: docs/pm/17-sobras-batch-cooking/tech.md › `collectSources` escala por `cookedServings` y omite las sobras.
// Guiso: 200g lentejas, 150g pechuga de pollo, 1 cebolla (tests/fixtures/sobras.ts). Fallan hasta la tarea 2.
describe("R3: la lista cuenta la tanda una vez, escalada a las raciones cocinadas", () => {
  const sobrasItems = (weekPlan: WeekPlan, meals: MealType[] = MEAL_TYPES) =>
    aggregate(collectSources({ weekPlan, recipes: SOBRAS_RECIPES, dates: WEEK, meals }));

  it("cocinada ×3 con 2 sobras → 450 g de pechuga y 600 g de lentejas, una sola vez", () => {
    const items = sobrasItems(BATCH_PLAN);
    expect(formatAmount(get(items, "pechuga de pollo"))).toBe("450 g");
    expect(formatAmount(get(items, "lentejas"))).toBe("600 g");
    expect(get(items, "pechuga de pollo").sources).toHaveLength(1);
  });

  it("la fuente única es la de la cocinada: día y comida de la Comida del martes", () => {
    const { sources } = get(sobrasItems(BATCH_PLAN), "pechuga de pollo");
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ date: TUE, mealType: "Comida", recipeId: GUISO.id });
  });

  it("las franjas de sobras no aportan fuentes", () => {
    const sources = collectSources({ weekPlan: BATCH_PLAN, recipes: SOBRAS_RECIPES, dates: WEEK, meals: MEAL_TYPES });
    expect(sources.filter((s) => s.date === WED || s.date === THU)).toEqual([]);
  });

  it("quitar una sobra no cambia las cantidades (se cocinó para N)", () => {
    const withoutWed: WeekPlan = { ...BATCH_PLAN, [WED]: [] };
    expect(formatAmount(get(sobrasItems(withoutWed), "pechuga de pollo"))).toBe("450 g");
  });

  it("una tanda sin sobras elegidas sigue contando N raciones", () => {
    const solo: WeekPlan = { [TUE]: [{ mealType: "Comida", recipeId: GUISO.id, batchId: "solo", cookedServings: 4 }] };
    expect(formatAmount(get(sobrasItems(solo), "pechuga de pollo"))).toBe("600 g");
  });

  it("los ingredientes por unidad se escalan igual (1 cebolla ×3 = 3)", () => {
    const cebolla = get(sobrasItems(BATCH_PLAN), "cebolla");
    expect(formatAmount(cebolla)).toBe("3");
    expect(cebolla.sources).toHaveLength(1);
  });

  it("si la Comida está desactivada en el perfil, la tanda no suma nada", () => {
    const meals = MEAL_TYPES.filter((m) => m !== "Comida");
    expect(find(sobrasItems(BATCH_PLAN, meals), "pechuga de pollo")).toBeUndefined();
  });

  it("una receta borrada tras planificar la tanda se ignora", () => {
    const items = aggregate(collectSources({ weekPlan: BATCH_PLAN, recipes: [], dates: WEEK, meals: MEAL_TYPES }));
    expect(items).toEqual([]);
  });
});

describe("R10: sin campos de tanda, la lista se comporta como hoy", () => {
  it("la misma receta en tres franjas normales suma tres veces (450 g), con tres fuentes", () => {
    const plain: WeekPlan = {
      [TUE]: [{ mealType: "Comida", recipeId: GUISO.id }],
      [WED]: [{ mealType: "Comida", recipeId: GUISO.id }],
      [THU]: [{ mealType: "Cena", recipeId: GUISO.id }],
    };
    const items = aggregate(collectSources({ weekPlan: plain, recipes: SOBRAS_RECIPES, dates: WEEK, meals: MEAL_TYPES }));
    expect(formatAmount(get(items, "pechuga de pollo"))).toBe("450 g");
    expect(get(items, "pechuga de pollo").sources).toHaveLength(3);
  });

  it("una sobra sin su cocinada se trata como franja normal: suma 1 ración", () => {
    const items = aggregate(
      collectSources({ weekPlan: ORPHAN_LEFTOVER_PLAN, recipes: SOBRAS_RECIPES, dates: WEEK, meals: MEAL_TYPES }),
    );
    expect(formatAmount(get(items, "pechuga de pollo"))).toBe("150 g");
  });
});
