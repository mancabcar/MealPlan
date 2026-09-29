# Hosting estático en IONOS + rutas de servidor en Vercel: Technical design
_Status: Draft · Updated: 2026-09-29_
_Related: [brief](brief.md) · Issue: [#69](https://github.com/mancabcar/MealPlan/issues/69)_

## Summary
`main` ya activó `output: "export"` para desplegar en IONOS (issue #69) parcheando las tres rutas dinámicas con `force-static` — un hack que hace que el build no falle, pero las deja **inservibles en producción**. Esta entrega las recupera: se separa el repo en dos proyectos Next.js independientes. La raíz (`/`) pierde `app/api/*` y sus `force-static`, y queda con `output: "export"` real (sin rutas que forzar) para IONOS. Un proyecto nuevo, `server/`, contiene las tres rutas de servidor (`/api/recipes`, `/api/foods/search`, `/api/foods/barcode`), importa la lógica pura de `src/lib` por ruta relativa, y se despliega en Vercel con CORS restringido al origen de IONOS. Esfuerzo: M.

## Context
- **Stack:** Next 16.2.9 (App Router), React 19, Tailwind 4, TypeScript. Tests con Vitest (`tests/unit/`) y Playwright (`tests/e2e/`); CI en `.github/workflows/ci.yml` (lint, typecheck, unit, build, e2e en un único job, Node 22).
- **Estado real de `main` (verificado, no el punto de partida original del brief):**
  - `next.config.ts` ya tiene `output: "export"` (commit `c2272b1`, issue #69).
  - Las tres rutas de servidor llevan `export const dynamic = "force-static"` como parche temporal: `src/app/api/recipes/route.ts` (POST, Claude), `src/app/api/foods/search/route.ts` (#13, búsqueda por nombre/marca en OFF), `src/app/api/foods/barcode/route.ts` (#14, búsqueda por código de barras en OFF). Las tres están **implementadas y ya mergeadas** — el problema no es que falte código, es que un export estático no puede servirlas.
  - `playwright.config.ts` ya sirve `out/` con `npx serve@latest` en CI (en vez de `next start`, incompatible con `output: "export"`); en local sigue reutilizando `npm run dev`. No hace falta tocarlo.
  - IONOS ya tiene desplegado un pipeline propio, **IONOS Deploy Now**, con tres workflows generados por IONOS (no editables a mano): `.github/workflows/MealPlan-orchestration.yaml` (dispara en cada push), `MealPlan-build.yaml` (`npm ci && npm run build`, sube la carpeta `out/`) y `deploy-to-ionos.yaml` (despliega lo subido). **No hace falta escribir ningún workflow de despliegue nuevo** — el pipeline ya construye y publica `out/` de la raíz del repo automáticamente en cada push a la rama configurada en IONOS.
  - Issue #69 (abierto por el usuario) describe exactamente este problema y propone como opción 2 "Separar: UI estática en IONOS + estas rutas API en un host con funciones serverless/Node" — es la que se implementa aquí.
- Tres puntos de `fetch` en el cliente, todos con ruta relativa: `src/app/recetas/page.tsx:57` (`/api/recipes`), `src/lib/useBrandSearch.ts:81` (`/api/foods/search`), `src/lib/useBarcodeLookup.ts:94` (`/api/foods/barcode`).
- `tests/e2e/recipes.spec.ts`, `tests/e2e/food.spec.ts` y los e2e de #14 interceptan estas rutas con `page.route("**/api/...")` — el glob matchea también URLs absolutas, así que no cambian al mover las rutas a otro origen.
- La doc local de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md:282`, "Unsupported Features") confirma que un build con `output: "export"` no admite Route Handlers que dependan del `Request` — las tres rutas los necesitan (query params o body), de ahí el hack `force-static` actual y la necesidad de sacarlas del proyecto que se exporta.
- IONOS: hosting estático confirmado por el usuario. Dominio de prueba dado por el usuario: `https://home-5021530898.app-ionos.space/`.
- Lógica reutilizable que `server/` necesita importar de `src/lib/`: `recipePrompt.ts` (`buildRecipePrompt`, `safeAllergies`, `RecipeProfile`), `allergens.ts` (`recipeViolations`), `foods.ts` (`plainQuery` y los tipos que usan `foods/search` y `foods/barcode`).

## Approaches considered
### A. Dos proyectos Next en el mismo repo (chosen)
Raíz sin `app/api/*`, sin los `force-static` → IONOS (vía el pipeline de Deploy Now ya existente, sin cambios). `server/` (Next mínimo, sin export) con las tres rutas, desplegado en Vercel con Root Directory = `server/`. Comparten `src/lib` por import relativo. · **Pros:** cada ruta conserva su forma actual (`NextResponse.json`, tests con el SDK/fetch simulado) y **pierde el hack `force-static`**, con lo que vuelve a funcionar; Vercel detecta y despliega route handlers de forma nativa; nada muta el árbol de trabajo en build time; el pipeline de IONOS Deploy Now no necesita ningún cambio, solo que la raíz siga generando `out/` sin rutas dinámicas dentro. · **Cons:** dos `package.json`, dos instalaciones de dependencias, dos jobs de CI; los imports de `server/` hacia `../src/lib/...` cruzan la frontera del proyecto (aceptado, ver Risks). · **Effort** M.

Elegido por el usuario (coincide con la recomendación).

### B. Script que aparta `app/api` durante el build estático
Un solo proyecto Next; un script mueve `src/app/api` a un directorio temporal antes del build de Deploy Now. · **Pros:** un solo `package.json`. · **Cons:** muta el árbol de trabajo en build time; el pipeline de Deploy Now es generado por IONOS y no está pensado para pasos de build a medida tan frágiles. · **Effort** S–M.

Descartado por el usuario por la fragilidad del movimiento de archivos.

### C. Vercel Functions a pelo (sin Next) para `server/`
`server/` sería `api/recipes.ts` + `api/foods/search.ts` + `api/foods/barcode.ts` con el runtime nativo de Vercel. · **Pros:** sin `next`/`react` como dependencias del backend. · **Cons:** reescribe las tres rutas, ya hechas y testeadas (`NextResponse`, `request.json()`/`request.url` de Next), a otra firma. · **Effort** M.

Descartado por el usuario: prefiere no reescribir código que ya funciona.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Raíz | `src/app/api/` | Se elimina entera (las tres rutas se mueven a `server/`, sin el hack `force-static`). |
| Raíz | `src/app/recetas/page.tsx:57` | `fetch("/api/recipes")` → `` fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/recipes`) ``. |
| Raíz | `src/lib/useBrandSearch.ts:81` | `fetch(\`/api/foods/search?...\`)` → URL absoluta con `NEXT_PUBLIC_API_BASE_URL`. |
| Raíz | `src/lib/useBarcodeLookup.ts:94` | `fetch(\`/api/foods/barcode?...\`)` → URL absoluta con `NEXT_PUBLIC_API_BASE_URL`. |
| Raíz | `.env.example` | Añade `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` (puerto de `server/` en dev). |
| Raíz | `tests/unit/recipes-route.test.ts`, `foods-route.test.ts` (si existe), `foods-barcode-route.test.ts` | Se mueven a `server/tests/unit/`. |
| server/ (nuevo) | `server/package.json` | Nuevo. Dependencias: `next`, `react`, `react-dom`, `@anthropic-ai/sdk`, `typescript`, `vitest`. Scripts iguales a los de la raíz (`dev`, `build`, `lint`, `typecheck`, `test`), sin `test:e2e`. |
| server/ (nuevo) | `server/next.config.ts` | Nuevo. Sin `output: "export"` (Node runtime por defecto). |
| server/ (nuevo) | `server/tsconfig.json` | Nuevo. `include` cubre `server/**` y `../src/lib/**`. |
| server/ (nuevo) | `server/app/api/recipes/route.ts` | Movido desde `src/app/api/recipes/route.ts`, sin `force-static`, imports ajustados a `../../../../src/lib/...`. |
| server/ (nuevo) | `server/app/api/foods/search/route.ts` | Movido desde `src/app/api/foods/search/route.ts`, sin `force-static`. |
| server/ (nuevo) | `server/app/api/foods/barcode/route.ts` | Movido desde `src/app/api/foods/barcode/route.ts`, sin `force-static`. |
| server/ (nuevo) | `server/lib/cors.ts` | Nuevo. Helper compartido por las tres rutas: valida `Origin` contra `CORS_ALLOWED_ORIGIN` y añade las cabeceras `Access-Control-Allow-*`. |
| server/ (nuevo) | `server/.env.example` | Nuevo. `ANTHROPIC_API_KEY=sk-ant-...`, `CORS_ALLOWED_ORIGIN=https://home-5021530898.app-ionos.space`. |
| CI | `.github/workflows/ci.yml` | Job existente pasa a operar solo sobre la raíz (sin `api/`, ya no hace falta verificar `force-static`); se añade un segundo job para `server/` (install, lint, typecheck, test, build) con su propio `working-directory`. |
| CI/CD IONOS | `.github/workflows/MealPlan-*.yaml`, `deploy-to-ionos.yaml` | **Sin cambios** — el pipeline generado por IONOS Deploy Now ya construye `out/` de la raíz y lo publica; solo se beneficia de que la raíz ya no tenga rutas `force-static` inútiles dentro del export. |
| Docs | `README.md` | Sustituye «Despliegue gratis en Vercel» por la arquitectura de dos despliegues (IONOS Deploy Now + Vercel) y cómo levantar `server/` en local. |
| Docs | issue [#69](https://github.com/mancabcar/MealPlan/issues/69) | Se cierra con el PR de esta entrega. |

### Data model
Ninguno — este cambio es de despliegue, no toca `MealEntry` ni ningún otro tipo de datos del usuario.

### APIs / interfaces
- **`POST /api/recipes`**, **`GET /api/foods/search`**, **`GET /api/foods/barcode`** (en `server/app/api/...`): mismo contrato que hoy en cada una (ver sus tech designs en `docs/pm/13-base-alimentos/tech.md` y `docs/pm/14-escaner-codigo-barras/tech.md`). Cambia solo dónde viven, que pierden `force-static`, y que ahora validan `Origin` (CORS) antes de procesar.
- **CORS** (las tres rutas, vía `server/lib/cors.ts`):
  - `Access-Control-Allow-Origin`: el valor de `CORS_ALLOWED_ORIGIN` si `request.headers.get("origin")` coincide, si no se omite la cabecera (el navegador bloquea la respuesta).
  - Responden a `OPTIONS` (preflight) con `204` y las cabeceras `Access-Control-Allow-Methods`/`Allow-Headers` correspondientes.
- **`NEXT_PUBLIC_API_BASE_URL`** (raíz, build-time): base URL de `server/` (el dominio que asigne Vercel). Al ser `NEXT_PUBLIC_*`, queda fijado en el HTML/JS estático en el momento del build — cambiarlo exige rehacer el build (lo dispara IONOS Deploy Now en el siguiente push) y no se puede cambiar en caliente (aceptado, ver Risks).

### UI
Sin cambios de UI. Los tres call-sites solo cambian la URL a la que hacen `fetch`; el resto del flujo (estado, render, manejo de errores) queda igual.

## Spec coverage
No aplica — esta entrega no viene de un `spec.md` (brainstorm sin prototipo, ver `brief.md`). El criterio de éxito es el de *Success looks like* del brief: IONOS sirve la app, las tres rutas vuelven a funcionar, la clave de Claude no llega al navegador.

## Risks & mitigations
- **Imports relativos cruzando la frontera del proyecto** (`server/` → `../src/lib/...`): si se reorganiza `src/lib` sin actualizar `server/`, el build de `server/` rompe en CI (se detecta, no en producción silenciosamente). Aceptado; si se vuelve incómodo, migrar a un workspace npm formal más adelante.
- **`NEXT_PUBLIC_API_BASE_URL` fijado en build time:** cambiar el dominio de `server/` en Vercel exige un nuevo push para que IONOS Deploy Now reconstruya y republique el estático. Aceptado: el dominio de Vercel no cambia salvo que se recree el proyecto.
- **CORS mal configurado** (origen equivocado o `CORS_ALLOWED_ORIGIN` vacío) dejaría la API inaccesible desde IONOS o, en el otro extremo, abierta a cualquier origen. Mitigación: los tests movidos a `server/` incluyen un caso que verifica la cabecera `Access-Control-Allow-Origin` con el origen esperado y su ausencia con uno distinto.
- **Dos despliegues que se pueden desincronizar** (front en IONOS pidiendo un contrato distinto al que `server/` expone si uno de los dos no se redespliega): mitigado porque ambos proyectos viven en el mismo repo/commit. Aceptado: repo de un solo desarrollador, sin usuarios concurrentes.
- **`server/` sin e2e propios:** las tres rutas solo llevan tests unitarios (con `fetch`/SDK simulado), como ya ocurre hoy. Aceptado: el e2e de la raíz (con `page.route`) sigue verificando el contrato desde el punto de vista del cliente, y ya corre contra el `out/` estático en CI.

## Testing strategy
- **`server/tests/unit/`**: los tres tests de ruta movidos tal cual (`recipes-route.test.ts`, el de `foods/search` y el de `foods/barcode`) + `cors.test.ts` (nuevo: origen permitido → cabecera presente; origen distinto → cabecera ausente; `OPTIONS` → `204`).
- **Raíz `tests/e2e/`**: sin cambios de fondo — siguen interceptando con `page.route("**/api/...")`, que matchea la URL absoluta a `server/` igual que hoy matchea la relativa. Siguen corriendo en CI contra `out/` servido con `serve` (sin cambios en `playwright.config.ts`).
- **Raíz `tests/unit/`**: sin los tests de rutas movidos. El resto (lógica pura, componentes) no cambia.
- **CI:** el job de la raíz verifica que `next build` sigue generando `out/` sin errores y **sin ningún `force-static`** (señal de que no queda ninguna ruta dinámica dentro). El job de `server/` corre lint/typecheck/test/build de ese proyecto.
- **Verificación manual tras el primer despliegue:** abrir el sitio de IONOS y comprobar en la pestaña Red del navegador que las llamadas a `server/` en Vercel devuelven 200 y no un error de CORS, para las tres rutas.

## Tasks
1. [ ] Crear `server/` (package.json, next.config.ts, tsconfig.json) y mover las tres rutas + sus tests unitarios ahí, quitando `force-static` y ajustando los imports a `../src/lib/...`
2. [ ] `server/lib/cors.ts` + aplicarlo a las tres rutas + `cors.test.ts`
3. [ ] Raíz: quitar `src/app/api/`; los tres call-sites (`recetas/page.tsx`, `useBrandSearch.ts`, `useBarcodeLookup.ts`) usan `NEXT_PUBLIC_API_BASE_URL`; `.env.example` de ambos proyectos actualizados
4. [ ] Confirmar que `npm run build` en la raíz genera `out/` sin errores (sin rutas `api/` dentro) y que los e2e siguen en verde contra `out/` servido con `serve`, como hace CI
5. [ ] `.github/workflows/ci.yml`: job nuevo para `server/` (install, lint, typecheck, test, build)
6. [ ] Crear el proyecto en Vercel con Root Directory `server/`, variables `ANTHROPIC_API_KEY` y `CORS_ALLOWED_ORIGIN`; anotar la URL resultante para `NEXT_PUBLIC_API_BASE_URL`
7. [ ] `README.md`: arquitectura de los dos despliegues (IONOS Deploy Now, sin cambios de config; Vercel para `server/`) y cómo levantar `server/` en local
8. [ ] PR: `Closes #69`

## Spec feedback
No aplica (sin `spec.md`). Preguntas que quedaron abiertas en el brief y siguen abiertas:
- Nombre final del subdominio/dominio de `server/` en Vercel (se usará el que Vercel asigne por defecto salvo que el usuario configure uno propio).
- La tarea 6 (crear el proyecto en Vercel) requiere acceso al dashboard de Vercel, que esta sesión no tiene — queda para que el usuario lo haga manualmente siguiendo las instrucciones que deje el PR, o para confirmarlo en otra sesión con acceso.
