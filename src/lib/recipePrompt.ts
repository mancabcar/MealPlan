// Prompt de generación de recetas (spec R10–R12, R17). Vive fuera de route.ts porque un route
// handler solo puede exportar métodos HTTP y config.
import { ALLERGEN_FAMILIES, ALLERGEN_LABELS } from "./allergens";
import { isExpiringSoon, type Allergies, type DietType, type PantryItem, type UserProfile } from "./types";

/** Lo único del perfil que necesita el prompt: los datos corporales no salen del navegador. */
export type RecipeProfile = Pick<
  UserProfile,
  "calorieGoal" | "proteinGoal" | "carbsGoal" | "fatGoal" | "allergies" | "diet" | "dislikedIngredients"
>;

export function toRecipeProfile(p: UserProfile): RecipeProfile {
  return {
    calorieGoal: p.calorieGoal,
    proteinGoal: p.proteinGoal, // con rango ya es el punto medio (R17)
    carbsGoal: p.carbsGoal,
    fatGoal: p.fatGoal,
    allergies: p.allergies,
    diet: p.diet,
    dislikedIngredients: p.dislikedIngredients,
  };
}

const DIET_RULES: Record<DietType, string> = {
  omnivore: "Come de todo.",
  pescetarian: "Pescetariana: nada de carne; sí pescado y marisco.",
  vegetarian: "Vegetariana: nada de carne, pescado ni marisco.",
  vegan: "Vegana: ningún producto de origen animal (ni lácteos, ni huevo, ni miel).",
};

/** El cliente puede mandar cualquier cosa: nos quedamos con alergias bien formadas. */
export function safeAllergies(raw: Partial<Allergies> | undefined): Allergies {
  return {
    preset: (raw?.preset ?? []).filter((p) => p in ALLERGEN_FAMILIES),
    custom: (raw?.custom ?? []).filter((c) => typeof c === "string" && c.trim() !== ""),
  };
}

function allergySection(allergies: Allergies): string {
  const lines = [
    ...allergies.preset.map((p) => `- ${ALLERGEN_LABELS[p]}: ${ALLERGEN_FAMILIES[p].join(", ")}`),
    ...allergies.custom.map((c) => `- ${c}`),
  ];
  if (lines.length === 0) return "ALERGIAS E INTOLERANCIAS: ninguna.";
  return `ALERGIAS E INTOLERANCIAS (regla estricta: nunca uses estos ingredientes, ni derivados, ni trazas):\n${lines.join("\n")}`;
}

export function buildRecipePrompt(profile: RecipeProfile, pantryItems: PantryItem[], count: number): string {
  const allergies = safeAllergies(profile.allergies);
  const dislikes = profile.dislikedIngredients ?? [];
  const expiring = pantryItems.filter(isExpiringSoon).map((i) => i.name);
  const allItems = pantryItems.map((i) => `${i.quantity} de ${i.name}`);

  // Cada sección va en su propio bloque (separado por línea en blanco) para que el modelo
  // no mezcle alergias (regla), dieta (regla) y gustos (preferencia).
  return `Eres un nutricionista y chef personal. Genera ${count} recetas personalizadas.

OBJETIVOS DIARIOS DEL USUARIO:
- Calorías: ${profile.calorieGoal} kcal/día
- Proteínas: ${profile.proteinGoal} g | Carbos: ${profile.carbsGoal} g | Grasas: ${profile.fatGoal} g

${allergySection(allergies)}

DIETA (regla obligatoria): ${DIET_RULES[profile.diet] ?? DIET_RULES.omnivore}

NO LE GUSTA (preferencia: evítalo si puedes, pero no es una regla):
${dislikes.length ? dislikes.map((d) => `- ${d}`).join("\n") : "- Nada en particular"}

INGREDIENTES DISPONIBLES:
${allItems.length ? allItems.join("\n") : "Sin información de despensa"}

INGREDIENTES QUE URGE USAR (caducan pronto):
${expiring.length ? expiring.join(", ") : "Ninguno"}

INSTRUCCIONES:
- Prioriza usar los ingredientes que caducan pronto
- Cada receta debe ser para 1 persona
- Incluye macros exactos
- Lista todos los ingredientes, sin omitir salsas, bases ni guarniciones
- Cada ingrediente en su propia línea con el formato "<cantidad> <unidad> de <ingrediente>", usando solo g, kg, ml, l, cucharada, cucharadita, lata, bote, diente o rebanada; para piezas enteras, solo el número ("2 huevos", "1/2 cebolla")
- Un ingrediente por línea: nada de "sal y pimienta" ni alternativas con "o". Condimentos sin cantidad, cada uno en su línea ("sal", "pimienta")
- Notas entre paréntesis al final ("(en seco)", "(opcional)")

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni backticks:
[
  {
    "id": "ai_001",
    "name": "Nombre de la receta",
    "ingredients": ["150g pechuga de pollo", "1 cucharada de aceite de oliva", "1/2 cebolla", "60g arroz (en seco)", "sal"],
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
}
