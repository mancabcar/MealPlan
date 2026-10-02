import { authenticate, guarded, reply, unauthorized } from "../../../../lib/auth";
import { preflight } from "../../../../lib/cors";
import { deleteSession } from "../../../../lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Cierra solo la sesión de este dispositivo: los tokens de los demás siguen valiendo. */
export const POST = (request: Request) => guarded(request, () => handle(request));

async function handle(request: Request) {
  const session = await authenticate(request);
  if (!session) return unauthorized(request);
  await deleteSession(session.tokenHash);
  return reply(request, { ok: true });
}
