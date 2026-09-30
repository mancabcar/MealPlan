// Spec: docs/pm/19-importar-receta-url/spec.md › R2, R3, R6, R7. Tech: tech.md › APIs / interfaces (`POST /api/recipes/import`).
// Contrato de `server/app/api/recipes/import/route.ts` (exporta `OPTIONS` y `POST`):
//   - Body JSON `{ url: string }`. Orden: límite por IP → validar URL → safeFetch → JSON-LD → (si no hay) Claude.
//   - 200: `{ recipe, source: "jsonld" | "ai", servingsHint?, tagHint? }` (mismos campos que src/lib/recipeImport.ts).
//   - Error: `{ error: código, message }` con el texto de ERROR_TEXTS y el status de ERROR_STATUS:
//       invalid_url 400 · blocked 400 · fetch_failed 502 · no_recipe 422 · rate_limited 429 (+ cabecera Retry-After).
//   - La IA solo se llama si no hay JSON-LD Recipe, con el modelo claude-haiku-4-5-20251001, una sola vez (sin reintentos),
//     y solo con el texto de la página (máx. 30.000 caracteres). Cualquier fallo de la IA es no_recipe.
//   - Con JSON-LD no hace falta ANTHROPIC_API_KEY. CORS igual que /api/recipes (CORS_ALLOWED_ORIGIN).
//   - La IP del límite sale del primer valor de `x-forwarded-for`; sin cabecera todas comparten la clave "unknown".
// `safeFetch` y el SDK de Anthropic se simulan: ningún test toca la red ni la API real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CALABAZA_AI,
  ERROR_STATUS,
  ERROR_TEXTS,
  HTML_JSONLD,
  HTML_NO_RECIPE,
  HTML_TEXT_ONLY,
  LENTEJAS_IMPORTED,
  RECIPE_URL,
  page,
} from "../../../tests/fixtures/importar-receta";

const create = vi.fn();
const safeFetch = vi.fn();

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

vi.mock("../../lib/safeFetch", () => {
  class SafeFetchError extends Error {
    constructor(
      public code: "blocked" | "fetch_failed",
      message = code,
    ) {
      super(message);
    }
  }
  return { SafeFetchError, safeFetch: (...args: unknown[]) => safeFetch(...args) };
});

const { OPTIONS, POST } = await import("../../app/api/recipes/import/route");
const { importLimiter } = await import("../../lib/rateLimit");
const { SafeFetchError } = await import("../../lib/safeFetch");

const ALLOWED = "https://home-5021533470.app-ionos.space";
const HAIKU = "claude-haiku-4-5-20251001";

beforeEach(() => {
  create.mockReset();
  safeFetch.mockReset();
  importLimiter.reset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  process.env.CORS_ALLOWED_ORIGIN = ALLOWED;
});

function pageIs(html: string) {
  safeFetch.mockResolvedValue({ html, finalUrl: RECIPE_URL });
}
function claudeReturns(data: unknown) {
  create.mockResolvedValue({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }] });
}

async function importUrl(url: unknown = RECIPE_URL, headers: Record<string, string> = {}) {
  const res = await POST(
    new Request("http://localhost/api/recipes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: ALLOWED, ...headers },
      body: JSON.stringify({ url }),
    }),
  );
  return { status: res.status, body: await res.json(), headers: res.headers };
}

function sentPrompt(): string {
  const content = create.mock.calls[0][0].messages[0].content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

describe("R2: con JSON-LD no se llama a la IA", () => {
  it("devuelve la receta del JSON-LD con source 'jsonld' y sin llamar a Claude", async () => {
    pageIs(HTML_JSONLD);
    const { status, body } = await importUrl();
    expect(status).toBe(200);
    expect(body.source).toBe("jsonld");
    expect(body.recipe).toEqual(LENTEJAS_IMPORTED);
    expect(create).not.toHaveBeenCalled();
  });

  it("incluye las pistas de raciones y de categoría", async () => {
    pageIs(HTML_JSONLD);
    const { body } = await importUrl();
    expect(body.servingsHint).toBe("4");
    expect(body.tagHint).toBe("Plato principal");
  });

  it("funciona aunque el servidor no tenga ANTHROPIC_API_KEY", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    pageIs(HTML_JSONLD);
    const { status, body } = await importUrl();
    expect(status).toBe(200);
    expect(body.source).toBe("jsonld");
  });

  it("descarga la URL que le pasan", async () => {
    pageIs(HTML_JSONLD);
    await importUrl("https://www.recetas-ejemplo.es/otra");
    expect(safeFetch).toHaveBeenCalledTimes(1);
    expect(String(safeFetch.mock.calls[0][0])).toBe("https://www.recetas-ejemplo.es/otra");
  });
});

