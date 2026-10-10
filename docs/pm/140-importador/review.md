# Endurecer el importador de recetas (#140): Review
_PR: rama `fix/140-importador` (issue [#140](https://github.com/mancabcar/MealPlan/issues/140)) · Reviewed: 2026-10-10 · Verdict: ⚠️ approved with follow-ups_

## Summary
Cierra los hallazgos 4–9 de la [review de #19](../19-importar-receta-url/review.md) y uno nuevo: el SDK de Anthropic reintentaba 2 veces por defecto, en contra de la «sola llamada» de R3. La code review (esfuerzo high) encontró 7 cosas. Cinco se arreglan en `3da9c5f`; el 2 se acepta y el 4 queda en [#165](https://github.com/mancabcar/MealPlan/issues/165).

Decisiones del usuario:
- un rango se lee como su punto medio;
- lo que no es HTML, XHTML o texto da `fetch_failed`;
- los rangos IPv6 con una IPv4 dentro se bloquean enteros;
- si la página no cabe, el recorte empieza en el encabezado «Ingredientes»;
- la IA tiene 18 s y `maxRetries: 0`;
- el rate limit barre como mucho una vez por minuto;
- las comillas triples de la página se reducen a una;
- pasos: tests → fix → review → PR.

## Spec conformance
Contra [docs/pm/19-importar-receta-url/spec.md](../19-importar-receta-url/spec.md) y el issue.

| Req | Status | Where | Tested |
|---|---|---|---|
| R2 (macros del JSON-LD): miles y rangos | ✅ Done | src/lib/recipeImport.ts › `toNumber`, `parseLocaleNumber` | ✅ unit `recipe-import-hardening` |
| R3 (IA con el texto de la página, máx. 30.000, una llamada) | ✅ Done: el recorte busca el encabezado «Ingredientes», sin reintentos | src/lib/recipeImport.ts › `htmlToText`; server/app/api/recipes/import/route.ts › `extractWithAi` | ✅ unit + route |
| R3 (texto no confiable) | ✅ Done: `"""` neutralizado | src/lib/recipeImport.ts › `buildImportPrompt` | ✅ unit |
| R6 (errores JSON) | ✅ Done: la IA corta a los 18 s con `no_recipe` en vez de un 504 sin JSON | route.ts › `AI_TIMEOUT_MS` | ✅ route (timers falsos) |
| R7 (SSRF) | ✅ Done: ::/96, NAT64, 6to4, Teredo y fec0::/10 | src/lib/recipeImport.ts › `isPrivateAddress` | ✅ unit |
| R7 (tamaño/tipo) | ✅ Done: solo text/html, text/plain y XHTML; el cuerpo no se lee | server/lib/safeFetch.ts | ✅ safe-fetch |
| R7 (límite por IP) | ✅ Done: el barrido es como mucho 1 vez por minuto y el límite no cambia | server/lib/rateLimit.ts | ✅ rate-limit |

## Blocking
Ninguno pendiente.

## Non-blocking
- ✅ fixed in `3da9c5f`: el recorte saltaba a cualquier «ingredientes», incluido un enlace del pie, y podía dejar fuera una receta que estaba arriba. Ahora solo cuenta una línea que empieza por esa palabra.
- ✅ fixed in `3da9c5f`: se aceptaba cualquier `text/*`; ahora solo text/html, text/plain y XHTML.
- ✅ fixed in `3da9c5f`: faltaban Teredo (`2001::/32`) y `fec0::/10`.
- ✅ fixed in `3da9c5f`: las RegExp de `toNumber` se compilan una vez; hay un test del barrido del rate limit (`size()`).
- Aceptado: «1.250 g» de una web en inglés se leería como 1250 (raro y editable en el formulario).
- Follow-up [#165](https://github.com/mancabcar/MealPlan/issues/165): `/api/recipes` (sugerir con IA) sigue con los reintentos del SDK y sin timeout propio.

## Code review findings
Code review a esfuerzo high: 7 hallazgos, recogidos arriba (5 arreglados, 1 aceptado, 1 follow-up).

Verificación final:
- App: lint (un warning previo de #111), typecheck, Vitest 1657/1657, Playwright 605 passed / 5 skipped, build OK.
- Servidor: Vitest 199/199, tsc, lint y build OK.
- Los tests nuevos fallaban antes de cada arreglo: 17 en la primera pasada y 6 en la segunda.

## History
- 2026-10-10 pass 1: 7 hallazgos. El usuario marcó el 1 como bloqueante, decidió arreglar el 3, el 5, el 6 y el 7, aceptó el 2 y mandó el 4 a follow-up (#165).
- 2026-10-10 pass 2: ⚠️ approved with follow-ups. Arreglos en `3da9c5f` con 6 tests que fallaban antes.
