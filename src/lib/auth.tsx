"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { apiUrl } from "./apiBase";
import { buildBackup } from "./backup";
import { adoptLocalData, clearUserData, hasUserData, listLocalAccounts, planFirstSync, type LocalAccount } from "./syncMigration";
import { userKey } from "./userKey";
import { USER_DATA_KEYS } from "./userData";

// Cuentas reales en el servidor (docs/pm/22-sincronizacion-dispositivos): usuario y contraseña contra server/, token opaco
// en cabecera. La sesión (con su token) vive en localStorage ("Recordar sesión") o solo en esta pestaña (sessionStorage).

export interface SessionUser {
  id: string;
  username: string;
}

/** Datos locales y del servidor a la vez (R7): hasta que el usuario decida, el inicio de sesión espera. */
export interface ReplaceRequest {
  /** Sustituye lo de este dispositivo por lo de la cuenta. */
  accept: () => void;
  /** Cierra la sesión del servidor y vuelve al login sin tocar nada. */
  cancel: () => void;
  /** Descarga un backup JSON de lo que hay en este dispositivo antes de decidir. */
  downloadLocal: () => void;
}

interface AuthState {
  user: SessionUser | null;
  loaded: boolean;
  /** Cuentas locales antiguas de este navegador, entre las que elegir los datos a traer. */
  localAccounts: LocalAccount[];
  token: string | null;
  replaceRequest: ReplaceRequest | null;
  login: (username: string, password: string, remember: boolean, localAccountId: string | null) => Promise<void>;
  register: (username: string, password: string, invite: string, remember: boolean, localAccountId: string | null) => Promise<void>;
  logout: () => Promise<void>;
  /** La sesión ha caducado (401): vuelve al login sin borrar la copia local. */
  expireSession: () => void;
  /** Lo registra la capa de sync para subir lo pendiente antes de que cerrar sesión borre la copia local (R12). */
  setBeforeLogout: (fn: (() => Promise<void>) | null) => void;
}

const SESSION_KEY = "mp_session";
const NETWORK_ERROR = "No se ha podido conectar con el servidor. Comprueba tu conexión.";

const AuthContext = createContext<AuthState | null>(null);

export { userKey };

interface StoredSession extends SessionUser {
  token: string;
}

function readSession(storage: Storage): StoredSession | null {
  try {
    const s = JSON.parse(storage.getItem(SESSION_KEY) ?? "null") as Partial<StoredSession> | null;
    return s && typeof s.id === "string" && typeof s.username === "string" && typeof s.token === "string" ? (s as StoredSession) : null;
  } catch {
    return null;
  }
}

async function post(path: string, body: unknown, token?: string): Promise<{ status: number; body: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function remoteHasData(token: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/sync"), { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw new Error("No se han podido consultar tus datos en el servidor.");
  return Object.keys((await res.json()) as object).length > 0;
}

function downloadBackup(userId: string) {
  const backup = buildBackup(localStorage, userId);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mealplan-backup-local-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([]);
  const [replaceRequest, setReplaceRequest] = useState<ReplaceRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const beforeLogout = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const session = readSession(localStorage) ?? readSession(sessionStorage);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (session) {
      setUser({ id: session.id, username: session.username });
      setToken(session.token);
    }
    setLocalAccounts(listLocalAccounts(localStorage));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const startSession = (session: StoredSession, remember: boolean) => {
    const json = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(SESSION_KEY, json);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, json);
      localStorage.removeItem(SESSION_KEY);
    }
    setToken(session.token);
    setUser({ id: session.id, username: session.username });
  };

  /** Pregunta al usuario y espera su respuesta (R7). */
  const askReplace = (serverId: string) =>
    new Promise<boolean>((resolve) => {
      const done = (answer: boolean) => {
        setReplaceRequest(null);
        resolve(answer);
      };
      setReplaceRequest({ accept: () => done(true), cancel: () => done(false), downloadLocal: () => downloadBackup(serverId) });
    });

  /** R6/R7: con la sesión ya abierta en el servidor, decide qué pasa con los datos de este dispositivo. */
  const finishSignIn = async (serverToken: string, serverUser: SessionUser, remember: boolean, localAccountId: string | null) => {
    if (localAccountId) adoptLocalData(localStorage, localAccountId, serverUser.id);
    // Un dispositivo que ya sincronizó antes con esta cuenta (p. ej. tras caducar la sesión) solo se pone al día
    const knownDevice = localStorage.getItem(userKey(serverUser.id, "syncmeta")) !== null;
    const plan = knownDevice
      ? "download"
      : planFirstSync(hasUserData(localStorage, serverUser.id), await remoteHasData(serverToken));

    if (plan === "confirm") {
      const replace = await askReplace(serverUser.id);
      if (!replace) {
        await post("/api/auth/logout", {}, serverToken).catch(() => undefined);
        clearUserData(localStorage, serverUser.id); // solo la copia adoptada: la cuenta local original no se toca
        throw new Error("");
      }
      clearUserData(localStorage, serverUser.id); // lo del servidor lo trae el primer pull
    } else if (plan === "upload") {
      // Sin versiones conocidas: el primer ciclo sube todas las claves que existan con baseVersion 0 (R6)
      const pending = USER_DATA_KEYS.filter((k) => localStorage.getItem(userKey(serverUser.id, k)) !== null);
      localStorage.setItem(userKey(serverUser.id, "syncmeta"), JSON.stringify({ versions: {}, pending }));
    }
    startSession({ ...serverUser, token: serverToken }, remember);
  };

  const enter = async (path: string, body: unknown, remember: boolean, localAccountId: string | null) => {
    const res = await post(path, body);
    if (res.status !== 200) throw new Error(typeof res.body.error === "string" ? res.body.error : "Algo ha fallado");
    await finishSignIn(res.body.token as string, res.body.user as SessionUser, remember, localAccountId);
  };

  const login = (username: string, password: string, remember: boolean, localAccountId: string | null) =>
    enter("/api/auth/login", { username, password }, remember, localAccountId);

  const register = (username: string, password: string, invite: string, remember: boolean, localAccountId: string | null) => {
    if (username.trim().length < 3) return Promise.reject(new Error("El usuario debe tener al menos 3 caracteres"));
    if (password.length < 6) return Promise.reject(new Error("La contraseña debe tener al menos 6 caracteres"));
    return enter("/api/auth/register", { username, password, invite }, remember, localAccountId);
  };

  const endSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
    setLocalAccounts(listLocalAccounts(localStorage));
  }, []);

  const logout = async () => {
    if (!user) return;
    // Lo pendiente se sube antes de borrar la copia local; sin red se sale igualmente (R12)
    await beforeLogout.current?.().catch(() => undefined);
    if (token) await post("/api/auth/logout", {}, token).catch(() => undefined);
    clearUserData(localStorage, user.id);
    endSession();
  };

  const setBeforeLogout = useCallback((fn: (() => Promise<void>) | null) => {
    beforeLogout.current = fn;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loaded, localAccounts, replaceRequest, login, register, logout, expireSession: endSession, setBeforeLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
