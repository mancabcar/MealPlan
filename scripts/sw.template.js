// Plantilla del service worker (issue #21, docs/pm/21-pwa-recordatorios/tech.md).
// scripts/generate-sw.mjs sustituye los marcadores y la escribe en out/sw.js tras `next build`.
// - Assets (_next/static con hash, iconos, payloads del router): caché primero.
// - Páginas (navegación): red primero, con la caché como respaldo sin conexión.
// - Solo se atiende el mismo origen: las llamadas a la API del server/ de Vercel no pasan por aquí.
const VERSION = "__SW_VERSION__";
const PRECACHE = __SW_PRECACHE__;
const CACHE_PREFIX = "mealplan-";
const CACHE = CACHE_PREFIX + VERSION;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" salta la caché HTTP del hosting para no precachear ficheros viejos
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Con trailingSlash las páginas viven en /ruta/: /ruta (sin barra) se sirve desde /ruta/. */
function withTrailingSlash(pathname) {
  return pathname.endsWith("/") || /\.[a-z0-9]+$/i.test(pathname) ? pathname : pathname + "/";
}

async function fromCache(request, pathname) {
  const cache = await caches.open(CACHE);
  return (
    (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
    (pathname ? await cache.match(pathname, { ignoreSearch: true }) : undefined)
  );
}

async function navigate(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (err) {
    const cached = (await fromCache(request, withTrailingSlash(url.pathname))) || (await fromCache("/", "/"));
    if (cached) return cached;
    throw err;
  }
}

async function asset(request) {
  const cached = await fromCache(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  event.respondWith(request.mode === "navigate" ? navigate(request, url) : asset(request));
});
