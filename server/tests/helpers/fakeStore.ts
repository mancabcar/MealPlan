// Fake en memoria de server/lib/store.ts (docs/pm/22-sincronizacion-dispositivos/tech.md › Testing strategy).
// Contrato que dev-code debe implementar en server/lib/store.ts (con SQL sobre Neon); las rutas solo hablan con él.
// putData es un compare-and-set: escribe solo si baseVersion es la versión actual del servidor (0 si no existe).
export interface StoredUser {
  id: string;
  username: string; // ya normalizado (trim + minúsculas)
  passwordHash: string;
}
export interface StoredSession {
  userId: string;
  expiresAt: number; // ms epoch
}
export interface DataRow {
  value: unknown;
  version: number;
}
export type PutResult = { ok: true; version: number } | { ok: false; value: unknown; version: number };

export function createFakeStore() {
  let users: StoredUser[] = [];
  let sessions = new Map<string, StoredSession>();
  let data = new Map<string, DataRow>();
  let failures: { username: string; at: number }[] = [];
  let nextId = 1;

  return {
    __reset() {
      users = [];
      sessions = new Map();
      data = new Map();
      failures = [];
      nextId = 1;
    },
    /** Solo para los tests: lo que hay guardado, para comprobar que nada sensible se guarda en claro. */
    __dump: () => ({ users, sessions: [...sessions.entries()], data: [...data.entries()] }),

    async createUser(input: { username: string; passwordHash: string }): Promise<StoredUser | null> {
      if (users.some((u) => u.username === input.username)) return null;
      const user = { id: `user-${nextId++}`, ...input };
      users.push(user);
      return user;
    },
    async findUserByUsername(username: string): Promise<StoredUser | null> {
      return users.find((u) => u.username === username) ?? null;
    },
    async createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> {
      sessions.set(tokenHash, { userId, expiresAt });
    },
    async getSession(tokenHash: string): Promise<StoredSession | null> {
      return sessions.get(tokenHash) ?? null;
    },
    async deleteSession(tokenHash: string): Promise<void> {
      sessions.delete(tokenHash);
    },

    async getAllData(userId: string): Promise<Record<string, DataRow>> {
      const out: Record<string, DataRow> = {};
      for (const [k, row] of data) if (k.startsWith(`${userId}|`)) out[k.slice(userId.length + 1)] = row;
      return out;
    },
    async putData(userId: string, key: string, value: unknown, baseVersion: number): Promise<PutResult> {
      const id = `${userId}|${key}`;
      const current = data.get(id) ?? { value: null, version: 0 };
      if (current.version !== baseVersion) return { ok: false, value: current.value, version: current.version };
      const next = { value, version: current.version + 1 };
      data.set(id, next);
      return { ok: true, version: next.version };
    },

    async recordLoginFailure(username: string, at: number): Promise<void> {
      failures.push({ username, at });
    },
    async countLoginFailures(username: string, since: number): Promise<number> {
      return failures.filter((f) => f.username === username && f.at >= since).length;
    },
    async clearLoginFailures(username: string): Promise<void> {
      failures = failures.filter((f) => f.username !== username);
    },
  };
}
