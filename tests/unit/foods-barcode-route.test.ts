// Spec: docs/pm/14-escaner-codigo-barras/spec.md › R3, R4, R5. Tech: tech.md › APIs / interfaces
// (`GET /api/foods/barcode`), Testing strategy.
// `fetch` se simula: ningún test llama a Open Food Facts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BARRITA_AVENA_CODE,
  BARRITA_AVENA_V2,
  CODIGO_INEXISTENTE,
  MULTIMARCA_CODE,
  MULTIMARCA_V2,
  SIN_GRASA_CODE,
  SIN_GRASA_V2,
  v2NotFound,
} from "../fixtures/foods";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const { GET } = await import("@/app/api/foods/barcode/route");

function offReturns(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(Response.json(body, { status }));
}

async function lookup(code: string | null) {
  const url = new URL("http://localhost/api/foods/barcode");
  if (code !== null) url.searchParams.set("code", code);
  const res = await GET(new Request(url));
  return { status: res.status, body: await res.json() };
}

/** URL y cabeceras de la llamada a OFF. */
function offCall() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit | undefined];
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  return { url, headers };
}

describe("R3: petición al endpoint de producto de OFF", () => {
  it("llama a world.openfoodfacts.org/api/v2/product/<code>.json con el código", async () => {
    offReturns(BARRITA_AVENA_V2);
    await lookup(BARRITA_AVENA_CODE);
    const { url } = offCall();
    expect(url.origin + url.pathname).toBe(`https://world.openfoodfacts.org/api/v2/product/${BARRITA_AVENA_CODE}.json`);
  });

  it("se identifica con el mismo User-Agent que la búsqueda por nombre", async () => {
    offReturns(BARRITA_AVENA_V2);
    await lookup(BARRITA_AVENA_CODE);
    expect(offCall().headers.get("user-agent")).toBe("MealPlan/0.1 (+https://github.com/mancabcar/MealPlan)");
  });

  it("un código con caracteres que no son dígitos responde 400 sin llamar a OFF", async () => {
    for (const code of ["abc", "123-456", "84 10000123456", ""]) {
      const { status, body } = await lookup(code);
      expect(status, code).toBe(400);
      expect(body).toEqual({ error: "bad_code" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin parámetro code responde 400 sin llamar a OFF", async () => {
    const { status, body } = await lookup(null);
    expect(status).toBe(400);
    expect(body).toEqual({ error: "bad_code" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("R4: normalización del producto encontrado", () => {
  it("devuelve código, nombre en español, primera marca, macros por 100 g y ración en g", async () => {
    offReturns(BARRITA_AVENA_V2);
    const { status, body } = await lookup(BARRITA_AVENA_CODE);
    expect(status).toBe(200);
    expect(body.product).toEqual({
      code: BARRITA_AVENA_CODE,
      name: "Barrita de avena y miel",
      brand: "Campo Dorado",
      kcal: 410,
      protein: 8.5,
      carbs: 62,
      fat: 13,
      servingGrams: 30,
    });
  });

  it("con varias marcas separadas por coma, usa solo la primera (a diferencia de Search-a-licious, aquí brands es texto)", async () => {
    offReturns(MULTIMARCA_V2);
    const { body } = await lookup(MULTIMARCA_CODE);
    expect(body.product.brand).toBe("Dulcesol");
  });
});

describe("R5: código no encontrado o sin macros completos", () => {
  it("OFF devuelve status 0 (no existe) → 404 not_found", async () => {
    offReturns(v2NotFound(CODIGO_INEXISTENTE));
    const { status, body } = await lookup(CODIGO_INEXISTENTE);
    expect(status).toBe(404);
    expect(body).toEqual({ error: "not_found" });
  });

  it("el producto existe pero le falta un macro (grasa) → 404 not_found, igual que si no existiera", async () => {
    offReturns(SIN_GRASA_V2);
    const { status, body } = await lookup(SIN_GRASA_CODE);
    expect(status).toBe(404);
    expect(body).toEqual({ error: "not_found" });
  });
});

describe("R5: error de red o límite de peticiones", () => {
  it("429 de OFF → 429 rate_limited con los segundos de Retry-After", async () => {
    fetchMock.mockResolvedValue(new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "20" } }));
    const { status, body } = await lookup(BARRITA_AVENA_CODE);
    expect(status).toBe(429);
    expect(body).toEqual({ error: "rate_limited", retryAfter: 20 });
  });

  it("429 sin Retry-After → retryAfter 60", async () => {
    fetchMock.mockResolvedValue(new Response("Too Many Requests", { status: 429 }));
    const { body } = await lookup(BARRITA_AVENA_CODE);
    expect(body).toEqual({ error: "rate_limited", retryAfter: 60 });
  });

  it("sin conexión (fetch lanza) → 502 unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { status, body } = await lookup(BARRITA_AVENA_CODE);
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });

  it("OFF responde 500 → 502 unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    const { status, body } = await lookup(BARRITA_AVENA_CODE);
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });

  it("una respuesta con forma inesperada → 502 unavailable", async () => {
    for (const payload of [{ foo: 1 }, null, "no-json-object"]) {
      fetchMock.mockResolvedValueOnce(Response.json(payload));
      const { status, body } = await lookup(BARRITA_AVENA_CODE);
      expect(status, JSON.stringify(payload)).toBe(502);
      expect(body).toEqual({ error: "unavailable" });
    }
  });

  it("un JSON ilegible → 502 unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("<html>not json</html>", { status: 200 }));
    const { status, body } = await lookup(BARRITA_AVENA_CODE);
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });

  it("timeout (8 s sin respuesta) → 502 unavailable", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const promise = lookup(BARRITA_AVENA_CODE);
    await vi.advanceTimersByTimeAsync(8_000);
    const { status, body } = await promise;
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });
});
