import { guarded, hashToken, LOCKOUT_MS, MAX_LOGIN_FAILURES, newToken, normalizeUsername, reply, SESSION_DAYS, verifyPassword } from "../../../../lib/auth";
import { preflight } from "../../../../lib/cors";
import { clearLoginFailures, countLoginFailures, createSession, findUserByUsername, recordLoginFailure } from "../../../../lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

const WRONG = "Usuario o contraseña incorrectos";

export const POST = (request: Request) => guarded(request, () => handle(request));

async function handle(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) return reply(request, { error: WRONG }, 401);

  const now = Date.now();
  if ((await countLoginFailures(username, now - LOCKOUT_MS)) >= MAX_LOGIN_FAILURES) {
    return reply(request, { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." }, 429);
  }

  // El hash se calcula aunque el usuario no exista para no delatarlo por el tiempo de respuesta
  const user = await findUserByUsername(username);
  if (!verifyPassword(password, user?.passwordHash ?? null) || !user) {
    await recordLoginFailure(username, now);
    return reply(request, { error: WRONG }, 401);
  }

  await clearLoginFailures(username);
  const token = newToken();
  await createSession(user.id, hashToken(token), now + SESSION_DAYS * 86_400_000);
  return reply(request, { token, user: { id: user.id, username: user.username } });
}
