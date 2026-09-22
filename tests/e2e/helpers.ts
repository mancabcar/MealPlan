import type { Page } from "@playwright/test";

export const USER_ID = "e2e-user";

/**
 * Deja al navegador con una sesión local iniciada (sin pasar por el login y su PBKDF2).
 * La sesión solo comprueba que el id exista en mp_users, así que el hash no importa.
 * Solo siembra una vez por contexto: los reload() conservan lo que la app haya guardado.
 */
export async function signIn(page: Page, data: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ userId, data }) => {
      if (localStorage.getItem("mp_users")) return;
      localStorage.setItem(
        "mp_users",
        JSON.stringify([{ id: userId, username: "lucia", salt: "00", hash: "00", createdAt: "2026-09-01T00:00:00Z" }]),
      );
      localStorage.setItem("mp_session", JSON.stringify({ id: userId, username: "lucia" }));
      for (const [k, v] of Object.entries(data)) localStorage.setItem(`mp_${userId}_${k}`, JSON.stringify(v));
    },
    { userId: USER_ID, data },
  );
}

export async function readStored<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(([k]) => JSON.parse(localStorage.getItem(k) ?? "null"), [`mp_${USER_ID}_${key}`]);
}
