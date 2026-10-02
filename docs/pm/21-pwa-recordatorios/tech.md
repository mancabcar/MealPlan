# PWA instalable y offline: Technical design
_Status: Draft · Updated: 2026-10-02_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Se añade un manifest (`src/app/manifest.ts`), iconos generados con un script de Playwright y un service worker escrito a mano (`public/sw.js` a partir de una plantilla) cuyo precache lo genera un script posterior al build. El script se encadena al `npm run build` que ya ejecuta IONOS. Sin dependencias nuevas ni cambios de datos. Esfuerzo: M.

## Context
- **Stack:** Next 16.2.9 (App Router, `output: "export"`, `trailingSlash: true` en `next.config.ts`), React 19, Tailwind 4. Tests: Vitest en `tests/unit/`, Playwright en `tests/e2e/`; CI en `.github/workflows/ci.yml`. En CI, `playwright.config.ts` sirve `out/` con `npx serve@latest`; en local usa `npm run dev`.
- **Despliegue:** IONOS Deploy Now ejecuta `npm ci && npm run build` y publica `out/` en la raíz del dominio (`https://home-5021533470.app-ionos.space/`). No se puede cambiar su pipeline ni confiar en `.htaccess`.
- **Next:** la guía local (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) y `.../metadata/manifest.md` documentan `app/manifest.ts` y un `public/sw.js`. Los Route Handlers GET sin `Request` se renderizan estáticos en el export (`static-exports.md`).
- **Capa visual:** tema oscuro con `--color-bg: #0a0a0a` y acento `--color-accent: #c8ff5c` (`src/app/globals.css`). `src/app/layout.tsx` solo tiene título y descripción en `metadata`; no hay iconos aparte de `src/app/favicon.ico`.
- **Rutas con red:** `src/lib/apiBase.ts` (`apiUrl`) hacia el `server/` de Vercel; `src/lib/useBrandSearch.ts` ya tiene un estado `"offline"`; `src/app/recetas/page.tsx:85` captura errores del `fetch`.
- **Perfil:** `src/app/perfil/page.tsx` y `src/components/perfil/` (p. ej. `DataSection.tsx`).

## Approaches considered
### A. `sw.js` propio + script que genera el precache (chosen)
Plantilla `scripts/sw.template.js` y `scripts/generate-sw.mjs`, que tras `next build` recorre `out/`, calcula un hash del build y escribe `out/sw.js` con la lista de URLs a precachear. · **Pros:** sin dependencias; cubre cualquier ruta (R4); versión y actualización controladas (R6); reutilizable por el push de la entrega 2. · **Cons:** código de caché propio que mantener y probar. · **Effort** M.

Elegido por Manuel (coincide con la recomendación).

### B. Serwist
Librería con la misma función. · **Pros:** mantenida. · **Cons:** integración con Turbopack y export estático dudosa. · **Effort** M, con más riesgo. Descartada por Manuel.

### C. Solo caché en ejecución
Se cachea lo que se visita. · **Pros:** muy simple. · **Cons:** incumple R4 en rutas no visitadas. · **Effort** S. Descartada.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Iconos | `public/icons/icon.svg` (fuente), `scripts/generate-icons.mjs`, `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | Símbolo sencillo en lima sobre `#0a0a0a`; Playwright rasteriza el SVG; los PNG se commitean (R2). |
| Manifest | `src/app/manifest.ts` | `name`/`short_name` «MealPlanner», `display: standalone`, `start_url: "/"`, `background_color`/`theme_color`, iconos (R1). Se verifica que el build emita `out/manifest.webmanifest`. |
| Layout | `src/app/layout.tsx` | `metadata`: `appleWebApp`, `icons.apple`; `viewport.themeColor`. Monta `ServiceWorkerRegister` (R3, R4). |
| SW registro | `src/components/ServiceWorkerRegister.tsx` | Componente cliente; registra `/sw.js` solo si `process.env.NODE_ENV === "production"`, con `updateViaCache: "none"` (R4, R6). |
| SW | `scripts/sw.template.js`, `scripts/generate-sw.mjs` | Genera `out/sw.js` con versión de caché (hash del build) y lista de precache; limpia cachés antiguas al activar; `skipWaiting` y `clients.claim`; assets `_next/static` cache-first; navegaciones network-first con respaldo de caché y de `/`; ignora peticiones no `GET` y a otros orígenes (API) (R4, R6). |
| Build | `package.json` | `"build": "next build && node scripts/generate-sw.mjs"` (R4, R6). |
| Sin red | `src/app/recetas/page.tsx`, `src/lib/useBarcodeLookup.ts`, `src/components/...` | Revisar que IA, búsqueda y escáner muestren «sin conexión» y no rompan (R5). |
| Instalar | `src/lib/useInstallPrompt.ts`, `src/components/perfil/InstallSection.tsx`, `src/app/perfil/page.tsx` | Captura `beforeinstallprompt`; botón «Instalar app» que no se muestra si no hay evento o ya está instalada (R7). |
| Tests | `tests/unit/generate-sw.test.ts`, `tests/e2e/pwa.spec.ts`, `playwright.config.ts` | Unit: lista de precache y hash. E2E sobre `out/` con `context.setOffline(true)`. |
| CI | `.github/workflows/ci.yml` | El e2e PWA corre tras `npm run build` (ya existe) contra `out/`. |
| Docs | `README.md` | Instalar, offline y la limitación de iOS (expulsión de datos). |

