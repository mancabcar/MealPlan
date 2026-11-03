// Spec: docs/pm/67-escanear-ticket/spec.md › R2, R5, R6. Tech: tech.md › APIs / interfaces (`POST /api/pantry/receipt`).
// Contrato de `server/app/api/pantry/receipt/route.ts` (exporta `OPTIONS` y `POST`):
//   - Cabecera `Authorization: Bearer <token>`; body JSON `{ image: string (base64), mediaType: "image/jpeg" }`.
//   - Orden: sesión → límite por usuario (`receiptLimiter`, 10 / 10 min) → validar imagen → API key → Claude.
//   - 200: `{ lines: ReceiptLine[] }` (lo que devuelve `parseReceiptReply`).
//   - Error: `{ error: código, message }` con ERROR_TEXTS y ERROR_STATUS (tests/fixtures/escanear-ticket.ts):
//       unauthorized 401 · rate_limited 429 (+ Retry-After) · invalid_image 400 · unreadable 422 · ai_failed 502.
//   - Claude: modelo claude-sonnet-5-5, sin pensamiento, una sola vez (maxRetries 0), con la imagen como bloque
//     `image` base64 y el prompt con los nombres de la Base de alimentos. 45 s como mucho: después, ai_failed.
//   - CORS igual que el resto de rutas (CORS_ALLOWED_ORIGIN).
// El SDK de Anthropic y el store se simulan: ningún test toca la red, la base de datos ni la API real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INVITE, ORIGIN, json, resetStore, useEnv } from "../helpers/api";
import {
  CLAUDE_REPLY,
  ERROR_STATUS,
  ERROR_TEXTS,
  MAX_IMAGE_BASE64,
  RECEIPT_LINES,
  TINY_JPEG_BASE64,
} from "../../../tests/fixtures/escanear-ticket";

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

const { POST: register } = await import("../../app/api/auth/register/route");
const { OPTIONS, POST } = await import("../../app/api/pantry/receipt/route");
const { receiptLimiter } = await import("../../lib/rateLimit");

const SONNET = "claude-sonnet-5-5";
const ROUTE = "/api/pantry/receipt";

let token: string;

beforeEach(async () => {
  vi.useRealTimers();
  create.mockReset();
  resetStore();
  useEnv();
  receiptLimiter.reset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  const res = await register(json("POST", "/api/auth/register", { username: "lucia", password: "secreto-123", invite: INVITE }));
  token = (await res.json()).token;
});

function claudeReturns(text: string) {
  create.mockResolvedValue({ content: [{ type: "text", text }] });
}

async function scan(body: unknown = { image: TINY_JPEG_BASE64, mediaType: "image/jpeg" }, auth: string | undefined = token) {
  const res = await POST(json("POST", ROUTE, body, auth));
  return { status: res.status, body: await res.json(), headers: res.headers };
}

function expectError(result: { status: number; body: unknown }, code: keyof typeof ERROR_TEXTS) {
  expect(result.status).toBe(ERROR_STATUS[code]);
  expect(result.body).toEqual({ error: code, message: ERROR_TEXTS[code] });
}

