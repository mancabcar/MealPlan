import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { UserProfile, PantryItem, Recipe } from "@/lib/types";
import { isExpiringSoon } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta la API key de Claude. Configura ANTHROPIC_API_KEY en el servidor." },
      { status: 500 },
    );
  }

  const { profile, pantryItems, count = 3 } = (await request.json()) as {
    profile: UserProfile;
    pantryItems: PantryItem[];
    count?: number;
  };

  if (!profile) {
    return NextResponse.json({ error: "Falta el perfil del usuario." }, { status: 400 });
  }

  const expiring = pantryItems.filter(isExpiringSoon).map((i) => i.name);
  const allItems = pantryItems.map((i) => `${i.quantity} de ${i.name}`);

  const prompt = `Eres un nutricionista y chef personal. Genera ${count} recetas personalizadas.

PERFIL DEL USUARIO:
- Calorías objetivo: ${profile.calorieGoal} kcal/día
- Proteínas: ${profile.proteinGoal}g | Carbos: ${profile.carbsGoal}g | Grasas: ${profile.fatGoal}g
- Restricciones: ${profile.dietaryRestrictions.length ? profile.dietaryRestrictions.join(", ") : "Ninguna"}
- No le gusta: ${profile.dislikedIngredients.length ? profile.dislikedIngredients.join(", ") : "Nada en particular"}

INGREDIENTES DISPONIBLES:
${allItems.length ? allItems.join("\n") : "Sin información de despensa"}

INGREDIENTES QUE URGE USAR (caducan pronto):
${expiring.length ? expiring.join(", ") : "Ninguno"}

INSTRUCCIONES:
- Prioriza usar los ingredientes que caducan pronto
- Cada receta debe ser para 1 persona
- Incluye macros exactos
- Respeta siempre las restricciones dietéticas y evita los ingredientes que no le gustan

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni backticks:
[
  {
    "id": "ai_001",
    "name": "Nombre de la receta",
    "ingredients": ["ingrediente 1", "ingrediente 2"],
    "instructions": ["paso 1", "paso 2"],
    "prepTimeMinutes": 20,
    "calories": 450,
    "protein": 35,
    "carbs": 40,
    "fat": 12,
    "tags": ["alto proteína"],
    "isAIGenerated": true
  }
]`;

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

    const recipes = JSON.parse(text.slice(start, end + 1)) as Recipe[];

    // IDs únicos para no chocar con recetas generadas antes
    const suffix = crypto.randomUUID().slice(0, 8);
    const result = recipes.map((r, i) => ({
      ...r,
      id: `ai_${suffix}_${i}`,
      isAIGenerated: true,
    }));

    return NextResponse.json({ recipes: result });
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
