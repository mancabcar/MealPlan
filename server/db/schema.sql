-- Esquema de la sincronización (docs/pm/22-sincronizacion-dispositivos/tech.md › Data model).
-- server/lib/db.ts lo aplica solo (CREATE TABLE IF NOT EXISTS) en la primera petición; este fichero es la referencia.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,            -- normalizado: trim + minúsculas
  password_hash text NOT NULL,              -- scrypt: "<sal hex>:<hash hex>"
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,              -- SHA-256 del token; el token en claro solo lo tiene el cliente
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL,               -- ms desde epoch
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_data (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  version integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  username text NOT NULL,
  failed_at bigint NOT NULL                 -- ms desde epoch
);
CREATE INDEX IF NOT EXISTS login_attempts_idx ON login_attempts(username, failed_at);
