// Límite de peticiones por clave (IP) en memoria (docs/pm/19-importar-receta-url/tech.md › Components & files).
// No es global entre instancias de Vercel: frena el abuso casual, no un ataque decidido (riesgo aceptado en el tech design).

export interface RateLimiter {
  check(key: string): { allowed: boolean; retryAfterSeconds: number };
  reset(): void;
}

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key) {
      const now = Date.now();
      // Limpieza de claves viejas para que el mapa no crezca sin límite
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset() {
      hits.clear();
    },
  };
}

export const importLimiter = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });
