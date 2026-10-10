// Descarga de una página web sin SSRF (R7, docs/pm/19-importar-receta-url/tech.md › Components & files):
// resuelve el DNS, rechaza si CUALQUIER IP es privada, conecta a la IP ya validada (no al nombre, contra DNS
// rebinding), sigue las redirecciones a mano revalidando cada salto y corta por tamaño y por tiempo.
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { isPrivateAddress, validateImportUrl } from "../../src/lib/recipeImport";

export const MAX_BYTES = 2 * 1024 * 1024;
export const TIMEOUT_MS = 8000;
export const MAX_REDIRECTS = 3;

export class SafeFetchError extends Error {
  constructor(
    public readonly code: "blocked" | "fetch_failed",
    message: string = code,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeFetchDeps {
  resolve(hostname: string): Promise<string[]>;
  get(
    target: { url: URL; address: string },
    signal: AbortSignal,
  ): Promise<{ status: number; location?: string; contentType?: string; body: AsyncIterable<Uint8Array> }>;
}

const defaultDeps: SafeFetchDeps = {
  async resolve(hostname) {
    const records = await dns.lookup(hostname, { all: true });
    return records.map((r) => r.address);
  },
  get({ url, address }, signal) {
    return new Promise((resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      const req = client.request(
        url,
        {
          method: "GET",
          signal,
          headers: { "user-agent": "Mozilla/5.0 (compatible; MealPlanImporter/1.0)", accept: "text/html,application/xhtml+xml" },
          // Conecta a la IP ya validada en vez de volver a resolver el nombre
          lookup: (_host, options, callback) => {
            const family = isIP(address);
            if ((options as { all?: boolean }).all) {
              (callback as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address, family }]);
            } else {
              (callback as (e: null, a: string, f: number) => void)(null, address, family);
            }
          },
        },
        (res) => {
          const location = res.headers.location;
          resolve({ status: res.statusCode ?? 0, location, contentType: res.headers["content-type"], body: res });
        },
      );
      req.on("error", reject);
      req.end();
    });
  },
};

function abortError(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(new Error("timeout"));
    signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
  });
}

/** Codificación del documento: `charset` de la cabecera Content-Type o, si no, del <meta> de los primeros bytes. */
function detectCharset(contentType: string | undefined, bytes: Uint8Array): string {
  const fromHeader = contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i)?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const label = fromHeader ?? head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1] ?? "utf-8";
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return "utf-8";
  }
}

async function readBody(body: AsyncIterable<Uint8Array>, signal: AbortSignal, contentType?: string): Promise<string> {
  const parts: Uint8Array[] = [];
  let total = 0;
  const iterator = body[Symbol.asyncIterator]();
  try {
    for (;;) {
      const next = await Promise.race([iterator.next(), abortError(signal)]);
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_BYTES) throw new SafeFetchError("fetch_failed", "La página es demasiado grande.");
      parts.push(next.value);
    }
  } finally {
    void iterator.return?.();
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder(detectCharset(contentType, all)).decode(all);
}

async function download(rawUrl: string, deps: SafeFetchDeps, signal: AbortSignal): Promise<{ html: string; finalUrl: string }> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = validateImportUrl(current);
    if (!checked.ok) {
      throw new SafeFetchError(checked.error === "blocked" ? "blocked" : "fetch_failed", "Dirección no permitida.");
    }
    const { url } = checked;

    const addresses = await Promise.race([deps.resolve(url.hostname.replace(/^\[|\]$/g, "")), abortError(signal)]);
    if (addresses.length === 0) throw new SafeFetchError("fetch_failed", "No se pudo resolver el dominio.");
    if (addresses.some(isPrivateAddress)) throw new SafeFetchError("blocked", "Dirección no permitida.");

    const response = await Promise.race([deps.get({ url, address: addresses[0] }, signal), abortError(signal)]);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      void (response.body[Symbol.asyncIterator]() as AsyncIterator<Uint8Array>).return?.();
      if (!response.location || hop === MAX_REDIRECTS) throw new SafeFetchError("fetch_failed", "Demasiadas redirecciones.");
      try {
        current = new URL(response.location, url).href;
      } catch {
        throw new SafeFetchError("fetch_failed", "Redirección no válida.");
      }
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new SafeFetchError("fetch_failed", `La web respondió HTTP ${response.status}.`);
    }
    // Solo páginas web (#140): un PDF, una imagen o un vídeo no se descarga ni se manda a la IA. Sin cabecera, se intenta
    if (response.contentType && !/^\s*(?:text\/|application\/xhtml\+xml\b)/i.test(response.contentType)) {
      void (response.body[Symbol.asyncIterator]() as AsyncIterator<Uint8Array>).return?.();
      throw new SafeFetchError("fetch_failed", "El enlace no es una página web.");
    }
    return { html: await readBody(response.body, signal, response.contentType), finalUrl: url.href };
  }
  throw new SafeFetchError("fetch_failed", "Demasiadas redirecciones.");
}

export async function safeFetch(url: string, deps: Partial<SafeFetchDeps> = {}): Promise<{ html: string; finalUrl: string }> {
  const merged = { ...defaultDeps, ...deps };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await download(url, merged, controller.signal);
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    throw new SafeFetchError("fetch_failed", "No se pudo descargar la página.");
  } finally {
    clearTimeout(timer);
  }
}
