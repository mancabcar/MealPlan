// Spec: docs/pm/34-temporada/spec.md › R1, R2, R3, R4, R6.
// Tech: docs/pm/34-temporada/tech.md › APIs / interfaces. Contrato (todo en src/lib/seasonal.ts):
//   currentMonth(): number                                         mes 1–12 de la fecha del dispositivo (la de todayStr)
//   monthMark(product, month): "empieza" | "últimas" | null         ventana circular; un solo mes o los 12 → null
//   seasonalProducts(month, products?): { verduras, frutas }        del mes, sin básicos
//   seasonalIn(recipe, month, products?): SeasonalProduct[]         no básicos del mes presentes en la receta, sin repetir
//   featuredRecipes(recipes, favorites, month, limit = 10, products?): Recipe[]
//   recipesWithProduct(recipes, product): Recipe[]                  en cualquier mes
// `products` es el calendario opcional (por defecto SEASONAL_PRODUCTS): aquí se inyectan productos sintéticos.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentMonth,
  featuredRecipes,
  monthMark,
  recipesWithProduct,
  seasonalIn,
  seasonalProducts,
  type SeasonalProduct,
} from "@/lib/seasonal";
import { recipe } from "../fixtures/shopping";

const product = (id: string, kind: "verdura" | "fruta", months: number[], keywords: string[], basic?: true): SeasonalProduct => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  kind,
  months,
  keywords,
  ...(basic ? { basic } : {}),
});

const OCT = 10;
const CALABAZA = product("calabaza", "verdura", [9, 10, 11], ["calabaza"]);
const CALABACIN = product("calabacin", "verdura", [6, 7, 8, 9], ["calabacin"]);
const COL = product("col", "verdura", [10, 11, 12], ["col"]);
const TOMATE = product("tomate", "verdura", [6, 7, 8, 9, 10], ["tomate"]);
const CAQUI = product("caqui", "fruta", [10, 11, 12], ["caqui"]);
const FRESA = product("fresa", "fruta", [3, 4, 5], ["fresa"]);
const CEBOLLA = product("cebolla", "verdura", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ["cebolla"], true);
const PRODUCTS = [CALABAZA, CALABACIN, COL, TOMATE, CAQUI, FRESA, CEBOLLA];
const names = (list: SeasonalProduct[]) => list.map((p) => p.id);

afterEach(() => vi.useRealTimers());

describe("R6: currentMonth usa la fecha del dispositivo", () => {
  it.each([
    ["2026-10-05T10:00:00", 10],
    ["2026-01-01T00:30:00", 1],
    ["2026-12-31T23:30:00", 12],
  ])("%s → mes %i", (iso, month) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    expect(currentMonth()).toBe(month);
  });
});

describe("R1: marcas «empieza» / «últimas»", () => {
  const trio = product("trio", "fruta", [10, 11, 12], ["trio"]);

  it("primer mes de la ventana → empieza; mes intermedio → nada; último mes → últimas", () => {
    expect(monthMark(trio, 10)).toBe("empieza");
    expect(monthMark(trio, 11)).toBeNull();
    expect(monthMark(trio, 12)).toBe("últimas");
  });

  it("fuera de la ventana no hay marca", () => {
    expect(monthMark(trio, 9)).toBeNull();
    expect(monthMark(trio, 1)).toBeNull();
  });

  it("la ventana es circular: noviembre–febrero empieza en noviembre y acaba en febrero", () => {
    const invierno = product("invierno", "verdura", [11, 12, 1, 2], ["invierno"]);
    expect(monthMark(invierno, 11)).toBe("empieza");
    expect(monthMark(invierno, 12)).toBeNull();
    expect(monthMark(invierno, 1)).toBeNull();
    expect(monthMark(invierno, 2)).toBe("últimas");
    expect(monthMark(invierno, 3)).toBeNull();
  });

  it("un producto de un solo mes no lleva marca", () => {
    expect(monthMark(product("uno", "fruta", [10], ["uno"]), 10)).toBeNull();
  });

  it("un producto de los 12 meses no lleva marca en ninguno", () => {
    for (let m = 1; m <= 12; m++) expect(monthMark(CEBOLLA, m)).toBeNull();
  });
});

