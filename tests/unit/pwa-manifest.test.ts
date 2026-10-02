// Spec: docs/pm/21-pwa-recordatorios/spec.md › R1 (manifest válido) y R2 (iconos).
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("R1: manifest", () => {
  const m = manifest();

  it("se llama MealPlanner y abre a pantalla completa desde la raíz", () => {
    expect(m.name).toBe("MealPlanner");
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
  });

  it("usa el tema oscuro con el acento lima del rediseño", () => {
    expect(m.background_color).toBe("#0a0a0a");
    expect(m.theme_color).toBeTruthy();
  });
});

describe("R2: iconos del manifest", () => {
  const icons = manifest().icons ?? [];

  it("incluye 192 y 512, y uno maskable", () => {
    expect(icons.some((i) => i.sizes === "192x192" && i.type === "image/png")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.type === "image/png")).toBe(true);
    expect(icons.some((i) => i.purpose?.includes("maskable"))).toBe(true);
  });

  it("todos apuntan a rutas absolutas (el sitio sirve en la raíz)", () => {
    for (const i of icons) expect(i.src.startsWith("/")).toBe(true);
  });
});
