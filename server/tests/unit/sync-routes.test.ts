// Spec: docs/pm/22-sincronizacion-dispositivos/spec.md › R3, R4, R5, R9 y Edge cases.
// Tech: tech.md › APIs / interfaces: GET /api/sync[?since=] y PUT /api/sync/[key] con baseVersion (409 = gana el servidor).
import { beforeEach, describe, expect, it } from "vitest";
import { INVITE, json, resetStore, useEnv } from "../helpers/api";
import { ACCOUNT_A_DATA } from "../../../tests/fixtures/backup";

const { POST: register } = await import("../../app/api/auth/register/route");
const { GET } = await import("../../app/api/sync/route");
const { PUT, OPTIONS } = await import("../../app/api/sync/[key]/route");

async function signUp(username: string): Promise<string> {
  const res = await register(json("POST", "/api/auth/register", { username, password: "secreto-123", invite: INVITE }));
  return (await res.json()).token;
}
const put = (key: string, token: string | undefined, value: unknown, baseVersion: number) =>
  PUT(json("PUT", `/api/sync/${key}`, { value, baseVersion }, token), { params: Promise.resolve({ key }) });
const get = (token: string | undefined, since?: Record<string, number>) =>
  GET(json("GET", `/api/sync${since ? `?since=${encodeURIComponent(JSON.stringify(since))}` : ""}`, undefined, token));

let a: string; // token de lucia
let b: string; // token de manuel
beforeEach(async () => {
  useEnv();
  resetStore();
  a = await signUp("lucia");
  b = await signUp("manuel");
});

describe("R3: bloques JSON con versión del servidor", () => {
  it("R3: la primera escritura de una clave (baseVersion 0) la guarda con versión 1", async () => {
    const res = await put("profile", a, ACCOUNT_A_DATA.profile, 0);
    expect(res.status).toBe(200);
    expect((await res.json()).version).toBe(1);
    expect((await (await get(a)).json()).profile).toEqual({ value: ACCOUNT_A_DATA.profile, version: 1 });
  });

  it("R3: cada una de las 10 claves se guarda (la décima, «ratings», es de #111) y se devuelve intacta", async () => {
    const values = { ...ACCOUNT_A_DATA, favorites: ["pollo-al-horno"], shopping: { current: { week: "2026-09-21", bought: {}, overrides: [], moved: {} }, usage: {} } };
    expect(Object.keys(values)).toHaveLength(10);
    for (const [key, value] of Object.entries(values)) expect((await put(key, a, value, 0)).status).toBe(200);
    const all = await (await get(a)).json();
    expect(Object.keys(all).sort()).toEqual(Object.keys(values).sort());
    for (const [key, value] of Object.entries(values)) expect(all[key].value).toEqual(value);
  });

  it("R3: el servidor ordena: la versión sube de uno en uno con cada escritura", async () => {
    await put("entries", a, [], 0);
    expect((await (await put("entries", a, ACCOUNT_A_DATA.entries, 1)).json()).version).toBe(2);
    expect((await (await put("entries", a, [], 2)).json()).version).toBe(3);
  });

  it("R3: una clave que no es de las 10 da 400 y no se guarda", async () => {
    expect((await put("mp_users", a, {}, 0)).status).toBe(400);
    expect(await (await get(a)).json()).toEqual({});
  });

  it("R3: un bloque de más de 1 MB da 413 y no se guarda", async () => {
    const big = [{ id: "x", customName: "x".repeat(1_000_001) }];
    expect((await put("entries", a, big, 0)).status).toBe(413);
    expect(await (await get(a)).json()).toEqual({});
  });
});

describe("R4: última escritura gana; un dispositivo desfasado adopta el servidor", () => {
  it("R4: dos dispositivos al día: la última escritura se queda", async () => {
    await put("pantry", a, [{ id: "p1" }], 0); // el PC escribe (v1); el móvil ya lo ha bajado
    expect((await put("pantry", a, [{ id: "p1" }, { id: "p2" }], 1)).status).toBe(200); // el móvil (v2)
    expect((await (await get(a)).json()).pantry.value).toEqual([{ id: "p1" }, { id: "p2" }]);
  });

  it("R4: con baseVersion desfasada responde 409 con el valor y la versión del servidor, y no escribe", async () => {
    await put("pantry", a, [{ id: "p1" }], 0);
    await put("pantry", a, [{ id: "p2" }], 1); // v2
    const stale = await put("pantry", a, [{ id: "viejo" }], 1);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ value: [{ id: "p2" }], version: 2 });
    expect((await (await get(a)).json()).pantry.version).toBe(2);
  });

  it("R4: crear una clave que ya existe con baseVersion 0 también es un conflicto (409)", async () => {
    await put("pantry", a, [{ id: "p1" }], 0);
    const res = await put("pantry", a, [{ id: "otro" }], 0);
    expect(res.status).toBe(409);
    expect((await res.json()).version).toBe(1);
  });

  it("R4: PUT con cuerpo inválido (sin baseVersion numérica) da 400", async () => {
    const res = await PUT(json("PUT", "/api/sync/pantry", { value: [] }, a), { params: Promise.resolve({ key: "pantry" }) });
    expect(res.status).toBe(400);
  });
});

describe("R5: GET devuelve solo lo que cambió desde las versiones conocidas", () => {
  it("R5: sin since devuelve todo; con since solo las claves más nuevas o desconocidas", async () => {
    await put("profile", a, ACCOUNT_A_DATA.profile, 0);
    await put("entries", a, [], 0);
    await put("entries", a, ACCOUNT_A_DATA.entries, 1); // entries v2
    const since = await (await get(a, { profile: 1, entries: 1 })).json();
    expect(Object.keys(since)).toEqual(["entries"]);
    expect(since.entries.version).toBe(2);
    expect(await (await get(a, { profile: 1, entries: 2 })).json()).toEqual({});
    expect(Object.keys(await (await get(a, { profile: 1 })).json())).toEqual(["entries"]);
  });

  it("R5: un since mal formado da 400", async () => {
    const res = await GET(json("GET", "/api/sync?since=no-es-json", undefined, a));
    expect(res.status).toBe(400);
  });
});

describe("R9: los datos son de cada usuario", () => {
  it("R9: sin token o con token inválido, GET y PUT dan 401", async () => {
    expect((await get(undefined)).status).toBe(401);
    expect((await put("profile", undefined, {}, 0)).status).toBe(401);
    expect((await put("profile", "no-existe", {}, 0)).status).toBe(401);
  });

  it("R9: el usuario B no ve lo de A, y las versiones de cada uno van aparte", async () => {
    await put("entries", a, ACCOUNT_A_DATA.entries, 0);
    expect(await (await get(b)).json()).toEqual({});
    expect((await put("entries", b, [], 0)).status).toBe(200); // B crea su propia "entries" con baseVersion 0
    expect((await (await get(a)).json()).entries.value).toEqual(ACCOUNT_A_DATA.entries);
  });
});

describe("CORS de las rutas de sync", () => {
  it("responde al preflight de PUT con Authorization permitido", async () => {
    const res = await OPTIONS(json("OPTIONS", "/api/sync/entries"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("las respuestas llevan Access-Control-Allow-Origin del origen del frontend", async () => {
    expect((await get(a)).headers.get("Access-Control-Allow-Origin")).toBe("https://home.example");
  });
});