### Data model
Ninguno. Los datos siguen en `localStorage`; la caché solo guarda ficheros de la app.

### APIs / interfaces
- **`/sw.js`** (generado en el build) y **`/manifest.webmanifest`**, servidos por el hosting estático.
- Sin endpoints nuevos. Las peticiones a la API de Vercel (otro origen) no pasan por la caché.

### UI
Sin pantallas nuevas salvo una tarjeta «Instalar app» en Perfil (R7), siguiendo el estilo de las secciones de `src/components/perfil/`. Sin prototipo (decidido en el brief).

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `src/app/manifest.ts`; test e2e comprueba `manifest.webmanifest`. |
| R2 | `scripts/generate-icons.mjs` y PNG en `public/icons/`; `icons.apple` en el layout. |
| R3 | Manifest + SW + metadatos de iPhone; verificación manual en los 3 dispositivos y Lighthouse. |
| R4 | Precache de todas las rutas de `out/` + respaldo de navegación; e2e offline. |
| R5 | Revisión de los flujos con red y mensaje «sin conexión»; test e2e con `setOffline`. |
| R6 | Versión de caché por hash, limpieza al activar, `skipWaiting`, `updateViaCache: "none"`; e2e de actualización. |
| R7 | `useInstallPrompt` y `InstallSection`; oculto si el navegador no lo permite. |

## Risks & mitigations
- Un service worker defectuoso puede dejar una app rota. Mitigación: versión de caché por hash, limpieza al activar, e2e de carga tras actualizar. **Aceptado.**
- Apache puede servir `sw.js` con caché HTTP larga. Mitigación: `updateViaCache: "none"`; no se añade `.htaccess`. **Aceptado.**
- El escáner (`barcode-detector`) puede traer su WASM de un CDN y fallar sin red. Se comprueba al implementar; si es así, R5 muestra «sin conexión». **Aceptado.**
- El script posterior al build no se puede probar en el pipeline de IONOS. Mitigación: validarlo en el CI, que ejecuta el mismo `npm run build`. **Aceptado.**
- iOS expulsa caché y `localStorage` de PWAs poco usadas. Fuera de alcance (spec); se documenta.

## Testing strategy
- **Unit (Vitest):** `generate-sw` produce lista de precache con todas las rutas, hash estable y distinto al cambiar un fichero.
- **E2E (Playwright, solo CI, sobre `out/`):** primera carga con red → `setOffline(true)` → abre rutas principales (R4); tras publicar una versión distinta se recibe en la siguiente apertura y los datos persisten (R6); acciones con red muestran «sin conexión» (R5); el manifest es válido (R1).
- **Manual:** instalar y abrir en Android, iPhone y PC (R3); Lighthouse «instalable».

## Tasks
1. [x] Iconos: `icon.svg`, `scripts/generate-icons.mjs` y PNG en `public/icons/` (covers R2)
2. [x] `manifest.ts` y metadatos de iPhone y `theme-color` en el layout (covers R1, R3)
3. [x] `scripts/generate-sw.mjs`, plantilla `sw.js`, hook en `build` y test unitario (covers R4, R6)
4. [x] `ServiceWorkerRegister` en el layout (covers R4, R6)
5. [x] Revisar y ajustar los mensajes «sin conexión» de IA, búsqueda y escáner (covers R5)
6. [x] `useInstallPrompt` y tarjeta «Instalar app» en Perfil (covers R7)
7. [x] E2E offline y de actualización sobre `out/`; proyecto de Playwright y CI (covers R4, R5, R6)
8. [x] README: instalar, offline y límite de iOS (covers R3)

