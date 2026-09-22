import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { PantryItem, Recipe } from "@/lib/types";
import { recipeViolations } from "@/lib/allergens";
import { buildRecipePrompt, safeAllergies, type RecipeProfile } from "@/lib/recipePrompt";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta la API key de Claude. Configura ANTHROPIC_API_KEY en el servidor." },
      { status: 500 },
    );
  }

  const { profile, pantryItems = [], count = 3 } = (await request.json()) as {
    profile: RecipeProfile;
    pantryItems?: PantryItem[];
    count?: number;
  };

  if (!profile) {
    return NextResponse.json({ error: "Falta el perfil del usuario." }, { status: 400 });
  }

  const prompt = buildRecipePrompt(profile, pantryItems, count);
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return NextResponse.json(
        { error: "No se pudo interpretar la respuesta de Claude." },
        { status: 502 },
      );
    }

    const recipes = (JSON.parse(text.slice(start, end + 1)) as Recipe[]).map((r) => ({
      ...r,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    }));

    // El prompt no basta: se descartan las que lleven un alérgeno declarado o de su familia (R18)
    const allergies = safeAllergies(profile.allergies);
    const safe = recipes.filter((r) => recipeViolations(r, allergies).length === 0);

    // IDs únicos para no chocar con recetas generadas antes
    const suffix = crypto.randomUUID().slice(0, 8);
    const result = safe.map((r, i) => ({
      ...r,
      id: `ai_${suffix}_${i}`,
      isAIGenerated: true,
    }));

    return NextResponse.json({ recipes: result, droppedCount: recipes.length - safe.length });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Error de la API de Claude (HTTP ${error.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo interpretar la respuesta de Claude." },
      { status: 502 },
    );
  }
}
