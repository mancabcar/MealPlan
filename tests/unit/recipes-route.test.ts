// Spec: docs/pm/onboarding-profile/spec.md › R10–R12, R17, R18 (prompt y filtro de alérgenos).
// El SDK de Anthropic se simula: ningún test llama a la API real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe, UserProfile } from "@/lib/types";
import { lucia, manuel } from "../fixtures/profiles";

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class Anthropic {
    static APIError = APIError;
    messages = { create };
  }
  return { default: Anthropic };
});

const { POST } = await import("@/app/api/recipes/route");

const recipe = (name: string, ingredients: string[]): Recipe => ({
  id: "x",
  name,
  ingredients,
  instructions: ["Mezclar"],
  prepTimeMinutes: 10,
  calories: 400,
  protein: 30,
  carbs: 40,
  fat: 12,
  tags: [],
});

function claudeReturns(recipes: Recipe[]) {
  create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(recipes) }] });
}

async function generate(profile: UserProfile | Record<string, unknown>) {
  const res = await POST(
    new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, pantryItems: [] }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

function sentPrompt(): string {
  return create.mock.calls[0][0].messages[0].content as string;
}

/** Bloques del prompt separados por línea en blanco: cada sección (alergias, dieta, gustos) va en el suyo. */
function blockWith(prompt: string, needle: RegExp): string {
  return prompt.split(/\n\s*\n/).find((b) => needle.test(b)) ?? "";
}

const allergicToNuts: UserProfile = {
  ...lucia,
  allergies: { preset: ["frutos_secos"], custom: [] },
  diet: "vegetarian",
  dislikedIngredients: ["Hígado"],
};

beforeEach(() => {
  create.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
  claudeReturns([recipe("Pollo al horno", ["pechuga de pollo"])]);
});

describe("R10: las alergias son una exclusión estricta, aparte de dieta y gustos", () => {
  it("R10: 'Frutos secos' va en su propio bloque de 'nunca uses', con su familia de ingredientes", async () => {
    await generate(allergicToNuts);
    const allergyBlock = blockWith(sentPrompt(), /nunca uses/i);
    expect(allergyBlock).toMatch(/frutos secos/i);
    for (const term of ["almendra", "nuez", "cacahuete", "pistacho"]) expect(allergyBlock).toMatch(new RegExp(term, "i"));
    expect(allergyBlock).not.toMatch(/hígado/i);
    expect(allergyBlock).not.toMatch(/vegetarian/i);
  });

  it("R10: las alergias libres también se listan como 'nunca uses'", async () => {
    await generate({ ...lucia, allergies: { preset: [], custom: ["Kiwi"] } });
    expect(blockWith(sentPrompt(), /nunca uses/i)).toMatch(/kiwi/i);
  });
});

describe("R11–R12: dieta como regla, 'no me gusta' como preferencia", () => {
  it("R12: 'Hígado' aparece como preferencia, no en el bloque de 'nunca uses'", async () => {
    await generate(allergicToNuts);
    const dislikeBlock = blockWith(sentPrompt(), /hígado/i);
    expect(dislikeBlock).not.toBe("");
    expect(dislikeBlock).not.toMatch(/nunca uses/i);
  });

  it("R11: la dieta Vegetariana aparece en el prompt, fuera del bloque de gustos", async () => {
    await generate(allergicToNuts);
    const dietBlock = blockWith(sentPrompt(), /vegetarian/i);
    expect(dietBlock).not.toBe("");
    expect(dietBlock).not.toMatch(/hígado/i);
  });
});

describe("R17: con proteína en rango, la IA apunta al punto medio", () => {
  it("R17: Manuel (130–170 g) → el prompt pide 150 g de proteína", async () => {
    await generate(manuel);
    expect(sentPrompt()).toMatch(/Prote[ií]nas?:?\s*150\s*g/i);
  });
});

describe("R18: se descartan las recetas con alérgenos antes de mostrarlas", () => {
  it("R18: con Frutos secos se descartan 'almendras laminadas' y 'Nueces'", async () => {
    claudeReturns([
      recipe("Ensalada crujiente", ["lechuga", "almendras laminadas"]),
      recipe("Salteado", ["Nueces", "brócoli"]),
      recipe("Pollo al horno", ["pechuga de pollo"]),
    ]);
    const { status, body } = await generate(allergicToNuts);
    expect(status).toBe(200);
    expect(body.recipes.map((r: Recipe) => r.name)).toEqual(["Pollo al horno"]);
    expect(body.droppedCount).toBe(2);
  });

  it("R18: si todas llevan el alérgeno, devuelve lista vacía y droppedCount para el aviso", async () => {
    claudeReturns([recipe("Turrón casero", ["almendra"]), recipe("Pesto", ["piñones", "albahaca"])]);
    const { status, body } = await generate(allergicToNuts);
    expect(status).toBe(200);
    expect(body.recipes).toEqual([]);
    expect(body.droppedCount).toBe(2);
  });

  it("R18: con Lactosa se conservan 'leche sin lactosa' y 'queso sin lactosa'", async () => {
    claudeReturns([recipe("Tortilla cremosa", ["leche sin lactosa", "queso sin lactosa"])]);
    const { body } = await generate({ ...lucia, allergies: { preset: ["lactosa"], custom: [] } });
    expect(body.recipes).toHaveLength(1);
    expect(body.droppedCount).toBe(0);
  });

  it("sin alergias no se descarta nada", async () => {
    claudeReturns([recipe("Turrón casero", ["almendra"])]);
    const { body } = await generate(lucia);
    expect(body.recipes).toHaveLength(1);
    expect(body.droppedCount).toBe(0);
  });
});
