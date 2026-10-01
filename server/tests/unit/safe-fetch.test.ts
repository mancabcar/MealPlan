// Spec: docs/pm/19-importar-receta-url/spec.md › R6 (fallos de descarga) y R7 (destinos internos, tamaño, tiempo, redirecciones).
// Tech: docs/pm/19-importar-receta-url/tech.md › Components & files (`server/lib/safeFetch.ts`). Contrato:
//   safeFetch(url: string, deps?: Partial<SafeFetchDeps>): Promise<{ html: string; finalUrl: string }>
//   - Rechaza con `SafeFetchError` (propiedad `code`: "blocked" | "fetch_failed"), nunca con otra cosa.
//   - Pasos: validateImportUrl → resolve(hostname) → si CUALQUIER IP es privada, "blocked" sin conectar → get() a la IP ya
//     validada (`{ url, address }`), no al nombre → redirecciones a mano (máx. 3), revalidando cada salto.
//   - `deps` sustituye el DNS y la conexión real (`node:dns`, `node:https`) para no tocar la red en los tests:
//       resolve(hostname): Promise<string[]>
//       get({ url: URL, address: string }, signal: AbortSignal): Promise<{ status: number; location?: string; body: AsyncIterable<Uint8Array> }>
//   - Constantes exportadas: MAX_BYTES (2 MB), TIMEOUT_MS (8000), MAX_REDIRECTS (3).
// Fallan hasta que exista el módulo (tarea 2 del tech design).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BYTES, MAX_REDIRECTS, SafeFetchError, TIMEOUT_MS, safeFetch } from "../../lib/safeFetch";
import { HTML_JSONLD, RECIPE_URL } from "../../../tests/fixtures/importar-receta";

const PUBLIC_IP = "93.184.216.34";

const bytes = (text: string) => new TextEncoder().encode(text);
async function* chunks(...parts: Uint8Array[]) {
  for (const part of parts) yield part;
}
const ok = (html: string) => ({ status: 200, body: chunks(bytes(html)) });
const redirect = (location: string, status = 302) => ({ status, location, body: chunks() });

function deps(get: ReturnType<typeof vi.fn>, addresses: string[] | Record<string, string[]> = [PUBLIC_IP]) {
  return {
    resolve: vi.fn(async (host: string) => (Array.isArray(addresses) ? addresses : (addresses[host] ?? [PUBLIC_IP]))),
    get,
  };
}

async function failureOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error("safeFetch debía fallar");
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("R2/R6: descarga correcta", () => {
  it("devuelve el HTML y la URL final", async () => {
    const get = vi.fn().mockResolvedValue(ok(HTML_JSONLD));
    const result = await safeFetch(RECIPE_URL, deps(get));
    expect(result.html).toBe(HTML_JSONLD);
    expect(result.finalUrl).toBe(RECIPE_URL);
  });

  it("R7: conecta a la IP ya validada, no al nombre de host", async () => {
    const get = vi.fn().mockResolvedValue(ok("<html></html>"));
    await safeFetch(RECIPE_URL, deps(get));
    const [target] = get.mock.calls[0];
    expect(target.address).toBe(PUBLIC_IP);
    expect(target.url.hostname).toBe("www.recetas-ejemplo.es");
  });

  it("junta el cuerpo recibido en varios trozos (y respeta los acentos entre trozos)", async () => {
    const all = bytes("<p>Sofreír la cebolla</p>");
    const cut = 9; // parte la "í" por la mitad
    const get = vi.fn().mockResolvedValue({ status: 200, body: chunks(all.slice(0, cut), all.slice(cut)) });
    expect((await safeFetch(RECIPE_URL, deps(get))).html).toBe("<p>Sofreír la cebolla</p>");
  });
});

