// Spec: docs/pm/19-importar-receta-url/spec.md › R2 (JSON-LD), R3 (respuesta de la IA), R7 (URL y direcciones) y Edge cases.
// Tech: docs/pm/19-importar-receta-url/tech.md › Design › Components & files (`src/lib/recipeImport.ts`). Contrato:
//   - extractJsonLdRecipe(html): ImportedJsonLd | null
//       { recipe: { name, ingredients: string[], instructions: string[], prepTimeMinutes?, calories?, protein?, carbs?, fat? },
//         servingsHint?: string, tagHint?: string }
//     `recipe` solo lleva las claves que la web trae; los pasos salen aplanados (HowToStep / HowToSection / texto);
//     `servingsHint` es el número de raciones como texto ("4"); `tagHint` es `recipeCategory`. null si no hay `Recipe`.
//   - htmlToText(html, maxChars): texto visible sin scripts, estilos ni etiquetas, recortado a maxChars.
//   - validateImportUrl(raw): { ok: true, url: URL } | { ok: false, error: "invalid_url" | "blocked" }
//   - isPrivateAddress(ip): true para loopback, privadas, link-local y equivalentes IPv6 (incl. IPv4 mapeadas).
//   - parseAiRecipe(text): la receta (mismas claves que `recipe`) o null si no hay JSON válido con nombre e ingredientes.
// Fallan hasta que exista el módulo (tarea 1 del tech design).
import { describe, expect, it } from "vitest";
import { extractJsonLdRecipe, htmlToText, isPrivateAddress, parseAiRecipe, validateImportUrl } from "@/lib/recipeImport";
import {
  CALABAZA_AI,
  HTML_GRAPH,
  HTML_JSONLD,
  HTML_LIST,
  HTML_NO_NUTRITION,
  HTML_NO_RECIPE,
  HTML_NO_YIELD,
  HTML_SECTIONS,
  HTML_TEXT_ONLY,
  HTML_TIME_1H30,
  LENTEJAS_IMPORTED,
  ldScript,
  page,
} from "../fixtures/importar-receta";

describe("R2: extractJsonLdRecipe", () => {
  it("lee nombre, ingredientes, pasos, tiempo y macros de un JSON-LD Recipe", () => {
    const found = extractJsonLdRecipe(HTML_JSONLD);
    expect(found?.recipe).toEqual(LENTEJAS_IMPORTED);
  });

  it("encuentra la Recipe dentro de un @graph con otros nodos", () => {
    expect(extractJsonLdRecipe(HTML_GRAPH)?.recipe).toEqual(LENTEJAS_IMPORTED);
  });

  it("encuentra la Recipe cuando el script contiene una lista de nodos", () => {
    expect(extractJsonLdRecipe(HTML_LIST)?.recipe).toEqual(LENTEJAS_IMPORTED);
  });

  it("acepta varios scripts JSON-LD y se queda con el que es una Recipe", () => {
    const html = page(ldScript({ "@type": "WebSite", name: "Recetas" }) + ldScript({ "@type": "Recipe", name: "Solo nombre", recipeIngredient: ["sal"] }));
    expect(extractJsonLdRecipe(html)?.recipe.name).toBe("Solo nombre");
  });

  it("sin bloque nutrition deja los macros sin definir (no los inventa)", () => {
    const { recipe } = extractJsonLdRecipe(HTML_NO_NUTRITION) ?? {};
    expect(recipe?.name).toBe("Lentejas con verduras");
    for (const key of ["calories", "protein", "carbs", "fat"] as const) expect(recipe?.[key]).toBeUndefined();
  });

  it("aplana los pasos de HowToSection en el orden de la web", () => {
    expect(extractJsonLdRecipe(HTML_SECTIONS)?.recipe.instructions).toEqual([
      "Picar la verdura.",
      "Sofreírla 10 minutos.",
      "Cocer las lentejas.",
    ]);
  });

  it("acepta recipeInstructions como una sola cadena y la parte por líneas", () => {
    const html = page(
      ldScript({ "@type": "Recipe", name: "Tostada", recipeIngredient: ["pan"], recipeInstructions: "Tostar el pan.\nAñadir el tomate." }),
    );
    expect(extractJsonLdRecipe(html)?.recipe.instructions).toEqual(["Tostar el pan.", "Añadir el tomate."]);
  });

  it("convierte la duración ISO 8601 a minutos (PT1H30M = 90)", () => {
    expect(extractJsonLdRecipe(HTML_TIME_1H30)?.recipe.prepTimeMinutes).toBe(90);
  });

  it("usa prepTime + cookTime si no hay totalTime", () => {
    const html = page(
      ldScript({ "@type": "Recipe", name: "Pasta", recipeIngredient: ["pasta"], prepTime: "PT10M", cookTime: "PT15M" }),
    );
    expect(extractJsonLdRecipe(html)?.recipe.prepTimeMinutes).toBe(25);
  });

  it("R8: devuelve las raciones que indica la web como pista y no toca los macros", () => {
    const found = extractJsonLdRecipe(HTML_JSONLD);
    expect(found?.servingsHint).toBe("4");
    expect(found?.recipe.calories).toBe(420);
  });

  it("R8: recipeYield numérico o en lista también da el número", () => {
    const html = page(ldScript({ "@type": "Recipe", name: "Sopa", recipeIngredient: ["agua"], recipeYield: [6, "6 porciones"] }));
    expect(extractJsonLdRecipe(html)?.servingsHint).toBe("6");
  });

  it("R8: sin recipeYield no hay pista", () => {
    expect(extractJsonLdRecipe(HTML_NO_YIELD)?.servingsHint).toBeUndefined();
  });

  it("devuelve recipeCategory como pista de etiqueta, sin asignarla a la receta", () => {
    const found = extractJsonLdRecipe(HTML_JSONLD);
    expect(found?.tagHint).toBe("Plato principal");
    expect(found?.recipe).not.toHaveProperty("tags");
  });

  it("no revienta con JSON-LD mal formado y sigue con los demás scripts", () => {
    const html = page(
      `<script type="application/ld+json">{ esto no es json </script>` +
        ldScript({ "@type": "Recipe", name: "Arroz", recipeIngredient: ["arroz"] }),
    );
    expect(extractJsonLdRecipe(html)?.recipe.name).toBe("Arroz");
  });

  it("devuelve null si no hay ninguna Recipe", () => {
    expect(extractJsonLdRecipe(HTML_NO_RECIPE)).toBeNull();
    expect(extractJsonLdRecipe(HTML_TEXT_ONLY)).toBeNull();
  });

  it("devuelve null si la Recipe no tiene ingredientes (no es importable)", () => {
    expect(extractJsonLdRecipe(page(ldScript({ "@type": "Recipe", name: "Vacía" })))).toBeNull();
  });
});

