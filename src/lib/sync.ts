// Motor de sincronización (docs/pm/22-sincronizacion-dispositivos/tech.md › Design). Sin React: el almacenamiento, fetch
// y la visibilidad se inyectan para poder probarlo con temporizadores falsos (tests/unit/sync-engine.test.ts).
//
// localStorage sigue siendo la copia principal (R8). El motor solo mueve bloques por clave entre ella y el servidor:
//  - subir (R4): cada clave pendiente se manda con PUT y la versión del servidor que este dispositivo conoce
//    (baseVersion). Si el servidor responde 409, este dispositivo estaba desfasado y adopta lo del servidor.
//  - bajar (R5): GET con las versiones conocidas; solo llegan las claves más nuevas.
import { USER_DATA_KEYS, type UserDataKey } from "./userData";

export type SyncStatus = "synced" | "syncing" | "unsynced";

export interface SyncEngineOptions {
  userId: string;
  storage: Storage;
  fetch: typeof fetch;
  apiBase: string;
  token: string;
  /** Una clave de localStorage ha cambiado por culpa del servidor: la capa de React debe releerla. */
  onRemoteChange: (key: UserDataKey) => void;
  /** El servidor ha respondido 401: la sesión ha caducado o se ha revocado. La copia local no se toca. */
  onUnauthorized?: () => void;
  onStatusChange?: (status: SyncStatus) => void;
  /** Con la pestaña oculta no se consulta (por defecto, document.visibilityState). */
  isVisible?: () => boolean;
}

export interface SyncEngine {
  /** Anota que la clave ha cambiado en este dispositivo; se sube tras 1 s sin más cambios. */
  markDirty: (key: UserDataKey) => void;
  /** Sube ya lo pendiente. */
  flush: () => Promise<void>;
  /** Sube lo pendiente y baja los cambios del servidor (al recuperar el foco y en cada ciclo de polling). */
  pull: () => Promise<void>;
  /** Empieza el polling (cada 15 s con la pestaña visible). */
  start: () => void;
  stop: () => void;
  readonly status: SyncStatus;
}

export const DEBOUNCE_MS = 1_000;
export const POLL_MS = 15_000;

interface Meta {
  versions: Partial<Record<UserDataKey, number>>;
  pending: UserDataKey[];
}

const dataKey = (userId: string, key: string) => `mp_${userId}_${key}`;

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { userId, storage, apiBase, token, onRemoteChange, onUnauthorized, onStatusChange } = options;
  const isVisible = options.isVisible ?? (() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const metaKey = dataKey(userId, "syncmeta");
  const base = apiBase.replace(/\/+$/, "");

  const readMeta = (): Meta => {
    try {
      const raw = JSON.parse(storage.getItem(metaKey) ?? "null") as Partial<Meta> | null;
      return { versions: raw?.versions ?? {}, pending: (raw?.pending ?? []).filter((k) => USER_DATA_KEYS.includes(k)) };
    } catch {
      return { versions: {}, pending: [] };
    }
  };
  const meta = readMeta();
  const saveMeta = () => storage.setItem(metaKey, JSON.stringify(meta));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let poller: ReturnType<typeof setInterval> | null = null;
  let running: Promise<void> | null = null;
  let failed = false;
  // Cuántas veces se ha marcado cada clave: si cambia mientras se sube, la clave sigue pendiente
  const generation: Partial<Record<UserDataKey, number>> = {};
  let last: SyncStatus | null = null;

  const computeStatus = (): SyncStatus => {
    if (running || timer) return "syncing";
    return meta.pending.length > 0 || failed ? "unsynced" : "synced";
  };
  const notify = () => {
    const status = computeStatus();
    if (status !== last) {
      last = status;
      onStatusChange?.(status);
    }
  };

  const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  const adopt = (key: UserDataKey, value: unknown, version: number) => {
    storage.setItem(dataKey(userId, key), JSON.stringify(value));
    meta.versions[key] = version;
    onRemoteChange(key);
  };

  /** Devuelve false si hay que parar (sin red, error o sesión caducada). */
  async function pushPending(): Promise<boolean> {
    for (const key of [...meta.pending]) {
      const raw = storage.getItem(dataKey(userId, key));
      const gen = generation[key] ?? 0;
      let res: Response;
      try {
        res = await options.fetch(`${base}/api/sync/${key}`, {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify({ value: raw === null ? null : JSON.parse(raw), baseVersion: meta.versions[key] ?? 0 }),
        });
      } catch {
        failed = true;
        return false;
      }
      if (res.status === 401) {
        onUnauthorized?.();
        failed = true;
        return false;
      }
      if (res.status === 409) {
        const body = (await res.json()) as { value: unknown; version: number };
        meta.pending = meta.pending.filter((k) => k !== key);
        adopt(key, body.value, body.version);
      } else if (res.ok) {
        const body = (await res.json()) as { version: number };
        meta.versions[key] = body.version;
        if ((generation[key] ?? 0) === gen) meta.pending = meta.pending.filter((k) => k !== key);
      } else {
        failed = true;
        return false;
      }
      saveMeta();
    }
    return true;
  }

  const run = (work: () => Promise<void>): Promise<void> => {
    const next = (running ?? Promise.resolve()).then(work).finally(() => {
      if (running === next) running = null;
      notify();
    });
    running = next;
    notify();
    return next;
  };

  const flush = () =>
    run(async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (meta.pending.length === 0) return;
      failed = false;
      await pushPending();
    });

  const pull = () =>
    run(async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      failed = false;
      // Primero se sube lo propio: así un cambio local pendiente se resuelve (o pierde por 409) antes de bajar nada
      if (meta.pending.length > 0 && !(await pushPending())) return;
      let res: Response;
      try {
        res = await options.fetch(`${base}/api/sync?since=${encodeURIComponent(JSON.stringify(meta.versions))}`, {
          headers: headers(),
        });
      } catch {
        failed = true;
        return;
      }
      if (res.status === 401) {
        onUnauthorized?.();
        failed = true;
        return;
      }
      if (!res.ok) {
        failed = true;
        return;
      }
      const rows = (await res.json()) as Partial<Record<UserDataKey, { value: unknown; version: number }>>;
      for (const key of USER_DATA_KEYS) {
        const row = rows[key];
        if (row && !meta.pending.includes(key)) adopt(key, row.value, row.version);
      }
      saveMeta();
    });

  return {
    markDirty(key) {
      generation[key] = (generation[key] ?? 0) + 1;
      if (!meta.pending.includes(key)) meta.pending.push(key);
      saveMeta();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, DEBOUNCE_MS);
      notify();
    },
    flush,
    pull,
    start() {
      if (poller) return;
      poller = setInterval(() => {
        if (isVisible()) void pull();
      }, POLL_MS);
    },
    stop() {
      if (poller) clearInterval(poller);
      poller = null;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    get status() {
      return computeStatus();
    },
  };
}
