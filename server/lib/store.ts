// Acceso a datos de cuentas, sesiones y datos sincronizados (docs/pm/22-sincronizacion-dispositivos/tech.md › Data model).
// Las rutas solo hablan con este módulo; los tests lo sustituyen por un fake en memoria (server/tests/helpers/fakeStore.ts).
import { sql } from "./db";

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

export async function createUser(input: { username: string; passwordHash: string }): Promise<StoredUser | null> {
  const db = await sql();
  const rows = await db`
    INSERT INTO users (username, password_hash) VALUES (${input.username}, ${input.passwordHash})
    ON CONFLICT (username) DO NOTHING
    RETURNING id, username, password_hash`;
  if (rows.length === 0) return null;
  return { id: rows[0].id, username: rows[0].username, passwordHash: rows[0].password_hash };
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const db = await sql();
  const rows = await db`SELECT id, username, password_hash FROM users WHERE username = ${username}`;
  if (rows.length === 0) return null;
  return { id: rows[0].id, username: rows[0].username, passwordHash: rows[0].password_hash };
}

export async function createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> {
  const db = await sql();
  await db`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt})`;
}

export async function getSession(tokenHash: string): Promise<StoredSession | null> {
  const db = await sql();
  const rows = await db`SELECT user_id, expires_at FROM sessions WHERE token_hash = ${tokenHash}`;
  if (rows.length === 0) return null;
  return { userId: rows[0].user_id, expiresAt: Number(rows[0].expires_at) };
}

export async function deleteSession(tokenHash: string): Promise<void> {
  const db = await sql();
  await db`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

export async function getAllData(userId: string): Promise<Record<string, DataRow>> {
  const db = await sql();
  const rows = await db`SELECT key, value, version FROM user_data WHERE user_id = ${userId}`;
  const out: Record<string, DataRow> = {};
  for (const r of rows) out[r.key] = { value: r.value, version: r.version };
  return out;
}

/**
 * Compare-and-set: escribe solo si `baseVersion` es la versión actual del servidor (0 si la clave no existe).
 * Si no, devuelve el valor y la versión del servidor para que el cliente los adopte (409).
 */
export async function putData(userId: string, key: string, value: unknown, baseVersion: number): Promise<PutResult> {
  const db = await sql();
  const json = JSON.stringify(value);
  const written =
    baseVersion === 0
      ? await db`
          INSERT INTO user_data (user_id, key, value, version) VALUES (${userId}, ${key}, ${json}::jsonb, 1)
          ON CONFLICT (user_id, key) DO NOTHING
          RETURNING version`
      : await db`
          UPDATE user_data SET value = ${json}::jsonb, version = version + 1, updated_at = now()
          WHERE user_id = ${userId} AND key = ${key} AND version = ${baseVersion}
          RETURNING version`;
  if (written.length > 0) return { ok: true, version: written[0].version };

  const current = await db`SELECT value, version FROM user_data WHERE user_id = ${userId} AND key = ${key}`;
  return current.length > 0
    ? { ok: false, value: current[0].value, version: current[0].version }
    : { ok: false, value: null, version: 0 };
}

export async function recordLoginFailure(username: string, at: number): Promise<void> {
  const db = await sql();
  await db`INSERT INTO login_attempts (username, failed_at) VALUES (${username}, ${at})`;
}

export async function countLoginFailures(username: string, since: number): Promise<number> {
  const db = await sql();
  const rows = await db`SELECT count(*)::int AS n FROM login_attempts WHERE username = ${username} AND failed_at >= ${since}`;
  return rows[0].n;
}

export async function clearLoginFailures(username: string): Promise<void> {
  const db = await sql();
  await db`DELETE FROM login_attempts WHERE username = ${username}`;
}
