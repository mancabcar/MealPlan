// Contrato de la sincronización (docs/pm/22-sincronizacion-dispositivos/tech.md › APIs / interfaces).
// Las 10 claves de datos del usuario (src/lib/userData.ts › USER_DATA_KEYS; se repiten aquí para no arrastrar al servidor
// los JSON de recetas que userData.ts importa, y server/tests/unit/sync-routes.test.ts comprueba que son diez).
export const SYNC_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan", "shopping", "measurements", "favorites", "water", "ratings"] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];

export const isSyncKey = (k: string): k is SyncKey => (SYNC_KEYS as readonly string[]).includes(k);

/** Tope por bloque (tech.md › Data model): 1 MB de JSON. */
export const MAX_BLOCK_BYTES = 1_000_000;
