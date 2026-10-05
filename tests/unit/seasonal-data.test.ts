// Spec: docs/pm/34-temporada/spec.md › R6, R8 (calendario nacional estático).
// Tech: docs/pm/34-temporada/tech.md › Data model (`SeasonalProduct`) y Testing strategy.
// Se prueba el calendario REAL (src/data/seasonal.json). La forma es estricta; el contenido, solo con unos hechos ancla
// estables (acordados en dev-test): calabaza, caqui y membrillo en octubre; fresa en mayo y no en octubre; membrillo
// empieza en octubre; los 6 básicos marcados. Si la fuente (MAPA/Mercasa) contradijera un ancla, se habla con Manuel.
import { describe, expect, it } from "vitest";
import { normalizeKey } from "@/lib/shopping/parse";
import { SEASONAL_PRODUCTS, type SeasonalProduct } from "@/lib/seasonal";

const byId = (id: string): SeasonalProduct => {
  const p = SEASONAL_PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`Falta el producto «${id}» en seasonal.json`);
  return p;
};

describe("R6: forma del calendario estático", () => {
  it("tiene entre 50 y 120 productos", () => {
    expect(SEASONAL_PRODUCTS.length).toBeGreaterThanOrEqual(50);
    expect(SEASONAL_PRODUCTS.length).toBeLessThanOrEqual(120);
  });

  it("los ids son slugs únicos para la URL (?producto=<id>)", () => {
    const ids = SEASONAL_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("cada producto tiene nombre, tipo válido y meses 1–12 sin repetir", () => {
    for (const p of SEASONAL_PRODUCTS) {
      expect(p.name.trim(), p.id).not.toBe("");
      expect(["verdura", "fruta"], p.id).toContain(p.kind);
      expect(p.months.length, p.id).toBeGreaterThanOrEqual(1);
      expect(new Set(p.months).size, p.id).toBe(p.months.length);
      for (const m of p.months) {
        expect(Number.isInteger(m) && m >= 1 && m <= 12, `${p.id}: mes ${m}`).toBe(true);
      }
    }
  });

  it("las palabras clave están normalizadas (normalizeKey) y ninguna se repite entre productos", () => {
    const seen = new Map<string, string>();
    for (const p of SEASONAL_PRODUCTS) {
      expect(p.keywords.length, p.id).toBeGreaterThanOrEqual(1);
      for (const k of p.keywords) {
        expect(normalizeKey(k), `${p.id}: «${k}»`).toBe(k);
        expect(seen.get(k), `«${k}» repetida en ${p.id} y ${seen.get(k)}`).toBeUndefined();
        seen.set(k, p.id);
      }
    }
  });

  it("hay verduras y frutas", () => {
    expect(SEASONAL_PRODUCTS.some((p) => p.kind === "verdura" && !p.basic)).toBe(true);
    expect(SEASONAL_PRODUCTS.some((p) => p.kind === "fruta" && !p.basic)).toBe(true);
  });
});

describe("R2: los 6 básicos de todo el año están marcados basic:true", () => {
  it.each(["cebolla", "ajo", "patata", "limon", "zanahoria", "champinon"])("%s es básico", (id) => {
    expect(byId(id).basic).toBe(true);
  });

  it("solo esos 6 son básicos", () => {
    const basics = SEASONAL_PRODUCTS.filter((p) => p.basic).map((p) => p.id).sort();
    expect(basics).toEqual(["ajo", "cebolla", "champinon", "limon", "patata", "zanahoria"]);
  });
});

describe("R1/R8: hechos ancla del calendario", () => {
  it("calabaza, caqui y membrillo están de temporada en octubre", () => {
    for (const id of ["calabaza", "caqui", "membrillo"]) expect(byId(id).months, id).toContain(10);
  });

  it("la fresa está en mayo y no en octubre", () => {
    expect(byId("fresa").months).toContain(5);
    expect(byId("fresa").months).not.toContain(10);
  });

  it("el membrillo empieza en octubre (septiembre no está en su ventana)", () => {
    expect(byId("membrillo").months).not.toContain(9);
  });
});
