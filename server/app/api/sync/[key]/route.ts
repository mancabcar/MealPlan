import { authenticate, reply, unauthorized } from "../../../../lib/auth";
import { preflight } from "../../../../lib/cors";
import { putData } from "../../../../lib/store";
import { isSyncKey, MAX_BLOCK_BYTES } from "../../../../lib/sync";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Escritura de una clave con concurrencia optimista: si `baseVersion` es la versión actual del servidor, se guarda y la
 * versión sube; si no, 409 con el valor y la versión del servidor, que el cliente adopta (gana el servidor).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await authenticate(request);
  if (!session) return unauthorized(request);

  const { key } = await params;
  if (!isSyncKey(key)) return reply(request, { error: "Clave desconocida" }, 400);

  const body = (await request.json().catch(() => null)) as { value?: unknown; baseVersion?: unknown } | null;
  if (!body || body.value === undefined || !Number.isInteger(body.baseVersion) || (body.baseVersion as number) < 0) {
    return reply(request, { error: "Falta el valor o baseVersion" }, 400);
  }
  if (Buffer.byteLength(JSON.stringify(body.value)) > MAX_BLOCK_BYTES) {
    return reply(request, { error: "El bloque supera 1 MB" }, 413);
  }

  const result = await putData(session.userId, key, body.value, body.baseVersion as number);
  return result.ok
    ? reply(request, { version: result.version })
    : reply(request, { value: result.value, version: result.version }, 409);
}
