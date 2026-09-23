// Spec: docs/pm/lista-compra/spec.md › R3, R4 y "Normalization rules".
// Tech: docs/pm/lista-compra/tech.md › "APIs / interfaces" (parse.ts), "Parsing rules", "Parser coverage".
import { describe, expect, it } from "vitest";
import { normalizeKey, parseIngredientLine, type ParsedIngredient } from "@/lib/shopping/parse";
import seed from "@/data/recipes.json";

/** La línea produce exactamente un ingrediente. */
function one(line: string): ParsedIngredient {
  const items = parseIngredientLine(line);
  expect(items, `"${line}" debería dar un solo ingrediente`).toHaveLength(1);
  return items[0];
}

const names = (line: string) => parseIngredientLine(line).map((i) => i.name);
const keyOf = (line: string) => one(line).key;

describe("R3: cantidad, unidad y nombre", () => {
  it('"1 bote pequeño de garbanzos cocidos (240g)" → garbanzos cocidos, 1 bote', () => {
    expect(one("1 bote pequeño de garbanzos cocidos (240g)")).toMatchObject({
      raw: "1 bote pequeño de garbanzos cocidos (240g)",
      qty: 1,
      unit: "bote",
      name: "garbanzos cocidos",
      key: "garbanzo cocido",
      optional: false,
      parsed: true,
    });
  });

  it("gramos con y sin espacio antes de la unidad", () => {
    expect(one("150g brócoli")).toMatchObject({ qty: 150, unit: "g", name: "brócoli" });
    expect(one("150 g brócoli")).toMatchObject({ qty: 150, unit: "g", name: "brócoli" });
    expect(keyOf("150g brócoli")).toBe(keyOf("150 g brócoli"));
  });

  it("kg, ml y l", () => {
    expect(one("1 kg de patatas")).toMatchObject({ qty: 1, unit: "kg" });
    expect(one("250ml leche")).toMatchObject({ qty: 250, unit: "ml", name: "leche" });
    expect(one("1 l de caldo de pollo")).toMatchObject({ qty: 1, unit: "l", name: "caldo de pollo" });
  });

  it("una palabra que empieza como una unidad no es la unidad (limón ≠ l, lata ≠ l, grande ≠ g)", () => {
    expect(one("1 limón")).toMatchObject({ qty: 1, unit: null, name: "limón" });
    expect(one("1 lata de atún al natural")).toMatchObject({ qty: 1, unit: "lata", name: "atún al natural" });
    expect(one("2 gambas")).toMatchObject({ qty: 2, unit: null, name: "gambas" });
  });

  it("cantidad sin unidad reconocida = recuento", () => {
    expect(one("1/2 pimiento rojo")).toMatchObject({ qty: 0.5, unit: null, name: "pimiento rojo" });
    expect(one("8 tomates cherry")).toMatchObject({ qty: 8, unit: null, name: "tomates cherry" });
  });

  it("unidades de la tabla del spec, con singular/plural fusionados", () => {
    expect(one("2 cucharadas de salsa de soja")).toMatchObject({ qty: 2, unit: "cucharada", name: "salsa de soja" });
    expect(one("1 cucharadita de canela")).toMatchObject({ qty: 1, unit: "cucharadita", name: "canela" });
    expect(one("3 latas de atún")).toMatchObject({ qty: 3, unit: "lata", name: "atún" });
    expect(one("2 botes de garbanzos cocidos")).toMatchObject({ qty: 2, unit: "bote" });
    expect(one("2 dientes de ajo")).toMatchObject({ qty: 2, unit: "diente", name: "ajo" });
    expect(one("1 diente de ajo")).toMatchObject({ qty: 1, unit: "diente", name: "ajo" });
    expect(one("2 rebanadas de pan integral")).toMatchObject({ qty: 2, unit: "rebanada", name: "pan integral" });
  });

  it("unidades añadidas por el tech design (cazo, hoja, rama, loncha, pizca, taza, vaso, filete, puñado, sobre)", () => {
    expect(one("1 cazo de proteína en polvo (sabor vainilla)")).toMatchObject({ qty: 1, unit: "cazo", name: "proteína en polvo" });
    expect(one("1 hoja de laurel")).toMatchObject({ qty: 1, unit: "hoja", name: "laurel" });
    expect(one("1 rama de apio (opcional)")).toMatchObject({ qty: 1, unit: "rama", name: "apio", optional: true });
    expect(one("3 lonchas de jamón serrano")).toMatchObject({ qty: 3, unit: "loncha", name: "jamón serrano" });
    expect(one("1 pizca de nuez moscada")).toMatchObject({ qty: 1, unit: "pizca" });
    expect(one("1 taza de leche")).toMatchObject({ qty: 1, unit: "taza", name: "leche" });
    expect(one("1 vaso de leche")).toMatchObject({ qty: 1, unit: "vaso", name: "leche" });
    expect(one("2 filetes de merluza")).toMatchObject({ qty: 2, unit: "filete", name: "merluza" });
    expect(one("1 puñado de nueces")).toMatchObject({ qty: 1, unit: "puñado", name: "nueces" });
    expect(one("1 sobre de levadura")).toMatchObject({ qty: 1, unit: "sobre", name: "levadura" });
  });

  it('"unidad(es)" equivale a un recuento sin unidad', () => {
    expect(one("1 unidad de pimiento rojo")).toMatchObject({ qty: 1, unit: null, name: "pimiento rojo" });
    expect(one("2 unidades de pimiento rojo")).toMatchObject({ qty: 2, unit: null });
    expect(keyOf("2 unidades de pimiento rojo")).toBe(keyOf("1/2 pimiento rojo"));
  });

  it("sin cantidad delante no se busca unidad: la línea entera es el nombre", () => {
    expect(one("hojas de lechuga")).toMatchObject({ qty: null, unit: null, name: "hojas de lechuga" });
  });
});

