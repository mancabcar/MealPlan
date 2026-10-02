# PWA instalable con recordatorios
_Status: shipped · Updated: 2026-10-02 · Issue: [#21](https://github.com/mancabcar/MealPlan/issues/21) (@mancabcar) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#92](https://github.com/mancabcar/MealPlan/pull/92) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Shipped
Entrega 1 (instalable y offline) fusionada el 2026-10-02 (PR [#91](https://github.com/mancabcar/MealPlan/pull/91) docs y [#92](https://github.com/mancabcar/MealPlan/pull/92) código) y en producción en IONOS; Manuel confirma que funciona. La entrega 2 (avisos con Web Push) sigue pendiente, y por eso el issue #21 permanece abierto.

## Follow-ups
- **Issues creados desde la revisión (2026-10-02):** [#93](https://github.com/mancabcar/MealPlan/issues/93) (WASM del escáner), [#94](https://github.com/mancabcar/MealPlan/issues/94) (instalación robusta del SW), [#95](https://github.com/mancabcar/MealPlan/issues/95) (tests y rendimiento del SW), [#96](https://github.com/mancabcar/MealPlan/issues/96) (barra de estado de iOS).
- **Entrega 2: Web Push real con servidor (dirección C).** Suscripciones guardadas en Vercel, planificador externo gratuito, horas configurables en Perfil y aviso de caducidad (el cliente sube un resumen de fechas). Puede depender de #22 (cuentas y datos en servidor).
- **Avisos dentro de la app (dirección B):** al abrirla, «caduca mañana: X» y «aún no has registrado la comida», con toggle en Perfil.
- Validar si el plan Hobby de Vercel solo permite tareas programadas diarias y, si es así, elegir planificador externo (GitHub Actions, cron-job.org).
- Límites de iOS: push solo con la PWA instalada y desde iOS 16.4; iOS puede expulsar la caché y el `localStorage` de PWAs poco usadas.
- Descartadas por ahora: recordatorios como eventos de calendario `.ics` (D) y avisos por Telegram o email (E).

## Problem
Manuel necesita que la app esté en la pantalla de inicio del móvil, abra a pantalla completa (también sin red) y le avise a la hora de registrar comidas y cuando algo caduca mañana, porque hoy es una pestaña del navegador que hay que recordar abrir y no puede avisar de nada; hoy se apoya en abrirla a mano y mirar la despensa.

## Success looks like
- Registro más comidas al día tras activar los avisos (medible con el diario).
- Criterios de aceptación del issue (siguen vigentes): la app se instala en Android/iOS y abre a pantalla completa; abre sin conexión mostrando los datos locales; los avisos son opt-in y se desactivan desde Perfil.

## Constraints & assumptions
- Dispositivos: Android (Chrome), iPhone (Safari) y PC (Chrome/Edge).
- Frontend estático en IONOS (Apache, `output: "export"`, `trailingSlash`); `server/` en Vercel ya existe con CORS limitado al origen de IONOS.
- Next trae su propia convención para el manifest (`app/manifest.ts`); revisar `node_modules/next/dist/docs/` antes de implementar. Funciona con export estático.
- Los datos viven en `localStorage`; offline = cachear la app y leer los datos locales. No se hace cola de cambios (eso es la segunda entrega de #22).
- Servidor nuevo aceptado «si hace falta» (para el push, entrega 2).
- Los recordatorios deseados son: registrar comidas a horas fijas y productos que caducan mañana.
- A validar: tareas programadas del plan Hobby de Vercel (solo diarias, según recuerdo).

## Directions considered
### A. Instalable y offline, sin avisos
Manifest, iconos y service worker que cachea la app. **Risk:** iOS expulsa cachés de PWAs poco usadas; el service worker puede chocar con el export estático en Apache.

### B. A + avisos dentro de la app
Al abrir la app, aviso de caducidad y de comida sin registrar; opcionalmente, insignia del icono. Sin servidor. **Risk:** solo avisa si ya la abres.

### C. A + Web Push real
Suscripciones en Vercel, planificador externo, horas configurables en Perfil. **Risk:** pieza más grande (VAPID, base de datos, planificador); iOS exige PWA instalada; los datos de despensa pasan por el servidor.

### D. Recordatorios como eventos de calendario (.ics)
Un `.ics` recurrente con alarmas que gestiona el móvil. **Risk:** no sirve para caducidades y rompe «desde Perfil».

### E. Avisos por Telegram o email
Un bot o correo diario. **Risk:** servidor y canal externo; el aviso no abre la app.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Solo instalable/offline | Med | Low | High | Que el service worker no choque con el export estático en Apache |
| B. A + avisos al abrir | Med | Low–Med | High | Que Manuel abra la app lo bastante a menudo |
| C. A + Web Push | High | High | Med | Que un planificador gratuito y iOS entreguen a la hora |
| D. Calendario .ics | Med | Low | Med | Que alarmas de calendario sirvan como recordatorio |
| E. Telegram/email | Med | Med–High | Med | Que se quiera un canal externo |

## Recommended bet
**A primero, C después.** Elegido por Manuel (coincide con la recomendación de Claude). Entrega 1: instalable y offline, que cumple los dos primeros criterios del issue sin servidor. Entrega 2: Web Push con servidor para el tercero. Haría cambiar de idea que el uso real fuera solo Android y se quisieran avisos ya, o que #22 aterrice antes y haga barato el servidor.

**Alcance de la entrega 1:** solo A (manifest, iconos, service worker offline). Los avisos (B y C) van a Follow-ups.

## What to prototype
Se salta el prototipo: la entrega 1 es casi toda técnica y no añade pantallas. Si más adelante entran avisos, la sección de Perfil se diseña en su spec.

## Open questions
- ¿Qué estrategia de caché usa el service worker para que las rutas con `trailingSlash` en Apache funcionen sin conexión y las actualizaciones lleguen (versionado de la caché)?
- ¿Qué pasa con iOS y la expulsión de caché/`localStorage`: cómo se comunica o se mitiga?
- ¿Iconos: de dónde salen (hay solo `favicon.ico`)? ¿Se diseñan o se generan?
- ¿La entrega 2 espera a #22 o se hace con una base de datos propia solo para suscripciones?
