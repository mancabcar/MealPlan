// Spec: docs/pm/13-base-alimentos/spec.md › R4 (productos de marca), R11 (errores de OFF) y Edge cases (sin marca,
// serving_size que no está en g). Tech: tech.md › APIs / interfaces (`GET /api/foods/search`).
// `fetch` se simula: ningún test llama a Open Food Facts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  YOGUR_GRIEGO_HIT,
  YOGUR_LIGERO_HIT,
  YOGUR_SIN_MARCA_HIT,
  YOGUR_SIN_PROTEINA_HIT,
  manyHits,
  salHit,
  type SalHit,
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

const { GET } = await import("@/app/api/foods/search/route");

function offReturns(hits: SalHit[]) {
  fetchMock.mockResolvedValue(Response.json({ hits, count: hits.length, page: 1, page_size: 20 }));
}

async function search(q: string | null) {
  const url = new URL("http://localhost/api/foods/search");
  if (q !== null) url.searchParams.set("q", q);
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

describe("R4: petición a Search-a-licious", () => {
  it("llama a search.openfoodfacts.org con el texto, filtrando por productos vendidos en España", async () => {
    offReturns([]);
    await search("yogur griego");
    const { url } = offCall();
    expect(url.origin + url.pathname).toBe("https://search.openfoodfacts.org/search");
    const q = url.searchParams.get("q") ?? "";
    expect(q).toContain("yogur griego");
    expect(q).toContain('countries_tags:"en:spain"');
  });

  it("se identifica con el User-Agent de la app (URL del repo, sin email)", async () => {
    offReturns([]);
    await search("yogur griego");
    expect(offCall().headers.get("user-agent")).toBe("MealPlan/0.1 (+https://github.com/mancabcar/MealPlan)");
  });

  it("quita la sintaxis de la consulta del texto: unas comillas no se comen el filtro de España (review)", async () => {
    offReturns([]);
    await search('Yogur "griego: (natural) OR -light\\');
    expect(offCall().url.searchParams.get("q")).toBe('yogur griego natural or light countries_tags:"en:spain"');
  });

  it("un texto que solo tiene sintaxis cuenta como corto: 400 sin llamar a OFF", async () => {
    const { status } = await search('"":()');
    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con menos de 2 caracteres responde 400 sin llamar a OFF", async () => {
    for (const q of [null, "", "a", "  a  "]) {
      const { status, body } = await search(q);
      expect(status, String(q)).toBe(400);
      expect(body).toEqual({ error: "bad_query" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("R4: normalización de los productos", () => {
  it("devuelve código, nombre en español, primera marca, macros por 100 g y ración en g", async () => {
    offReturns([YOGUR_GRIEGO_HIT]);
    const { status, body } = await search("yogur griego");
    expect(status).toBe(200);
    expect(body.products).toEqual([
      {
        code: "8400000000011",
        name: "Yogur griego natural",
        brand: "Lácteos Sierra Alta",
        kcal: 122,
        protein: 3.6,
        carbs: 4.1,
        fat: 10.2,
        servingGrams: 125,
      },
    ]);
  });

  it("sin nombre en español usa product_name", async () => {
    offReturns([YOGUR_LIGERO_HIT]);
    const { body } = await search("yogur griego");
    expect(body.products[0].name).toBe("Yogur griego ligero");
  });

  it("oculta los productos a los que les falta kcal, P, C o G por 100 g", async () => {
    const sinKcal = salHit("1", "Sin kcal", "M", { protein: 1, carbs: 1, fat: 1 });
    const sinCarbs = salHit("2", "Sin carbs", "M", { kcal: 10, protein: 1, fat: 1 });
    const sinGrasa = salHit("3", "Sin grasa", "M", { kcal: 10, protein: 1, carbs: 1 });
    const sinNutriments: SalHit = { code: "4", product_name: "Sin nada", brands: ["M"] };
    offReturns([sinKcal, YOGUR_SIN_PROTEINA_HIT, sinCarbs, sinGrasa, sinNutriments, YOGUR_LIGERO_HIT]);
    const { body } = await search("yogur griego");
    expect(body.products.map((p: { code: string }) => p.code)).toEqual([YOGUR_LIGERO_HIT.code]);
  });

  it("oculta los productos sin nombre", async () => {
    offReturns([{ ...YOGUR_LIGERO_HIT, product_name: undefined, product_name_es: undefined }]);
    const { body } = await search("yogur griego");
    expect(body.products).toEqual([]);
  });

  it("devuelve como mucho 5 productos, en el orden de OFF", async () => {
    offReturns(manyHits(12));
    const { body } = await search("yogur griego");
    expect(body.products.map((p: { name: string }) => p.name)).toEqual([
      "Yogur griego 1",
      "Yogur griego 2",
      "Yogur griego 3",
      "Yogur griego 4",
      "Yogur griego 5",
    ]);
  });

  it("los 5 son válidos aunque OFF traiga inválidos por delante", async () => {
    offReturns([YOGUR_SIN_PROTEINA_HIT, ...manyHits(6)]);
    const { body } = await search("yogur griego");
    expect(body.products).toHaveLength(5);
    expect(body.products[0].name).toBe("Yogur griego 1");
  });

  it("un producto sin marca no lleva brand (Edge cases)", async () => {
    offReturns([YOGUR_SIN_MARCA_HIT]);
    const { body } = await search("yogur griego");
    expect(body.products[0].brand).toBeUndefined();
  });

  it("una ración que no está en gramos (ml) no da servingGrams (Edge cases)", async () => {
    offReturns([YOGUR_SIN_MARCA_HIT]);
    const { body } = await search("yogur griego");
    expect(body.products[0].servingGrams).toBeUndefined();
  });

  it("sin resultados responde 200 con una lista vacía", async () => {
    offReturns([]);
    const { status, body } = await search("zzzz");
    expect(status).toBe(200);
    expect(body).toEqual({ products: [] });
  });
});

describe("R11: errores de OFF", () => {
  it("429 de OFF → 429 rate_limited con los segundos de Retry-After", async () => {
    fetchMock.mockResolvedValue(new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "42" } }));
    const { status, body } = await search("yogur griego");
    expect(status).toBe(429);
    expect(body).toEqual({ error: "rate_limited", retryAfter: 42 });
  });

  it("429 sin Retry-After → retryAfter 60", async () => {
    fetchMock.mockResolvedValue(new Response("Too Many Requests", { status: 429 }));
    const { body } = await search("yogur griego");
    expect(body).toEqual({ error: "rate_limited", retryAfter: 60 });
  });

  it("OFF sin conexión (fetch lanza) → 502 unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { status, body } = await search("yogur griego");
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });

  it("OFF responde 500 → 502 unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    const { status, body } = await search("yogur griego");
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });

  it("una respuesta con forma inesperada → 502 unavailable", async () => {
    for (const payload of [{ foo: 1 }, { hits: "no" }, null]) {
      fetchMock.mockResolvedValueOnce(Response.json(payload));
      const { status, body } = await search("yogur griego");
      expect(status, JSON.stringify(payload)).toBe(502);
      expect(body).toEqual({ error: "unavailable" });
    }
  });

  it("un JSON ilegible → 502 unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }));
    const { status } = await search("yogur griego");
    expect(status).toBe(502);
  });

  it("si OFF tarda más de 8 s → 502 unavailable", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = search("yogur griego");
    await vi.advanceTimersByTimeAsync(8_000);
    const { status, body } = await pending;
    expect(status).toBe(502);
    expect(body).toEqual({ error: "unavailable" });
  });
});
