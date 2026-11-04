# Escanear un ticket de compra: Review
_PR: [#186](https://github.com/mancabcar/MealPlan/pull/186) · Reviewed: 2026-11-04 · Verdict: ⚠️ approved with follow-ups_

## Summary
La PR construye las 5 Must y las 2 Should de la spec, con tests unit, de ruta y e2e para cada una; R8 (Could) queda fuera, como estaba previsto. La revisión de código encontró 9 hallazgos, ninguno bloqueante: Manuel decidió arreglar los 5 de corrección en esta misma PR (`86b90a2`) y dejar los 4 de limpieza como follow-ups. Falta la prueba manual con tickets reales y la cámara del móvil (tarea 7 de tech.md).

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/components/despensa/ScanReceiptSheet.tsx (inputs «Hacer foto» / «Elegir imagen»), src/lib/receiptImage.ts | ✅ e2e |
| R2 | ✅ Done | server/app/api/pantry/receipt/route.ts, src/lib/receiptScan.ts (`parseReceiptReply`), sheet (líneas no comida desmarcadas) | ✅ unit, server, e2e · manual: calidad de lectura de Claude |
| R3 | ✅ Done | sheet `LineList`, `canConfirm` | ✅ unit, e2e |
| R4 | ✅ Done | `toPantryItems`, src/app/despensa/page.tsx (`addScanned`) | ✅ unit, e2e |
| R5 | ✅ Done | códigos de error de la ruta, sheet (alerta, «Reintentar», «Añadir a mano») | ✅ server, e2e |
| R6 | ✅ Done | `buildReceiptPrompt` con los 161 nombres de src/data/foods.json | ✅ unit, server · manual: casado real |
| R7 | ✅ Done | page.tsx (aviso «N añadidos» con Deshacer, chip «Nuevo» con `addedFromReceiptAt`) | ✅ e2e |
| R8 | — Not in scope | Could, fuera de esta entrega | — |

Sin nada construido fuera de la spec. Divergencias de tech.md, todas documentadas: `canConfirm` como helper puro, la cabecera de la Despensa en dos filas en el móvil (decidido por Manuel en dev-code), el arreglo del helper `scan()` del test de la ruta, y los cambios de esta review (validación de la imagen antes del límite, cantidad obligatoria, 401 → login).

## Blocking
Ninguno.

## Non-blocking
- ✅ fixed in `86b90a2`: una respuesta cortada por el límite de tokens perdía el ticket entero. Ahora max_tokens 8000 y `parseReceiptReply` conserva las líneas completas (unit + server).
- ✅ fixed in `86b90a2`: un artículo podía guardarse sin cantidad (el prompt de sugerencias recibía « de Sal»). Ahora la cantidad ausente pasa a «1 ud» y una línea marcada sin cantidad impide confirmar, como el formulario manual (unit + e2e).
- ✅ fixed in `86b90a2`: la ubicación distinguía mayúsculas («nevera» acababa en Despensa) (unit).
- ✅ fixed in `86b90a2`: un 401 no cerraba la sesión caducada; ahora llama a `expireSession()` como la sincronización (e2e).
- ✅ fixed in `86b90a2`: la ruta no validaba el contenido de la imagen; ahora exige base64 con cabecera JPEG y valida antes del límite, así que una imagen rechazada no gasta cupo (unit + server).
- Pendiente: prueba manual con tickets reales y la cámara del móvil tras desplegar (tarea 7).

## Code review findings
Follow-ups, anotados en el brief:
- src/app/despensa/page.tsx: el aviso de Deshacer del escaneo y el de la lista de la compra pueden mostrarse a la vez, uno encima del otro.
- server/app/api/pantry/receipt/route.ts: la respuesta 500 de «falta la API key» está copiada del importador; mejor un helper compartido en server/lib.
- server/app/api/pantry/receipt/route.ts: el prompt fijo (~1,5k tokens con los 161 alimentos) se reenvía sin caché en cada escaneo.
- src/lib/receiptImage.ts: el segundo intento con calidad 0,6 es código muerto en la práctica.

## History
- 2026-11-04 pass 1: ⚠️ approved with follow-ups. 0 bloqueantes, 9 hallazgos; Manuel eligió arreglar los 5 de corrección en la PR (`86b90a2`) y dejar 4 como follow-ups.