describe("R7: destinos internos", () => {
  it("rechaza una URL que ya es interna sin resolver ni conectar", async () => {
    const get = vi.fn();
    const d = deps(get);
    const error = await failureOf(safeFetch("http://192.168.1.10/receta", d));
    expect(error).toBeInstanceOf(SafeFetchError);
    expect((error as SafeFetchError).code).toBe("blocked");
    expect(get).not.toHaveBeenCalled();
  });

  it("rechaza un nombre público que resuelve a una IP privada", async () => {
    const get = vi.fn();
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get, ["10.0.0.7"])));
    expect((error as SafeFetchError).code).toBe("blocked");
    expect(get).not.toHaveBeenCalled();
  });

  it("rechaza si UNA de varias IPs resueltas es privada (DNS con respuestas mezcladas)", async () => {
    const get = vi.fn();
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get, [PUBLIC_IP, "127.0.0.1"])));
    expect((error as SafeFetchError).code).toBe("blocked");
    expect(get).not.toHaveBeenCalled();
  });

  it("rechaza una redirección hacia una dirección interna (revalida cada salto)", async () => {
    const get = vi.fn().mockResolvedValueOnce(redirect("http://169.254.169.254/latest/meta-data"));
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect((error as SafeFetchError).code).toBe("blocked");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("rechaza una redirección a un nombre que resuelve a una IP privada", async () => {
    const get = vi.fn().mockResolvedValueOnce(redirect("https://trampa.example/receta"));
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get, { "trampa.example": ["192.168.0.5"] })));
    expect((error as SafeFetchError).code).toBe("blocked");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("rechaza una redirección a un protocolo que no es http(s)", async () => {
    const get = vi.fn().mockResolvedValueOnce(redirect("ftp://recetas-ejemplo.es/lentejas"));
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect(error).toBeInstanceOf(SafeFetchError);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("R7: redirecciones", () => {
  it("sigue una redirección relativa y devuelve la URL final", async () => {
    const get = vi.fn().mockResolvedValueOnce(redirect("/lentejas-nueva")).mockResolvedValueOnce(ok(HTML_JSONLD));
    const result = await safeFetch(RECIPE_URL, deps(get));
    expect(result.finalUrl).toBe("https://www.recetas-ejemplo.es/lentejas-nueva");
    expect(result.html).toBe(HTML_JSONLD);
  });

  it.each([301, 302, 303, 307, 308])("sigue una redirección %i", async (status) => {
    const get = vi.fn().mockResolvedValueOnce(redirect("https://otra.example/receta", status)).mockResolvedValueOnce(ok("<html></html>"));
    await expect(safeFetch(RECIPE_URL, deps(get))).resolves.toMatchObject({ finalUrl: "https://otra.example/receta" });
  });

  it(`admite hasta ${MAX_REDIRECTS} redirecciones`, async () => {
    const get = vi.fn();
    for (let i = 0; i < MAX_REDIRECTS; i++) get.mockResolvedValueOnce(redirect(`/salto-${i + 1}`));
    get.mockResolvedValueOnce(ok("<html></html>"));
    await expect(safeFetch(RECIPE_URL, deps(get))).resolves.toBeDefined();
  });

  it("falla con fetch_failed a la cuarta redirección", async () => {
    const get = vi.fn();
    for (let i = 0; i <= MAX_REDIRECTS; i++) get.mockResolvedValueOnce(redirect(`/salto-${i + 1}`));
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect((error as SafeFetchError).code).toBe("fetch_failed");
  });

  it("una redirección sin cabecera Location es fetch_failed", async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 302, body: chunks() });
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect((error as SafeFetchError).code).toBe("fetch_failed");
  });
});

