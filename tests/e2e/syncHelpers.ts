// Ayudas de los e2e de sincronización (docs/pm/22-sincronizacion-dispositivos/tech.md › Testing strategy › E2E).
// La API se intercepta con page.route y la contesta el doble de tests/fixtures/fakeSyncBackend.ts: ningún e2e toca
// una red ni una BD reales. Cada BrowserContext es "un dispositivo": su localStorage es propio y el backend, común.
import type { BrowserContext, Page } from "@playwright/test";
import { TODAY } from "./helpers";
import type { FakeBackend } from "../fixtures/fakeSyncBackend";
import { INVITE_CODE } from "../fixtures/fakeSyncBackend";

export { INVITE_CODE };

/** Redirige /api/auth/** y /api/sync/** (venga de la base que venga) al servidor simulado; sin red → la petición falla. */
export async function mockBackend(context: BrowserContext, backend: FakeBackend) {
  await context.route(/\/api\/(auth|sync)(\/|\?|$)/, async (route) => {
    if (!backend.online) return route.abort("internetdisconnected");
    const req = route.request();
    const res = backend.handle(req.method(), new URL(req.url()), req.headers(), req.postDataJSON() ?? undefined);
    await route.fulfill({ status: res.status, contentType: "application/json", body: JSON.stringify(res.body) });
  });
}

export const LOCAL_ID = "local-acc-1";

/** Un dispositivo con una cuenta local antigua (mp_users) y sus datos, sin sesión del servidor: lo que hay hoy. */
export async function seedLocalDevice(page: Page, data: Record<string, unknown>) {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
  await page.addInitScript(
    ({ id, data }) => {
      if (localStorage.getItem("mp_users")) return;
      localStorage.setItem(
        "mp_users",
        JSON.stringify([{ id, username: "lucia", salt: "00", hash: "00", createdAt: "2026-09-01T00:00:00Z" }]),
      );
      localStorage.setItem("mp_session", JSON.stringify({ id, username: "lucia" }));
      for (const [k, v] of Object.entries(data)) localStorage.setItem(`mp_${id}_${k}`, JSON.stringify(v));
    },
    { id: LOCAL_ID, data },
  );
}

/** Un dispositivo sin nada guardado. */
export async function emptyDevice(page: Page) {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
}

export const stored = <T = unknown>(page: Page, userId: string, key: string) =>
  page.evaluate(([k]) => JSON.parse(localStorage.getItem(k) ?? "null") as T, [`mp_${userId}_${key}`]);

/** Contrato de UI de Login (tech.md › UI): Usuario, Contraseña, Repite la contraseña, Código de invitación. */
export async function register(page: Page, username: string, password: string, invite = INVITE_CODE) {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "¿No tienes cuenta? Regístrate" });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repite la contraseña").fill(password);
  await page.getByLabel("Código de invitación").fill(invite);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

export async function login(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
