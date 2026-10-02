// Plantilla del service worker (issue #21, docs/pm/21-pwa-recordatorios/tech.md).
// scripts/generate-sw.mjs sustituye los marcadores y la escribe en out/sw.js tras `next build`.
// - Assets (lo precacheado y _next/static con hash): caché primero.
// - Páginas (navegación): red primero con un tiempo máximo; si falla o tarda, la caché.
// - Solo se atiende lo precacheado y _next/static: el resto (API del server/ de Vercel, otros orígenes) va a la red.
// - Al activarse una versión nueva se conserva la caché de la anterior: las pestañas que siguen abiertas con el
//   HTML viejo aún piden chunks con hash viejo, que ya no existen en el servidor (review de #92).
const VERSION = "__SW_VERSION__";
const PRECACHE = __SW_PRECACHE__;
const CACHE_PREFIX = "mealplan-";
const CACHE = CACHE_PREFIX + VERSION;
const PRECACHED = new Set(PRECACHE);
// Con mala cobertura la red no falla, solo tarda: pasado este tiempo se abre desde la caché
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" salta la caché HTTP del hosting para no precachear ficheros viejos
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

/** Cachés de otras versiones, de la más nueva a la más antigua (keys() las devuelve por orden de creación). */
async function otherCaches() {
  const keys = await caches.keys();
  return keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).reverse();
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    otherCaches()
      // se queda la versión anterior; las más antiguas ya no las usa ninguna pestaña
      .then((others) => Promise.all(others.slice(1).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Con trailingSlash las páginas viven en /ruta/: /ruta (sin barra) se sirve desde /ruta/. */
function withTrailingSlash(pathname) {
  return pathname.endsWith("/") || /\.[a-z0-9]+$/i.test(pathname) ? pathname : pathname + "/";
}

/** Busca primero en la caché actual y luego en la anterior. */
async function fromCache(request) {
  for (const name of [CACHE, ...(await otherCaches())]) {
    const cache = await caches.open(name);
    const hit = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
  }
  return undefined;
}

async function navigate(request, url) {
  const network = fetch(request);
  network.catch(() => {}); // si gana la caché, un fallo posterior de la red no debe quedar sin capturar
  const fallback = async () => (await fromCache(withTrailingSlash(url.pathname))) || (await fromCache("/"));
  const timedOut = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS, null));
  try {
    const response = await Promise.race([network, timedOut]);
    if (response) return response;
    return (await fallback()) || network;
  } catch (err) {
    const cached = await fallback();
    if (cached) return cached;
    throw err;
  }
}

async function asset(request, url) {
  const cached = await fromCache(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Los _next/static llevan hash en el nombre: un fichero que no estaba en el precache se puede guardar sin riesgo
  if (response.ok && url.pathname.startsWith("/_next/static/")) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
  } else if (PRECACHED.has(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(asset(request, url));
  }
});
