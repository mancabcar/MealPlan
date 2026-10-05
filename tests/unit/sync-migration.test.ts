// Spec: docs/pm/22-sincronizacion-dispositivos/spec.md › R6, R7, R12 y Edge cases.
// Tech: tech.md › Data model («Migración de cuentas locales») y Tasks 8–9. Funciones sin React (src/lib/syncMigration.ts)
// más el motor de sync; el servidor es el doble de tests/fixtures/fakeSyncBackend.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncEngine } from "@/lib/sync";
import {
  adoptLocalData,
  clearUserData,
  hasUserData,
  listLocalAccounts,
  planFirstSync,
} from "@/lib/syncMigration";
import { withSeedRecipes } from "@/lib/userData";
import { createFakeBackend, SYNC_KEYS, type FakeBackend } from "../fixtures/fakeSyncBackend";
import { ACCOUNT_A, ACCOUNT_A_DATA, ACCOUNT_B, ACCOUNT_B_DATA, OTHER_ACCOUNT } from "../fixtures/backup";

const SERVER_ID = "srv-1";
const k = (id: string, key: string) => `mp_${id}_${key}`;

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(key: string) {
    return this.m.get(key) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.m.delete(key);
  }
  setItem(key: string, value: string) {
    this.m.set(key, String(value));
  }
}

const ALL_A: Record<string, unknown> = { ...ACCOUNT_A_DATA, favorites: ["pollo-al-horno"], shopping: { current: { week: "2026-09-21", bought: { Brócoli: true }, overrides: [], moved: {} }, usage: {} } };

function seedLocal(storage: Storage, id: string, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) storage.setItem(k(id, key), JSON.stringify(value));
}
const keysOf = (storage: Storage) => Array.from({ length: storage.length }, (_, i) => storage.key(i)!).sort();

let storage: MemoryStorage;
let backend: FakeBackend;
beforeEach(() => {
  vi.useRealTimers();
  storage = new MemoryStorage();
  backend = createFakeBackend();
});

function engineFor(userId = SERVER_ID, user = "lucia") {
  return createSyncEngine({
    userId,
    storage,
    fetch: backend.fetch,
    apiBase: "https://api.example.test",
    token: backend.token(user),
    onRemoteChange: () => {},
    isVisible: () => true,
  });
}

describe("planFirstSync: qué hacer en el primer inicio de sesión de un dispositivo", () => {
  it("R6: datos locales y servidor vacío → subir", () => {
    expect(planFirstSync(true, false)).toBe("upload");
  });
  it("R7: datos en ambos lados → pedir confirmación (gana el servidor)", () => {
    expect(planFirstSync(true, true)).toBe("confirm");
  });
  it("dispositivo nuevo: sin datos locales y con datos en el servidor → bajar", () => {
    expect(planFirstSync(false, true)).toBe("download");
  });
  it("Edge: sin datos en ninguno de los dos → nada que hacer (perfil vacío, onboarding)", () => {
    expect(planFirstSync(false, false)).toBe("nothing");
  });
});

describe("hasUserData: qué cuenta como «hay datos locales»", () => {
  it("un almacenamiento vacío no tiene datos", () => {
    expect(hasUserData(storage, "acc-9d41e7")).toBe(false);
  });

  it("Edge: las recetas de ejemplo sembradas automáticamente no cuentan como datos del usuario", () => {
    seedLocal(storage, "acc-9d41e7", { recipes: withSeedRecipes([]), entries: [], pantry: [], weekplan: {} });
    expect(hasUserData(storage, "acc-9d41e7")).toBe(false);
  });

  it("perfil, diario, despensa, plan, medidas o una receta propia sí cuentan", () => {
    for (const key of ["profile", "entries", "pantry", "weekplan", "measurements"]) {
      const s = new MemoryStorage();
      seedLocal(s, "acc", { [key]: ALL_A[key] });
      expect(hasUserData(s, "acc"), key).toBe(true);
    }
    const s = new MemoryStorage();
    seedLocal(s, "acc", { recipes: [...withSeedRecipes([]), ACCOUNT_A_DATA.recipes[0]] });
    expect(hasUserData(s, "acc")).toBe(true);
  });

  it("R13 (#23): un dispositivo con solo agua guardada sí tiene datos propios", () => {
    const s = new MemoryStorage();
    seedLocal(s, "acc", { water: ACCOUNT_A_DATA.water });
    expect(hasUserData(s, "acc")).toBe(true);
  });

  it("solo mira los datos de ese usuario", () => {
    seedLocal(storage, OTHER_ACCOUNT.id, ALL_A);
    expect(hasUserData(storage, "acc-9d41e7")).toBe(false);
  });
});