describe("R6: fallos de descarga", () => {
  it.each([403, 404, 429, 500, 503])("un HTTP %i es fetch_failed", async (status) => {
    const get = vi.fn().mockResolvedValue({ status, body: chunks() });
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect(error).toBeInstanceOf(SafeFetchError);
    expect((error as SafeFetchError).code).toBe("fetch_failed");
  });

  it("un error de red o de DNS es fetch_failed", async () => {
    const get = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    expect(((await failureOf(safeFetch(RECIPE_URL, deps(get)))) as SafeFetchError).code).toBe("fetch_failed");

    const noDns = { resolve: vi.fn().mockRejectedValue(new Error("ENOTFOUND")), get: vi.fn() };
    expect(((await failureOf(safeFetch(RECIPE_URL, noDns))) as SafeFetchError).code).toBe("fetch_failed");
    expect(noDns.get).not.toHaveBeenCalled();
  });

  it("un nombre sin ninguna IP es fetch_failed", async () => {
    const get = vi.fn();
    expect(((await failureOf(safeFetch(RECIPE_URL, deps(get, [])))) as SafeFetchError).code).toBe("fetch_failed");
    expect(get).not.toHaveBeenCalled();
  });
});

describe("R7: tamaño máximo", () => {
  it("corta y falla si la respuesta pasa de 2 MB", async () => {
    const big = new Uint8Array(MAX_BYTES / 2);
    const get = vi.fn().mockResolvedValue({ status: 200, body: chunks(big, big, new Uint8Array(1)) });
    const error = await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect((error as SafeFetchError).code).toBe("fetch_failed");
  });

  it("acepta una respuesta de exactamente 2 MB", async () => {
    const exact = new Uint8Array(MAX_BYTES).fill(97);
    const get = vi.fn().mockResolvedValue({ status: 200, body: chunks(exact) });
    await expect(safeFetch(RECIPE_URL, deps(get))).resolves.toBeDefined();
  });

  it("no sigue leyendo el cuerpo después de pasarse del límite", async () => {
    let pulled = 0;
    async function* endless() {
      while (true) {
        pulled++;
        yield new Uint8Array(MAX_BYTES);
      }
    }
    const get = vi.fn().mockResolvedValue({ status: 200, body: endless() });
    await failureOf(safeFetch(RECIPE_URL, deps(get)));
    expect(pulled).toBeLessThanOrEqual(2);
  });
});

describe("R7: tiempo máximo", () => {
  it("aborta a los 8 s y falla con fetch_failed", async () => {
    expect(TIMEOUT_MS).toBe(8000);
    const get = vi.fn(
      (_target: unknown, signal: AbortSignal) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("abortado")))),
    );
    const pending = failureOf(safeFetch(RECIPE_URL, deps(get)));
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 10);
    expect(((await pending) as SafeFetchError).code).toBe("fetch_failed");
  });

  it("el límite de 8 s cuenta para toda la descarga, redirecciones incluidas", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(redirect("/salto"))
      .mockImplementationOnce(
        (_target: unknown, signal: AbortSignal) =>
          new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("abortado")))),
      );
    const pending = failureOf(safeFetch(RECIPE_URL, deps(get)));
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 10);
    expect(((await pending) as SafeFetchError).code).toBe("fetch_failed");
  });
});

describe("Codificación del documento", () => {
  // «Sofreír la cebolla» en ISO-8859-1: la «í» es el byte 0xED
  const latin1 = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

  it("usa el charset de la cabecera Content-Type", async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, contentType: "text/html; charset=ISO-8859-1", body: chunks(latin1("<p>Sofreír la cebolla</p>")) });
    expect((await safeFetch(RECIPE_URL, deps(get))).html).toBe("<p>Sofreír la cebolla</p>");
  });

  it("sin charset en la cabecera, lo toma del <meta charset>", async () => {
    const html = '<html><head><meta charset="windows-1252"></head><body>Sofreír la cebolla</body></html>';
    const get = vi.fn().mockResolvedValue({ status: 200, contentType: "text/html", body: chunks(latin1(html)) });
    expect((await safeFetch(RECIPE_URL, deps(get))).html).toContain("Sofreír la cebolla");
  });

  it("un charset desconocido cae a UTF-8", async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, contentType: "text/html; charset=inventado", body: chunks(bytes("<p>Sofreír</p>")) });
    expect((await safeFetch(RECIPE_URL, deps(get))).html).toBe("<p>Sofreír</p>");
  });
});
