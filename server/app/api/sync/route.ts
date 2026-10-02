import { authenticate, guarded, reply, unauthorized } from "../../../lib/auth";
import { preflight } from "../../../lib/cors";
import { getAllData } from "../../../lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Datos del usuario; con `?since={"clave":versión}` solo las claves más nuevas que esas versiones (o desconocidas). */
export const GET = (request: Request) => guarded(request, () => handle(request));

async function handle(request: Request) {
  const session = await authenticate(request);
  if (!session) return unauthorized(request);

  let since: Record<string, number> = {};
  const raw = new URL(request.url).searchParams.get("since");
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
      since = parsed as Record<string, number>;
    } catch {
      return reply(request, { error: "El parámetro since no es un JSON válido" }, 400);
    }
  }

  const all = await getAllData(session.userId);
  const changed = Object.fromEntries(Object.entries(all).filter(([key, row]) => row.version > (Number(since[key]) || 0)));
  return reply(request, changed);
}
