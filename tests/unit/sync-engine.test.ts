// Spec: docs/pm/22-sincronizacion-dispositivos/spec.md › R4, R5, R8, R10, R11.
// Tech: tech.md › Design › Components (src/lib/sync.ts) y Testing strategy (Cliente). El motor no depende de React:
// storage, fetch, temporizadores y visibilidad se inyectan; el servidor es el doble de tests/fixtures/fakeSyncBackend.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncEngine } from "@/lib/sync";
import { createFakeBackend, SYNC_KEYS, type FakeBackend } from "../fixtures/fakeSyncBackend";
import { ACCOUNT_A_DATA } from "../fixtures/backup";

const U = "srv-1";
const API = "https://api.example.test";
const k = (key: string) => `mp_${U}_${key}`;

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

let backend: FakeBackend;
let storage: MemoryStorage;
let changed: string[];
let visible: boolean;
let unauthorized: number;

function makeEngine(over: Partial<Parameters<typeof createSyncEngine>[0]> = {}) {
  return createSyncEngine({
    userId: U,
    storage,
    fetch: backend.fetch,
    apiBase: API,
    token: backend.token("lucia"),
    onRemoteChange: (key) => changed.push(key),
    onUnauthorized: () => {
      unauthorized++;
    },
    isVisible: () => visible,
    ...over,
  });
}
const local = (key: string, value: unknown) => storage.setItem(k(key), JSON.stringify(value));
const stored = (key: string) => JSON.parse(storage.getItem(k(key)) ?? "null");
const puts = () => backend.requests.filter((r) => r.method === "PUT");

beforeEach(() => {
  vi.useFakeTimers();
  backend = createFakeBackend();
  backend.seed("lucia", "secreto-123", {});
  storage = new MemoryStorage();
  changed = [];
  visible = true;
  unauthorized = 0;
});
afterEach(() => vi.useRealTimers());

describe("R4: subir los cambios locales", () => {
  it("R4: espera 1 s sin más cambios y sube el valor más reciente de la clave en un solo PUT, con el token", async () => {
    const engine = makeEngine();
    local("pantry", [{ id: "p1" }]);
    engine.markDirty("pantry");
    local("pantry", ACCOUNT_A_DATA.pantry);
    engine.markDirty("pantry");
    engine.markDirty("pantry");
    await vi.advanceTimersByTimeAsync(900);
    expect(puts()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(puts()).toHaveLength(1);
    expect(puts()[0]).toMatchObject({ path: "/api/sync/pantry", body: { value: ACCOUNT_A_DATA.pantry, baseVersion: 0 } });
    expect(backend.dataOf("lucia").pantry).toEqual({ value: ACCOUNT_A_DATA.pantry, version: 1 });
    expect(engine.status).toBe("synced");
  });

  it("R4: lo que se manda lleva la cabecera Authorization: Bearer y va a apiBase", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), auth: new Headers(init?.headers).get("Authorization") });
      return backend.fetch(input, init);
    }) as typeof fetch;
    const token = backend.token("lucia");
    const engine = makeEngine({ fetch: spy, token });
    local("entries", ACCOUNT_A_DATA.entries);
    engine.markDirty("entries");
    await engine.flush();
    expect(seen[0]).toEqual({ url: `${API}/api/sync/entries`, auth: `Bearer ${token}` });
  });

  it("R4: la siguiente escritura de la misma clave usa la versión que devolvió el servidor como base", async () => {
    const engine = makeEngine();
    local("entries", []);
    engine.markDirty("entries");
    await engine.flush();
    local("entries", ACCOUNT_A_DATA.entries);
    engine.markDirty("entries");
    await engine.flush();
    expect(puts().map((p) => (p.body as { baseVersion: number }).baseVersion)).toEqual([0, 1]);
    expect(backend.dataOf("lucia").entries.version).toBe(2);
  });

  it("R4: cada clave pendiente se sube por separado y las no tocadas no se suben", async () => {
    const engine = makeEngine();
    local("entries", ACCOUNT_A_DATA.entries);
    local("pantry", ACCOUNT_A_DATA.pantry);
    local("profile", ACCOUNT_A_DATA.profile);
    engine.markDirty("entries");
    engine.markDirty("pantry");
    await engine.flush();
    expect(puts().map((p) => p.path).sort()).toEqual(["/api/sync/entries", "/api/sync/pantry"]);
  });

  it("R4: si el servidor responde 409 (base desfasada) adopta lo del servidor, avisa y queda al día", async () => {
    backend.remoteWrite("lucia", "pantry", [{ id: "del-pc" }]); // el PC subió pantry v1; este dispositivo no lo sabe
    const engine = makeEngine();
    local("pantry", [{ id: "del-movil" }]);
    engine.markDirty("pantry");
    await engine.flush();
    expect(stored("pantry")).toEqual([{ id: "del-pc" }]);
    expect(changed).toEqual(["pantry"]);
    expect(backend.dataOf("lucia").pantry).toEqual({ value: [{ id: "del-pc" }], version: 1 });
    expect(engine.status).toBe("synced");
    // la versión adoptada es la base de la siguiente escritura
    local("pantry", [{ id: "del-pc" }, { id: "nuevo" }]);
    engine.markDirty("pantry");
    await engine.flush();
    expect(backend.dataOf("lucia").pantry.version).toBe(2);
  });
});

