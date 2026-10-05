# Escanear código de barras para registrar productos envasados

_Status: shipped (2026-09-29) · Updated: 2026-10-05 · Issue: [#14](https://github.com/mancabcar/MealPlan/issues/14) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#68](https://github.com/mancabcar/MealPlan/pull/68) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Follow-ups
- «Reintentar» del escáner reenvía el código obsoleto si el usuario edita el campo sin volver a pulsar «Buscar código» (review). (`useBarcodeLookup.ts:114`)
- Un código mal formado escrito a mano muestra «Open Food Facts no responde ahora» en vez de avisar de un formato inválido (review). (`FoodPicker.tsx:342`)
- `useBarcodeLookup`/`GET /api/foods/barcode` duplican casi literalmente el patrón de `useBrandSearch`/`GET /api/foods/search` de #13 en vez de reutilizarlo; candidato a extraer una base común (review).
- El bucle de detección de `BarcodeScanner` llama a `detect()` en cada `requestAnimationFrame` sin throttling — coste de batería/CPU real en un móvil (review).
- `GET /api/foods/barcode` quedó con `export const dynamic = "force-static"` (mismo parche temporal que `/api/foods/search`, ver [#69](https://github.com/mancabcar/MealPlan/issues/69)): mientras la app se despliegue en el plan Static de IONOS, el escaneo por código no funcionará en producción, igual que la búsqueda por nombre. Se resuelve junto con #69.

> Brainstorm y prototipo omitidos (decisión del usuario, 2026-09-27): el issue #14 ya trae problema, propuesta y criterios de aceptación fijados — surgió como follow-up del brainstorm de [#13](../13-base-alimentos/brief.md), que ya evaluó y descartó meter el escáner en esa entrega. Se pasa directo a spec.

## Problema

Estándar en MyFitnessPal, Yazio y Fitia: escanear el envase es la forma más rápida de registrar productos envasados. Hoy, con #13 ya mergeado, registrar un producto de marca en «Añadir comida» → «Alimento» requiere teclear el nombre y elegir entre los resultados de Open Food Facts — funciona, pero es más lento que apuntar la cámara al código de barras.

## Propuesta

- Botón «Escanear» en «Añadir comida» (pestaña Alimento) que abre la cámara (`BarcodeDetector` donde exista, con fallback a una librería JS) y busca el EAN leído en Open Food Facts.
- También útil para añadir productos a la Despensa.

## Criterios de aceptación (del issue)

- [ ] En el móvil, escanear un producto conocido rellena nombre y macros por 100 g.
- [ ] Un código no encontrado ofrece introducirlo a mano.
- [ ] Sin permiso de cámara, se puede escribir el código.

## Depende de

- [#13](https://github.com/mancabcar/MealPlan/issues/13) — Base de datos de alimentos (mergeado en `main` vía [#63](https://github.com/mancabcar/MealPlan/pull/63), [#64](https://github.com/mancabcar/MealPlan/pull/64), [#65](https://github.com/mancabcar/MealPlan/pull/65)). El proxy a Open Food Facts (`src/app/api/foods/search/route.ts`) y el modelo `MealEntry.foodId = "off:<código de barras>"` ya existen; buscar por código en vez de por nombre reutiliza esa base.

## Contexto de código relevante

- `src/app/page.tsx` — pestañas Receta / Alimento / Personalizada en «Añadir comida».
- `src/lib/foods.ts`, `src/app/api/foods/search/route.ts` — búsqueda de productos de marca por nombre (Search-a-licious). OFF tiene además un endpoint de producto por código de barras (`/api/v2/product/<code>`), distinto del de búsqueda por texto.
- `src/lib/types.ts` — `MealEntry.foodId` ya admite `"off:<code>"`; `PantryItem` (Despensa) solo tiene `name` y `quantity` (texto libre), sin macros.