describe("R3: sin JSON-LD, Claude extrae la receta", () => {
  it("llama una vez a Haiku 4.5 con el texto de la página y devuelve source 'ai'", async () => {
    pageIs(HTML_TEXT_ONLY);
    claudeReturns(CALABAZA_AI);
    const { status, body } = await importUrl();
    expect(status).toBe(200);
    expect(body.source).toBe("ai");
    expect(body.recipe).toEqual(CALABAZA_AI);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe(HAIKU);
    expect(sentPrompt()).toContain("500 g de calabaza");
  });

  it("no envía scripts, estilos ni etiquetas a Claude", async () => {
    pageIs(HTML_TEXT_ONLY);
    claudeReturns(CALABAZA_AI);
    await importUrl();
    expect(sentPrompt()).not.toContain("window.track");
    expect(sentPrompt()).not.toContain("font-family");
  });

  it("pide macros estimados por ración y en el idioma original", async () => {
    pageIs(HTML_TEXT_ONLY);
    claudeReturns(CALABAZA_AI);
    await importUrl();
    expect(sentPrompt()).toMatch(/por raci[oó]n/i);
    expect(sentPrompt()).toMatch(/idioma original|sin traducir/i);
  });

  it("recorta el texto enviado a ~30.000 caracteres", async () => {
    pageIs(page("", `<p>${"lentejas ".repeat(20_000)}</p>`));
    claudeReturns(CALABAZA_AI);
    await importUrl();
    expect(sentPrompt().length).toBeLessThan(30_000 + 5_000);
  });

  it("acepta que Claude envuelva el JSON en texto", async () => {
    pageIs(HTML_TEXT_ONLY);
    claudeReturns("Aquí está:\n" + JSON.stringify(CALABAZA_AI));
    const { status, body } = await importUrl();
    expect(status).toBe(200);
    expect(body.recipe.name).toBe("Crema de calabaza");
  });

  it("sin ANTHROPIC_API_KEY y sin JSON-LD responde 500 con un mensaje de configuración", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    pageIs(HTML_TEXT_ONLY);
    const { status, body } = await importUrl();
    expect(status).toBe(500);
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("R6: errores", () => {
  const expectError = (res: { status: number; body: { error: string; message: string } }, code: keyof typeof ERROR_TEXTS) => {
    expect(res.body.error).toBe(code);
    expect(res.body.message).toBe(ERROR_TEXTS[code]);
    expect(res.status).toBe(ERROR_STATUS[code]);
  };

  it("página sin receta: Claude no encuentra ninguna → no_recipe", async () => {
    pageIs(HTML_NO_RECIPE);
    claudeReturns("NO_RECIPE");
    expectError(await importUrl(), "no_recipe");
  });

  it("Claude devuelve una receta sin ingredientes → no_recipe", async () => {
    pageIs(HTML_TEXT_ONLY);
    claudeReturns({ ...CALABAZA_AI, ingredients: [] });
    expectError(await importUrl(), "no_recipe");
  });

  it("fallo de la IA (error de API) → no_recipe y NO se reintenta", async () => {
    pageIs(HTML_TEXT_ONLY);
    create.mockRejectedValue(new Error("boom"));
    expectError(await importUrl(), "no_recipe");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("la IA que devuelve algo inválido tampoco se reintenta", async () => {
    pageIs(HTML_TEXT_ONLY);
    claudeReturns("no sé qué es esto");
    expectError(await importUrl(), "no_recipe");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("safeFetch falla → fetch_failed", async () => {
    safeFetch.mockRejectedValue(new SafeFetchError("fetch_failed"));
    expectError(await importUrl(), "fetch_failed");
    expect(create).not.toHaveBeenCalled();
  });

  it("safeFetch bloquea un destino → blocked", async () => {
    safeFetch.mockRejectedValue(new SafeFetchError("blocked"));
    expectError(await importUrl(), "blocked");
  });

  it("un error inesperado al descargar también es fetch_failed", async () => {
    safeFetch.mockRejectedValue(new Error("algo raro"));
    expectError(await importUrl(), "fetch_failed");
  });
});

describe("R7: validación de la URL antes de descargar", () => {
  it.each(["", "no es una url", "ftp://recetas-ejemplo.es/x", 42, null, undefined])("%j → invalid_url sin descargar", async (url) => {
    const res = await importUrl(url);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_url");
    expect(res.body.message).toBe(ERROR_TEXTS.invalid_url);
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it.each(["http://localhost/x", "http://127.0.0.1/x", "http://192.168.1.10/x", "http://169.254.169.254/latest/meta-data", "http://[::1]/x"])(
    "%s → blocked sin descargar",
    async (url) => {
      const res = await importUrl(url);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("blocked");
      expect(res.body.message).toBe(ERROR_TEXTS.blocked);
      expect(safeFetch).not.toHaveBeenCalled();
    },
  );

  it("un cuerpo que no es JSON → invalid_url", async () => {
    const res = await POST(new Request("http://localhost/api/recipes/import", { method: "POST", body: "no-json" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_url");
  });

  it("una URL sin protocolo se completa con https://", async () => {
    pageIs(HTML_JSONLD);
    const res = await importUrl("www.recetas-ejemplo.es/lentejas");
    expect(res.status).toBe(200);
    expect(String(safeFetch.mock.calls[0][0])).toBe("https://www.recetas-ejemplo.es/lentejas");
  });
});

describe("R7: límite de peticiones por IP", () => {
  const ip = (n: string) => ({ "x-forwarded-for": n });

  it("la importación número 11 desde la misma IP en 10 minutos es rate_limited", async () => {
    pageIs(HTML_JSONLD);
    for (let i = 0; i < 10; i++) expect((await importUrl(RECIPE_URL, ip("5.5.5.5"))).status, `importación ${i + 1}`).toBe(200);
    safeFetch.mockClear();
    const res = await importUrl(RECIPE_URL, ip("5.5.5.5"));
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("rate_limited");
    expect(res.body.message).toBe(ERROR_TEXTS.rate_limited);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("otra IP no queda limitada", async () => {
    pageIs(HTML_JSONLD);
    for (let i = 0; i < 11; i++) await importUrl(RECIPE_URL, ip("5.5.5.5"));
    expect((await importUrl(RECIPE_URL, ip("6.6.6.6"))).status).toBe(200);
  });

  it("usa la primera IP de x-forwarded-for", async () => {
    pageIs(HTML_JSONLD);
    for (let i = 0; i < 10; i++) await importUrl(RECIPE_URL, ip("7.7.7.7, 10.0.0.1"));
    expect((await importUrl(RECIPE_URL, ip("7.7.7.7, 10.0.0.2"))).status).toBe(429);
  });

  it("las peticiones con URL inválida también cuentan (no se puede sondear gratis)", async () => {
    for (let i = 0; i < 10; i++) await importUrl("no es una url", ip("8.8.4.4"));
    pageIs(HTML_JSONLD);
    expect((await importUrl(RECIPE_URL, ip("8.8.4.4"))).status).toBe(429);
  });

  it("sin x-forwarded-for todas comparten la clave 'unknown'", async () => {
    pageIs(HTML_JSONLD);
    for (let i = 0; i < 10; i++) await importUrl();
    expect((await importUrl()).status).toBe(429);
  });
});

describe("R7: CORS (misma política que /api/recipes)", () => {
  it("responde con Access-Control-Allow-Origin al origen permitido, en éxito y en error", async () => {
    pageIs(HTML_JSONLD);
    expect((await importUrl()).headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
    expect((await importUrl("no es una url")).headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
  });

  it("no añade la cabecera con otro origen", async () => {
    pageIs(HTML_JSONLD);
    const res = await importUrl(RECIPE_URL, { origin: "https://otro-origen.example" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("el preflight OPTIONS responde 204 con los métodos permitidos", async () => {
    const res = await OPTIONS(new Request("http://localhost/api/recipes/import", { method: "OPTIONS", headers: { origin: ALLOWED } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
