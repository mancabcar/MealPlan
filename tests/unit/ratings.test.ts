// Spec: docs/pm/111-recetas-valoracion-filtros/spec.md › R2 (la valoración persiste por usuario, entra en la copia de
// seguridad y en la sincronización, y se ignora para recetas que ya no existen).
// Tech: tech.md › Data model (`ratings: Record<string, 1–5>`, `sanitizeRatings`, schemaVersion 1) y APIs (SYNC_KEYS).
// Storage en memoria; ninguna prueba toca localStorage. Fallan hasta la tarea 1 del tech design.
import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, buildBackup, parseBackup, writeUserData } from "@/lib/backup";
import { EMPTY_USER_DATA, LOAD_OPTIONS, sanitizeRatings, USER_DATA_KEYS } from "@/lib/userData";
import { userKey } from "@/lib/auth";
import { SYNC_KEYS } from "../../server/lib/sync";

const U = "acc-rating";

class MemoryStorage implements Storage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name: string]: any;
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

const backupWith = (data: Record<string, unknown>) =>
  JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: "2026-10-05T10:00:00.000Z", data });

describe("R2: sanitizeRatings", () => {
  it("conserva las notas enteras de 1 a 5", () => {
    expect(sanitizeRatings({ a: 1, b: 3, c: 5 })).toEqual({ a: 1, b: 3, c: 5 });
  });
  it("descarta notas fuera de 1–5, no enteras o que no son números", () => {
    expect(sanitizeRatings({ a: 0, b: 6, c: 2.5, d: "4", e: null, f: -1, g: 4 })).toEqual({ g: 4 });
  });
  it("descarta ids vacíos", () => {
    expect(sanitizeRatings({ "": 3, ok: 3 })).toEqual({ ok: 3 });
  });
  it.each([null, undefined, "a", 5, ["a", 3], true])("%j no es un objeto de notas: queda vacío", (raw) => {
    expect(sanitizeRatings(raw)).toEqual({});
  });
});

describe("R2: ratings es una clave más de los datos del usuario", () => {
  it("USER_DATA_KEYS incluye ratings detrás de water (al final va mealFavorites, #55) y EMPTY_USER_DATA la deja vacía", () => {
    expect(USER_DATA_KEYS).toHaveLength(11);
    expect(USER_DATA_KEYS.indexOf("ratings")).toBe(USER_DATA_KEYS.indexOf("water") + 1);
    expect(EMPTY_USER_DATA.ratings).toEqual({});
  });
  it("LOAD_OPTIONS.ratings: vacía sin nada guardado y saneada al cargar", () => {
    expect(LOAD_OPTIONS.ratings.fallback).toEqual({});
    expect(LOAD_OPTIONS.ratings.upgrade({ x: 4, y: 9 })).toEqual({ x: 4 });
  });
});

describe("R2: el servidor de sincronización conoce las mismas claves que el cliente", () => {
  it("SYNC_KEYS (server/lib/sync.ts) coincide con USER_DATA_KEYS e incluye ratings", () => {
    expect([...SYNC_KEYS]).toEqual([...USER_DATA_KEYS]);
    expect(SYNC_KEYS).toContain("ratings");
  });
});

describe("R2: copia de seguridad con valoraciones", () => {
  it("buildBackup lee la clave mp_<id>_ratings tal cual y omite la ausente", () => {
    const st = new MemoryStorage();
    expect(buildBackup(st, U).data.ratings).toBeUndefined();
    st.setItem(userKey(U, "ratings"), JSON.stringify({ "f-puerros": 4, "f-yogur": 2 }));
    expect(buildBackup(st, U).data.ratings).toEqual({ "f-puerros": 4, "f-yogur": 2 });
  });

  it("ida y vuelta: exportar, importar y escribir devuelve las mismas notas", () => {
    const src = new MemoryStorage();
    src.setItem(userKey(U, "ratings"), JSON.stringify({ a: 5, b: 1 }));
    const text = JSON.stringify(buildBackup(src, U));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.data.ratings).toEqual({ a: 5, b: 1 });

    const dst = new MemoryStorage();
    writeUserData(dst, "otro", parsed.data);
    expect(JSON.parse(dst.getItem(userKey("otro", "ratings"))!)).toEqual({ a: 5, b: 1 });
  });

  it("una copia anterior sin ratings carga con las notas vacías, sin error", () => {
    const result = parseBackup(backupWith({ favorites: ["a"] }));
    if (!result.ok) throw new Error(result.error);
    expect(result.data.ratings).toEqual({});
  });

  it("una sección de ratings que no es un objeto invalida la copia entera", () => {
    const result = parseBackup(backupWith({ ratings: [4, 5] }));
    expect(result).toEqual({ ok: false, error: "La sección «ratings» no tiene el formato esperado." });
  });

  it("las notas mal formadas de una copia se descartan al importar, sin invalidarla", () => {
    const result = parseBackup(backupWith({ ratings: { a: 4, b: 9, c: "x" } }));
    if (!result.ok) throw new Error(result.error);
    expect(result.data.ratings).toEqual({ a: 4 });
  });
});
