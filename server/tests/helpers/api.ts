// Utilidades de los tests de rutas de auth y sync (docs/pm/22-sincronizacion-dispositivos/tech.md › APIs / interfaces).
// El store se simula con el fake en memoria; las rutas (y scrypt) son las reales.
import { vi } from "vitest";

vi.mock("../../lib/store", async () => {
  const { createFakeStore } = await import("./fakeStore");
  return createFakeStore();
});

export const INVITE = "codigo-de-invitacion";
export const ORIGIN = "https://home.example";

const store = (await import("../../lib/store")) as unknown as ReturnType<typeof import("./fakeStore").createFakeStore>;
export const resetStore = () => store.__reset();
export const dumpStore = () => store.__dump();

export function useEnv() {
  process.env.REGISTRATION_CODE = INVITE;
  process.env.CORS_ALLOWED_ORIGIN = ORIGIN;
}

export function json(method: string, path: string, body?: unknown, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      origin: ORIGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