describe("R3: cantidades (enteros, decimales y fracciones)", () => {
  it.each([
    ["1/2 cebolla", 0.5],
    ["½ cebolla", 0.5],
    ["1/4 cebolla", 0.25],
    ["¼ cebolla", 0.25],
    ["¾ cebolla", 0.75],
    ["3 cebollas", 3],
  ])('"%s" → %s', (line, qty) => {
    expect(one(line)).toMatchObject({ qty, unit: null });
    expect(one(line).key).toBe(normalizeKey("cebolla"));
  });

  it("decimales con coma o con punto", () => {
    expect(one("1,5 kg de patata")).toMatchObject({ qty: 1.5, unit: "kg", name: "patata" });
    expect(one("1.5 l de agua")).toMatchObject({ qty: 1.5, unit: "l", name: "agua" });
  });
});

describe("R3: líneas con varios ingredientes", () => {
  it('"sal, pimienta y ajo en polvo" → tres ingredientes sin cantidad', () => {
    const items = parseIngredientLine("sal, pimienta y ajo en polvo");
    expect(items.map((i) => i.name)).toEqual(["sal", "pimienta", "ajo en polvo"]);
    for (const i of items) expect(i).toMatchObject({ qty: null, unit: null, parsed: true });
  });

  it('"limón, sal y eneldo" → limón, sal, eneldo', () => {
    expect(names("limón, sal y eneldo")).toEqual(["limón", "sal", "eneldo"]);
  });

  it("separa solo por coma o solo por y", () => {
    expect(names("vinagre balsámico, sal")).toEqual(["vinagre balsámico", "sal"]);
    expect(names("aceite de oliva y sal")).toEqual(["aceite de oliva", "sal"]);
    expect(names("cebollino y pimentón")).toEqual(["cebollino", "pimentón"]);
  });

  it("una línea con cantidad no se separa (no rompe nombres)", () => {
    expect(parseIngredientLine("1 bote de garbanzos y alubias")).toHaveLength(1);
  });

  it("cada parte sigue las reglas de normalización (zumo de, al gusto)", () => {
    expect(names("zumo de lima, aceite y sal")).toEqual(["lima", "aceite", "sal"]);
    expect(names("canela y hielo al gusto")).toEqual(["canela", "hielo"]);
  });
});

