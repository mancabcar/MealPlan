# Escanear código de barras: Spec
_Status: Draft · Owner: @mancabcar · Updated: 2026-09-27_
_Related: [brief](brief.md) · [issue #14](https://github.com/mancabcar/MealPlan/issues/14)_

## TL;DR
Registrar un producto de marca en «Añadir comida» hoy exige teclear el nombre y elegir entre resultados de Open Food Facts. Añadimos un botón «Escanear» que abre la cámara, lee el código de barras (EAN) con `BarcodeDetector` o una librería de respaldo, y busca ese código directamente en Open Food Facts. Habrá funcionado si buena parte de las entradas de productos de marca empiezan a venir de escanear en vez de teclear.

## Problem
Con #13 ya mergeado, la pestaña «Alimento» busca productos de marca por nombre en Open Food Facts (`src/app/api/foods/search/route.ts`), pero apuntar la cámara al código de barras del envase es más rápido que teclear el nombre y elegir entre resultados — es el flujo estándar en MyFitnessPal, Yazio y Fitia.

## Goals
- Registrar un producto de marca escaneando su código de barras, en vez de buscarlo por nombre.
- Si el código no se puede leer, no está en Open Food Facts, o falta algún macro, seguir pudiendo registrar el producto a mano sin perder el código leído.

## Non-goals
- Añadir productos a la Despensa por escaneo (`PantryItem` no guarda macros; queda para un issue nuevo si se decide).
- Escanear alimentos genéricos/básicos (no tienen código de barras).
- Caché local de productos ya escaneados, para reintentar sin red.
- Escaneo continuo de varios productos en la misma sesión de cámara.
- Historial o analítica dedicada del uso del escáner (más allá de que la entrada quede en el Diario como cualquier otra de alimento).

## Users & key scenarios
Usuario único de la app, registrando a diario.
- **Escaneo con éxito**: en «Añadir comida» → Alimento, pulsa «Escanear», apunta la cámara al código del envase; la app lo detecta, busca en OFF y abre la tarjeta de cantidad con nombre y macros ya rellenos.
- **Código no encontrado**: escanea un producto que OFF no tiene, o le faltan macros; la app ofrece pasar a Personalizada con el código anotado para registrarlo a mano.
- **Sin permiso de cámara**: deniega el permiso (o su dispositivo no tiene cámara); escribe el código en el campo de texto y sigue el mismo flujo que si lo hubiese escaneado.
- **Sin `BarcodeDetector` nativo**: en un navegador sin soporte (p. ej. Safari/iOS en 2026), el escaneo sigue funcionando con una librería de respaldo.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | En «Añadir comida» → pestaña Alimento, junto al buscador por nombre hay un botón «Escanear» y, siempre visible bajo él, un campo «o escribe el código». | Must |
| R2 | Al pulsar «Escanear», la app pide permiso de cámara y abre un visor de escaneo. Si el navegador soporta `BarcodeDetector`, se usa; si no, se usa una librería de respaldo (a decidir en tech design). | Must |
| R3 | Al detectar un código EAN válido, el visor se cierra y la app busca ese código en Open Food Facts (por código de barras, no por nombre). | Must |
| R4 | Si el producto existe en OFF y trae los cuatro macros por 100 g (mismo criterio que R4 de #13), se abre la tarjeta de cantidad con nombre y macros ya rellenos, igual que al elegir un resultado de la búsqueda por nombre. | Must |
| R5 | Si el código no se encuentra en OFF, le faltan macros, o la búsqueda falla (sin red, error, límite de peticiones), se ofrece pasar a Personalizada con el código escaneado anotado (p. ej. en el nombre o como nota), para registrarlo a mano. | Must |
| R6 | Sin permiso de cámara concedido (denegado, no disponible, o dispositivo sin cámara), el campo «o escribe el código» permite teclear el EAN a mano y sigue el mismo flujo que R3–R5. | Must |
| R7 | El visor de escaneo tiene un botón para cerrarlo sin detectar nada y volver a la pestaña Alimento tal como estaba. | Should |
| R8 | Al detectar un primer código válido, el visor se cierra (no sigue escaneando otros códigos en la misma sesión). | Must |

## User flows
**Escaneo con éxito**
1. En Alimento, pulsa «Escanear»; el navegador pide permiso de cámara.
2. Concede el permiso; se abre el visor.
3. Apunta al código de barras; al detectarlo, el visor se cierra.
4. La app busca el código en OFF; al encontrarlo con macros completos, abre la tarjeta de cantidad (como en el flujo de #13: gramos/unidades, macros en vivo, «Añadir <cantidad>»).

**Código no encontrado o sin macros**
1. Repite 1–3 del flujo anterior.
2. OFF no tiene el código, o le faltan macros: se ofrece «Introducir a mano», que abre Personalizada con el código anotado.

**Sin permiso de cámara**
1. Deniega el permiso, o pulsa directamente en el campo «o escribe el código».
2. Escribe el EAN y confirma; sigue el mismo flujo que el paso 4 de «Escaneo con éxito» (o el 2 de «Código no encontrado»).

**Error de red al buscar por código**
1. Tras detectar o escribir un código, la búsqueda en OFF falla (sin red, error del servidor, límite de peticiones).
2. Se muestra el error con la opción de reintentar o pasar a Personalizada con el código anotado.

## Acceptance criteria
**R1**
- Given estoy en Alimento, then veo el botón «Escanear» y, bajo él, el campo «o escribe el código», sin necesidad de fallar antes con la cámara.

**R2**
- Given pulso «Escanear» y concedo el permiso, then se abre el visor de cámara.
- Given el navegador soporta `BarcodeDetector`, then se usa esa API.
- Given el navegador no lo soporta, then el escaneo sigue funcionando con la librería de respaldo.

**R3, R4**
- Given el visor detecta un código EAN de un producto que existe en OFF con los cuatro macros, then el visor se cierra y se abre la tarjeta de cantidad con nombre y macros correctos (verificable con un producto real conocido, criterio del issue).

**R5**
- Given escaneo o escribo un código que OFF no tiene, then se ofrece pasar a Personalizada con el código anotado, sin perder el dato leído (criterio del issue).
- Given el producto existe en OFF pero le falta algún macro, then se trata igual que "no encontrado" (mismo criterio que R4 de #13).
- Given la búsqueda por código falla por red, error o límite de peticiones, then se muestra el error con opción de reintentar o de pasar a Personalizada.

**R6**
- Given no concedo el permiso de cámara (o mi dispositivo no tiene), then puedo escribir el código a mano en el campo «o escribe el código» y completar el registro (criterio del issue).

**R7**
- Given abro el visor sin escanear nada, when lo cierro, then vuelvo a Alimento tal como estaba, sin buscar nada en OFF.

**R8**
- Given el visor detecta un código válido, then se cierra inmediatamente; no sigue detectando otros códigos hasta volver a pulsar «Escanear».

## Edge cases
- Código de barras dañado o ilegible: el visor sigue escaneando hasta detectar uno válido o hasta que el usuario lo cierre; no hay timeout automático especificado (se deja abierto indefinidamente).
- Formatos de código no EAN (UPC-A, etc.): fuera de goals explícitos, pero si `BarcodeDetector`/la librería de respaldo los detecta igual, se busca igual en OFF con ese código.
- El mismo código escrito a mano con dígitos de más o de menos: se busca tal cual en OFF; si no hay resultado, se trata como "no encontrado" (R5).

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| % de entradas de alimento de marca (`foodId` empieza por `off:`) que se originan escaneando en vez de buscando por nombre | TBD (sin analítica hoy) | TBD | Requiere instrumentar el origen (escaneo vs. búsqueda) en el evento de añadir; no existe hoy |

## Risks & dependencies
- Depende de [#13](https://github.com/mancabcar/MealPlan/issues/13) (mergeado): reutiliza el proxy a OFF y el modelo `MealEntry.foodId = "off:<code>"`.
- `BarcodeDetector` requiere HTTPS y no está soportado en todos los navegadores (notablemente Safari/iOS en 2026); de ahí el requisito de librería de respaldo.
- El acceso a la cámara requiere HTTPS; a decidir en tech design cómo se comporta en desarrollo local sin HTTPS.
- Open Food Facts puede no tener el producto, tener datos incompletos, o aplicar límite de peticiones — mismos riesgos que la búsqueda por nombre de #13.

## Open questions
- [ ] Cómo se instrumenta el % de escaneo vs. búsqueda por nombre para medir la métrica de éxito — no bloquea construir la funcionalidad, sí queda pendiente para saber si funcionó (@mancabcar).
