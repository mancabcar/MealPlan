// Copia de seguridad de los datos del usuario (docs/pm/backup-datos). Funciones puras con el Storage inyectado:
// la página de Perfil les pasa localStorage y los tests uno en memoria.
import { userKey } from "./auth";
import { todayStr } from "./types";
import { USER_DATA_KEYS, type UserDataKey } from "./userData";

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
 * Lee las seis claves del usuario tal cual y omite las ausentes (R2, R3). Nunca lee credenciales, sesión,
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