describe("R3: una línea ilegible nunca se pierde", () => {
  it.each(["250g", "½", "(para decorar)"])('"%s" aparece como un ingrediente con el texto original', (line) => {
    const items = parseIngredientLine(line);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ raw: line, name: line, qty: null, unit: null, parsed: false });
  });
});

describe("Normalización (spec › Normalization rules)", () => {
  it("ignora mayúsculas, tildes y espacios alrededor", () => {
    expect(normalizeKey("  Brócoli ")).toBe(normalizeKey("brocoli"));
    expect(normalizeKey("SAL")).toBe(normalizeKey("sal"));
    expect(normalizeKey("Salmón")).toBe(normalizeKey("salmon"));
  });

  it("el nombre visible conserva las tildes", () => {
    expect(one("150g brócoli").name).toBe("brócoli");
  });

  it("quita las notas entre paréntesis del nombre", () => {
    expect(one("60g arroz (en seco)")).toMatchObject({ name: "arroz", qty: 60, unit: "g" });
    expect(one("1 cucharada de harina (o maicena)")).toMatchObject({ name: "harina", qty: 1, unit: "cucharada" });
    expect(one("1 panecillo integral (80g)")).toMatchObject({ name: "panecillo integral", qty: 1, unit: null });
    expect(keyOf("150g carne picada de ternera (magra)")).toBe(keyOf("150g carne picada de ternera"));
  });

  it('"(opcional)" se quita del nombre pero queda como etiqueta', () => {
    expect(one("1 cucharadita de miel (opcional)")).toMatchObject({ name: "miel", optional: true });
    expect(one("1 cucharadita de miel")).toMatchObject({ name: "miel", optional: false });
    expect(keyOf("1 cucharadita de miel (opcional)")).toBe(keyOf("1 cucharadita de miel"));
  });

  it('quita "de" y los tamaños (pequeño, grande, mediano) entre la unidad y el nombre', () => {
    expect(one("1 cucharada de aceite de oliva").name).toBe("aceite de oliva");
    expect(one("1 tomate grande").name).toBe("tomate");
    expect(one("1 patata pequeña").name).toBe("patata");
    expect(one("2 tortillas de trigo pequeñas").name).toBe("tortillas de trigo");
    expect(one("1 calabacín mediano").name).toBe("calabacín");
  });

  it('"patata" y "patata pequeña" son el mismo ingrediente; "cebolla" y "cebolla morada" no', () => {
    expect(keyOf("1 patata pequeña")).toBe(keyOf("200g patata"));
    expect(keyOf("1/2 cebolla")).not.toBe(keyOf("1/4 cebolla morada"));
  });

  it("fusiona el plural simple del español", () => {
    expect(keyOf("1 huevo")).toBe(keyOf("2 huevos"));
    expect(keyOf("1/2 calabacín")).toBe(keyOf("2 calabacines"));
    expect(keyOf("150g lomo de salmón")).toBe(normalizeKey("Lomos de salmón"));
    expect(keyOf("100g champiñones")).toBe(normalizeKey("champiñón"));
    expect(keyOf("15g nueces")).toBe(normalizeKey("nuez"));
  });

  it("palabras distintas siguen siendo ingredientes distintos", () => {
    expect(keyOf("60g arroz")).not.toBe(keyOf("60g arroz integral"));
    expect(keyOf("80g lentejas secas")).not.toBe(keyOf("80g lentejas rojas"));
    expect(keyOf("4 claras de huevo")).not.toBe(keyOf("1 huevo"));
  });

  it('"zumo de X" es el ingrediente X', () => {
    expect(one("zumo de 1/2 lima")).toMatchObject({ name: "lima", qty: 0.5, unit: null });
    expect(one("zumo de 1/2 limón")).toMatchObject({ name: "limón", qty: 0.5, unit: null });
    expect(keyOf("zumo de 1/2 limón")).toBe(normalizeKey("limón"));
  });

  it("de las alternativas se queda la primera", () => {
    expect(one("250ml leche o bebida vegetal")).toMatchObject({ name: "leche", qty: 250, unit: "ml" });
    expect(one("100ml caldo de pescado o agua").name).toBe("caldo de pescado");
    expect(one("60g queso fresco batido o en lonchas").name).toBe("queso fresco batido");
    expect(one("rúcula u hojas verdes").name).toBe("rúcula");
    expect(one("harina o maicena").name).toBe("harina");
  });

  it('quita las notas finales "al gusto" y "para …"', () => {
    expect(one("canela al gusto").name).toBe("canela");
    expect(one("sésamo para terminar").name).toBe("sésamo");
    expect(one("1 cucharadita de aceite para la sartén")).toMatchObject({ name: "aceite", qty: 1, unit: "cucharadita" });
  });

  it("normalizeKey aplica las mismas reglas de nombre que el parser (se usa con la Despensa)", () => {
    expect(normalizeKey("Patata pequeña")).toBe(normalizeKey("patatas"));
    expect(normalizeKey("Garbanzos cocidos (bote)")).toBe("garbanzo cocido");
  });
});

