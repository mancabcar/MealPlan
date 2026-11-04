// Spec: docs/pm/16-despensa-recetas/spec.md › R2–R5, R8 y Edge cases.
// Tech: docs/pm/16-despensa-recetas/tech.md › APIs / interfaces (`src/lib/pantryRecipes.ts`):
//   recipeUsage(recipe, index, today) → { matched, total, soonest? }
//   recipesUsingItem(recipes, item, today) → Recipe[]
//   rankByPantry(recipes, pantry, today) → { recipe, usage }[]
// Reutilizan el parser y el matcher de la lista de la compra (mismas reglas de coincidencia).
import { describe, expect, it } from "vitest";
import { rankByPantry, recipeUsage, recipesUsingItem } from "@/lib/pantryRecipes";
import { indexPantry } from "@/lib/shopping/pantryMatch";
import { recipe } from "../fixtures/shopping";
import type { PantryItem } from "@/lib/types";

const TODAY = "2026-09-22";

const p = (id: string, name: string, expiryDate?: string): PantryItem => ({
  id,
  name,
  quantity: "1",
  category: "Nevera",
  ...(expiryDate ? { expiryDate } : {}),
});

const usage = (r: ReturnType<typeof recipe>, pantry: PantryItem[]) => recipeUsage(r, indexPantry(pantry), TODAY);

describe("R8: recipeUsage cuenta los ingredientes de la receta que ya están en la Despensa", () => {
  it("N de M: coincidentes sobre el total, sin contar los básicos", () => {
    const r = recipe("r", "Pollo con arroz", ["150g pechuga de pollo", "60g arroz", "1 huevo", "sal", "pimienta"]);
    const u = usage(r, [p("1", "Pechuga de pollo"), p("2", "Arroz")]);
    expect(u.matched).toBe(2);
    expect(u.total).toBe(3); // sal y pimienta son básicos
  });

  it("los ingredientes opcionales no cuentan ni en N ni en M", () => {
    const r = recipe("r", "Huevos", ["2 huevos", "perejil (opcional)"]);
    const u = usage(r, [p("1", "Huevos"), p("2", "Perejil")]);
    expect(u).toMatchObject({ matched: 1, total: 1 });
  });

  it("un artículo caducado no cuenta como coincidencia", () => {
    const r = recipe("r", "Arroz con leche", ["200 ml de leche", "80g arroz"]);
    const u = usage(r, [p("1", "Leche", "2026-09-21"), p("2", "Arroz")]);
    expect(u).toMatchObject({ matched: 1, total: 2 });
  });

  it("un ingrediente cuenta una sola vez aunque coincidan varios artículos", () => {
    const r = recipe("r", "Natillas", ["200 ml de leche"]);
    const u = usage(r, [p("1", "Leche entera"), p("2", "Leche semidesnatada")]);
    expect(u).toMatchObject({ matched: 1, total: 1 });
  });

  it("coincidencia por palabras: 'leche' de la despensa no cubre 'leche de almendras'", () => {
    const r = recipe("r", "Batido vegetal", ["250 ml de leche de almendras"]);
    expect(usage(r, [p("1", "Leche")])).toMatchObject({ matched: 0, total: 1 });
  });
});

describe("R4: recipeUsage devuelve la caducidad más próxima entre los artículos coincidentes", () => {
  const r = recipe("r", "Desayuno", ["200 ml de leche", "125g yogur natural", "60g arroz"]);

  it("soonest = la fecha más cercana de los coincidentes; los artículos sin fecha no la fijan", () => {
    const u = usage(r, [p("1", "Leche", "2026-09-24"), p("2", "Yogur natural", "2026-09-30"), p("3", "Arroz")]);
    expect(u.soonest).toBe("2026-09-24");
  });

  it("sin ninguna fecha entre los coincidentes, soonest no existe", () => {
    const u = usage(r, [p("1", "Leche"), p("2", "Arroz")]);
    expect(u.soonest).toBeUndefined();
  });

  it("ignora la fecha de un artículo que no forma parte de la receta", () => {
    const u = usage(r, [p("1", "Leche", "2026-09-28"), p("2", "Manzanas", "2026-09-23")]);
    expect(u.soonest).toBe("2026-09-28");
  });
});

