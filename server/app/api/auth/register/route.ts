import { hashPassword, hashToken, MIN_PASSWORD, MIN_USERNAME, newToken, normalizeUsername, reply, SESSION_DAYS } from "../../../../lib/auth";
import { preflight } from "../../../../lib/cors";
import { createSession, createUser } from "../../../../lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// Registro cerrado: solo con el código de invitación de REGISTRATION_CODE (tech.md › Risks). Sin la variable, nadie se registra.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown; invite?: unknown } | null;
  const code = process.env.REGISTRATION_CODE;
  if (!code || typeof body?.invite !== "string" || body.invite !== code) {
    return reply(request, { error: "Código de invitación incorrecto" }, 403);
  }
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length < MIN_USERNAME) return reply(request, { error: `El usuario debe tener al menos ${MIN_USERNAME} caracteres` }, 400);
  if (password.length < MIN_PASSWORD) return reply(request, { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` }, 400);

  const user = await createUser({ username, passwordHash: hashPassword(password) });
  if (!user) return reply(request, { error: "Ese usuario ya existe" }, 409);

  const token = newToken();
  await createSession(user.id, hashToken(token), Date.now() + SESSION_DAYS * 86_400_000);
  return reply(request, { token, user: { id: user.id, username: user.username } });
}
