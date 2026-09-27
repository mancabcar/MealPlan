# Escanear código de barras para registrar productos envasados

_Status: spec · Updated: 2026-09-27 · Issue: [#14](https://github.com/mancabcar/MealPlan/issues/14) (@mancabcar) · Spec: [spec.md](spec.md)_

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

## Follow-ups

_(vacío por ahora)_