describe("R2: recipesUsingItem devuelve las recetas cuyos ingredientes contienen el artículo", () => {
  const ARROZ_LECHE = recipe("arroz-leche", "Arroz con leche", ["200 ml de leche", "80g arroz"]);
  const ALMENDRAS = recipe("batido", "Batido de almendras", ["250 ml de leche de almendras", "1 plátano"]);
  const POLLO = recipe("pollo", "Pollo a la plancha", ["150g pechuga de pollo", "sal"]);
  const NATILLAS = recipe("natillas", "Natillas", ["500 ml de leche", "2 huevos"]);
  const recetas = [ARROZ_LECHE, ALMENDRAS, POLLO, NATILLAS];

  it("'Leche entera' → las recetas con 'leche', en el orden del recetario y sin 'leche de almendras'", () => {
    const res = recipesUsingItem(recetas, p("1", "Leche entera", "2026-09-24"), TODAY);
    expect(res.map((r) => r.id)).toEqual(["arroz-leche", "natillas"]);
  });

  it("un artículo que ninguna receta usa → lista vacía", () => {
    expect(recipesUsingItem(recetas, p("1", "Salmón", "2026-09-23"), TODAY)).toEqual([]);
  });

  it("un artículo que solo casa con un básico (sal) → lista vacía", () => {
    expect(recipesUsingItem(recetas, p("1", "Sal", "2026-09-23"), TODAY)).toEqual([]);
  });
});

describe("R3: rankByPantry ordena por nº de ingredientes que ya tengo", () => {
  const DOS = recipe("dos", "Pollo con arroz", ["150g pechuga de pollo", "60g arroz", "1 brócoli"]);
  const UNO = recipe("uno", "Arroz blanco", ["60g arroz", "1 cebolla"]);
  const TRES = recipe("tres", "Pollo, arroz y huevo", ["150g pechuga de pollo", "60g arroz", "1 huevo"]);
  const NADA = recipe("nada", "Ensalada", ["1 lechuga", "1 tomate"]);
  const pantry = [p("1", "Pechuga de pollo"), p("2", "Arroz"), p("3", "Huevos")];

  it("más coincidencias primero", () => {
    const res = rankByPantry([UNO, DOS, TRES], pantry, TODAY);
    expect(res.map((x) => x.recipe.id)).toEqual(["tres", "dos", "uno"]);
    expect(res.map((x) => x.usage.matched)).toEqual([3, 2, 1]);
  });

  it("las recetas sin ninguna coincidencia no aparecen", () => {
    const res = rankByPantry([NADA, UNO], pantry, TODAY);
    expect(res.map((x) => x.recipe.id)).toEqual(["uno"]);
  });

  it("las recetas cuyas únicas coincidencias están caducadas no aparecen", () => {
    const res = rankByPantry([UNO], [p("2", "Arroz", "2026-09-21")], TODAY);
    expect(res).toEqual([]);
  });

  it("despensa vacía → nada", () => {
    expect(rankByPantry([UNO, DOS], [], TODAY)).toEqual([]);
  });
});

describe("R4: rankByPantry desempata por la caducidad más próxima", () => {
  const A = recipe("a", "A: arroz y leche", ["60g arroz", "200 ml de leche"]);
  const B = recipe("b", "B: pollo y yogur", ["150g pechuga de pollo", "125g yogur natural"]);
  const C = recipe("c", "C: dos sin fecha", ["1 huevo", "1 manzana"]);
  const D = recipe("d", "D: otra sin fecha", ["1 huevo", "1 manzana", "1 tomate"]);

  it("a igualdad de coincidencias gana la receta cuyo ingrediente caduca antes", () => {
    const pantry = [p("1", "Arroz", "2026-10-05"), p("2", "Leche", "2026-09-30"), p("3", "Pechuga de pollo", "2026-09-23"), p("4", "Yogur natural", "2026-10-02")];
    const res = rankByPantry([A, B], pantry, TODAY);
    expect(res.map((x) => x.recipe.id)).toEqual(["b", "a"]); // B caduca el 09-23, A el 09-30
  });

  it("las recetas sin fecha van detrás de las que tienen fecha, con el mismo nº de coincidencias", () => {
    const pantry = [p("1", "Huevos"), p("2", "Manzanas"), p("3", "Arroz", "2026-10-05"), p("4", "Leche", "2026-10-06")];
    const res = rankByPantry([C, A], pantry, TODAY);
    expect(res.map((x) => x.recipe.id)).toEqual(["a", "c"]);
  });

  it("si sigue el empate se conserva el orden del recetario", () => {
    const pantry = [p("1", "Huevos"), p("2", "Manzanas")];
    expect(rankByPantry([C, D], pantry, TODAY).map((x) => x.recipe.id)).toEqual(["c", "d"]);
    expect(rankByPantry([D, C], pantry, TODAY).map((x) => x.recipe.id)).toEqual(["d", "c"]);
  });

  it("el nº de coincidencias pesa más que la caducidad", () => {
    const TRES = recipe("tres", "Tres sin fecha", ["1 huevo", "1 manzana", "1 pera"]);
    const pantry = [p("1", "Huevos"), p("2", "Manzanas"), p("3", "Peras"), p("4", "Pechuga de pollo", "2026-09-22"), p("5", "Yogur natural", "2026-09-23")];
    const res = rankByPantry([B, TRES], pantry, TODAY);
    expect(res.map((x) => x.recipe.id)).toEqual(["tres", "b"]);
  });
});
