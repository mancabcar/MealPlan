# PWA instalable y offline: Review
_PR: [#92](https://github.com/mancabcar/MealPlan/pull/92) · Reviewed: 2026-10-02 · Verdict: 🔁 changes requested_

## Summary
La entrega 1 cubre R1, R2, R4, R5, R6 y R7 con tests en verde (lint y typecheck limpios, 1044 unitarios y 394 e2e en modo CI). Se piden cambios por dos bloqueantes: el botón «Instalar app» (R7) no aparecería en la práctica porque el listener de `beforeinstallprompt` vive solo en Perfil, y el service worker nuevo borra la caché vieja con pestañas abiertas, lo que contradice el edge case de la spec («una versión nueva no debe dejar una app rota»). R3 (instalación en Android, iPhone y PC y Lighthouse) sigue sin probarse en dispositivos reales.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/app/manifest.ts:1`, `src/app/layout.tsx:28` | ✅ unit + e2e |
| R2 | ✅ Done | `public/icons/`, `scripts/generate-icons.mjs` | ✅ unit + e2e |
| R3 | ⚠️ Not verified | manifest, SW y metadatos de iPhone | ❌ manual pendiente |
| R4 | ✅ Done | `scripts/generate-sw.mjs`, `scripts/sw.template.js:43` | ✅ unit + e2e |
| R5 | ✅ Done | `src/app/recetas/page.tsx:109` | ✅ e2e |
| R6 | ⚠️ Partial | `scripts/sw.template.js:21` | ✅ test de versión; ❌ pestañas abiertas |
| R7 | ⚠️ Partial | `src/lib/useInstallPrompt.ts:16`, `src/components/perfil/InstallSection.tsx` | ✅ unit; ❌ montaje tardío |

Divergencias del tech design (documentadas en `tech.md`): el CI no se toca porque ya ejecuta los e2e contra `out/`; el test de R6 sirve `out/` en un puerto propio porque Playwright no intercepta la descarga del `sw.js`. Aceptadas: tienen razón documentada. Sin cambios fuera de alcance.

## Blocking
1. **R7: el botón «Instalar app» no aparece**: `src/lib/useInstallPrompt.ts:26`. El navegador lanza `beforeinstallprompt` una vez al cargar y el hook solo escucha cuando se monta Perfil. → Capturar el evento en un listener global (layout o store de módulo) y que el hook lo lea; añadir un test que dispare el evento en la home, navegue a Perfil y espere el botón.
2. **R6: skipWaiting + borrar la caché vieja rompe pestañas abiertas**: `scripts/sw.template.js:25`. Una PWA abierta durante un deploy pierde sus chunks con hash antiguo (ya no están en caché ni en el servidor): ChunkLoadError hasta recargar. → Conservar la caché anterior hasta que no queden clientes con ella, o recargar los clientes al activar la versión nueva.

## Non-blocking
- **Navegación red-primero sin timeout** (`scripts/sw.template.js:43`): con cobertura mala (escenario 2 de la spec) la app no abre aunque esté en caché. Importante: competir el fetch con un timeout de unos segundos y caer a la caché.
- **`asset()` cachea y reutiliza cualquier GET del mismo origen con `ignoreSearch`** (`scripts/sw.template.js:58`): una API en el mismo origen devolvería la respuesta de otra consulta. Limitar a `/_next/static/` y a las URLs del precache.
- **`statusBarStyle: "black-translucent"`** (`src/app/layout.tsx:31`) puede dejar el contenido bajo la barra de estado de iOS sin `viewport-fit=cover` ni safe-area. Verificar en un iPhone; alternativa: `default`.
- **Todo `TypeError` se muestra como «Sin conexión»** (`src/app/recetas/page.tsx:109`): aislar el `fetch` en su propio try/catch.
- **`cache.addAll` es todo o nada** (`scripts/sw.template.js:16`): un fichero que falle impide instalar el SW. Precachear de forma tolerante lo opcional.
- **`install()` sin try/catch** (`src/lib/useInstallPrompt.ts:37`): un rechazo de `prompt()` deja el botón sin efecto.
- **Precache grande** (`scripts/generate-sw.mjs`): incluye los SVG de plantilla de `public/` y todo `out/`, y la versión cambia en cada deploy.
- **R3 sin probar** en Android, iPhone y PC ni con Lighthouse: comprobación manual antes de fusionar.
- Follow-up ya creado: [#93](https://github.com/mancabcar/MealPlan/issues/93) (WASM del escáner sin CDN).

## Code review findings
Los 9 hallazgos del pase 1 (`code-review`, nivel high) están recogidos arriba; el décimo, la falta de un test de montaje tardío para R7, va dentro del bloqueante 1. No hay más.
