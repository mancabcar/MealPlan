# Hosting estático en IONOS + rutas de servidor en Vercel: Review
_PR: [#70](https://github.com/mancabcar/MealPlan/pull/70) · Reviewed: 2026-09-29 · Verdict: ⚠️ approved with follow-ups_

## Summary
Sin `spec.md` (brainstorm sin prototipo — cambio de infraestructura, issue [#69](https://github.com/mancabcar/MealPlan/issues/69)), la conformidad se revisó contra `tech.md` y el criterio de éxito del brief. La implementación sigue el diseño elegido (dos proyectos Next, CORS restringido al origen de IONOS, imports relativos para compartir `src/lib`), pasa lint/typecheck/tests/build en ambos proyectos, y ya arregla durante la revisión un bug real (`apiUrl()` con barra final) que habría dado 404 en el despliegue real. Queda un hallazgo de correción no bloqueante (aceptado por el usuario) y varios de mantenibilidad, todos como follow-ups.

## Spec conformance
Sin requisitos R# (no hay `spec.md`). Contra el brief § Success looks like y `tech.md`:

| Criterio | Estado | Dónde | Verificado |
|---|---|---|---|
| MealPlan se sirve desde IONOS (estático) y las 3 rutas vuelven a funcionar | ⚠️ Parcial | `server/app/api/*`, `next.config.ts` (raíz) | ✅ build+tests; ❌ despliegue real (proyecto de Vercel pendiente de crear, fuera del alcance de la sesión) |
| La API key de Claude nunca llega al navegador | ✅ Hecho | `server/app/api/recipes/route.ts` (lee `ANTHROPIC_API_KEY` solo en servidor) | ✅ |
| El pipeline de #13 (route handler) sigue siendo válido | ✅ Hecho | `server/app/api/foods/search/route.ts` (código de main relocado tal cual) | ✅ |

## Blocking
Ninguno.

## Non-blocking
- **`server/app/api/recipes/route.ts:22`** — `handlePOST` hace `await request.json()` sin `try/catch`; si el body no es JSON válido, la excepción sale antes de que `withCors()` envuelva la respuesta, así que el error llega sin cabecera CORS y el navegador lo reporta como fallo de CORS genérico en vez del error real. Antes de este PR era inofensivo (llamada mismo origen); ahora que es cross-origin, enmascara el error. Decisión del usuario: no bloqueante — el body siempre lo manda la propia app con JSON válido hoy. Follow-up: envolver `request.json()` en `try/catch` y devolver un 400 con CORS.
- **`server/tsconfig.json`** duplica a mano todo `compilerOptions` de la raíz en vez de `"extends": "../tsconfig.json"` con solo `paths` distinto — un cambio futuro de flag en la raíz no se propaga y nada lo avisa.
- Las tres rutas repiten el mismo patrón `handleX` + wrapper `withCors` letra por letra — un combinador compartido (`withCorsRoute(handler)`) evitaría la triplicación y el riesgo de que una copia se desincronice al añadir una cuarta ruta.
- `server/lib/cors.ts`: `preflight()` recalcula `corsHeaders(...)` en vez de componer `withCors()` — dos sitios con la misma lógica de cabeceras en vez de uno.
- `server/next.config.ts`: `turbopack.root` abarca todo el repo (necesario para resolver `../src/lib`), lo que también le da a `server/` acceso a todo el árbol de la raíz sin ninguna frontera real, solo por convención.
- `server/lib/cors.ts`: `CORS_ALLOWED_ORIGIN` admite un único origen — un segundo entorno estático (preview, `www.`) quedaría bloqueado en silencio sin aviso claro, y haría falta otro parche para admitir una lista.
- Decisión del usuario: los cinco anteriores quedan como no bloqueantes / follow-ups, sin tocar código en esta PR.

## Code review findings
Pase 1 (`code-review`, esfuerzo `high`, 8 ángulos + verificación): 7 hallazgos reportados, listados arriba (1 confirmado, 1 corregido durante la revisión, 5 de mantenibilidad). Ningún otro hallazgo sobrevivió la verificación — en particular se descartó (REFUTED) una lectura inicial de que `lucide-react` en `server/package.json` estuviera sin usar: es un import de solo-tipo dentro de `src/lib/types.ts`, transitivo desde las rutas, y ya hacía falta para que `tsc` resolviera (confirmado por el fallo real de CI antes de añadirlo).

### Corregido durante la revisión
- **`src/lib/apiBase.ts:4`** — `apiUrl()` no quitaba la barra final de `NEXT_PUBLIC_API_BASE_URL`; con la URL de Vercel pegada con `/` al final (fácil de hacer, así se muestra en su panel), las tres rutas habrían dado 404 en IONOS+Vercel por doble barra, sin que nada lo avisara antes de producción. Arreglado (`.replace(/\/+$/, "")`) y cubierto con `tests/unit/apiBase.test.ts` (3 casos: sin base, con base, con base con barra final).