describe("R2: un ticket legible devuelve sus líneas", () => {
  it("responde 200 con las líneas que lee Claude", async () => {
    claudeReturns(CLAUDE_REPLY);
    const { status, body } = await scan();
    expect(status).toBe(200);
    expect(body).toEqual({ lines: RECEIPT_LINES });
  });

  it("llama una vez a Sonnet 5.5, sin pensamiento y sin reintentos", async () => {
    claudeReturns(CLAUDE_REPLY);
    await scan();
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0];
    expect(params.model).toBe(SONNET);
    expect(params.thinking).toEqual({ type: "disabled" });
    expect(options).toMatchObject({ maxRetries: 0 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("manda la imagen a Claude como bloque image en base64", async () => {
    claudeReturns(CLAUDE_REPLY);
    await scan();
    const content = create.mock.calls[0][0].messages[0].content;
    expect(content).toEqual(
      expect.arrayContaining([
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: TINY_JPEG_BASE64 } },
      ]),
    );
  });
});

describe("R6: el prompt lleva la Base de alimentos", () => {
  it("incluye nombres de src/data/foods.json", async () => {
    claudeReturns(CLAUDE_REPLY);
    await scan();
    const content = create.mock.calls[0][0].messages[0].content as { type: string; text?: string }[];
    const text = content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    expect(text).toContain("Pechuga de pollo, cruda");
    expect(text).toContain("Leche semidesnatada");
  });
});

describe("R5: errores", () => {
  it("sin token responde 401 y no llama a Claude", async () => {
    const result = await scan(undefined, undefined);
    expectError(result, "unauthorized");
    expect(create).not.toHaveBeenCalled();
  });

  it("con un token inválido responde 401", async () => {
    expectError(await scan(undefined, "token-falso"), "unauthorized");
  });

  it("sin imagen, con otro tipo o con un cuerpo que no es JSON responde 400", async () => {
    expectError(await scan({ mediaType: "image/jpeg" }), "invalid_image");
    expectError(await scan({ image: "", mediaType: "image/jpeg" }), "invalid_image");
    expectError(await scan({ image: TINY_JPEG_BASE64, mediaType: "image/png" }), "invalid_image");
    expectError(await scan({ image: 42, mediaType: "image/jpeg" }), "invalid_image");
    const res = await POST(
      new Request(`http://localhost${ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: ORIGIN, Authorization: `Bearer ${token}` },
        body: "esto no es json",
      }),
    );
    expect(res.status).toBe(ERROR_STATUS.invalid_image);
    expect(create).not.toHaveBeenCalled();
  });

  it("una imagen de más de 4 MB en base64 responde 400", async () => {
    const big = "A".repeat(MAX_IMAGE_BASE64 + 1);
    expectError(await scan({ image: big, mediaType: "image/jpeg" }), "invalid_image");
    expect(create).not.toHaveBeenCalled();
  });

  it("una imagen justo en el límite se acepta", async () => {
    claudeReturns(CLAUDE_REPLY);
    const { status } = await scan({ image: "A".repeat(MAX_IMAGE_BASE64), mediaType: "image/jpeg" });
    expect(status).toBe(200);
  });

  it("si Claude no devuelve líneas válidas responde 422", async () => {
    claudeReturns("No veo ningún ticket en esta imagen.");
    expectError(await scan(), "unreadable");
  });

  it("si Claude devuelve una lista vacía responde 422", async () => {
    claudeReturns(JSON.stringify({ lines: [] }));
    expectError(await scan(), "unreadable");
  });

  it("si la API de Claude falla responde 502", async () => {
    create.mockRejectedValue(new Error("overloaded"));
    expectError(await scan(), "ai_failed");
  });

  it("si Claude tarda más de 45 s corta la llamada y responde 502", async () => {
    vi.useFakeTimers();
    create.mockImplementation(
      (_body: unknown, opts?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const pending = scan();
    await vi.advanceTimersByTimeAsync(46_000);
    expectError(await pending, "ai_failed");
  });

  it("sin ANTHROPIC_API_KEY responde 500 sin llamar a Claude", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { status } = await scan();
    expect(status).toBe(500);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("Límite: 10 escaneos cada 10 minutos por usuario", () => {
  it("el undécimo responde 429 con Retry-After y no llama a Claude", async () => {
    claudeReturns(CLAUDE_REPLY);
    for (let i = 0; i < 10; i++) expect((await scan()).status).toBe(200);
    create.mockClear();
    const result = await scan();
    expectError(result, "rate_limited");
    expect(Number(result.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("el límite es por usuario, no compartido", async () => {
    claudeReturns(CLAUDE_REPLY);
    for (let i = 0; i < 10; i++) await scan();
    const res = await register(json("POST", "/api/auth/register", { username: "manuel", password: "secreto-123", invite: INVITE }));
    const other = (await res.json()).token;
    expect((await scan(undefined, other)).status).toBe(200);
  });

  it("una petición sin sesión no gasta el cupo", async () => {
    claudeReturns(CLAUDE_REPLY);
    for (let i = 0; i < 12; i++) await scan(undefined, undefined);
    expect((await scan()).status).toBe(200);
  });
});

describe("CORS", () => {
  it("el preflight permite el origen del front y la cabecera Authorization", async () => {
    const res = await OPTIONS(new Request(`http://localhost${ROUTE}`, { method: "OPTIONS", headers: { origin: ORIGIN } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("las respuestas llevan la cabecera CORS", async () => {
    claudeReturns(CLAUDE_REPLY);
    const { headers } = await scan();
    expect(headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });
});
