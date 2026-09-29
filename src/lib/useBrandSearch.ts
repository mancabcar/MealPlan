"use client";

// Búsqueda de productos de marca (docs/pm/13-base-alimentos/tech.md › APIs, R4, R11, R12): llama a
// GET /api/foods/search solo al pulsar, guarda en sessionStorage las búsquedas del último minuto y el Retry-After
// del último 429 de OFF (para que recargar no salte el límite) y expone la cuenta atrás, calculada con Date.now()
// en cada tick. sessionStorage se lee una vez al montar, no en cada render (review de #13).
import { useCallback, useEffect, useRef, useState } from "react";
import { OFF_LIMIT, offCooldown, type BrandProduct } from "./foods";
import { apiUrl } from "./apiBase";

export type BrandSearchState = "idle" | "loading" | "ok" | "offline" | "error" | "rate_limited";

const STAMPS_KEY = "mp_off_searches";
const BLOCKED_KEY = "mp_off_blocked_until";

function readStamps(): number[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STAMPS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((t): t is number => typeof t === "number") : [];
  } catch {
    return [];
  }
}

function readBlockedUntil(): number {
  try {
    const n = Number(sessionStorage.getItem(BLOCKED_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin sessionStorage (modo privado estricto): el límite solo dura lo que dure la página
  }
}

export function useBrandSearch() {
  const [state, setState] = useState<BrandSearchState>("idle");
  const [products, setProducts] = useState<BrandProduct[]>([]);
  /** El texto de la última búsqueda (para Reintentar). */
  const [query, setQuery] = useState("");
  /** Búsquedas (ms) de la ventana de OFF_LIMIT, como en sessionStorage. */
  const [stamps, setStamps] = useState(readStamps);
  /** Hasta cuándo manda el 429 de OFF (Retry-After). */
  const [blockedUntil, setBlockedUntil] = useState(readBlockedUntil);
  const [now, setNow] = useState(() => Date.now());
  // Solo cuenta la respuesta de la última petición: si el texto cambia a mitad, la anterior se ignora
  const requestId = useRef(0);

  const cooldownAt = useCallback(
    (at: number) => Math.max(offCooldown(stamps, at), Math.ceil((blockedUntil - at) / 1000), 0),
    [stamps, blockedUntil],
  );
  const cooldown = cooldownAt(now);

  // Tick de 1 s mientras haya cuenta atrás. Se recalcula con Date.now(): si el reloj salta, la cuenta lo sigue.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const run = useCallback(
    async (q: string) => {
      const at = Date.now();
      if (cooldownAt(at) > 0) return;
      const nextStamps = [...stamps.filter((t) => at - t < OFF_LIMIT.windowMs), at];
      setStamps(nextStamps);
      write(STAMPS_KEY, nextStamps);
      setNow(at);
      const id = ++requestId.current;
      setQuery(q);
      setState("loading");
      setProducts([]);
      let next: { state: BrandSearchState; products?: BrandProduct[]; retryAfter?: number };
      try {
        const res = await fetch(apiUrl(`/api/foods/search?q=${encodeURIComponent(q)}`));
        const body = (await res.json().catch(() => null)) as { products?: BrandProduct[]; retryAfter?: number } | null;
        if (res.status === 429) next = { state: "rate_limited", retryAfter: body?.retryAfter ?? 60 };
        else if (res.ok && Array.isArray(body?.products)) next = { state: "ok", products: body.products };
        else next = { state: "error" };
      } catch {
        // fetch solo lanza sin red (o si el navegador corta la petición)
        next = { state: "offline" };
      }
      if (id !== requestId.current) return;
      setState(next.state);
      setProducts(next.products ?? []);
      if (next.retryAfter !== undefined) {
        const until = Date.now() + next.retryAfter * 1000;
        setBlockedUntil(until);
        write(BLOCKED_KEY, until);
        setNow(Date.now());
      }
    },
    [cooldownAt, stamps],
  );

  const search = useCallback((q: string) => void run(q), [run]);
  const retry = useCallback(() => void run(query), [run, query]);
  /** El texto cambió: el bloque de marcas de la búsqueda anterior desaparece (Edge cases). */
  const reset = useCallback(() => {
    requestId.current++;
    setState("idle");
    setProducts([]);
  }, []);

  return { state, products, query, search, retry, reset, cooldown };
}
