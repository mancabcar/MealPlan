// Spec: docs/pm/23-agua-fibra-micros/spec.md › R6 y Edge cases (fibra de OFF ausente, negativa o > 100 g/100 g = sin fibra).
// Tech: tech.md › APIs / interfaces: `GET /api/foods/search` y `GET /api/foods/barcode` devuelven `fiber?` (g/100 g).
// `fetch` se simula: ningún test llama a Open Food Facts. Fallan hasta construir la tarea 4.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { salHit, v2Product } from "../../../tests/fixtures/foods";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const { GET: searchGET } = await import("../../app/api/foods/search/route");
const { GET: barcodeGET } = await import("../../app/api/foods/barcode/route");

const MACROS = { kcal: 372, protein: 9, carbs: 62, fat: 9 };
const CODE = "8410000999001";

async function search(fiber: number | undefined) {
  fetchMock.mockResolvedValue(
    Response.json({ hits: [salHit(CODE, "Galleta integral", "Campo Dorado", { ...MACROS, fiber })], count: 1, page: 1, page_size: 20 }),
  );
  const res = await searchGET(new Request("http://localhost/api/foods/search?q=galleta%20integral"));
  const body = await res.json();
  return { status: res.status, product: body.products?.[0] };
}

async function barcode(fiber: number | undefined) {
  fetchMock.mockResolvedValue(Response.json(v2Product(CODE, "Galleta integral", "Campo Dorado", { ...MACROS, fiber })));
  const res = await barcodeGET(new Request(`http://localhost/api/foods/barcode?code=${CODE}`));
  const body = await res.json();
  return { status: res.status, product: body.product };
}

describe.each([
  ["R6: búsqueda por nombre", search],
  ["R6: código de barras", barcode],
] as const)("%s", (_name, lookup) => {
  it("con fiber_100g, devuelve fiber redondeado a 2 decimales", async () => {
    const { status, product } = await lookup(6.5000001907349);
    expect(status).toBe(200);
    expect(product.fiber).toBe(6.5);
  });

  it("fibra 0 es un dato: se devuelve 0", async () => {
    const { product } = await lookup(0);
    expect(product.fiber).toBe(0);
  });

  it("sin fiber_100g, el producto se devuelve igual y sin la propiedad fiber", async () => {
    const { status, product } = await lookup(undefined);
    expect(status).toBe(200);
    expect(product.kcal).toBe(372);
    expect(product).not.toHaveProperty("fiber");
  });

  it("con fibra negativa, devuelve el producto sin fiber", async () => {
    const { status, product } = await lookup(-3);
    expect(status).toBe(200);
    expect(product).not.toHaveProperty("fiber");
  });

  it("con más de 100 g por 100 g, devuelve el producto sin fiber", async () => {
    const { status, product } = await lookup(140);
    expect(status).toBe(200);
    expect(product).not.toHaveProperty("fiber");
  });
});