describe("R3: htmlToText (lo que se envía a la IA)", () => {
  it("quita scripts, estilos y etiquetas y conserva el texto de la receta", () => {
    const text = htmlToText(HTML_TEXT_ONLY, 30_000);
    expect(text).toContain("Crema de calabaza");
    expect(text).toContain("500 g de calabaza");
    expect(text).not.toContain("window.track");
    expect(text).not.toContain("font-family");
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it("recorta al máximo de caracteres", () => {
    const long = page("", `<p>${"a".repeat(50_000)}</p>`);
    expect(htmlToText(long, 30_000).length).toBeLessThanOrEqual(30_000);
  });

  it("decodifica las entidades HTML habituales", () => {
    expect(htmlToText(page("", "<p>Tortilla &amp; patatas&nbsp;fritas</p>"), 1000)).toContain("Tortilla & patatas");
  });
});

describe("R3: parseAiRecipe", () => {
  it("lee el JSON que devuelve Claude", () => {
    expect(parseAiRecipe(JSON.stringify(CALABAZA_AI))).toEqual(CALABAZA_AI);
  });

  it("tolera texto y bloques de código alrededor del JSON", () => {
    expect(parseAiRecipe("Aquí tienes:\n```json\n" + JSON.stringify(CALABAZA_AI) + "\n```")).toEqual(CALABAZA_AI);
  });

  it("devuelve null si no hay JSON, no tiene nombre o no tiene ingredientes", () => {
    expect(parseAiRecipe("No hay receta en esa página.")).toBeNull();
    expect(parseAiRecipe(JSON.stringify({ ...CALABAZA_AI, name: "" }))).toBeNull();
    expect(parseAiRecipe(JSON.stringify({ ...CALABAZA_AI, ingredients: [] }))).toBeNull();
    expect(parseAiRecipe(JSON.stringify({ error: "no_recipe" }))).toBeNull();
  });

  it("descarta macros que no son números en vez de fiarse de ellos", () => {
    const parsed = parseAiRecipe(JSON.stringify({ ...CALABAZA_AI, calories: "muchas", protein: -3 }));
    expect(parsed?.calories).toBeUndefined();
    expect(parsed?.protein).toBeUndefined();
    expect(parsed?.carbs).toBe(28);
  });
});

describe("R7: validateImportUrl", () => {
  it("acepta http y https", () => {
    expect(validateImportUrl("https://www.recetas-ejemplo.es/lentejas")).toMatchObject({ ok: true });
    expect(validateImportUrl("http://recetas-ejemplo.es/lentejas")).toMatchObject({ ok: true });
  });

  it("completa con https:// si falta el protocolo", () => {
    const result = validateImportUrl("www.recetas-ejemplo.es/lentejas");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.href).toBe("https://www.recetas-ejemplo.es/lentejas");
  });

  it.each(["", "   ", "no es una url", "ftp://recetas-ejemplo.es/lentejas", "javascript:alert(1)", "file:///etc/passwd"])(
    "rechaza %j como invalid_url",
    (raw) => {
      expect(validateImportUrl(raw)).toEqual({ ok: false, error: "invalid_url" });
    },
  );

  it.each([
    "http://localhost/receta",
    "http://LOCALHOST:3001/receta",
    "http://127.0.0.1/receta",
    "http://0.0.0.0/receta",
    "http://10.0.0.5/receta",
    "http://172.16.0.1/receta",
    "http://192.168.1.10/receta",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/receta",
    "http://[::ffff:127.0.0.1]/receta",
    "http://[fe80::1]/receta",
    "http://[fd00::1]/receta",
    "http://2130706433/receta",
  ])("rechaza %s como blocked", (raw) => {
    expect(validateImportUrl(raw)).toEqual({ ok: false, error: "blocked" });
  });

});

describe("R7: isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "0.0.0.0",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:10.0.0.1",
    "::ffff:7f00:1",
  ])("%s es privada", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.169.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s es pública",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});
