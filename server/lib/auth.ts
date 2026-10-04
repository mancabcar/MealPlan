// Cuentas y sesiones (docs/pm/22-sincronizacion-dispositivos/tech.md › APIs / interfaces).
// Contraseñas con scrypt de node:crypto (sin dependencias); sesión = token opaco aleatorio del que el servidor
// solo guarda el SHA-256 (se puede revocar borrando la fila y una filtración de la BD no da sesiones válidas).
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { withCors } from "./cors";
import { getSession } from "./store";

export const SESSION_DAYS = 90;
/** Bloqueo de login: 5 fallos en 15 minutos → 429 hasta que pasen esos 15 minutos. */
export const MAX_LOGIN_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60_000;
export const MIN_USERNAME = 3;
export const MIN_PASSWORD = 6;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** Compara en tiempo constante; con un hash ausente (usuario inexistente) gasta el mismo trabajo y devuelve false. */
export function verifyPassword(password: string, stored: string | null): boolean {
  const [saltHex, hashHex] = (stored ?? `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return stored !== null && expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const newToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** IP del cliente tal como la reenvía Vercel (primer valor de x-forwarded-for); "unknown" si no hay. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

/** Usuario de la sesión de la petición, o null si falta el token, no existe o ha caducado. */
export async function authenticate(request: Request): Promise<{ userId: string; tokenHash: string } | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await getSession(tokenHash);
  if (!session || session.expiresAt <= Date.now()) return null;
  return { userId: session.userId, tokenHash };
}

/** Respuesta JSON con las cabeceras CORS del frontend. */
export function reply(request: Request, body: unknown, status = 200): NextResponse {
  return withCors(request, NextResponse.json(body, { status }));
}

/** Ejecuta la ruta; si algo lanza (BD caída o sin tablas…), lo registra y responde un 500 JSON legible con CORS en vez de un 500 vacío. */
export async function guarded(request: Request, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    console.error(`${request.method} ${new URL(request.url).pathname} falló:`, err);
    return reply(request, { error: "Error del servidor. Inténtalo de nuevo en unos minutos." }, 500);
  }
}

export const unauthorized = (request: Request) => reply(request, { error: "Sesión no válida" }, 401);
