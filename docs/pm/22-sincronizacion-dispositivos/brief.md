# Sincronización entre dispositivos: cuentas y datos en servidor
_Status: shipped (2026-10-02) · Updated: 2026-10-05 · Issue: [#22](https://github.com/mancabcar/MealPlan/issues/22) (relacionado: [#66](https://github.com/mancabcar/MealPlan/issues/66)) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#98](https://github.com/mancabcar/MealPlan/pull/98) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Follow-ups
- Follow-ups de la review de #98 como issues: [#99](https://github.com/mancabcar/MealPlan/issues/99) (polling y píldora), [#100](https://github.com/mancabcar/MealPlan/issues/100) (adopción pisa datos), [#101](https://github.com/mancabcar/MealPlan/issues/101) (hardening).
- **Segunda entrega: offline con cola de cambios e indicador de estado** (al día / pendiente / sin conexión / error). Son criterios de éxito de Manuel y de #22, pero quedan fuera de la v1: la v1 exige conexión.
- **Merge por fila (dirección B)** si la última escritura gana pierde ediciones en la práctica (diario, lista de la compra editados desde dos dispositivos).
- Tiempo real con websockets (la v1 usa refresco al volver a la pestaña y polling).
- Recuperación de contraseña por email.
- Aviso de conflicto cuando una escritura pisa a otra.
- Migración automática de los datos locales al primer inicio de sesión (la v1 reimporta el backup JSON a mano).
- Las recetas del usuario se sincronizan; el catálogo se queda en el bundle ([recetas-almacenamiento](../recetas-almacenamiento/brief.md)).

## Problem
Manuel (único usuario) necesita poder usar la app en el momento y el sitio donde toma las decisiones (súper, cocina, móvil) con los mismos datos que en el PC, incluso sin red, y sin miedo a perderlos. Hoy las cuentas y los datos viven en el `localStorage` de cada navegador (`mp_users`, `mp_<userId>_<clave>`): el usuario creado en el navegador del PC no existe en el móvil, y borrar los datos del navegador (o iOS purgando `localStorage`) los pierde. La única salida es exportar/importar el JSON de `backup.ts` a mano, sin que se mantenga sincronizado.

Este brief unifica dos issues: #22 (sincronización entre dispositivos) y #66 (mover la persistencia a un backend real por riesgo de pérdida de datos).

## Success looks like
- Entro en el móvil con mi cuenta y veo mis datos.
- Un cambio en un dispositivo aparece en el otro en segundos.
- Puedo editar sin red y no se pierde nada (segunda entrega).
- Nunca pierdo datos aunque borre el navegador.

## Constraints & assumptions
- Un solo usuario real (Manuel), varios dispositivos (PC y móvil).
- Frontend estático en IONOS (solo hosting estático, Deploy Now; sin PHP ni base de datos accesible). Ya existe `server/` en Vercel con rutas API y CORS limitado al origen de IONOS.
- Coste: usar lo que ya tiene; un servicio nuevo solo si es necesario y con capa gratuita.
- «Casi en vivo»: cambios visibles en segundos, sin exigir tiempo real.
- Se sincronizan todos los datos del usuario (perfil, recetas propias/IA, diario, despensa, plan, lista de la compra, medidas) y también la cuenta (login).
- La sesión viaja como token en cabecera, no en cookies, por ser IONOS y Vercel orígenes distintos (a validar en el diseño técnico).
- Datos de salud: requieren cuidado con la privacidad.
- Migración: Manuel reimporta a mano el backup JSON (`backup.ts`) en el primer dispositivo.
- Delegated to Claude: método de login (usuario y contraseña, Google, enlace mágico); se decide en el diseño técnico.
- Suposición a validar: la última escritura gana no molestará en la práctica con un solo usuario.

## Directions considered
### A. Backend propio mínimo: bloques y última escritura gana
El `server/` de Vercel crece con una base de datos Postgres gratuita y cuentas propias. Cada una de las 7 claves se guarda como un bloque JSON con marca de tiempo; `localStorage` sigue siendo la copia principal. El «casi en vivo» se consigue refrescando al volver a la pestaña y con polling. **Risk:** editar el mismo dato en dos dispositivos a la vez pierde una de las ediciones.

### B. Backend gestionado (Supabase o similar): filas y merge por fila
Cuentas, base de datos y tiempo real ya hechos. Diario, despensa, medidas pasan a ser filas que se fusionan por separado. **Risk:** reescribir el store de bloque a fila; dependencia de un proveedor y de su capa gratuita.

### C. Local-first con motor de sincronización (CRDT)
Automerge, Yjs, Jazz, PowerSync o similar guardan los datos en el dispositivo y los fusionan solos. **Risk:** tecnología nueva que sustituye `usePersisted`, con un formato de datos distinto y más peso. _Descartada por el usuario._

### D. La mínima: subir y bajar una copia a mano
El backup JSON guardado en el servidor con un botón de subir/bajar. **Risk:** no cumple «casi en vivo» ni «sin red».

### E. Sin cuentas: emparejar dispositivos con un QR
Una clave secreta larga (QR o enlace) identifica los datos en el servidor. Capa de identidad, no una dirección completa. **Risk:** quien tenga la clave lo tiene todo; sin recuperación si se pierde.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Backend propio, bloques y última escritura gana | High | Med | Med | Que editar el mismo dato en dos dispositivos a la vez sea raro |
| B. Supabase, filas y merge por fila | High | Med–High | Med | Que su capa gratuita aguante y encaje en un frontend estático con offline |
| D. Subir/bajar copia a mano | Low | Low | High | Que Manuel acepte pulsar un botón |
| E. Sin cuentas, con QR | Med (solo identidad) | Low | Med | Que una clave larga sea suficiente para datos de salud |

## Recommended bet
**A ahora, B si hace falta.** Elegido por Manuel. Menos piezas nuevas (solo una base de datos), encaja con el `server/` de Vercel que ya existe y sirve al frontend estático de IONOS por CORS, como ya hacen `/api/recipes` y la búsqueda de alimentos. Se deja el formato de datos preparado para pasar a filas si molesta. Lo que haría pasar a B: editar el mismo dato desde PC y móvil casi a la vez (p. ej. la lista de la compra) y perder cambios.

**v1:** cuentas reales en servidor (registro y login), sincronización de las 7 claves (subir y bajar), refresco casi en vivo (foco y polling). Migración reimportando el backup JSON.

## What to prototype
Estado de sincronización y primer inicio. Pantallas: login/registro contra el servidor; indicador de estado (al día, pendiente, sin conexión, error); primer inicio en un dispositivo nuevo, incluida la reimportación del backup JSON. Aunque el indicador va a la segunda entrega, se explora ahora para diseñar la v1 pensando en él.

Pregunta que debe responder: ¿se entiende sin dudar si mis datos están guardados y sincronizados, y qué hago en un dispositivo nuevo?

## Open questions
- Proveedor de base de datos y de autenticación (Postgres gratuito en Vercel/Neon/Supabase): capa gratuita, latencia, límites.
- Contraseña: hoy se hashea en el navegador (PBKDF2); con cuentas reales se hashea en el servidor. ¿Qué pasa con las cuentas locales existentes?
- ¿Cómo se comportan `localStorage` y el servidor si hay datos en ambos al iniciar sesión (qué gana)?
- Método de login (delegado): usuario/contraseña, Google o enlace mágico.
- Estrategia de conflictos de la v1 con última escritura gana por clave: ¿por marca de tiempo del cliente o del servidor?
- Cifrado o protección extra de datos de salud en la base de datos.
