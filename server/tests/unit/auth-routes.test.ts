// Spec: docs/pm/22-sincronizacion-dispositivos/spec.md › R1, R2 (y bloqueo de fuerza bruta de tech.md › Risks).
// Tech: tech.md › APIs / interfaces y Testing strategy. Rutas reales; el store, un fake en memoria (helpers/).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dumpStore, INVITE, json, resetStore, useEnv } from "../helpers/api";

const { POST: register } = await import("../../app/api/auth/register/route");
const { POST: login } = await import("../../app/api/auth/login/route");
const { POST: logout } = await import("../../app/api/auth/logout/route");
const { GET: getSync } = await import("../../app/api/sync/route");

const NOW = new Date("2026-09-22T10:00:00Z");
const PASSWORD = "c0ntr4s3ña-s3cr3t4";

const signUp = (username = "lucia", password = PASSWORD, invite = INVITE) =>
  register(json("POST", "/api/auth/register", { username, password, invite }));
const signIn = (username: string, password: string) => login(json("POST", "/api/auth/login", { username, password }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  useEnv();
  resetStore();
});
afterEach(() => vi.useRealTimers());

describe("R1: registro", () => {
  it("R1: con usuario, contraseña válidos y código de invitación crea la cuenta y devuelve token y usuario", async () => {
    const res = await signUp();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(body.user.username).toBe("lucia");
    expect(typeof body.user.id).toBe("string");
  });

  it("R1: sin el código de invitación correcto no se crea la cuenta (403)", async () => {
    expect((await signUp("lucia", PASSWORD, "otro-codigo")).status).toBe(403);
    expect((await signUp("lucia", PASSWORD, "")).status).toBe(403);
    expect(dumpStore().users).toHaveLength(0);
  });

  it("R1: un usuario que ya existe (sin distinguir mayúsculas) da 409", async () => {
    await signUp("lucia");
    expect((await signUp("Lucia")).status).toBe(409);
  });

  it("R1: el usuario necesita 3 caracteres y la contraseña 6 (400)", async () => {
    expect((await signUp("lu")).status).toBe(400);
    expect((await signUp("lucia", "12345")).status).toBe(400);
    expect(dumpStore().users).toHaveLength(0);
  });

  it("R1: el servidor guarda solo el hash de la contraseña, nunca la contraseña ni el token en claro", async () => {
    const { token } = await (await signUp()).json();
    const dump = JSON.stringify(dumpStore());
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toContain(token);
    expect(dumpStore().users[0].passwordHash.length).toBeGreaterThan(20);
  });
});

describe("R1: login", () => {
  beforeEach(async () => {
    await signUp("lucia");
  });

  it("R1: usuario y contraseña correctos devuelven token y usuario (el usuario no distingue mayúsculas)", async () => {
    const res = await signIn("LUCIA", PASSWORD);
    expect(res.status).toBe(200);
    expect((await res.json()).user.username).toBe("lucia");
  });

  it("R1: contraseña incorrecta o usuario inexistente dan 401 con el mismo mensaje y sin token", async () => {
    const wrongPassword = await signIn("lucia", "incorrecta");
    const unknownUser = await signIn("nadie", PASSWORD);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    const a = await wrongPassword.json();
    const b = await unknownUser.json();
    expect(a.token).toBeUndefined();
    expect(a.error).toBe(b.error);
  });
});

describe("Bloqueo de fuerza bruta (tech.md › Risks): 5 fallos en 15 min → 429 durante 15 min", () => {
  beforeEach(async () => {
    await signUp("lucia");
  });
  const fail = async (n: number) => {
    for (let i = 0; i < n; i++) expect((await signIn("lucia", "mal")).status).toBe(401);
  };

  it("tras 5 fallos seguidos el login da 429, incluso con la contraseña correcta", async () => {
    await fail(5);
    expect((await signIn("lucia", PASSWORD)).status).toBe(429);
  });

  it("4 fallos no bloquean", async () => {
    await fail(4);
    expect((await signIn("lucia", PASSWORD)).status).toBe(200);
  });

  it("pasados 15 minutos se puede volver a entrar", async () => {
    await fail(5);
    vi.setSystemTime(new Date(NOW.getTime() + 15 * 60_000 + 1000));
    expect((await signIn("lucia", PASSWORD)).status).toBe(200);
  });

  it("un login correcto reinicia el contador", async () => {
    await fail(4);
    expect((await signIn("lucia", PASSWORD)).status).toBe(200);
    await fail(4);
    expect((await signIn("lucia", PASSWORD)).status).toBe(200);
  });

  it("el bloqueo es por usuario: otro usuario sigue entrando", async () => {
    await signUp("manuel");
    await fail(5);
    expect((await signIn("manuel", PASSWORD)).status).toBe(200);
  });
});

describe("R2: sesión y logout", () => {
  it("R2: el token abre sesión en las rutas protegidas", async () => {
    const { token } = await (await signUp()).json();
    expect((await getSync(json("GET", "/api/sync", undefined, token))).status).toBe(200);
  });

  it("R2: tras cerrar sesión el token deja de valer (401)", async () => {
    const { token } = await (await signUp()).json();
    expect((await logout(json("POST", "/api/auth/logout", undefined, token))).status).toBe(200);
    expect((await getSync(json("GET", "/api/sync", undefined, token))).status).toBe(401);
  });

  it("R2: cerrar sesión no invalida las sesiones de otros dispositivos del mismo usuario", async () => {
    const pc = (await (await signUp()).json()).token;
    const movil = (await (await signIn("lucia", PASSWORD)).json()).token;
    await logout(json("POST", "/api/auth/logout", undefined, pc));
    expect((await getSync(json("GET", "/api/sync", undefined, movil))).status).toBe(200);
  });

  it("R2: la sesión caduca a los 90 días (401)", async () => {
    const { token } = await (await signUp()).json();
    vi.setSystemTime(new Date(NOW.getTime() + 89 * 86_400_000));
    expect((await getSync(json("GET", "/api/sync", undefined, token))).status).toBe(200);
    vi.setSystemTime(new Date(NOW.getTime() + 91 * 86_400_000));
    expect((await getSync(json("GET", "/api/sync", undefined, token))).status).toBe(401);
  });

  it("R2: un token inventado o una cabecera mal formada dan 401", async () => {
    expect((await getSync(json("GET", "/api/sync", undefined, "no-existe"))).status).toBe(401);
    const malformed = new Request("http://localhost/api/sync", { headers: { Authorization: "Token abc" } });
    expect((await getSync(malformed)).status).toBe(401);
  });
});