describe("R5: bajar los cambios de otros dispositivos", () => {
  it("R5: pull escribe en el almacenamiento solo las claves más nuevas y avisa de cada una", async () => {
    backend.remoteWrite("lucia", "entries", ACCOUNT_A_DATA.entries);
    backend.remoteWrite("lucia", "profile", ACCOUNT_A_DATA.profile);
    const engine = makeEngine();
    await engine.pull();
    expect(stored("entries")).toEqual(ACCOUNT_A_DATA.entries);
    expect(stored("profile")).toEqual(ACCOUNT_A_DATA.profile);
    expect(changed.sort()).toEqual(["entries", "profile"]);

    changed.length = 0;
    await engine.pull(); // sin novedades: ni escribe ni avisa
    expect(changed).toEqual([]);
    backend.remoteWrite("lucia", "entries", []);
    await engine.pull();
    expect(changed).toEqual(["entries"]);
    expect(stored("entries")).toEqual([]);
  });

  it("R5: pide al servidor solo lo posterior a las versiones que ya conoce (since)", async () => {
    backend.remoteWrite("lucia", "entries", []);
    const engine = makeEngine();
    await engine.pull();
    await engine.pull();
    const gets = backend.requests.filter((r) => r.method === "GET");
    expect(gets).toHaveLength(2);
    expect(JSON.parse(new URLSearchParams(gets[1].search).get("since") ?? "{}")).toEqual({ entries: 1 });
  });

  it("R5: con start() consulta cada 15 s mientras la pestaña está visible y el cambio llega en ≤ 30 s", async () => {
    const engine = makeEngine();
    engine.start();
    backend.remoteWrite("lucia", "pantry", ACCOUNT_A_DATA.pantry);
    await vi.advanceTimersByTimeAsync(14_000);
    expect(changed).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000); // 16 s
    expect(changed).toEqual(["pantry"]);
    expect(stored("pantry")).toEqual(ACCOUNT_A_DATA.pantry);
    engine.stop();
  });

  it("R5: con la pestaña oculta no consulta; al volver a verse, la siguiente consulta recoge los cambios", async () => {
    const engine = makeEngine();
    engine.start();
    visible = false;
    backend.remoteWrite("lucia", "pantry", ACCOUNT_A_DATA.pantry);
    const before = backend.requests.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(backend.requests.length).toBe(before);
    visible = true;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(changed).toEqual(["pantry"]);
    engine.stop();
  });

  it("R5: stop() detiene el polling", async () => {
    const engine = makeEngine();
    engine.start();
    engine.stop();
    backend.remoteWrite("lucia", "pantry", ACCOUNT_A_DATA.pantry);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(changed).toEqual([]);
  });

  it("R5: pull() inmediato (al recuperar el foco) trae los cambios sin esperar al intervalo", async () => {
    const engine = makeEngine();
    backend.remoteWrite("lucia", "weekplan", ACCOUNT_A_DATA.weekplan);
    await engine.pull();
    expect(changed).toEqual(["weekplan"]);
  });
});

