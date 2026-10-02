// Bug: si el store falla (BD sin configurar, sin tablas, conexión caída) las rutas lanzaban y Next respondía un 500 vacío;
// el cliente solo podía mostrar «Algo ha fallado». Contrato: error de servidor → 500 JSON con `error` legible (con CORS).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INVITE, json, ORIGIN, resetStore, useEnv } from "../helpers/api";

const store = await import("../../lib/store");
const { POST: register } = await import("../../app/api/auth/register/route");
const { POST: login } = await import("../../app/api/auth/login/route");
const { POST: logout } = await import("../../app/api/auth/logout/route");
const { GET: getSync } = await import("../../app/api/sync/route");

beforeEach(() => {
  useEnv();
  resetStore();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const boom = () => new Error("connection refused");

async function expectReadable500(res: Response) {
  expect(res.status).toBe(500);
  expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  const body = await res.json();
  expect(typeof body.error).toBe("string");
  expect(body.error.length).toBeGreaterThan(10);
  expect(body.error).not.toContain("connection refused"); // el detalle va al log, no al usuario
  expect(console.error).toHaveBeenCalled();
}

describe("fallos del store → 500 legible", () => {
  it("registro con el código correcto pero la BD caída", async () => {
    vi.spyOn(store, "countLoginFailures").mockRejectedValue(boom());
    const res = await register(json("POST", "/api/auth/register", { username: "lucia", password: "secreto123", invite: INVITE }));
    await expectReadable500(res);
  });

  it("registro: createUser lanza", async () => {
    vi.spyOn(store, "createUser").mockRejectedValue(boom());
    const res = await register(json("POST", "/api/auth/register", { username: "lucia", password: "secreto123", invite: INVITE }));
    await expectReadable500(res);
  });

  it("login", async () => {
    vi.spyOn(store, "countLoginFailures").mockRejectedValue(boom());
    await expectReadable500(await login(json("POST", "/api/auth/login", { username: "lucia", password: "secreto123" })));
  });

  it("logout", async () => {
    vi.spyOn(store, "getSession").mockRejectedValue(boom());
    await expectReadable500(await logout(json("POST", "/api/auth/logout", {}, "token-cualquiera")));
  });

  it("sync GET", async () => {
    vi.spyOn(store, "getSession").mockRejectedValue(boom());
    await expectReadable500(await getSync(json("GET", "/api/sync", undefined, "token-cualquiera")));
  });
});
