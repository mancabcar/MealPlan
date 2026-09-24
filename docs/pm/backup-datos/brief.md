# Copia de seguridad: exportar e importar mis datos en JSON

_Status: in review ([PR #32](https://github.com/mancabcar/MealPlan/pull/32)) · review: ✅ approved ([review](review.md)) · Updated: 2026-09-24 · Origen: [issue #8](https://github.com/mancabcar/MealPlan/issues/8) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

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
- Tests: escritos antes del código el 2026-09-24 (dev-test): `tests/unit/backup.test.ts` (53), 8 nuevos en `tests/unit/store.test.tsx` (`importData`), `tests/e2e/backup-datos.spec.ts` (22), el caso "Perfil con error de importación" en `accessibility.spec.ts` y la fixture `tests/fixtures/backup.ts`. Todos fallan porque la funcionalidad aún no existe (faltan `src/lib/backup.ts`, `src/lib/userData.ts`, `importData` y la sección "Tus datos"); el resto sigue en verde (unit 387/387, e2e 131/131). Cobertura en [tech.md › Test coverage](tech.md#test-coverage). Siguiente: código (dev-code).
- Código: rama `feature/backup-datos`, 2026-09-24 (dev-code), una tarea de tech.md por commit: registro compartido `userData.ts` (ddd4c9e), `buildBackup` (414f51a), `parseBackup` y `formatExportDate` (6a2dc00), `writeUserData` con vuelta atrás (098e4ef), `importData` en el store (c3262cd), sección "Tus datos" y exportar (bc4622f) e importar (f710035); la tarea 8 (e2e y axe) ya venía de los tests. Tests sin cambios. Unit 451/451, e2e 154/154, typecheck, lint y build en verde. Comprobado en la app en móvil: sección "Tus datos", confirmación con la fecha, "Datos importados", borrador de "Tu objetivo" descartado al importar y el error de cuota (simulado) sin tocar nada. Desviaciones menores: la despensa ahora también pasa por `load` con upgrade, así que una clave `pantry` ausente se guarda como `[]` al cargar (como ya pasaba con diario y plan); si `exportedAt` falta o no es una fecha, la confirmación dice "esta copia" en vez de la fecha; `buildBackup` omite una clave guardada que no sea JSON legible. PR preparado, pendiente de aprobación para subirlo. Siguiente: PR y revisión (dev-review).
- Review: [review.md](review.md), 2026-09-24 (dev-review): ✅ approved. 11/11 requisitos hechos y con test (10 Must), sin bloqueantes; 3 no bloqueantes (perfil v2 validado solo por `schemaVersion`, versión del perfil escrita a mano en el validador, error de lectura del fichero sin mensaje) y 3 notas de la revisión de código (`mealType` sin validar, `dietaryRestrictions` v1 que no es lista, `isObject` repetido). Unit 451/451, e2e 154/154, typecheck y lint en verde. Siguiente: merge del PR (o arreglar los no bloqueantes antes).

## Decisiones (Manuel, 2026-09-24)
- Brainstorm y prototipo saltados: de acuerdo.
- Requisitos Must de la spec aprobados.
- La copia incluye la lista de la compra (`shopping`).
- En esta versión no se exporta automáticamente una copia antes de importar.
- Tech design aprobado con las 6 propuestas de "Spec feedback": confirmación con `window.confirm` y test de R4 con un nombre de perfil distinto del username.