describe("listLocalAccounts: cuentas locales entre las que elegir los datos a traer", () => {
  it("lista las cuentas de mp_users y marca como sugerida la de la última sesión local", () => {
    storage.setItem("mp_users", JSON.stringify([ACCOUNT_A, ACCOUNT_B].map((a) => ({ ...a, createdAt: "2026-09-01T00:00:00Z" }))));
    storage.setItem("mp_session", JSON.stringify({ id: ACCOUNT_B.id, username: ACCOUNT_B.username }));
    expect(listLocalAccounts(storage)).toEqual([
      { id: ACCOUNT_A.id, username: "lucia", lastSession: false },
      { id: ACCOUNT_B.id, username: "manuel", lastSession: true },
    ]);
  });

  it("sin cuentas locales devuelve una lista vacía", () => {
    expect(listLocalAccounts(storage)).toEqual([]);
  });
});

describe("R6: servidor vacío → se suben los datos locales sin pérdida", () => {
  it("R6: adoptar la cuenta local copia sus 9 claves bajo el id del servidor y no borra las originales", () => {
    seedLocal(storage, ACCOUNT_A.id, ALL_A);
    seedLocal(storage, OTHER_ACCOUNT.id, { entries: [{ id: "otro" }] });
    const before = keysOf(storage);
    adoptLocalData(storage, ACCOUNT_A.id, SERVER_ID);
    for (const key of SYNC_KEYS) expect(JSON.parse(storage.getItem(k(SERVER_ID, key))!), key).toEqual(ALL_A[key]);
    for (const original of before) expect(storage.getItem(original)).not.toBeNull();
    expect(storage.getItem(k(SERVER_ID, "entries"))).not.toContain("otro");
  });

  it("R6: tras adoptar y sincronizar, las 9 claves del servidor son idénticas a las locales", async () => {
    backend.seed("lucia", "secreto-123", {});
    seedLocal(storage, ACCOUNT_A.id, ALL_A);
    adoptLocalData(storage, ACCOUNT_A.id, SERVER_ID);
    expect(planFirstSync(hasUserData(storage, SERVER_ID), Object.keys(backend.dataOf("lucia")).length > 0)).toBe("upload");

    const engine = engineFor();
    for (const key of SYNC_KEYS) engine.markDirty(key);
    await engine.flush();

    for (const key of SYNC_KEYS) expect(backend.dataOf("lucia")[key].value, key).toEqual(ALL_A[key]);
    for (const key of SYNC_KEYS) expect(JSON.parse(storage.getItem(k(ACCOUNT_A.id, key))!), key).toEqual(ALL_A[key]);
    expect(engine.status).toBe("synced");
  });
});

describe("R7: datos en ambos lados → el servidor gana, con confirmación", () => {
  beforeEach(() => {
    backend.seed("lucia", "secreto-123", { ...ALL_A, entries: ACCOUNT_B_DATA.entries, pantry: ACCOUNT_B_DATA.pantry });
    seedLocal(storage, SERVER_ID, ALL_A);
    seedLocal(storage, SERVER_ID, { entries: [{ id: "solo-local", date: "2026-09-22", mealType: "Cena", customName: "Local", calories: 1, protein: 0, carbs: 0, fat: 0 }] });
  });

  it("R7: se detecta el caso de confirmación antes de cambiar nada", () => {
    const remote = Object.keys(backend.dataOf("lucia")).length > 0;
    expect(planFirstSync(hasUserData(storage, SERVER_ID), remote)).toBe("confirm");
    expect(JSON.parse(storage.getItem(k(SERVER_ID, "entries"))!)[0].id).toBe("solo-local");
  });

  it("R7: aceptar → pull adopta los datos del servidor en las claves que difieren", async () => {
    const changed: string[] = [];
    const engine = createSyncEngine({
      userId: SERVER_ID,
      storage,
      fetch: backend.fetch,
      apiBase: "https://api.example.test",
      token: backend.token("lucia"),
      onRemoteChange: (key) => changed.push(key),
      isVisible: () => true,
    });
    await engine.pull();
    expect(JSON.parse(storage.getItem(k(SERVER_ID, "entries"))!)).toEqual(ACCOUNT_B_DATA.entries);
    expect(JSON.parse(storage.getItem(k(SERVER_ID, "pantry"))!)).toEqual(ACCOUNT_B_DATA.pantry);
    expect(changed).toContain("entries");
    expect(changed).toContain("pantry");
  });
});

describe("R12: cerrar sesión limpia la copia local de ese usuario", () => {
  it("R12: clearUserData borra sus 9 claves, los metadatos de sync y las copias *_v1_backup, y nada más", () => {
    seedLocal(storage, SERVER_ID, ALL_A);
    storage.setItem(k(SERVER_ID, "syncmeta"), JSON.stringify({ versions: { entries: 3 }, pending: [] }));
    storage.setItem(k(SERVER_ID, "profile_v1_backup"), "{}");
    seedLocal(storage, OTHER_ACCOUNT.id, { entries: [{ id: "otro" }] });
    storage.setItem("mp_users", "[]");
    clearUserData(storage, SERVER_ID);
    expect(keysOf(storage).filter((key) => key.startsWith(`mp_${SERVER_ID}_`))).toEqual([]);
    expect(storage.getItem(k(OTHER_ACCOUNT.id, "entries"))).not.toBeNull();
    expect(storage.getItem("mp_users")).toBe("[]");
  });
});
