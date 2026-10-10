// Primer inicio de sesión en un dispositivo y limpieza al salir (docs/pm/22-sincronizacion-dispositivos/spec.md › R6, R7, R12).
// Funciones puras con el Storage inyectado, como backup.ts.
import { loadShoppingState } from "./shopping/state";
import { CATALOG_IDS } from "./catalog";
import { RETIRED_RECIPE_IDS } from "./migrate";
import { USER_DATA_KEYS } from "./userData";

const userKey = (userId: string, key: string) => `mp_${userId}_${key}`;

export type FirstSyncPlan = "upload" | "confirm" | "download" | "nothing";

/** R6/R7: qué hacer según haya datos en este dispositivo y/o en el servidor. */
export function planFirstSync(localHasData: boolean, remoteHasData: boolean): FirstSyncPlan {
  if (localHasData && remoteHasData) return "confirm";
  if (localHasData) return "upload";
  return remoteHasData ? "download" : "nothing";
}

const read = (storage: Storage, userId: string, key: string): unknown => {
  try {
    const raw = storage.getItem(userKey(userId, key));
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/**
 * ¿Tiene este usuario datos propios en el dispositivo? Las recetas del catálogo que una versión anterior guardó en el dispositivo no cuentan
 * (no son del usuario), ni la lista de la compra vacía que se crea sola.
 */
export function hasUserData(storage: Storage, userId: string): boolean {
  for (const key of ["profile", "entries", "pantry", "weekplan", "measurements", "favorites", "water", "ratings", "mealFavorites"] as const) {
    if (!isEmpty(read(storage, userId, key))) return true;
  }
  const recipes = read(storage, userId, "recipes");
  if (Array.isArray(recipes)) {
    const isCatalog = (id: string) => CATALOG_IDS.has(id) || Object.hasOwn(RETIRED_RECIPE_IDS, id);
    if (recipes.some((r) => !isCatalog((r as { id?: string }).id ?? ""))) return true;
  }
  // loadShoppingState entiende también el formato anterior { current, usage }
  const shopping = loadShoppingState(read(storage, userId, "shopping"));
  return Object.values(shopping.weeks).some((w) => !isEmpty(w.bought) || !isEmpty(w.overrides) || !isEmpty(w.moved));
}

export interface LocalAccount {
  id: string;
  username: string;
  /** Es la cuenta de la última sesión local de este navegador: la que se sugiere traer. */
  lastSession: boolean;
}

/** Cuentas locales antiguas (mp_users) de este navegador, entre las que elegir los datos a traer. */
export function listLocalAccounts(storage: Storage): LocalAccount[] {
  try {
    const accounts = JSON.parse(storage.getItem("mp_users") ?? "[]") as { id: string; username: string }[];
    const session = JSON.parse(storage.getItem("mp_session") ?? "null") as { id?: string } | null;
    return accounts.map((a) => ({ id: a.id, username: a.username, lastSession: a.id === session?.id }));
  } catch {
    return [];
  }
}

/** Copia las claves de una cuenta local al usuario del servidor. Las originales se conservan hasta cerrar sesión (R12). */
export function adoptLocalData(storage: Storage, localId: string, serverId: string): void {
  for (const key of USER_DATA_KEYS) {
    const raw = storage.getItem(userKey(localId, key));
    if (raw !== null) storage.setItem(userKey(serverId, key), raw);
  }
}

/** R12: borra todo lo de este usuario (datos, metadatos de sync y copias *_v1_backup) y nada de los demás. */
export function clearUserData(storage: Storage, userId: string): void {
  const prefix = userKey(userId, "");
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(prefix)) doomed.push(k);
  }
  for (const k of doomed) storage.removeItem(k);
}