describe("R1: seasonalProducts del mes, separados en verduras y frutas", () => {
  it("octubre: solo los de octubre, repartidos por tipo", () => {
    const { verduras, frutas } = seasonalProducts(OCT, PRODUCTS);
    expect(names(verduras).sort()).toEqual(["calabaza", "col", "tomate"]);
    expect(names(frutas)).toEqual(["caqui"]);
  });

  it("no incluye los básicos aunque estén todo el año", () => {
    const { verduras } = seasonalProducts(OCT, PRODUCTS);
    expect(names(verduras)).not.toContain("cebolla");
  });

  it("cambiar de mes cambia el resultado sin tocar los datos", () => {
    expect(names(seasonalProducts(5, PRODUCTS).frutas)).toEqual(["fresa"]);
    expect(names(seasonalProducts(OCT, PRODUCTS).frutas)).toEqual(["caqui"]);
  });
});

describe("R3/R6: seasonalIn casa los ingredientes por palabra completa", () => {
  it("calabaza casa con «calabaza» y no con «calabacín»", () => {
    const r = recipe("r1", "Crema", ["300g calabaza", "1 calabacín"]);
    expect(names(seasonalIn(r, 9, PRODUCTS)).sort()).toEqual(["calabacin", "calabaza"]);
    expect(names(seasonalIn(recipe("r2", "Solo calabacín", ["1 calabacín"]), 9, PRODUCTS))).toEqual(["calabacin"]);
    expect(names(seasonalIn(recipe("r3", "Solo calabaza", ["300g calabaza"]), 9, PRODUCTS))).toEqual(["calabaza"]);
  });

  it("«col» no casa dentro de otras palabras (colorante)", () => {
    const r = recipe("r", "Postre", ["1 pizca de colorante alimentario"]);
    expect(seasonalIn(r, OCT, PRODUCTS)).toEqual([]);
    expect(names(seasonalIn(recipe("r", "Salteado", ["200g col"]), OCT, PRODUCTS))).toEqual(["col"]);
  });

  it("casa con plurales y cantidades en texto libre", () => {
    expect(names(seasonalIn(recipe("r", "Horno", ["2 calabazas pequeñas"]), OCT, PRODUCTS))).toEqual(["calabaza"]);
    expect(names(seasonalIn(recipe("r", "Fruta", ["1/2 caqui"]), OCT, PRODUCTS))).toEqual(["caqui"]);
  });

  it("las conservas cuentan como el producto (asumido en la spec): «tomate frito» es tomate", () => {
    expect(names(seasonalIn(recipe("r", "Huevos", ["100g tomate frito"]), OCT, PRODUCTS))).toEqual(["tomate"]);
  });

  it("solo devuelve los productos del mes", () => {
    const r = recipe("r", "Mixta", ["300g calabaza", "100g fresas"]);
    expect(names(seasonalIn(r, OCT, PRODUCTS))).toEqual(["calabaza"]);
    expect(names(seasonalIn(r, 5, PRODUCTS))).toEqual(["fresa"]);
  });

  it("los básicos no cuentan aunque la receta los lleve", () => {
    const r = recipe("r", "Sofrito", ["1 cebolla", "300g calabaza"]);
    expect(names(seasonalIn(r, OCT, PRODUCTS))).toEqual(["calabaza"]);
  });

  it("un producto que aparece dos veces cuenta una sola", () => {
    const r = recipe("r", "Doble", ["200g calabaza", "100g calabaza asada"]);
    expect(names(seasonalIn(r, OCT, PRODUCTS))).toEqual(["calabaza"]);
  });

  it("R6: no modifica la receta (no se guarda nada en ella)", () => {
    const r = Object.freeze(recipe("r", "Crema", ["300g calabaza"]));
    const before = JSON.stringify(r);
    seasonalIn(r, OCT, PRODUCTS);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("R2: featuredRecipes", () => {
  const A = recipe("a", "Ensalada de caqui", ["1 caqui"]); // 1 producto
  const B = recipe("b", "Crema de calabaza y col", ["300g calabaza", "100g col"]); // 2
  const C = recipe("c", "Cuscús de calabaza, col y caqui", ["300g calabaza", "100g col", "1 caqui"]); // 3
  const D = recipe("d", "Pollo con cebolla", ["200g pollo", "1 cebolla"]); // 0 (básico)
  const E = recipe("e", "Fresas con nata", ["200g fresas"]); // 0 en octubre

  it("ordena por nº de productos de temporada, de más a menos", () => {
    expect(featuredRecipes([A, B, C], [], OCT, 10, PRODUCTS).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("deja fuera las recetas sin producto de temporada, también las que solo llevan básicos", () => {
    expect(featuredRecipes([A, D, E], [], OCT, 10, PRODUCTS).map((r) => r.id)).toEqual(["a"]);
  });

  it("empate: favoritas primero y luego A–Z", () => {
    const x = recipe("x", "Zarzuela de calabaza", ["300g calabaza"]);
    const y = recipe("y", "Arroz con calabaza", ["300g calabaza"]);
    const z = recipe("z", "Bizcocho de calabaza", ["300g calabaza"]);
    const out = featuredRecipes([x, y, z], ["x"], OCT, 10, PRODUCTS).map((r) => r.id);
    expect(out).toEqual(["x", "y", "z"]); // x favorita; y y z por nombre
    expect(featuredRecipes([x, y, z], [], OCT, 10, PRODUCTS).map((r) => r.id)).toEqual(["y", "z", "x"]);
  });

  it("nunca devuelve más de 10 (límite por defecto), con las de más productos primero", () => {
    const many = Array.from({ length: 14 }, (_, i) => recipe(`m${i}`, `Calabaza ${String(i).padStart(2, "0")}`, ["300g calabaza"]));
    const top = recipe("top", "Cuscús completo", ["300g calabaza", "100g col", "1 caqui"]);
    const out = featuredRecipes([...many, top], [], OCT, undefined, PRODUCTS);
    expect(out).toHaveLength(10);
    expect(out[0].id).toBe("top");
  });

  it("sin coincidencias devuelve una lista vacía (la sección se oculta)", () => {
    expect(featuredRecipes([D, E], [], OCT, 10, PRODUCTS)).toEqual([]);
  });

  it("R6: una receta nueva con un producto del mes queda destacada sin más cambios, y deja de estarlo al cambiar de mes", () => {
    const nueva = { ...recipe("ai_1", "Caqui con yogur", ["2 caquis", "150g yogur"]), isAIGenerated: true as const };
    expect(featuredRecipes([A, nueva], [], OCT, 10, PRODUCTS).map((r) => r.id)).toContain("ai_1");
    expect(featuredRecipes([A, nueva], [], 5, 10, PRODUCTS)).toEqual([]);
  });
});

describe("R4: recipesWithProduct", () => {
  const A = recipe("a", "Crema de calabaza", ["300g calabaza"]);
  const B = recipe("b", "Calabacín relleno", ["1 calabacín"]);
  const C = recipe("c", "Cuscús", ["300g calabaza", "100g col"]);

  it("devuelve las recetas que llevan el producto, sin confundir calabaza con calabacín", () => {
    expect(recipesWithProduct([A, B, C], CALABAZA).map((r) => r.id)).toEqual(["a", "c"]);
    expect(recipesWithProduct([A, B, C], CALABACIN).map((r) => r.id)).toEqual(["b"]);
  });

  it("funciona en cualquier mes: no depende de si el producto está de temporada", () => {
    expect(recipesWithProduct([A], FRESA)).toEqual([]);
    expect(recipesWithProduct([recipe("f", "Batido", ["200g fresas"])], FRESA)).toHaveLength(1);
  });

  it("un producto sin recetas devuelve una lista vacía", () => {
    expect(recipesWithProduct([A, B, C], CAQUI)).toEqual([]);
  });
});