// ---------------------------------------------------------------------------
// Corpus: las 145 líneas distintas de las 40 recetas semilla (tech.md › "Parser coverage").
// ---------------------------------------------------------------------------
const SEED_LINES = [...new Set((seed.recipes as { ingredients: string[] }[]).flatMap((r) => r.ingredients))].sort();

describe("R3: corpus de recetas semilla (src/data/recipes.json)", () => {
  it("el corpus tiene las 145 líneas distintas medidas en el tech design", () => {
    expect(SEED_LINES).toHaveLength(145);
  });

  it("ninguna línea se pierde y todas se entienden (145/145 limpias)", () => {
    const failures = SEED_LINES.filter((line) => {
      const items = parseIngredientLine(line);
      return items.length === 0 || items.some((i) => !i.parsed);
    });
    expect(failures).toEqual([]);
  });

  it("ningún nombre queda vacío ni conserva paréntesis, alternativas o notas finales", () => {
    const bad = SEED_LINES.flatMap((line) => parseIngredientLine(line).map((i) => ({ line, name: i.name, key: i.key })))
      .filter(({ name, key }) => !name.trim() || !key.trim() || /[()]| o | u |al gusto|\bpara\b/.test(name));
    expect(bad).toEqual([]);
  });

  it("107 ingredientes distintos (tech.md › Parser coverage)", () => {
    const keys = new Set(SEED_LINES.flatMap((line) => parseIngredientLine(line).map((i) => i.key)));
    expect(keys.size).toBe(107);
  });

  it("snapshot del conjunto de claves: cualquier cambio de reglas se ve en la revisión", () => {
    const keys = [...new Set(SEED_LINES.flatMap((line) => parseIngredientLine(line).map((i) => i.key)))].sort();
    expect(keys).toMatchSnapshot();
  });

  it("fusiones esperadas en el corpus", () => {
    const same = (...lines: string[]) => expect(new Set(lines.map(keyOf)).size, lines.join(" | ")).toBe(1);
    same("1 huevo", "2 huevos", "3 huevos");
    same("1 diente de ajo", "2 dientes de ajo");
    same("1/2 calabacín", "2 calabacines");
    same("1 patata pequeña", "200g patata");
    same("120g pechuga de pollo", "150g pechuga de pollo");
    same("30g copos de avena", "40g copos de avena", "50g copos de avena");
    same("50g guisantes", "80g guisantes", "100g guisantes");
    same("150g carne picada de ternera", "150g carne picada de ternera (magra)");
    const limonDeLista = parseIngredientLine("limón, sal y eneldo").find((i) => i.name === "limón");
    expect(limonDeLista?.key).toBe(keyOf("zumo de 1/2 limón"));
  });

  it("separaciones esperadas en el corpus", () => {
    const distinct = (...lines: string[]) => expect(new Set(lines.map(keyOf)).size, lines.join(" | ")).toBe(lines.length);
    distinct("1/2 cebolla", "1/4 cebolla morada");
    distinct("60g arroz (en seco)", "60g arroz integral (en seco)");
    distinct("80g lentejas (en seco)", "80g lentejas secas", "80g lentejas rojas");
    distinct("4 claras de huevo", "1 huevo");
  });
});
