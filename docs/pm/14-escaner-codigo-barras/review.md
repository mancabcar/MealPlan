# Escáner de código de barras: Review
_PR: [#68](https://github.com/mancabcar/MealPlan/pull/68) · Reviewed: 2026-09-29 · Verdict: ✅ approved with follow-ups_

## Summary
La implementación cubre los 8 requisitos del spec y el camino de código escrito a mano funciona de extremo a extremo (verificado en vivo contra la API real de Open Food Facts). El pase de revisión encontró dos bugs bloqueantes en el camino de la cámara (la identidad inestable del callback `onDetected` reiniciaba la cámara en bucle bajo el límite de peticiones activo, y escanear con ese límite ya alcanzado fallaba en silencio) — ambos arreglados en la misma sesión, con tests nuevos que los cubren; ver detalle en Blocking. El resto de hallazgos (un «Reintentar» que reenvía un código obsoleto, un mensaje de error engañoso con un código mal formado, y la duplicación del patrón de #13 en vez de reutilizarlo) quedan como follow-ups, sin bloquear el merge.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `FoodPicker.tsx:302-332` | ✅ e2e |
| R2 | ✅ Done | `BarcodeScanner.tsx` | ✅ unit (permiso concedido en dispositivo real: pendiente, sin cámara disponible en el entorno de desarrollo) |
| R3 | ✅ Done | `BarcodeScanner.tsx` | ✅ unit+e2e (el bucle de reinicio del Blocking 1 ya arreglado) |
| R4 | ✅ Done | `FoodPicker.tsx` (`onCodeResult`/`fromBrand`) | ✅ unit+e2e+verificación manual contra OFF real (Nutella) |
| R5 | ✅ Done | `FoodPicker.tsx:145-153,334-353` | ✅ unit+e2e, incluido el camino de escaneo con el límite activo (Blocking 2 ya arreglado) |
| R6 | ✅ Done | `FoodPicker.tsx:312-332` | ✅ e2e |
| R7 (Should) | ✅ Done | `BarcodeScanner.tsx` (vía `Sheet`) | ✅ unit |
| R8 | ✅ Done | `BarcodeScanner.tsx:59-74` | ✅ unit, incluida la condición de carrera tras cerrar (arreglada junto al Blocking 1) |

## Blocking
1. **Identidad inestable de `onDetected` reinicia la cámara en bucle** — ✅ Arreglado. `BarcodeScanner.tsx` ahora guarda `onDetected` en un `ref` (igual que `Sheet.tsx` con `onClose`) y el `useEffect` de la cámara pasa a depender de `[]`, así que ya no se reinicia por un cambio de identidad del callback. De paso se cerró también la condición de carrera del hallazgo no bloqueante (un `detect()` en curso ya no entrega el código si el visor se cerró mientras tanto). Tests nuevos: `tests/unit/BarcodeScanner.test.tsx › "review de #14: la cámara no se reinicia..."` (2 tests) y `"review de #14: no se entrega un código tras cerrar..."`.
2. **Escanear con el límite de peticiones activo falla en silencio** — ✅ Arreglado. El botón «Escanear» se desactiva mientras `barcode.cooldown > 0` (igual que «Buscar código»), y además `useBarcodeLookup.run()` deja el estado en `"rate_limited"` en vez de devolver `null` sin más cuando el bloqueo ya está activo, así que el aviso se muestra igual aunque el escaneo llegue a completarse por una carrera de tiempo. Test nuevo: `tests/unit/useBarcodeLookup.test.tsx › "review de #14: buscar con el límite ya activo..."`.

## Non-blocking
- ~~Condición de carrera tras cerrar el visor~~ — arreglada junto con el Blocking 1 (ver arriba).
- **«Reintentar» reenvía un código obsoleto**: `useBarcodeLookup.ts:114` — `retry()` usa el `code` interno del hook (el último buscado), no el `codeText` que el usuario pueda haber editado en el campo tras un fallo, sin volver a pulsar «Buscar código».
- **Mensaje engañoso con un código mal formado**: `FoodPicker.tsx:342` — un código que no pasa la validación del servidor (400 `bad_code`) cae en el estado genérico `"error"`, mostrando «Open Food Facts no responde ahora» en vez de avisar de un código con formato inválido.
- **Duplicación del patrón de #13**: `useBarcodeLookup.ts` (deducción, contador, `requestId`, `run`/`retry`/`reset`) casi replica `useBrandSearch.ts`, sin siquiera reutilizar `OFF_LIMIT`/`offCooldown` de `foods.ts` pese a que su propio comentario dice que tienen «la misma forma». `src/app/api/foods/barcode/route.ts` duplica de forma similar `text`/`num`/`toProduct`/el patrón de timeout+429 de `search/route.ts`. Candidato a extraer una base común (`useOffLookup`/`lib/off.ts`) en un refactor aparte.
- **Bucle de detección sin throttling**: `BarcodeScanner.tsx:74` — `detector.detect(video)` corre en cada `requestAnimationFrame` (hasta 60–120 Hz) mientras el visor esté abierto, sin necesidad real de esa cadencia (el usuario apunta la cámara a mano). Coste real de CPU/batería en un móvil real, no detectado por los tests (jsdom no tiene temporización real de `requestAnimationFrame`).

## Code review findings
Sin hallazgos adicionales del pase 1 más allá de los ya listados arriba (Blocking y Non-blocking cubren los 8 hallazgos que sobrevivieron verificación de los 8 ángulos del pase 1: corrección ×5, reuso/altitud ×2, eficiencia ×1). El ángulo de convenciones (CLAUDE.md/AGENTS.md) no encontró ninguna infracción.
