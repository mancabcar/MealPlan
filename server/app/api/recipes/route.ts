import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { PantryItem, Recipe } from "../../../../src/lib/types";
import { recipeViolations } from "../../../../src/lib/allergens";
import { buildRecipePrompt, safeAllergies, safePreferredIngredient, type RecipeProfile } from "../../../../src/lib/recipePrompt";
import { preflight, withCors } from "../../../lib/cors";

export const maxDuration = 60;

/** Opus 5.5 siempre piensa: esfuerzo bajo para no alargar la respuesta y tokens de sobra para pensamiento + JSON (#180). */
const AI_MODEL = "claude-opus-5-5";
const AI_EFFORT = "low";
const AI_MAX_TOKENS = 16_000;
/** Por debajo de los 60 s de la función, para responder con el error JSON de la ruta y no con un 504 vacío (#165). */
const AI_TIMEOUT_MS = 50_000;

export async function OPTIONS(request: Request) {
  return preflight(request);
}

async function handlePOST(request: Request): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta la API key de Claude. Configura ANTHROPIC_API_KEY en el servidor." },
      { status: 500 },
    );
  }

  const { profile, pantryItems = [], count = 3, preferredIngredient } = (await request.json()) as {
    profile: RecipeProfile;
    pantryItems?: PantryItem[];
    count?: number;
    /** Opcional (docs/pm/34-temporada): un servidor antiguo lo ignora y genera una receta genérica. */
    preferredIngredient?: unknown;
  };

  if (!profile) {
    return NextResponse.json({ error: "Falta el perfil del usuario." }, { status: 400 });
  }

  const prompt = buildRecipePrompt(profile, pantryItems, count, safePreferredIngredient(preferredIngredient));
  const client = new Anthropic();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    // Un solo intento de verdad: el SDK reintenta 2 veces por defecto, y cada intento se paga (#165)
    const response = await client.messages.create(
      {
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        output_config: { effort: AI_EFFORT },
        messages: [{ role: "user", content: prompt }],
      },
      { signal: controller.signal, maxRetries: 0 },
    );

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Claude ha rechazado esta petición. Prueba de nuevo o cambia el ingrediente." },
        { status: 502 },
      );
    }

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
    if (controller.signal.aborted) {
      return NextResponse.json(
        { error: "Claude ha tardado demasiado en responder. Prueba de nuevo." },
        { status: 504 },
      );
    }
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
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  return withCors(request, await handlePOST(request));
}
