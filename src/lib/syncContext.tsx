"use client";

// Capa de React sobre el motor de sync (docs/pm/22-sincronizacion-dispositivos/tech.md › Components & files).
// Crea un motor por sesión, lo arranca (pull inicial, foco, polling) y expone markDirty y el estado al resto de la app.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { apiUrl } from "./apiBase";
import { useAuth } from "./auth";
import { createSyncEngine, type SyncEngine, type SyncStatus } from "./sync";
import type { UserDataKey } from "./userData";

interface SyncState {
  status: SyncStatus;
  /** Anota que una clave ha cambiado en este dispositivo para subirla. */
  markDirty: (key: UserDataKey) => void;
  /** Avisa de las claves que el servidor ha cambiado en localStorage (la capa de datos las relee). */
  subscribeRemote: (listener: (key: UserDataKey) => void) => () => void;
}

// Sin SyncProvider (tests del store, pruebas de componentes) la app funciona igual, solo local: no hay nada que sincronizar
const LOCAL_ONLY: SyncState = { status: "synced", markDirty: () => {}, subscribeRemote: () => () => {} };

const SyncContext = createContext<SyncState>(LOCAL_ONLY);

export function SyncProvider({ userId, token, children }: { userId: string; token: string; children: ReactNode }) {
  const { expireSession, setBeforeLogout } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("synced");
  const engine = useRef<SyncEngine | null>(null);
  const listeners = useRef(new Set<(key: UserDataKey) => void>());

  useEffect(() => {
    const e = createSyncEngine({
      userId,
      storage: localStorage,
      fetch: (...args) => fetch(...args),
      apiBase: apiUrl(""),
      token,
      onRemoteChange: (key) => listeners.current.forEach((l) => l(key)),
      onUnauthorized: expireSession,
      onStatusChange: setStatus,
    });
    engine.current = e;
    setStatus(e.status);
    e.start();
    void e.pull(); // al abrir: sube lo pendiente y baja lo nuevo

    // Al volver a la pestaña o recuperar la conexión, sin esperar al siguiente ciclo (R5, R8)
    const refresh = () => {
      if (document.visibilityState !== "hidden") void e.pull();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    setBeforeLogout(() => e.flush());
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      setBeforeLogout(null);
      e.stop();
      engine.current = null;
    };
  }, [userId, token, expireSession, setBeforeLogout]);

  const markDirty = useCallback((key: UserDataKey) => engine.current?.markDirty(key), []);
  const subscribeRemote = useCallback((l: (key: UserDataKey) => void) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);
  const value = useMemo(() => ({ status, markDirty, subscribeRemote }), [status, markDirty, subscribeRemote]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  return useContext(SyncContext);
}
