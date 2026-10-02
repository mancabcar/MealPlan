// Spec: docs/pm/21-pwa-recordatorios/spec.md › R1, R2, R4, R5, R6.
// R3 (instalar en Android, iPhone y PC + Lighthouse) es manual: no se puede automatizar.
// El service worker solo existe en el build (out/): CI ya sirve out/; en local, `npm run build && npx serve out -l 3000`
// y PWA_E2E=1. Con `next dev` esos tests se saltan; R5 no depende del SW y corre siempre.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
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

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Sirve out/ en un puerto propio para poder "publicar" otro sw.js a mitad del test: Playwright no intercepta
 * la descarga del sw.js que hace el navegador al buscar versiones nuevas (ni con page.route ni con context.route).
 */
async function serveOut(swOverride: { body?: string }) {
  const root = path.resolve("out");
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = path.join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname);
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const body = pathname === "/sw.js" && swOverride.body ? swOverride.body : fs.readFileSync(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://localhost:${port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

buildOnly("R6: una versión nueva del service worker sustituye la caché vieja y conserva los datos", async ({ page }) => {
  const swOverride: { body?: string } = {};
  const site = await serveOut(swOverride);
  try {
    await runUpdateScenario(page, site.url, swOverride);
  } finally {
    await site.close();
  }
});

async function runUpdateScenario(page: Page, base: string, swOverride: { body?: string }) {
  await signIn(page, { profile: lucia });
  await page.goto(`${base}/`);
  await waitForServiceWorker(page);
  const before = await page.evaluate(() => caches.keys());
  expect(before.length).toBeGreaterThan(0);

  // Se publica un sw.js con otra versión (contrato: `const VERSION = "<hash>"` y cachés con la versión en el nombre).
  const original = await (await page.request.get(`${base}/sw.js`)).text();
  swOverride.body = original.replace(/const VERSION = "[^"]*"/, 'const VERSION = "test-v2"');
  expect(swOverride.body).not.toBe(original);

  const checkForUpdate = async () => {
    // update() no hace nada mientras haya una versión instalándose o a medio activar
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return reg!.active?.state === "activated" && !reg!.installing && !reg!.waiting;
        }),
      )
      .toBe(true);
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg!.update();
    });
  };
  const cacheKeys = () => page.evaluate(() => caches.keys());

  await checkForUpdate();
  await expect.poll(async () => (await cacheKeys()).some((k) => k.includes("test-v2")), { timeout: 15_000 }).toBe(true);
  // Review #92: la caché de la versión anterior se conserva (las pestañas abiertas aún piden sus chunks con hash viejo)
  expect(await cacheKeys()).toEqual(expect.arrayContaining(before));

  // …y una segunda actualización ya borra la más antigua
  swOverride.body = original.replace(/const VERSION = "[^"]*"/, 'const VERSION = "test-v3"');
  await checkForUpdate();
  await expect.poll(async () => (await cacheKeys()).some((k) => k.includes("test-v3")), { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await cacheKeys()).length, { timeout: 15_000 }).toBe(2);
  const after = await cacheKeys();
  expect(after.some((k) => before.includes(k))).toBe(false);
  expect(after.some((k) => k.includes("test-v2"))).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
  expect(await readStored(page, "profile")).toMatchObject({ name: "Lucía" });
}

test("R7 (review #92): si el navegador ofrece instalar antes de abrir Perfil, el botón aparece al llegar", async ({
  page,
}) => {
  await signIn(page, { profile: lucia });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diario" })).toBeVisible();
  await page.evaluate(() => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });

  await page.getByRole("link", { name: "Perfil" }).click(); // navegación del cliente: el módulo no se recarga
  const card = page.getByRole("region", { name: "Instalar app" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Instalar app" }).click();
  await expect(card).toHaveCount(0);
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