describe("R8 y R10: sin red la app sigue y avisa; al volver se pone al día sin pisar lo nuevo", () => {
  it("R8/R10: sin conexión el cambio local se conserva y el estado pasa a «unsynced»", async () => {
    const engine = makeEngine();
    expect(engine.status).toBe("synced");
    backend.setOnline(false);
    local("entries", ACCOUNT_A_DATA.entries);
    engine.markDirty("entries");
    await vi.advanceTimersByTimeAsync(1_100);
    expect(engine.status).toBe("unsynced");
    expect(stored("entries")).toEqual(ACCOUNT_A_DATA.entries);
    expect(changed).toEqual([]);
  });

  it("R8/R10: al volver la red el motor reintenta solo (polling) y vuelve a «synced»", async () => {
    const engine = makeEngine();
    engine.start();
    backend.setOnline(false);
    local("entries", ACCOUNT_A_DATA.entries);
    engine.markDirty("entries");
    await vi.advanceTimersByTimeAsync(1_100);
    expect(engine.status).toBe("unsynced");
    backend.setOnline(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(engine.status).toBe("synced");
    expect(backend.dataOf("lucia").entries.value).toEqual(ACCOUNT_A_DATA.entries);
    engine.stop();
  });

  it("R8: si el servidor tiene cambios más nuevos que los locales sin subir, gana el servidor (no se pisan)", async () => {
    const engine = makeEngine();
    await engine.pull();
    backend.setOnline(false);
    local("pantry", [{ id: "editado-sin-red" }]);
    engine.markDirty("pantry");
    await vi.advanceTimersByTimeAsync(1_100);
    backend.remoteWrite("lucia", "pantry", [{ id: "editado-en-el-pc" }]);
    backend.setOnline(true);
    await engine.flush();
    expect(backend.dataOf("lucia").pantry.value).toEqual([{ id: "editado-en-el-pc" }]);
    expect(stored("pantry")).toEqual([{ id: "editado-en-el-pc" }]);
    expect(changed).toEqual(["pantry"]);
    expect(engine.status).toBe("synced");
  });

  it("R8: los cambios sin subir sobreviven a una recarga y se suben cuando hay red", async () => {
    backend.setOnline(false);
    const first = makeEngine();
    local("entries", ACCOUNT_A_DATA.entries);
    first.markDirty("entries");
    await vi.advanceTimersByTimeAsync(1_100);
    first.stop();

    backend.setOnline(true);
    const reloaded = makeEngine(); // misma storage, motor nuevo (recarga de la pestaña)
    expect(reloaded.status).toBe("unsynced");
    await reloaded.flush();
    expect(backend.dataOf("lucia").entries.value).toEqual(ACCOUNT_A_DATA.entries);
    expect(reloaded.status).toBe("synced");
  });

  it("R8: un error del servidor (500) deja el cambio pendiente y el estado en «unsynced»", async () => {
    const failing = (async () => new Response("{}", { status: 500 })) as typeof fetch;
    const engine = makeEngine({ fetch: failing });
    local("entries", ACCOUNT_A_DATA.entries);
    engine.markDirty("entries");
    await engine.flush();
    expect(engine.status).toBe("unsynced");
    expect(stored("entries")).toEqual(ACCOUNT_A_DATA.entries);
  });

  it("Edge: con la sesión caducada (401) avisa con onUnauthorized y no pierde la copia local", async () => {
    const engine = makeEngine({ token: "caducado" });
    local("entries", ACCOUNT_A_DATA.entries);
    engine.markDirty("entries");
    await engine.flush();
    await engine.pull();
    expect(unauthorized).toBeGreaterThan(0);
    expect(stored("entries")).toEqual(ACCOUNT_A_DATA.entries);
  });
});

describe("R11: lo importado se sincroniza", () => {
  it("R11: marcar las 7 claves como pendientes sube las 7", async () => {
    const engine = makeEngine();
    const all: Record<string, unknown> = { ...ACCOUNT_A_DATA, shopping: { current: { week: "2026-09-21", bought: {}, overrides: [], moved: {} }, usage: {} } };
    for (const key of SYNC_KEYS) {
      local(key, all[key]);
      engine.markDirty(key);
    }
    await engine.flush();
    expect(puts()).toHaveLength(7);
    for (const key of SYNC_KEYS) expect(backend.dataOf("lucia")[key].value).toEqual(all[key]);
  });
});
