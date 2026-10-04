// Spec: docs/pm/combobox-recetas/spec.md › R1 (resaltar el tramo del nombre que coincide con la búsqueda).
// Tech: docs/pm/combobox-recetas/tech.md › APIs / interfaces: highlightRanges(text, query) → [inicio, fin)[] sobre el
// texto ORIGINAL (con tildes), sin solaparse; consulta vacía → []. Fallan hasta la tarea 1.
import { describe, expect, it } from "vitest";
import { highlightRanges } from "@/lib/text";

describe("R1: highlightRanges", () => {
  it("encuentra el tramo ignorando mayúsculas", () => {
    expect(highlightRanges("Crema de calabaza", "CALABAZA")).toEqual([[9, 17]]);
  });

  it("«pure» resalta «Puré» entero con su tilde original", () => {
    expect(highlightRanges("Puré de calabaza", "pure")).toEqual([[0, 4]]);
  });

  it("una consulta con tilde también encuentra texto sin ella", () => {
    expect(highlightRanges("Pure de calabaza", "puré")).toEqual([[0, 4]]);
  });

  it("una tilde descompuesta (e + U+0301) entra en el rango", () => {
    expect(highlightRanges("Café con leche", "cafe")).toEqual([[0, 5]]);
  });

  it("consulta vacía o solo espacios → sin rangos", () => {
    expect(highlightRanges("Puré de calabaza", "")).toEqual([]);
    expect(highlightRanges("Puré de calabaza", "   ")).toEqual([]);
  });

  it("sin coincidencia → sin rangos", () => {
    expect(highlightRanges("Puré de calabaza", "salmón")).toEqual([]);
  });

  it("los caracteres especiales de regex se buscan como texto y no lanzan", () => {
    expect(highlightRanges("Ensalada (fría) 1+1", "(fría)")).toEqual([[9, 15]]);
    expect(highlightRanges("Ensalada (fría) 1+1", "1+1")).toEqual([[16, 19]]);
    expect(() => highlightRanges("Pollo", "[")).not.toThrow();
    expect(highlightRanges("Pollo", ".*")).toEqual([]);
  });

  it("varias apariciones: todas, en orden y sin solaparse", () => {
    expect(highlightRanges("Pollo con pollo", "pollo")).toEqual([
      [0, 5],
      [10, 15],
    ]);
    expect(highlightRanges("aaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it("los rangos nunca salen del texto, ni con caracteres que cambian al normalizar", () => {
    for (const text of ["Straße de pollo", "Ofﬁcina", "Piña colada", "ÁÉÍÓÚ"]) {
      for (const query of ["stra", "ofi", "pina", "ae", "o", "a"]) {
        for (const [start, end] of highlightRanges(text, query)) {
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(text.length);
          expect(end).toBeGreaterThan(start);
        }
      }
    }
  });
});
