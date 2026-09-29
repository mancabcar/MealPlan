// Review de #69/PR #70: apiUrl() no debe generar doble barra si NEXT_PUBLIC_API_BASE_URL
// se configura con "/" al final (fácil de hacer, así la muestra Vercel).
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl } from "@/lib/apiBase";

const ORIGINAL = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL;
});

describe("apiUrl", () => {
  it("sin NEXT_PUBLIC_API_BASE_URL, devuelve la ruta tal cual (relativa)", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(apiUrl("/api/recipes")).toBe("/api/recipes");
  });

  it("con la base sin barra final, la concatena tal cual", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://mealplan-server.vercel.app";
    expect(apiUrl("/api/recipes")).toBe("https://mealplan-server.vercel.app/api/recipes");
  });

  it("con la base con barra final (review), no genera doble barra", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://mealplan-server.vercel.app/";
    expect(apiUrl("/api/recipes")).toBe("https://mealplan-server.vercel.app/api/recipes");
  });
});
