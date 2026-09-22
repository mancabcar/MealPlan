"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Cuentas locales: viven en el localStorage de este navegador (no hay backend).
// La contraseña se guarda como hash PBKDF2 con sal aleatoria, nunca en claro.

export interface Account {
  id: string;
  username: string;
  salt: string; // hex
  hash: string; // hex
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
}

interface AuthState {
  user: SessionUser | null;
  loaded: boolean;
  rememberedUsers: string[];
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  register: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  forgetUser: (username: string) => void;
}

const USERS_KEY = "mp_users";
const SESSION_KEY = "mp_session";
const REMEMBERED_KEY = "mp_remembered";
// Claves anteriores a las cuentas: se adoptan en la primera cuenta creada
const LEGACY_KEYS = ["profile", "recipes", "entries", "pantry", "weekplan"];

const AuthContext = createContext<AuthState | null>(null);

export function userKey(userId: string, key: string): string {
  return `mp_${userId}_${key}`;
}

function read<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const normalize = (u: string) => u.trim().toLowerCase();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Tu navegador no permite cifrado aquí. Abre la app por https o localhost.");
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

function adoptLegacyData(userId: string) {
  for (const k of LEGACY_KEYS) {
    const raw = localStorage.getItem(`mp_${k}`);
    if (raw !== null) {
      localStorage.setItem(userKey(userId, k), raw);
      localStorage.removeItem(`mp_${k}`);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rememberedUsers, setRememberedUsers] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Sesión recordada (localStorage) o solo de esta pestaña (sessionStorage)
    const accounts = read<Account[]>(localStorage, USERS_KEY, []);
    const session =
      read<SessionUser | null>(localStorage, SESSION_KEY, null) ??
      read<SessionUser | null>(sessionStorage, SESSION_KEY, null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(session && accounts.some((a) => a.id === session.id) ? session : null);
    setRememberedUsers(read<string[]>(localStorage, REMEMBERED_KEY, []));
    setLoaded(true);
  }, []);

  const startSession = (account: Account, remember: boolean) => {
    const session: SessionUser = { id: account.id, username: account.username };
    const json = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(SESSION_KEY, json);
      sessionStorage.removeItem(SESSION_KEY);
      const list = [account.username, ...rememberedUsers.filter((u) => normalize(u) !== normalize(account.username))];
      setRememberedUsers(list);
      localStorage.setItem(REMEMBERED_KEY, JSON.stringify(list));
    } else {
      sessionStorage.setItem(SESSION_KEY, json);
      localStorage.removeItem(SESSION_KEY);
    }
    setUser(session);
  };

  const login = async (username: string, password: string, remember: boolean) => {
    const accounts = read<Account[]>(localStorage, USERS_KEY, []);
    const account = accounts.find((a) => normalize(a.username) === normalize(username));
    // Se calcula el hash aunque no exista el usuario para no delatarlo por el tiempo
    const hash = await hashPassword(password, account ? fromHex(account.salt) : new Uint8Array(16));
    if (!account || hash !== account.hash) throw new Error("Usuario o contraseña incorrectos");
    startSession(account, remember);
  };

  const register = async (username: string, password: string, remember: boolean) => {
    const name = username.trim();
    if (name.length < 3) throw new Error("El usuario debe tener al menos 3 caracteres");
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    const accounts = read<Account[]>(localStorage, USERS_KEY, []);
    if (accounts.some((a) => normalize(a.username) === normalize(name))) {
      throw new Error("Ese usuario ya existe");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const account: Account = {
      id: crypto.randomUUID(),
      username: name,
      salt: toHex(salt),
      hash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    };
    if (accounts.length === 0) adoptLegacyData(account.id);
    localStorage.setItem(USERS_KEY, JSON.stringify([...accounts, account]));
    startSession(account, remember);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const forgetUser = (username: string) => {
    const list = rememberedUsers.filter((u) => normalize(u) !== normalize(username));
    setRememberedUsers(list);
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(list));
  };

  return (
    <AuthContext.Provider value={{ user, loaded, rememberedUsers, login, register, logout, forgetUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
