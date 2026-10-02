# PWA instalable y offline: Review
_PR: [#92](https://github.com/mancabcar/MealPlan/pull/92) · Reviewed: 2026-10-02 (segunda revisión) · Verdict: ⚠️ approved with follow-ups_

## Summary
Segunda revisión tras los arreglos de la primera (`🔁 changes requested`, mismo día). Los dos bloqueantes, el botón «Instalar app» que no aparecía (R7) y el service worker que borraba la caché vieja con pestañas abiertas (R6), están resueltos y cubiertos por tests. R1, R2, R4, R5, R6 y R7 están implementados con tests en verde (lint y typecheck limpios, 1046 unitarios y 395 e2e en modo CI). Queda R3 sin probar en dispositivos reales, que Manuel comprobará en el móvil antes de fusionar, y cinco hallazgos no bloqueantes como follow-ups.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/app/manifest.ts:1`, `src/app/layout.tsx:28` | ✅ unit + e2e |
| R2 | ✅ Done | `public/icons/`, `scripts/generate-icons.mjs` | ✅ unit + e2e |
| R3 | ⚠️ Not verified | manifest, SW y metadatos de iPhone | ❌ manual pendiente (Android, iPhone, PC, Lighthouse) |
| R4 | ✅ Done | `scripts/generate-sw.mjs`, `scripts/sw.template.js:56` | ✅ unit + e2e |
| R5 | ✅ Done | `src/app/recetas/page.tsx:100` | ✅ e2e |
| R6 | ✅ Done | `scripts/sw.template.js:31` | ✅ unit + e2e (dos actualizaciones) |
| R7 | ✅ Done | `src/lib/useInstallPrompt.ts:26`, `src/components/InstallPromptCapture.tsx` | ✅ unit + e2e (montaje tardío) |

Divergencias del tech design (documentadas en `tech.md`, aceptadas): CI sin tocar, servidor propio en el test de R6 y estrategia de caché (se conserva la versión anterior). Sin cambios fuera de alcance.

## Blocking
Ninguno. Los dos de la primera revisión (R7 listener tardío, R6 caché vieja) están resueltos, ver *Seguimiento*.

## Non-blocking
1. **Una instalación fallida deja una caché parcial que desplaza a la anterior** (`scripts/sw.template.js:35`): si `addAll` falla, `mealplan-<v>` queda creada y el siguiente deploy la cuenta como «anterior» y borra la buena. → Borrar la caché propia si falla `addAll` y relanzar el error.
2. **`caches.keys()` en cada petición** (`scripts/sw.template.js:40`): `fromCache` lo calcula antes de mirar la caché actual. → Consultar `CACHE` primero y las anteriores solo si falla.
3. **`statusBarStyle: "black-translucent"`** (`src/app/layout.tsx:31`): puede solapar la barra de estado de iOS sin `viewport-fit=cover`. → Comprobar en un iPhone (parte de R3) o usar `default`.
4. **`cache.addAll` todo o nada** (`scripts/sw.template.js:33`): un fichero con error impide instalar el SW. → Precachear de forma tolerante lo opcional.
5. **Tests que faltan**: ni el timeout de 4 s de la navegación ni que la caché anterior sirva chunks (`tests/e2e/pwa.spec.ts`). → e2e que pida un recurso solo presente en la caché anterior y otro con la red retenida más de 4 s.
6. **Tamaño del precache** (`scripts/generate-sw.mjs`): incluye los SVG de plantilla de `public/` y la versión cambia en cada deploy.
7. **R3 sin probar** en Android, iPhone y PC ni con Lighthouse: comprobación manual antes de fusionar.
- Follow-up ya creado: [#93](https://github.com/mancabcar/MealPlan/issues/93) (WASM del escáner sin CDN).

## Code review findings
Los hallazgos de las dos pasadas (`code-review`, nivel high) están recogidos arriba; ninguno más.

## Seguimiento
Primera revisión (2026-10-02): `🔁 changes requested` por R7 (el listener de `beforeinstallprompt` solo existía con Perfil montado) y R6 (el SW nuevo borraba la caché de la versión anterior con pestañas abiertas). Arreglados en `feature/21-pwa-offline` (`d19f44c`, `80c7efc`, `18e9fcc`), junto con el timeout de navegación, la caché acotada a lo precacheado y `_next/static`, el `TypeError` de recetas y el `try/catch` de `install()`. Segunda revisión: sin bloqueantes; Manuel confirma las clasificaciones y el veredicto `⚠️ approved with follow-ups`, con la comprobación manual de R3 antes de fusionar.
