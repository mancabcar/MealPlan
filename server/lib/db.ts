// Conexión a Neon Postgres (docs/pm/22-sincronizacion-dispositivos/tech.md › Components & files).
// DATABASE_URL se configura en el servidor (Vercel) y en server/.env.local; nunca llega al navegador.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;
let ready: Promise<void> | null = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS user_data (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key text NOT NULL,
    value jsonb NOT NULL,
    version integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    username text NOT NULL,
    failed_at bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS login_attempts_idx ON login_attempts(username, failed_at)`,
];

/** Cliente SQL listo para usar: crea el esquema la primera vez que se llama (idempotente). */
export async function sql(): Promise<NeonQueryFunction<false, false>> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en el servidor.");
  if (!client) client = neon(url);
  const db = client;
  ready ??= (async () => {
    for (const statement of SCHEMA) await db.query(statement);
  })().catch((err) => {
    ready = null; // reintentar en la siguiente petición
    throw err;
  });
  await ready;
  return db;
}
