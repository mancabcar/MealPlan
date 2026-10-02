// Spec: docs/pm/21-pwa-recordatorios/spec.md › R1, R2, R4, R5, R6.
// R3 (instalar en Android, iPhone y PC + Lighthouse) es manual: no se puede automatizar.
// El service worker solo existe en el build (out/): CI ya sirve out/; en local, `npm run build && npx serve out -l 3000`
// y PWA_E2E=1. Con `next dev` esos tests se saltan; R5 no depende del SW y corre siempre.
import { expect, test, type Page } from "@playwright/test";
import { lucia } from "../fixtures/profiles";
import { readStored, signIn } from "./helpers";

const buildOnly = process.env.CI || process.env.PWA_E2E ? test : test.skip;

/** Espera a que el SW haya instalado el precache y controle la página. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      );
    }
  });
}

buildOnly("R1: el HTML enlaza el manifest y el icono de iOS, y el manifest es válido", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "MealPlanner", display: "standalone", start_url: "/" });
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

buildOnly("R2: los iconos del manifest existen como PNG", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

buildOnly("R4: tras una visita con red, las rutas principales abren sin conexión con los datos locales", async ({
  page,
  context,
}) => {
  await signIn(page, { profile: lucia });
  await page.goto("/");
  await waitForServiceWorker(page);

  await context.setOffline(true);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
  for (const route of ["/plan/", "/recetas/", "/despensa/"]) {
    await page.goto(route);
    await expect(page.getByRole("navigation", { name: "Navegación principal" }), route).toBeVisible();
  }
  await page.goto("/perfil/");
  await expect(page.getByRole("region", { name: "Datos corporales" })).toBeVisible();
  expect(await readStored(page, "profile")).toMatchObject({ name: "Lucía" });
});

buildOnly("R4: navegar dentro de la app sin conexión (enlaces de la barra) también funciona", async ({
  page,
  context,
}) => {
  await signIn(page, { profile: lucia });
  await page.goto("/");
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByRole("region", { name: "Datos corporales" })).toBeVisible();
});

buildOnly("R6: una versión nueva del service worker sustituye la caché vieja y conserva los datos", async ({
  page,
}) => {
  await signIn(page, { profile: lucia });
  await page.goto("/");
  await waitForServiceWorker(page);
  const before = await page.evaluate(() => caches.keys());
  expect(before.length).toBeGreaterThan(0);

  // Se publica un sw.js con otra versión (contrato: `const VERSION = "<hash>"` y cachés con la versión en el nombre).
  const original = await (await page.request.get("/sw.js")).text();
  const bumped = original.replace(/const VERSION = "[^"]*"/, 'const VERSION = "test-v2"');
  expect(bumped).not.toBe(original);
  await page.route("**/sw.js", (route) => route.fulfill({ contentType: "application/javascript", body: bumped }));

  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg!.update();
  });

  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).every((k) => k.includes("test-v2"))), {
      timeout: 15_000,
    })
    .toBe(true);
  expect(await page.evaluate(() => caches.keys())).not.toEqual(before);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
  expect(await readStored(page, "profile")).toMatchObject({ name: "Lucía" });
});

test("R5: sin conexión, «Sugerir con IA» avisa de que no hay conexión y la app sigue usable", async ({ page }) => {
  await signIn(page, { profile: lucia });
  await page.route("**/api/recipes", (route) => route.abort("internetdisconnected"));
  await page.goto("/recetas");

  await page.getByRole("button", { name: /Sugerir con IA/i }).first().click();

  await expect(page.getByText(/sin conexión/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sugerir con IA/i }).first()).toBeEnabled();
});
