# Hosting estático en IONOS + rutas de servidor en Vercel
_Status: shipped (2026-09-29) · Updated: 2026-10-05 · Issue: [#69](https://github.com/mancabcar/MealPlan/issues/69) · Tech: [tech.md](tech.md) · PR: [#70](https://github.com/mancabcar/MealPlan/pull/70) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Follow-ups
- ~~Pipeline de despliegue a IONOS~~ — descubierto durante dev-technical-opinion: ya existe y está automatizado (IONOS Deploy Now, `.github/workflows/MealPlan-*.yaml`), no hace falta decidirlo.
- Revisar si los e2e de #13/#14 (`page.route("**/api/foods/...")`) siguen funcionando igual cuando las rutas se llaman por URL absoluta a Vercel en vez de relativa.

## Problem
Manuel tiene contratado hosting estático en IONOS y quiere servir MealPlan desde ahí, pero la app depende de rutas de servidor que no se pueden exportar como estáticas: `GET /api/foods/search` (proxy a Open Food Facts, #13), `GET /api/foods/barcode` (proxy a Open Food Facts, #14) y `POST /api/recipes` (genera recetas llamando a Claude con una API key que debe quedarse en el servidor). Un `next build` con `output: "export"` no soporta route handlers que dependen del `Request` entrante (confirmado en `node_modules/next/dist/docs/01-app/02-guides/static-exports.md:282`, sección "Unsupported Features").

**Descubierto durante dev-technical-opinion:** esto ya se intentó en `main` antes de este brainstorm — activó `output: "export"` y parcheó las tres rutas con `export const dynamic = "force-static"` solo para que el build no fallara, dejándolas **inservibles en producción**. Quedó registrado como el issue [#69](https://github.com/mancabcar/MealPlan/issues/69), abierto por el propio Manuel. Este brief y su tech design son la solución a ese issue.

## Success looks like
- MealPlan se sirve desde el dominio de IONOS (hosting estático) y sigue funcionando: búsqueda de alimentos por nombre/marca y generación de recetas con IA, sin cambios de comportamiento para el usuario.
- La API key de Claude nunca llega al navegador.
- El pipeline para terminar #13 (route handler + tests ya escritos) sigue siendo válido, con ajustes menores conocidos, no un rediseño.

## Constraints & assumptions
- El plan de IONOS es solo estático (HTML/CSS/JS servidos como ficheros; sin Node.js ni funciones de servidor). Confirmado por el usuario.
- Las dos rutas de servidor (`/api/foods/search`, `/api/recipes`) siguen viviendo en Vercel (gratis), no se migran a otro proveedor.
- La clave de Claude no puede exponerse en el cliente en ningún escenario.
- App de un solo usuario (ya asumido en el tech design de #13): no hay presión de escala ni de coste en las rutas de Vercel.
- Delegated to Claude: nombre exacto de los subdominios (p. ej. `app.` / `api.`) — se deja para dev-technical-opinion, que lo resolverá junto con la configuración de CORS y `next.config.ts`.

## Directions considered
### A. Subdominios + CORS, rutas en Vercel (elegida)
Un subdominio (IONOS, estático, `output: "export"`) sirve la app; otro subdominio o `*.vercel.app` (Vercel, sin cambios de plataforma) sirve las dos rutas. El cliente llama a la URL absoluta de Vercel; se activa CORS en ambas rutas. **Riesgo:** hay que sacar `app/api/*` del build que se exporta a IONOS sin romper `next build --output export` (el export falla si detecta esas rutas), probablemente con dos builds/configuraciones distintas desde el mismo repo.

### B. Proxy delante (Cloudflare u otro) con un solo dominio
Un proxy a nivel de DNS/CDN reenvía `/api/*` a Vercel y el resto a IONOS, todo bajo un único dominio, sin CORS. **Riesgo:** añade una pieza y una cuenta nuevas que aprender y mantener, para un beneficio (mismo origen) que no es un requisito expresado.

### C. Mover las rutas a otro proveedor serverless (Cloudflare Workers, Netlify Functions...)
En vez de Vercel. **Riesgo:** reescribir el proxy a OFF y la llamada a Claude en otro runtime, sin necesidad clara — Vercel ya funciona hoy y es gratis.

### D. Sin servidor en ningún sitio
Todo estático de verdad: buscar en OFF directamente desde el navegador (ya descartado en el tech design de #13, Approach B, porque OFF exige un `User-Agent` que el navegador no permite fijar) y/o exponer la clave de Claude en el cliente. **Riesgo:** rompe el requisito de no exponer la clave y repite un descarte ya hecho.

### E. No tocar nada, seguir todo en Vercel
Ignorar IONOS para esta app. **Riesgo:** no cumple el objetivo del usuario de aprovechar un hosting que ya paga; no resuelve el problema, solo lo evita.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Subdominios + CORS, rutas en Vercel | High | Low | High | Se puede excluir `app/api/*` del build exportado sin dos repos separados |
| B. Proxy con un solo dominio | High | Med | Med | Vale la pena la complejidad de un proxy para no tener CORS |
| C. Otro proveedor serverless | Med | Med-High | Med | Hace falta salir de Vercel, sin motivo claro hoy |
| D. Sin servidor en ningún sitio | Low | High | Low | Ya descartado en #13 (User-Agent) y viola "clave nunca en el cliente" |
| E. Todo en Vercel, IONOS sin usar | Low (no resuelve el objetivo) | None | High | El usuario acepta no usar el hosting de IONOS |

## Recommended bet
**A. Subdominios + CORS, con las dos rutas de servidor en Vercel** — elegida por el usuario, coincide con la recomendación. Es el cambio más pequeño (Vercel sigue funcionando igual que hoy; solo cambia cómo se sirve el front y cómo lo llama), y las dos rutas conservan la clave de Claude en el servidor. Lo que haría cambiar de opinión: si al entrar en tech design resulta que separar `app/api/*` del build estático exige mantener dos repos o una duplicación de código incómoda — en ese caso reconsiderar B.

## What to prototype
Esta idea no tiene UI nueva que prototipar (pm-prototype no aplica). El siguiente paso es un tech design (dev-technical-opinion) que resuelva la pregunta técnica clave: cómo generar, desde el mismo repo, un build estático (`output: "export"`) que no incluya `app/api/*`, y cómo apuntar el cliente a la URL absoluta de Vercel para las dos rutas, con CORS configurado.

## Open questions
- ¿Cómo se sube el `out/` generado a IONOS? (FTP/SFTP manual vs. automatizado, p. ej. GitHub Actions) — no decidido, queda para tech design.
- Nombres reales de los subdominios/dominio en IONOS y en Vercel.
- Si el e2e de #13 necesita ajustarse al pasar de ruta relativa a URL absoluta.
