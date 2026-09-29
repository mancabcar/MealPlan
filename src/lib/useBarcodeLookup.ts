"use client";

// Búsqueda de producto por código de barras (docs/pm/14-escaner-codigo-barras/tech.md › APIs, R4, R5): llama a
// GET /api/foods/barcode al detectar o escribir un código, con su propio límite de peticiones por minuto en
// sessionStorage (independiente del de useBrandSearch: OFF trata /api/v2/product y Search-a-licious como APIs
// distintas). Mismo patrón que useBrandSearch.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandProduct } from "./foods";

export type BarcodeLookupState = "idle" | "loading" | "ok" | "not_found" | "offline" | "error" | "rate_limited";

const STAMPS_KEY = "mp_barcode_searches";
const BLOCKED_KEY = "mp_barcode_blocked_until";
/** Misma forma que OFF_LIMIT (foods.ts): 10 peticiones por minuto, contadas por el cliente. */
const BARCODE_LIMIT = { max: 10, windowMs: 60_000 } as const;

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

function cooldownFor(timestamps: number[], now: number): number {
  const recent = timestamps.filter((t) => now - t < BARCODE_LIMIT.windowMs).sort((a, b) => a - b);
  if (recent.length < BARCODE_LIMIT.max) return 0;
  const blocking = recent[recent.length - BARCODE_LIMIT.max];
  return Math.ceil((blocking + BARCODE_LIMIT.windowMs - now) / 1000);
}

export function useBarcodeLookup() {
  const [state, setState] = useState<BarcodeLookupState>("idle");
  const [product, setProduct] = useState<BrandProduct | null>(null);
  /** El código de la última búsqueda (para Reintentar). */
  const [code, setCode] = useState("");
  const [stamps, setStamps] = useState(readStamps);
  const [blockedUntil, setBlockedUntil] = useState(readBlockedUntil);
  const [now, setNow] = useState(() => Date.now());
  const requestId = useRef(0);

  const cooldownAt = useCallback(
    (at: number) => Math.max(cooldownFor(stamps, at), Math.ceil((blockedUntil - at) / 1000), 0),
    [stamps, blockedUntil],
  );
  const cooldown = cooldownAt(now);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const run = useCallback(
    async (c: string) => {
      const at = Date.now();
      if (cooldownAt(at) > 0) {
        // Bloqueado por el límite (p. ej. un código escaneado con la cámara mientras ya estaba activo): se
        // deja en "rate_limited" para que el aviso se muestre igual que si lo hubiera bloqueado el servidor
        // (review de #14: antes se devolvía null y no pasaba nada, sin avisar).
        setCode(c);
        setState("rate_limited");
        setProduct(null);
        return { state: "rate_limited" as const, product: null, code: c };
      }
      const nextStamps = [...stamps.filter((t) => at - t < BARCODE_LIMIT.windowMs), at];
      setStamps(nextStamps);
      write(STAMPS_KEY, nextStamps);
      setNow(at);
      const id = ++requestId.current;
      setCode(c);
      setState("loading");
      setProduct(null);
      let next: { state: BarcodeLookupState; product?: BrandProduct; retryAfter?: number };
      try {
        const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(c)}`);
        const body = (await res.json().catch(() => null)) as { product?: BrandProduct; retryAfter?: number } | null;
        if (res.status === 429) next = { state: "rate_limited", retryAfter: body?.retryAfter ?? 60 };
        else if (res.status === 404) next = { state: "not_found" };
        else if (res.ok && body?.product) next = { state: "ok", product: body.product };
        else next = { state: "error" };
      } catch {
        // fetch solo lanza sin red (o si el navegador corta la petición)
        next = { state: "offline" };
      }
      if (id !== requestId.current) return null;
      setState(next.state);
      setProduct(next.product ?? null);
      if (next.retryAfter !== undefined) {
        const until = Date.now() + next.retryAfter * 1000;
        setBlockedUntil(until);
        write(BLOCKED_KEY, until);
        setNow(Date.now());
      }
      // Se devuelve el resultado (y no solo se deja en el estado) para que quien llama pueda reaccionar en el
      // mismo manejador de evento (p. ej. abrir la tarjeta o caer a Personalizada), sin un efecto que observe
      // el estado y dispare otro setState.
      return { state: next.state, product: next.product ?? null, code: c };
    },
    [cooldownAt, stamps],
  );

  const lookup = useCallback((c: string) => run(c), [run]);
  const retry = useCallback(() => run(code), [run, code]);
  const reset = useCallback(() => {
    requestId.current++;
    setState("idle");
    setProduct(null);
  }, []);

  return { state, product, code, lookup, retry, reset, cooldown };
}
