# Copia de seguridad: exportar e importar mis datos en JSON

_Status: tech design · Updated: 2026-09-24 · Origen: [issue #8](https://github.com/mancabcar/MealPlan/issues/8) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

## Problema
Todos los datos viven en el `localStorage` del navegador. Si se borran los datos del navegador o se cambia de dispositivo, se pierden sin remedio: no hay backend ni ninguna otra copia.

## Apuesta
En Perfil, "Exportar mis datos" descarga un `.json` con el perfil, las recetas, el diario, la despensa, el plan y el estado de la lista de la compra del usuario. "Importar" pide confirmación y sustituye los datos actuales por los del fichero.

## Criterios de aceptación (del issue)
- Exportar y después importar en otro navegador deja la app idéntica.
- El fichero incluye `schemaVersion`; importar un perfil v1 pasa por la migración existente.
- Un JSON inválido muestra un error y no toca los datos actuales.
- No se exporta nada de las credenciales locales (hash de contraseña).

## Contexto técnico
- Claves por usuario `mp_<userId>_<dato>` (`userKey` en `src/lib/auth.tsx`). Los datos son `profile`, `recipes`, `entries`, `pantry`, `weekplan` y `shopping`. Se leen en `AppProvider` (`src/lib/store.tsx`) con `upgrade` (migraciones y siembra).
- Migraciones en `src/lib/migrate.ts` (perfil v1→v2, "Snack"→"Merienda" en diario y plan) y en `loadShoppingState`.
- Las credenciales (`mp_users`, `mp_session`, `mp_remembered`) y las copias `*_v1_backup` quedan fuera.

## Pasos del pipeline
- Brainstorm: saltado. El issue ya trae problema, propuesta y criterios.
- Prototipo: saltado. Son dos botones en Perfil y una confirmación, sin pantallas ni flujos nuevos.
- Spec: [spec.md](spec.md), aprobada el 2026-09-24.
- Tech design: [tech.md](tech.md) (2026-09-24). Enfoque: validar y migrar la copia entera en memoria, escribir las seis claves con vuelta atrás y releer el store sin recargar. Esfuerzo M.

## Decisiones (Manuel, 2026-09-24)
- Brainstorm y prototipo saltados: de acuerdo.
- Requisitos Must de la spec aprobados.
- La copia incluye la lista de la compra (`shopping`).
- En esta versión no se exporta automáticamente una copia antes de importar.
- Tech design aprobado con las 6 propuestas de "Spec feedback": confirmación con `window.confirm` y test de R4 con un nombre de perfil distinto del username.