## Test coverage
Los tests están en la rama `feature/21-pwa-offline` (commit `4e6535f`). Los e2e de service worker solo corren contra el build: en CI siempre; en local con `npm run build && npx serve out -l 3000` y `PWA_E2E=1`. R3 es manual (Android, iPhone, PC y Lighthouse).

Contrato para dev-code: `scripts/generate-sw.mjs` exporta `collectPrecacheUrls`, `buildVersion` y `renderSw` (tipos en `scripts/generate-sw.d.mts`); la plantilla usa `__SW_VERSION__` y `__SW_PRECACHE__`, declara `const VERSION = "..."` y los nombres de caché llevan la versión; `src/lib/useInstallPrompt.ts` devuelve `{ canInstall, install }`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/pwa-manifest.test.ts › "R1: manifest" | unit | 🟢 passing |
| R1 | tests/e2e/pwa.spec.ts › "R1: el HTML enlaza el manifest…" | e2e (build) | 🟢 passing |
| R2 | tests/unit/pwa-manifest.test.ts › "R2: iconos del manifest" | unit | 🟢 passing |
| R2 | tests/e2e/pwa.spec.ts › "R2: los iconos del manifest existen como PNG" | e2e (build) | 🟢 passing |
| R3 | Instalar en Android, iPhone y PC; Lighthouse | manual | ⏳ pending |
| R4 | tests/unit/generate-sw.test.ts › "R4: lista de precache" | unit | 🟢 passing |
| R4 | tests/e2e/pwa.spec.ts › "R4: tras una visita con red…" y "navegar dentro de la app sin conexión" | e2e (build) | 🟢 passing |
| R5 | tests/e2e/pwa.spec.ts › "R5: sin conexión, «Sugerir con IA»…" | e2e | 🟢 passing |
| R6 | tests/unit/generate-sw.test.ts › "R6: versión del build" | unit | 🟢 passing |
| R6 | tests/e2e/pwa.spec.ts › "R6: una versión nueva del service worker…" | e2e (build) | 🟢 passing |
| R7 | tests/unit/useInstallPrompt.test.tsx › "R7: useInstallPrompt" | unit | 🟢 passing |

## Spec feedback
Ninguno: la spec no cambia. Sin preguntas abiertas que bloqueen el código.

## Desviaciones durante la implementación
- **Tarea 7 (CI y proyecto de Playwright):** no hizo falta tocar el workflow ni crear un proyecto de Playwright: `ci.yml` ya ejecuta `npm run build` y los e2e contra `out/` (con `CI`), así que los e2e de PWA corren ahí sin cambios; en local se saltan salvo `PWA_E2E=1`.
- **Test R6:** Playwright no intercepta la descarga del `sw.js` que hace el navegador al buscar versiones nuevas (`page.route` ni `context.route`). El test sirve `out/` en un puerto propio y cambia el `sw.js` entre versiones; las aserciones no cambian.
- **Riesgo 3 (escáner):** confirmado que `barcode-detector` baja su WASM de `fastly.jsdelivr.net` cuando el navegador no trae `BarcodeDetector` nativo. No se cambia: el escáner ya cae a la vía manual si falla y la consulta del producto ya muestra «Parece que no hay conexión». Queda como follow-up (empaquetar el WASM) si se quiere escanear sin red.
- **R5:** el único flujo sin mensaje era «Sugerir con IA»; ahora un fallo de red muestra «Sin conexión. Prueba de nuevo cuando vuelvas a tener red.» (texto elegido por Claude; el test solo exige /sin conexión/i).
- **Estrategia de caché (review #92):** el diseño decía «se borran las cachés antiguas al activar»; ahora se conserva la de la versión anterior y se borran las más antiguas (las pestañas abiertas aún piden chunks con hash viejo). Además, la navegación red-primero tiene un máximo de 4 s antes de caer a la caché, y solo se atiende lo precacheado y `/_next/static/`. El captador de `beforeinstallprompt` vive a nivel de módulo (`InstallPromptCapture` en el layout), no dentro del hook.
