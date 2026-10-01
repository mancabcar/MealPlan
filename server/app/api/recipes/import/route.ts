import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  AI_TEXT_MAX_CHARS,
  IMPORT_ERROR_MESSAGES,
  IMPORT_ERROR_STATUS,
  buildImportPrompt,
  extractJsonLdRecipe,
  htmlToText,
  parseAiRecipe,
  validateImportUrl,
  type ImportErrorCode,
} from "../../../../../src/lib/recipeImport";
import { preflight, withCors } from "../../../../lib/cors";
import { importLimiter } from "../../../../lib/rateLimit";
import { SafeFetchError, safeFetch } from "../../../../lib/safeFetch";

export const maxDuration = 30;

const AI_MODEL = "claude-haiku-4-5-20251001";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

function failure(code: ImportErrorCode, headers?: Record<string, string>) {
  return NextResponse.json({ error: code, message: IMPORT_ERROR_MESSAGES[code] }, { status: IMPORT_ERROR_STATUS[code], headers });
}

async function extractWithAi(html: string): Promise<Response> {
  const text = htmlToText(html, AI_TEXT_MAX_CHARS);
  try {
    const response = await new Anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: buildImportPrompt(text) }],
    });
    const reply = response.content.find((b) => b.type === "text")?.text ?? "";
    const recipe = parseAiRecipe(reply);
    // Un solo intento: cualquier fallo de la IA cuenta como "no hay receta" (R6)
    return recipe ? NextResponse.json({ recipe, source: "ai" }) : failure("no_recipe");
  } catch {
    return failure("no_recipe");
  }
}

async function handlePOST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = importLimiter.check(ip);
  if (!limit.allowed) return failure("rate_limited", { "Retry-After": String(limit.retryAfterSeconds) });

  let raw: unknown;
  try {
    raw = ((await request.json()) as { url?: unknown }).url;
  } catch {
    return failure("invalid_url");
  }
  if (typeof raw !== "string") return failure("invalid_url");
  const checked = validateImportUrl(raw);
  if (!checked.ok) return failure(checked.error);

  let html: string;
  try {
    ({ html } = await safeFetch(checked.url.href));
  } catch (error) {
    return failure(error instanceof SafeFetchError ? error.code : "fetch_failed");
  }

  const found = extractJsonLdRecipe(html);
  if (found) return NextResponse.json({ ...found, source: "jsonld" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta la API key de Claude. Configura ANTHROPIC_API_KEY en el servidor." },
      { status: 500 },
    );
  }
  return extractWithAi(html);
}

export async function POST(request: Request) {
  return withCors(request, (await handlePOST(request)) as NextResponse);
}
