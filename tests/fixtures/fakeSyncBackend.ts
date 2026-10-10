// Servidor simulado con el contrato de docs/pm/22-sincronizacion-dispositivos/tech.md › APIs / interfaces.
// Lo usan los tests unitarios del cliente (fetch inyectado) y los e2e (page.route): ninguno toca una red ni una BD reales.
// Es un doble del contrato, no de la implementación: la SQL real y las rutas se prueban en server/tests/unit.
export const SYNC_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping", "measurements", "favorites", "water", "mealFavorites"] as const;

interface Row {
  value: unknown;
  version: number;
}
interface FakeUser {
  id: string;
  username: string;
  password: string;
  data: Map<string, Row>;
}
export interface FakeResponse {
  status: number;
  body: unknown;
}

export const INVITE_CODE = "codigo-de-invitacion";

export function createFakeBackend() {
  const users: FakeUser[] = [];
  const tokens = new Map<string, string>(); // token -> userId
  let online = true;
  let n = 0;
  const requests: { method: string; path: string; search: string; body: unknown }[] = [];

  const byId = (id: string) => users.find((u) => u.id === id)!;
  const reply = (status: number, body: unknown): FakeResponse => ({ status, body });
  const startSession = (u: FakeUser) => {
    const token = `token-${++n}-${"x".repeat(32)}`;
    tokens.set(token, u.id);
    return reply(200, { token, user: { id: u.id, username: u.username } });
  };

  function handle(method: string, url: URL, headers: Record<string, string>, body: Record<string, unknown> | undefined): FakeResponse {
    const path = url.pathname;
    requests.push({ method, path, search: url.search, body });
    const userId = tokens.get((headers.authorization ?? "").replace(/^Bearer /i, ""));

    if (method === "POST" && path === "/api/auth/register") {
      if (body?.invite !== INVITE_CODE) return reply(403, { error: "Código de invitación incorrecto" });
      const name = String(body.username).trim().toLowerCase();
      if (users.some((u) => u.username === name)) return reply(409, { error: "Ese usuario ya existe" });
      const u: FakeUser = { id: `srv-${users.length + 1}`, username: name, password: String(body.password), data: new Map() };
      users.push(u);
      return startSession(u);
    }
    if (method === "POST" && path === "/api/auth/login") {
      const u = users.find((x) => x.username === String(body?.username).trim().toLowerCase());
      if (!u || u.password !== body?.password) return reply(401, { error: "Usuario o contraseña incorrectos" });
      return startSession(u);
    }
    if (method === "POST" && path === "/api/auth/logout") {
      tokens.delete((headers.authorization ?? "").replace(/^Bearer /i, ""));
      return reply(200, { ok: true });
    }

    if (!userId) return reply(401, { error: "Sesión no válida" });
    const user = byId(userId);

    if (method === "GET" && path === "/api/sync") {
      const since: Record<string, number> = JSON.parse(url.searchParams.get("since") ?? "{}");
      const out: Record<string, Row> = {};
      for (const [k, row] of user.data) if (row.version > (since[k] ?? 0)) out[k] = row;
      return reply(200, out);
    }
    // «mealFavorites» (#55) es la primera clave con mayúscula
    const put = path.match(/^\/api\/sync\/([a-zA-Z]+)$/);
    if (method === "PUT" && put) {
      const key = put[1];
      if (!(SYNC_KEYS as readonly string[]).includes(key)) return reply(400, { error: "Clave desconocida" });
      const current = user.data.get(key) ?? { value: null, version: 0 };
      if (current.version !== body?.baseVersion) return reply(409, { value: current.value, version: current.version });
      user.data.set(key, { value: body?.value, version: current.version + 1 });
      return reply(200, { version: current.version + 1 });
    }
    return reply(404, { error: "No existe" });
  }

  /** fetch inyectable: respeta `online` (sin red lanza TypeError, como el navegador). */
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!online) throw new TypeError("Failed to fetch");
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    const res = handle((init?.method ?? "GET").toUpperCase(), url, headers, init?.body ? JSON.parse(String(init.body)) : undefined);
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  return {
    fetch: fetchFn,
    handle,
    requests,
    setOnline: (v: boolean) => {
      online = v;
    },
    get online() {
      return online;
    },
    /** Siembra datos de un usuario como si otro dispositivo los hubiera subido (versión 1). */
    seed(username: string, password: string, data: Record<string, unknown>) {
      const u: FakeUser = { id: `srv-${users.length + 1}`, username, password, data: new Map() };
      for (const [k, value] of Object.entries(data)) u.data.set(k, { value, version: 1 });
      users.push(u);
      return u.id;
    },
    /** Un usuario con id fijo y una sesión ya abierta (para e2e que se saltan el login): devuelve el token. */
    seedAs(id: string, username: string): string {
      users.push({ id, username, password: "", data: new Map() });
      const token = `token-seed-${++n}-${"x".repeat(32)}`;
      tokens.set(token, id);
      return token;
    },
    /** Escritura de "otro dispositivo": sube la versión de una clave. */
    remoteWrite(username: string, key: string, value: unknown) {
      const u = users.find((x) => x.username === username)!;
      const cur = u.data.get(key) ?? { value: null, version: 0 };
      u.data.set(key, { value, version: cur.version + 1 });
    },
    dataOf(username: string): Record<string, Row> {
      const u = users.find((x) => x.username === username);
      return u ? Object.fromEntries(u.data) : {};
    },
    token: (username: string): string => {
      const u = users.find((x) => x.username === username)!;
      const token = `token-seed-${++n}-${"x".repeat(32)}`;
      tokens.set(token, u.id);
      return token;
    },
  };
}
export type FakeBackend = ReturnType<typeof createFakeBackend>;
