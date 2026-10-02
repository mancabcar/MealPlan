// Spec: docs/pm/20-recetas-filtros/spec.md › R4 (los favoritos persisten por usuario y entran en la copia de seguridad).
// Tech: docs/pm/20-recetas-filtros/tech.md › Data model (`favorites: string[]`, `sanitizeFavorites`, schemaVersion 1) y
// Testing strategy (unit). Storage en memoria; ninguna prueba toca localStorage. Fallan hasta la tarea 1.
import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, buildBackup, parseBackup, writeUserData } from "@/lib/backup";
import { EMPTY_USER_DATA, LOAD_OPTIONS, sanitizeFavorites, USER_DATA_KEYS } from "@/lib/userData";
import { userKey } from "@/lib/auth";

const U = "acc-fav";

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
  JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: "2026-09-22T10:00:00.000Z", data });

describe("R4: sanitizeFavorites", () => {
  it("conserva una lista de ids y quita duplicados manteniendo el orden", () => {
    expect(sanitizeFavorites(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
  it("descarta lo que no sea un string", () => {
    expect(sanitizeFavorites(["a", 3, null, { id: "x" }, "", "b"])).toEqual(["a", "b"]);
  });
  it.each([null, undefined, "a", 5, { a: 1 }])("%j no es una lista: queda vacío", (raw) => {
    expect(sanitizeFavorites(raw)).toEqual([]);
  });
});

describe("R4: favorites es una clave más de los datos del usuario", () => {
  it("USER_DATA_KEYS incluye favorites y EMPTY_USER_DATA la deja vacía", () => {
    expect(USER_DATA_KEYS).toContain("favorites");
    expect(EMPTY_USER_DATA.favorites).toEqual([]);
  });
  it("LOAD_OPTIONS.favorites: vacía sin nada guardado y saneada al cargar", () => {
    expect(LOAD_OPTIONS.favorites.fallback).toEqual([]);
    expect(LOAD_OPTIONS.favorites.upgrade(["x", "x", 1])).toEqual(["x"]);
  });
});

describe("R4: copia de seguridad con favoritos", () => {
  it("buildBackup lee la clave mp_<id>_favorites tal cual y omite la ausente", () => {
    const st = new MemoryStorage();
    expect(buildBackup(st, U).data.favorites).toBeUndefined();
    st.setItem(userKey(U, "favorites"), JSON.stringify(["f-puerros", "f-yogur"]));
    expect(buildBackup(st, U).data.favorites).toEqual(["f-puerros", "f-yogur"]);
  });

  it("ida y vuelta: exportar, importar y escribir devuelve los mismos favoritos", () => {
    const src = new MemoryStorage();
    src.setItem(userKey(U, "favorites"), JSON.stringify(["f-puerros", "f-yogur"]));
    const parsed = parseBackup(JSON.stringify(buildBackup(src, U)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.favorites).toEqual(["f-puerros", "f-yogur"]);

    const dst = new MemoryStorage();
    writeUserData(dst, "acc-destino", parsed.data);
    expect(JSON.parse(dst.getItem(userKey("acc-destino", "favorites"))!)).toEqual(["f-puerros", "f-yogur"]);
  });

  it("una copia anterior sin la clave deja los favoritos vacíos, sin error", () => {
    const parsed = parseBackup(backupWith({ pantry: [] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.favorites).toEqual([]);
  });

  it("la copia sigue en schemaVersion 1 (decisión del tech design: no se sube)", () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(1);
    expect(buildBackup(new MemoryStorage(), U).schemaVersion).toBe(1);
  });

  it("una sección favorites que no es una lista de strings invalida la copia entera (todo o nada)", () => {
    for (const bad of [{ a: 1 }, "f-puerros", [1, 2], [{ id: "x" }]]) {
      const parsed = parseBackup(backupWith({ favorites: bad }));
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toContain("favorites");
    }
  });

  it("writeUserData escribe favorites junto al resto y nada fuera de las claves del usuario", () => {
    const st = new MemoryStorage();
    st.setItem("mp_otra-cuenta_favorites", JSON.stringify(["no-tocar"]));
    writeUserData(st, U, { ...EMPTY_USER_DATA, favorites: ["f-pudin"] });
    expect(JSON.parse(st.getItem(userKey(U, "favorites"))!)).toEqual(["f-pudin"]);
    expect(JSON.parse(st.getItem("mp_otra-cuenta_favorites")!)).toEqual(["no-tocar"]);
  });

  it("cuenta aparte: los favoritos de otra cuenta no entran en la copia", () => {
    const st = new MemoryStorage();
    st.setItem(userKey(U, "favorites"), JSON.stringify(["mia"]));
    st.setItem(userKey("acc-otra", "favorites"), JSON.stringify(["de-otra"]));
    expect(buildBackup(st, U).data.favorites).toEqual(["mia"]);
  });
});
