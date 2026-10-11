// Spec: docs/pm/55-mis-alimentos/spec.md › R6 (los favoritos se sincronizan y entran en la copia de seguridad; una copia
// antigua sin ellos se importa sin error). Tech: tech.md › Data model (undécima clave `mealFavorites`, detrás de `ratings` de #111) y Components & files
// (USER_DATA_KEYS, SYNC_KEYS del servidor, SECTION_SHAPE, hasUserData).
// Fallan hasta la tarea 2 del tech design.
import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, buildBackup, parseBackup } from "@/lib/backup";
import { hasUserData } from "@/lib/syncMigration";
import { EMPTY_USER_DATA, USER_DATA_KEYS } from "@/lib/userData";
import { SYNC_KEYS as SERVER_SYNC_KEYS } from "../../server/lib/sync";
import { SYNC_KEYS as FAKE_SYNC_KEYS } from "../fixtures/fakeSyncBackend";
import { AVENA_FAV, HUEVOS_FAV, TORTILLA_FAV, TOSTADA_FAV } from "../fixtures/favoritos-anadir";

const FAVS = [TORTILLA_FAV, TOSTADA_FAV, AVENA_FAV, HUEVOS_FAV];

function backupWith(data: Record<string, unknown>): string {
  return JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: "2026-10-10T10:00:00.000Z", data });
}

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe("R6: «mealFavorites» es la undécima clave de los datos del usuario", () => {
  it("va al final de USER_DATA_KEYS, detrás de «water»", () => {
    expect(USER_DATA_KEYS).toHaveLength(11);
    expect(USER_DATA_KEYS.at(-1)).toBe("mealFavorites");
  });

  it("vacía por defecto", () => {
    expect(EMPTY_USER_DATA.mealFavorites).toEqual([]);
  });

  it("R6: el servidor la sincroniza (SYNC_KEYS = USER_DATA_KEYS, también en el backend simulado)", () => {
    expect([...SERVER_SYNC_KEYS]).toEqual([...USER_DATA_KEYS]);
    expect([...FAKE_SYNC_KEYS]).toEqual([...USER_DATA_KEYS]);
  });
});

describe("R6: los favoritos viajan en la copia de seguridad", () => {
  it("R6: exportar e importar devuelve los favoritos con sus datos", () => {
    const storage = memoryStorage();
    storage.setItem("mp_u_mealFavorites", JSON.stringify(FAVS));
    const file = buildBackup(storage, "u");
    expect(file.data.mealFavorites).toEqual(FAVS);

    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.data.mealFavorites).toEqual(FAVS);
  });

  it("R6: una copia antigua sin «mealFavorites» se importa sin error y la lista queda vacía", () => {
    const parsed = parseBackup(backupWith({ favorites: ["t-pollo-curry"] }));
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.data.mealFavorites).toEqual([]);
    expect(parsed.ok && parsed.data.favorites).toEqual(["t-pollo-curry"]);
  });

  it("una sección «mealFavorites» que no es una lista de objetos con id y kind invalida la copia (todo o nada)", () => {
    expect(parseBackup(backupWith({ mealFavorites: "Tortilla" }))).toEqual({ ok: false, error: "La sección «mealFavorites» no tiene el formato esperado." });
    expect(parseBackup(backupWith({ mealFavorites: [{ name: "Tortilla" }] }))).toEqual({
      ok: false,
      error: "La sección «mealFavorites» no tiene el formato esperado.",
    });
  });
});

describe("R6: primera sincronización", () => {
  it("un dispositivo con solo favoritos de comidas tiene datos propios (hasUserData)", () => {
    const storage = memoryStorage();
    storage.setItem("mp_u_mealFavorites", JSON.stringify([TORTILLA_FAV]));
    expect(hasUserData(storage, "u")).toBe(true);
  });
});
