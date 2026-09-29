# Escáner de código de barras: Review
_PR: [#68](https://github.com/mancabcar/MealPlan/pull/68) · Reviewed: 2026-09-29 · Verdict: 🔁 changes requested_

## Summary
La implementación cubre los 8 requisitos del spec y el camino de código escrito a mano funciona de extremo a extremo (verificado en vivo contra la API real de Open Food Facts). Pero el camino de la cámara tiene dos bugs de corrección que afectan a Musts en un escenario real, no de laboratorio: la identidad inestable del callback `onDetected` reinicia la cámara en bucle cuando el límite de peticiones está activo (R3), y escanear con ese límite ya alcanzado falla en silencio sin ningún aviso (R5). Se piden cambios antes de mergear; el resto de hallazgos (una condición de carrera de ventana estrecha, un «Reintentar» que reenvía un código obsoleto, un mensaje de error engañoso, y la duplicación del patrón de #13 en vez de reutilizarlo) quedan como no bloqueantes.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `FoodPicker.tsx:302-332` | ✅ e2e |
| R2 | ✅ Done | `BarcodeScanner.tsx` | ✅ unit (permiso concedido en dispositivo real: pendiente, sin cámara disponible en el entorno de desarrollo) |
| R3 | ⚠️ Partial | `BarcodeScanner.tsx` | ✅ unit+e2e del camino feliz; el bucle de reinicio (Blocking 1) puede impedir llegar a detectar nada en el escenario descrito |
| R4 | ✅ Done | `FoodPicker.tsx` (`onCodeResult`/`fromBrand`) | ✅ unit+e2e+verificación manual contra OFF real (Nutella) |
| R5 | ⚠️ Partial | `FoodPicker.tsx:145-153,334-353` | ✅ camino manual (encontrado, no encontrado, red, límite); ❌ camino de escaneo con el límite ya activo (Blocking 2) |
| R6 | ✅ Done | `FoodPicker.tsx:312-332` | ✅ e2e |
| R7 (Should) | ✅ Done | `BarcodeScanner.tsx` (vía `Sheet`) | ✅ unit |
| R8 | ⚠️ Partial | `BarcodeScanner.tsx:59-74` | ✅ camino feliz; ❌ condición de carrera tras cerrar el visor (Non-blocking 1) |

## Blocking
1. **Identidad inestable de `onDetected` reinicia la cámara en bucle**: `src/components/diario/BarcodeScanner.tsx:85` — el `useEffect` que pide la cámara depende de `[onDetected]`, pero `src/components/diario/FoodPicker.tsx:357-361` le pasa una función flecha nueva en cada render. Mientras el visor está abierto y `barcode.cooldown > 0`, el `setInterval` de `useBarcodeLookup.ts` re-renderiza `FoodPicker` cada segundo, lo que reinicia el efecto entero: para el stream y vuelve a pedir `getUserMedia`. La cámara puede no llegar nunca a tener un frame estable que escanear. → Memoizar `onDetected` en `FoodPicker` (`useCallback`) o guardarlo en un `ref` dentro de `BarcodeScanner` y sacarlo del array de dependencias (como ya hace `Sheet.tsx` con `onClose`).
2. **Escanear con el límite de peticiones activo falla en silencio**: `src/components/diario/FoodPicker.tsx:304-311` — el botón «Escanear» no tiene la guarda de `cooldown` que sí tiene «Buscar código» (línea 327). Si el límite ya está activo, `barcode.lookup()` devuelve `null` (`useBarcodeLookup.ts:75`), `onCodeResult(null)` no hace nada: el visor se cierra y no pasa nada más, sin tarjeta, sin caer a Personalizada, sin aviso de límite. Incumple R5 para el camino de escaneo. → Desactivar «Escanear» mientras `barcode.cooldown > 0` (igual que «Buscar código»), o mostrar el aviso de límite también cuando `onCodeResult` reciba `null`.

## Non-blocking
- **Condición de carrera tras cerrar el visor**: `BarcodeScanner.tsx:62` — `cancelled` solo se comprueba antes de `await detector.detect(video)`, no después. Si se cierra el visor mientras un `detect()` está en curso, la promesa puede resolver después y `onDetected` se llama igualmente con un código de un escaneo ya cancelado.
- **«Reintentar» reenvía un código obsoleto**: `useBarcodeLookup.ts:114` — `retry()` usa el `code` interno del hook (el último buscado), no el `codeText` que el usuario pueda haber editado en el campo tras un fallo, sin volver a pulsar «Buscar código».
- **Mensaje engañoso con un código mal formado**: `FoodPicker.tsx:342` — un código que no pasa la validación del servidor (400 `bad_code`) cae en el estado genérico `"error"`, mostrando «Open Food Facts no responde ahora» en vez de avisar de un código con formato inválido.
- **Duplicación del patrón de #13**: `useBarcodeLookup.ts` (deducción, contador, `requestId`, `run`/`retry`/`reset`) casi replica `useBrandSearch.ts`, sin siquiera reutilizar `OFF_LIMIT`/`offCooldown` de `foods.ts` pese a que su propio comentario dice que tienen «la misma forma». `src/app/api/foods/barcode/route.ts` duplica de forma similar `text`/`num`/`toProduct`/el patrón de timeout+429 de `search/route.ts`. Candidato a extraer una base común (`useOffLookup`/`lib/off.ts`) en un refactor aparte.
- **Bucle de detección sin throttling**: `BarcodeScanner.tsx:74` — `detector.detect(video)` corre en cada `requestAnimationFrame` (hasta 60–120 Hz) mientras el visor esté abierto, sin necesidad real de esa cadencia (el usuario apunta la cámara a mano). Coste real de CPU/batería en un móvil real, no detectado por los tests (jsdom no tiene temporización real de `requestAnimationFrame`).

## Code review findings
Sin hallazgos adicionales del pase 1 más allá de los ya listados arriba (Blocking y Non-blocking cubren los 8 hallazgos que sobrevivieron verificación de los 8 ángulos del pase 1: corrección ×5, reuso/altitud ×2, eficiencia ×1). El ángulo de convenciones (CLAUDE.md/AGENTS.md) no encontró ninguna infracción.
