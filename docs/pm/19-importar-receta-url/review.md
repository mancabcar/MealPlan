# Importar una receta desde una URL: Review
_PR: [#88](https://github.com/mancabcar/MealPlan/pull/88) · Reviewed: 2026-10-01 · Verdict: ⚠️ approved with follow-ups_

## Summary
R1–R9 están implementados y cubiertos por tests (970 unit en la raíz, 127 en `server/`, 359 e2e, todos en verde); no hay divergencias de `tech.md` ni cambios fuera de alcance. La revisión de código (high) no encontró bugs bloqueantes; quedan 9 follow-ups, tres de ellos prioritarios (diálogo cerrado que reabre el formulario, charset no UTF-8 y entidades HTML en el JSON-LD). Decisión del usuario: todos non-blocking. Sin verificar: descarga real contra webs (el DNS y la red están simulados) y la métrica de éxito del spec (5 webs reales, ≥3 con JSON-LD).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/app/recetas/page.tsx, src/components/recetas/ImportRecipeSheet.tsx | ✅ |
| R2 | ✅ Done | src/lib/recipeImport.ts (`extractJsonLdRecipe`), server/app/api/recipes/import/route.ts | ✅ |
| R3 | ✅ Done | server/app/api/recipes/import/route.ts (`extractWithAi`), src/lib/recipeImport.ts (`parseAiRecipe`) | ✅ |
| R4 | ✅ Done | src/components/recetas/RecipeForm.tsx, src/app/recetas/page.tsx (chip) | ✅ |
| R5 | ✅ Done | RecipeForm solo llama a `onSave` en «Guardar» | ✅ |
| R6 | ✅ Done | ImportRecipeSheet.tsx, route.ts (códigos de error) | ✅ |
| R7 | ✅ Done | server/lib/safeFetch.ts, server/lib/rateLimit.ts, `validateImportUrl` | ✅ |
| R8 | ✅ Done | `servingsHint` → aviso en RecipeForm | ✅ |
| R9 | ✅ Done | `sourceUrl` + enlace «Ver receta original» en page.tsx | ✅ |

## Blocking
Ninguno.

## Non-blocking
1. ✅ Arreglado: la importación en curso no se cancela al cerrar el diálogo; `onImported` abre el formulario aunque el usuario ya lo cerró y el servidor sigue gastando IA (`src/components/recetas/ImportRecipeSheet.tsx:28`) → `AbortController` abortado al desmontar/cerrar.
2. ✅ Arreglado: el HTML se decodifica siempre como UTF-8; webs en ISO-8859-1 dan «�» (`server/lib/safeFetch.ts:96`) → leer `charset` del `Content-Type` o del `<meta>`.
3. ✅ Arreglado: el JSON-LD no decodifica entidades HTML ni quita etiquetas (`&amp;`, `&frac12;`, `<p>`) en nombre, ingredientes y pasos (`src/lib/recipeImport.ts:103`) → reutilizar el decodificador de `htmlToText`.
4. `toNumber` interpreta «1,200 kcal» como 1.2 y toma el primer número de un rango (`src/lib/recipeImport.ts:38`).
5. No se comprueba el `Content-Type`: PDFs o imágenes de hasta 2 MB acaban como texto en Claude (`server/lib/safeFetch.ts:71`).
6. `isPrivateAddress` no cubre NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`) ni `::a.b.c.d` (`src/lib/recipeImport.ts:205`).
7. La IA no tiene timeout propio y el recorte a 30.000 caracteres puede dejar fuera la receta tras mucho texto de navegación; un cuelgue acaba en 504 sin JSON de error (`server/app/api/recipes/import/route.ts:34`).
8. `rateLimit.check` recorre todo el mapa en cada petición (`server/lib/rateLimit.ts:14`).
9. El delimitador `"""` del prompt se puede cerrar desde la página (`src/lib/recipeImport.ts:259`); impacto acotado (solo rellena un formulario revisable).
10. `tagHint` se devuelve pero la UI no lo usa; el spec dice «puede sugerirse» (aceptado por el usuario).

## Code review findings
Los 9 hallazgos de la pasada 1 están listados arriba (1–9).
