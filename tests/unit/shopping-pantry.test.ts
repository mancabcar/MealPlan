// Spec: docs/pm/lista-compra/spec.md › R5 y "Despensa matching", Edge cases (sin fecha de caducidad).
// Tech: docs/pm/lista-compra/tech.md › pantryMatch.ts (`matchPantry(key, pantry, today)` → `{ match?, expiredMatch? }`).
import { describe, expect, it } from "vitest";
import { matchPantry } from "@/lib/shopping/pantryMatch";
import { normalizeKey } from "@/lib/shopping/parse";
import type { PantryItem } from "@/lib/types";

const TODAY = "2026-09-22";

const p = (id: string, name: string, extra: Partial<PantryItem> = {}): PantryItem => ({
  id,
  name,
  quantity: "1",
  category: "Despensa",
  ...extra,
});

const match = (ingredient: string, pantry: PantryItem[], today = TODAY) => matchPantry(normalizeKey(ingredient), pantry, today);

describe("R5: un ingrediente coincide si todas sus palabras están en el nombre del artículo de la Despensa", () => {
  it('"arroz" coincide con "Arroz integral"', () => {
    const arroz = p("a", "Arroz integral", { quantity: "1 kg" });
    expect(match("arroz", [arroz]).match).toEqual(arroz);
  });

  it('"lomo de salmón" coincide con "Lomos de salmón" (plural, tildes y mayúsculas)', () => {
    const salmon = p("s", "Lomos de salmón", { category: "Congelador" });
    expect(match("lomo de salmón", [salmon]).match).toEqual(salmon);
  });

  it('"de" no cuenta como palabra', () => {
    const salmon = p("s", "Salmón lomos");
    expect(match("lomo de salmón", [salmon]).match).toEqual(salmon);
  });

  it('"arroz integral" no coincide con "Arroz" (falta una palabra)', () => {
    expect(match("arroz integral", [p("a", "Arroz")])).toEqual({});
  });

  it('"cebolla morada" no coincide con "Cebolla"; "cebolla" sí coincide con "Cebolla morada"', () => {
    expect(match("cebolla morada", [p("c", "Cebolla")]).match).toBeUndefined();
    expect(match("cebolla", [p("c", "Cebolla morada")]).match?.id).toBe("c");
  });

  it("sin coincidencias → objeto vacío", () => {
    expect(match("brócoli", [p("a", "Arroz integral")])).toEqual({});
    expect(match("brócoli", [])).toEqual({});
  });
});

describe("R5: caducidad", () => {
  it("un artículo caducado no cuenta: devuelve expiredMatch y no match", () => {
    const esparragos = p("e", "Espárragos verdes", { category: "Nevera", expiryDate: "2026-09-20" });
    expect(match("espárragos verdes", [esparragos])).toEqual({ expiredMatch: esparragos });
  });

  it("caduca hoy → todavía vale (se compara con el `today` recibido, no con el reloj)", () => {
    const yogur = p("y", "Yogur natural", { expiryDate: TODAY });
    expect(match("yogur natural", [yogur]).match).toEqual(yogur);
    expect(match("yogur natural", [yogur], "2026-09-23")).toEqual({ expiredMatch: yogur });
  });

  it("sin fecha de caducidad cuenta como no caducado", () => {
    const sal = p("s", "Sal gorda");
    expect(match("sal", [sal]).match).toEqual(sal);
  });

  it("con varias coincidencias se usa la primera no caducada, en el orden de la Despensa", () => {
    const caducado = p("1", "Arroz basmati", { expiryDate: "2026-09-01" });
    const integral = p("2", "Arroz integral", { quantity: "1 kg" });
    const redondo = p("3", "Arroz redondo");
    const result = match("arroz", [caducado, integral, redondo]);
    expect(result.match).toEqual(integral);
  });
});
