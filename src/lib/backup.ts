// Copia de seguridad de los datos del usuario (docs/pm/backup-datos). Funciones puras con el Storage inyectado:
// la página de Perfil les pasa localStorage y los tests uno en memoria.
import { userKey } from "./auth";
import { sanitizeMeasurements } from "./measurements";
import { PROFILE_SCHEMA_VERSION } from "./migrate";
import { todayStr } from "./types";
import { LOAD_OPTIONS, USER_DATA_KEYS, type UserData, type UserDataKey } from "./userData";

export const BACKUP_APP_ID = "mealplan";
/** Versión del FORMATO de copia, no del perfil (R3). */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  /** ISO 8601 */
  exportedAt: string;
  /** Cada dato tal como está guardado (R2); una clave ausente = vacío. */
  data: Partial<Record<UserDataKey, unknown>>;
}

/** "mealplan-backup-2026-09-24.json" con la fecha local (R1). */
export function backupFileName(today: string = todayStr()): string {
  return `mealplan-backup-${today}.json`;
}

/**
 * Lee las siete claves del usuario tal cual y omite las ausentes (R2, R3). Nunca lee credenciales, sesión,
 * usuarios recordados, copias *_v1_backup ni otras cuentas, y no escribe el id de la cuenta (R4).
 */
export function buildBackup(storage: Storage, userId: string, now: Date = new Date()): BackupFile {
  const data: BackupFile["data"] = {};
  for (const k of USER_DATA_KEYS) {
    const stored = storage.getItem(userKey(userId, k));
    if (stored === null) continue;
    try {
      data[k] = JSON.parse(stored);
    } catch {
      // Algo ilegible no se puede copiar; la carga de la app tampoco lo usa (vuelve al vacío)
    }
  }
  return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export type ParseResult = { ok: true; data: UserData; exportedAt: string } | { ok: false; error: string };

const NOT_JSON = "El fichero no es un JSON válido.";
const NOT_A_BACKUP = "Este fichero no es una copia de MealPlan.";
const NEWER_VERSION = "Esta copia es de una versión más nueva de la app.";
const BAD_FORMAT = "El fichero no tiene el formato esperado.";
const badSection = (k: UserDataKey) => `La sección «${k}» no tiene el formato esperado.`;

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const everyObject = (v: unknown, ok: (o: Obj) => boolean) => Array.isArray(v) && v.every((x) => isObject(x) && ok(x));
const hasId = (o: Obj) => isString(o.id);
const isStringList = (v: unknown) => Array.isArray(v) && v.every(isString);

/** Un perfil actual necesita los campos que leen las pantallas; uno v1 los completa la migración. */
function isProfile(v: unknown): boolean {
  if (v === null) return true;
  if (!isObject(v)) return false;
  if (v.schemaVersion === undefined) return true; // v1: se migra
  // Uno futuro no se "migra" como v1
  if (v.schemaVersion !== PROFILE_SCHEMA_VERSION) return false;
  const a = v.allergies;
  return (
    isString(v.name) &&
    isString(v.goal) &&
    isString(v.targetSource) &&
    isString(v.diet) &&
    isNumber(v.calorieGoal) &&
    isNumber(v.proteinGoal) &&
    isNumber(v.carbsGoal) &&
    isNumber(v.fatGoal) &&
    isStringList(v.meals) &&
    (v.meals as string[]).length > 0 &&
    isObject(a) &&
    isStringList(a.preset) &&
    isStringList(a.custom) &&
    isStringList(v.dislikedIngredients)
  );
}

/**
 * Forma mínima de cada sección para que las pantallas no se rompan (tech.md › Spec feedback 3), no un esquema
 * completo: los campos extra se conservan tal cual.
 */
const SECTION_SHAPE: Record<UserDataKey, (v: unknown) => boolean> = {
  profile: isProfile,
  recipes: (v) => everyObject(v, hasId),
  entries: (v) =>
    everyObject(
      v,
      (e) =>
        isString(e.id) &&
        isString(e.date) &&
        isString(e.mealType) &&
        isNumber(e.calories) &&
        isNumber(e.protein) &&
        isNumber(e.carbs) &&
        isNumber(e.fat),
    ),
  pantry: (v) => everyObject(v, hasId),
  weekplan: (v) =>
    isObject(v) && Object.values(v).every((day) => everyObject(day, (s) => isString(s.mealType) && isString(s.recipeId))),
  shopping: isObject,
  // Una medición que sanitizeMeasurements tiraría invalida la copia en vez de perderse en silencio (todo o nada, R8)
  measurements: (v) => Array.isArray(v) && sanitizeMeasurements(v).length === v.length,
};

/**
 * Todo o nada (R8): JSON → cabecera → forma de cada sección → migraciones de LOAD_OPTIONS (R7), todo en memoria.
 * Nunca toca el storage. Una sección ausente es un dato vacío.
 */
export function parseBackup(text: string): ParseResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_JSON };
  }
  if (!isObject(file) || file.app !== BACKUP_APP_ID) return { ok: false, error: NOT_A_BACKUP };
  const version = file.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return { ok: false, error: NOT_A_BACKUP };
  if (version > BACKUP_SCHEMA_VERSION) return { ok: false, error: NEWER_VERSION };
  const raw = file.data;
  if (!isObject(raw)) return { ok: false, error: NOT_A_BACKUP };

  for (const k of USER_DATA_KEYS) {
    if (Object.hasOwn(raw, k) && !SECTION_SHAPE[k](raw[k])) return { ok: false, error: badSection(k) };
  }

  try {
    const upgrade = <K extends UserDataKey>(k: K): UserData[K] =>
      LOAD_OPTIONS[k].upgrade(raw[k]) ?? LOAD_OPTIONS[k].fallback;
    const data: UserData = {
      profile: upgrade("profile"),
      recipes: upgrade("recipes"),
      entries: upgrade("entries"),
      pantry: upgrade("pantry"),
      weekplan: upgrade("weekplan"),
      shopping: upgrade("shopping"),
      measurements: upgrade("measurements"),
    };
    return { ok: true, data, exportedAt: isString(file.exportedAt) ? file.exportedAt : "" };
  } catch {
    return { ok: false, error: BAD_FORMAT };
  }
}

/**
 * Escribe las siete claves del usuario (y nada más). Si una escritura lanza (cuota llena), restaura en orden inverso
 * las ya escritas a su valor anterior, o las borra si no existían, y relanza: todo o nada (R8).
 */
export function writeUserData(storage: Storage, userId: string, data: UserData): void {
  const keys = USER_DATA_KEYS.map((k) => userKey(userId, k));
  const prev = keys.map((key) => storage.getItem(key));
  let written = 0;
  try {
    USER_DATA_KEYS.forEach((k, i) => {
      storage.setItem(keys[i], JSON.stringify(data[k]));
      written = i + 1;
    });
  } catch (err) {
    // Desde la que falló (índice `written`), por si un setItem que lanza dejara algo a medias
    for (let i = written; i >= 0; i--) {
      const old = prev[i];
      if (old === null) storage.removeItem(keys[i]);
      else storage.setItem(keys[i], old);
    }
    throw err;
  }
}

/** "2026-09-24T08:00:00.000Z" → "24/09/2026" en fecha local; "" si no es una fecha. */
export function formatExportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
