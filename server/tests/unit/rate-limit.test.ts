// Spec: docs/pm/19-importar-receta-url/spec.md › R7 (límite de peticiones por IP: 10 cada 10 minutos).
// Tech: docs/pm/19-importar-receta-url/tech.md › Components & files (`server/lib/rateLimit.ts`). Contrato:
//   createRateLimiter({ max, windowMs }): { check(key: string): { allowed: boolean; retryAfterSeconds: number }; reset(): void }
//   importLimiter = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 })  (el que usa la ruta de importar)
//   - Ventana deslizante en memoria por clave; `check` cuenta la petición si se permite. Una petición rechazada no amplía el bloqueo.
//   - Al rechazar, `retryAfterSeconds` ≥ 1: segundos hasta que se libera la petición más antigua de la ventana.
// Fallan hasta que exista el módulo (tarea 2 del tech design).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter, importLimiter } from "../../lib/rateLimit";

const MIN = 60_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("R7: createRateLimiter", () => {
  it("permite hasta el máximo y rechaza la siguiente", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 10 * MIN });
    for (let i = 0; i < 3; i++) expect(limiter.check("1.2.3.4").allowed, `petición ${i + 1}`).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(false);
  });

  it("cuenta cada IP por separado", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 10 * MIN });
    expect(limiter.check("1.1.1.1").allowed).toBe(true);
    expect(limiter.check("1.1.1.1").allowed).toBe(false);
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
  });

  it("vuelve a permitir cuando pasa la ventana", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 10 * MIN });
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    vi.advanceTimersByTime(10 * MIN + 1);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("es una ventana deslizante: libera las peticiones antiguas una a una", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 10 * MIN });
    limiter.check("a"); // t = 0
    vi.advanceTimersByTime(6 * MIN);
    limiter.check("a"); // t = 6
    expect(limiter.check("a").allowed).toBe(false);
    vi.advanceTimersByTime(4 * MIN + 1); // t = 10 min: sale la primera, sigue la segunda
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("informa de los segundos hasta poder reintentar", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 10 * MIN });
    limiter.check("a");
    vi.advanceTimersByTime(2 * MIN);
    const denied = limiter.check("a");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(8 * 60 - 1);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(8 * 60 + 1);
  });

  it("las peticiones rechazadas no prolongan el bloqueo", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 10 * MIN });
    limiter.check("a");
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(MIN);
      limiter.check("a");
    }
    vi.advanceTimersByTime(5 * MIN + 1); // ya pasaron 10 min desde la única aceptada (t = 0)
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("reset() borra todo el estado", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 10 * MIN });
    limiter.check("a");
    limiter.reset();
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("R7: importLimiter (el de la ruta)", () => {
  it("permite 10 importaciones por IP cada 10 minutos", () => {
    importLimiter.reset();
    for (let i = 0; i < 10; i++) expect(importLimiter.check("9.9.9.9").allowed, `importación ${i + 1}`).toBe(true);
    expect(importLimiter.check("9.9.9.9").allowed).toBe(false);
    vi.advanceTimersByTime(10 * MIN + 1);
    expect(importLimiter.check("9.9.9.9").allowed).toBe(true);
  });
});
