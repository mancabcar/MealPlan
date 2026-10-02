# PWA instalable y offline: Spec
_Status: Draft · Owner: Manuel · Updated: 2026-10-02_
_Related: [brief](brief.md) · Issue [#21](https://github.com/mancabcar/MealPlan/issues/21)_

## TL;DR
La app es hoy una pestaña del navegador: no se instala y no abre sin red. En la entrega 1 la convertimos en una PWA instalable (manifest, iconos, service worker) que abre a pantalla completa y funciona sin conexión con los datos locales. Sabremos que funcionó si se instala y abre sin red en Android, iPhone y PC. Los avisos opt-in (comidas y caducidades) son la entrega 2.

## Problem
Manuel usa la app desde el navegador del móvil y del PC. Hay que acordarse de abrir la pestaña, no ocupa un sitio en la pantalla de inicio y sin conexión no abre. Hoy se apoya en abrirla a mano. El problema completo (incluidos los avisos) está en el [brief](brief.md); esta spec cubre solo la entrega 1.

## Goals
- Instalable en Android (Chrome), iPhone (Safari) y PC (Chrome/Edge), abriendo a pantalla completa.
- Abre sin conexión en cualquier ruta, mostrando los datos locales.
- Las versiones nuevas de la app llegan sin borrar la caché a mano.

## Non-goals
- Notificaciones y avisos de cualquier tipo (entrega 2, Web Push).
- Cola de cambios offline y sincronización entre dispositivos (#22).
- Cachear respuestas de la API (IA, búsqueda de alimentos).
- Página o campaña propia de «instalar» en la app (más allá de R7, que es Could).
- Abrir sin red sin haber visitado antes la app con conexión.
- Evitar que el navegador borre los datos locales (se documenta y se remite al backup JSON).

## Users & key scenarios
Manuel, único usuario, con PC y móvil.
1. Instala la app desde el navegador del móvil y la abre desde la pantalla de inicio, a pantalla completa.
2. Está en el súper sin cobertura, abre la app y consulta la lista de la compra y sus datos.
3. Se despliega una versión nueva; al reabrir la app ya la tiene.
4. Sin red, intenta generar una receta con IA y ve que no hay conexión, sin que la app se rompa.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | La app expone un manifest válido: nombre «MealPlanner», `display: standalone`, `start_url`, colores del tema oscuro con acento lima | Must |
| R2 | Iconos 192 y 512, versión maskable y apple-touch-icon (delegado a Claude: símbolo sencillo en lima sobre oscuro) | Must |
| R3 | La app se puede instalar en Android, iPhone y PC | Must |
| R4 | Tras una primera visita con conexión, la app abre sin conexión en cualquier ruta y muestra los datos locales | Must |
| R5 | Las acciones que usan red (IA, búsqueda de alimentos, etc.) muestran un mensaje «sin conexión» y el resto de la app sigue funcionando | Should |
| R6 | Al desplegar una versión nueva, el usuario la recibe en la siguiente apertura sin borrar caché a mano y sin perder datos | Must |
| R7 | Botón «Instalar app» en Perfil cuando el navegador lo permite | Could |

## User flows
1. **Instalar.** Abrir la web en el móvil → instalar (Chrome: opción de instalar; Safari: «Añadir a pantalla de inicio») → abrir desde el icono → la app abre sin barra del navegador.
2. **Sin red.** Con la app ya visitada y sin conexión → abrir desde el icono → ver la pantalla y los datos locales.
3. **Actualizar.** Se publica una versión nueva → el usuario abre la app → recibe la versión nueva en la siguiente apertura.

## Acceptance criteria
**R1**
- Given la app desplegada, when se pide el manifest, then es JSON válido con nombre, `display: standalone`, `start_url` correcto, colores e iconos.
**R2**
- Given el manifest, when se cargan los iconos, then existen en 192 y 512 y hay uno maskable y un apple-touch-icon.
**R3**
- Given Android/Chrome, PC/Chrome o Edge, when se visita la app, then el navegador ofrece instalarla.
- Given iPhone/Safari, when se usa «Añadir a pantalla de inicio», then la app abre a pantalla completa desde el icono.
**R4**
- Given una primera visita con conexión, when se pone el dispositivo sin red y se abre cada ruta principal (incluido recargar con `trailingSlash`), then carga y muestra los datos del `localStorage`.
**R5**
- Given sin conexión, when se lanza una acción que necesita la API, then aparece «sin conexión» en esa acción y el resto de la app sigue usable.
**R6**
- Given una app instalada con versión vieja y una nueva publicada, when el usuario la abre (y, si hace falta, la reabre una vez), then ve la versión nueva y conserva todos sus datos.
**R7**
- Given un navegador que permite instalar, when el usuario pulsa «Instalar app» en Perfil, then se lanza la instalación; si no lo permite (o ya está instalada), el botón no aparece.

## Edge cases
- Primera visita sin conexión: no hay nada en caché; es el comportamiento esperable (non-goal).
- iOS puede expulsar la caché y el `localStorage` de PWAs poco usadas: se documenta y la salida es el backup JSON existente.
- Si el despliegue en IONOS (Apache) responde distinto a rutas con y sin barra final, el offline debe funcionar igual (a resolver en el diseño técnico).
- Una versión nueva del service worker no debe dejar a un usuario con una app rota o con datos perdidos.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Checklist de aceptación (R1–R6) en Android, iPhone y PC | 0 de 3 | 3 de 3 | Prueba manual por dispositivo |
| Lighthouse: instalable como PWA | No instalable | Cumple | Auditoría de Lighthouse sobre el despliegue |

La métrica de comidas registradas por día se medirá en la entrega 2 (avisos).

## Risks & dependencies
- Hosting estático en IONOS (Apache): el service worker y las cabeceras de caché dependen de cómo sirva el sitio.
- iOS es más restrictivo con PWAs (expulsión de datos y de caché).
- La entrega 2 (Web Push) añadirá su propio service worker o ampliará este: conviene no cerrarle la puerta.
- Dependencia posterior de #22 para la sincronización.

## Open questions
- [ ] Estrategia de caché y versionado del service worker con `trailingSlash` en Apache (diseño técnico).
- [ ] ¿Se pide almacenamiento persistente (`navigator.storage.persist()`) como mitigación en Chrome? Decidido fuera de alcance; reabrir si molesta.
