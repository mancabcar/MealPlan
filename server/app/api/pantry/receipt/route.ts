// Escanear un ticket de compra (docs/pm/67-escanear-ticket/tech.md › APIs / interfaces): la foto, ya reducida en el
// navegador, va a Claude con visión y vuelve como líneas para la lista editable de la Despensa.
// La imagen solo se reenvía a Claude: no se guarda ni se registra (tech.md › Risks).
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { FOODS } from "@/lib/foods";
import {
  MAX_IMAGE_BASE64,
  RECEIPT_ERROR_MESSAGES,
  RECEIPT_ERROR_STATUS,
  buildReceiptPrompt,
  parseReceiptReply,
  type ReceiptErrorCode,
} from "@/lib/receiptScan";
import { authenticate, guarded } from "../../../../lib/auth";
import { preflight, withCors } from "../../../../lib/cors";
import { receiptLimiter } from "../../../../lib/rateLimit";

export const maxDuration = 60;

/** Sonnet 5.5 sin pensamiento: lee bien las abreviaturas del ticket con coste y tiempo razonables (tech.md). */
const AI_MODEL = "claude-sonnet-5-5";
/** Dentro de los 60 s de la función: la ruta siempre responde con JSON antes del corte. */
const AI_TIMEOUT_MS = 45_000;

const FOOD_NAMES = FOODS.map((f) => f.name);

export async function OPTIONS(request: Request) {
  return preflight(request);
}

function failure(request: Request, code: ReceiptErrorCode, headers?: Record<string, string>) {
  return withCors(
    request,
    NextResponse.json({ error: code, message: RECEIPT_ERROR_MESSAGES[code] }, { status: RECEIPT_ERROR_STATUS[code], headers }),
  );
}

async function readLines(request: Request, image: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    // Un solo intento: el SDK reintenta 2 veces por defecto
    const response = await new Anthropic().messages.create(
      {
        model: AI_MODEL,
        max_tokens: 4000,
        thinking: { type: "disabled" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: buildReceiptPrompt(FOOD_NAMES) },
            ],
          },
        ],
      },
      { signal: controller.signal, maxRetries: 0 },
    );
    const reply = response.content.find((b) => b.type === "text")?.text ?? "";
    const lines = parseReceiptReply(reply);
    return lines ? withCors(request, NextResponse.json({ lines })) : failure(request, "unreadable");
  } catch {
    return failure(request, "ai_failed");
  } finally {
    clearTimeout(timer);
  }
}

async function handle(request: Request): Promise<Response> {
  const session = await authenticate(request);
  if (!session) return failure(request, "unauthorized");

  const limit = receiptLimiter.check(session.userId);
  if (!limit.allowed) return failure(request, "rate_limited", { "Retry-After": String(limit.retryAfterSeconds) });

  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return failure(request, "invalid_image");
  }
  const { image, mediaType } = body ?? {};
  if (typeof image !== "string" || image === "" || image.length > MAX_IMAGE_BASE64 || mediaType !== "image/jpeg") {
    return failure(request, "invalid_image");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return withCors(
      request,
      NextResponse.json({ error: "Falta la API key de Claude. Configura ANTHROPIC_API_KEY en el servidor." }, { status: 500 }),
    );
  }
  return readLines(request, image);
}

export const POST = (request: Request) => guarded(request, () => handle(request));
