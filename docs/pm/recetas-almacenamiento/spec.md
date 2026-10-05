# Separar el catálogo de recetas de las del usuario: Spec
_Status: Draft · Owner: Manuel · Updated: 2026-10-05_
_Related: [brief](brief.md) · Issue [#42](https://github.com/mancabcar/MealPlan/issues/42)_

## TL;DR
El catálogo de recetas (`src/data/recipes.json`) se copia hoy a `localStorage` de cada cuenta y queda congelado, así que ningún cambio del JSON llega a las cuentas que ya existen. Vamos a leer el catálogo directamente del bundle en cada carga y guardar en `localStorage` solo las recetas del usuario (IA y propias). Funciona si un cambio en el JSON se ve al recargar en una cuenta existente, sin migrar datos del usuario y sin perder ninguna receta suya.

## Problem
Manuel (único usuario) hace crecer el catálogo con PRs (hoy 107 recetas) y corrige macros y erratas. `withSeedRecipes` (`src/lib/userData.ts`) solo añade las recetas cuyo id falta, así que las correcciones y los campos nuevos (`cuisine`, `season`) no llegan a cuentas existentes. La salida actual es una migración puntual por cada cambio, como `RETIRED_RECIPE_IDS` para los duplicados retirados (commit `05abea2`), o borrar los datos de la cuenta.

Estado del código al escribir esta spec:
- #18 (recetas propias) está entregado: el catálogo es de solo lectura y "Duplicar y editar" crea una receta propia con id nuevo (`custom_<uuid>`). Las de IA llevan `isAIGenerated`; las del catálogo no llevan ninguna marca.
- #22 (sincronización) está entregado: `recipes` es una de las claves que se sincronizan y `hasUserData` (`src/lib/syncMigration.ts`) usa `withSeedRecipes` para distinguir las recetas de ejemplo.
- Las pantallas ya toleran una receta ausente (`?? "la receta"`, comprobaciones de `undefined`), pero el diario muestra "Receta" como nombre de reserva.

## Goals
- Un cambio en `src/data/recipes.json` (macros, campo nuevo, receta nueva) llega a todas las cuentas al recargar.
- Las recetas del usuario (IA y propias) se conservan, también al migrar.
- Añadir un campo a las recetas del catálogo no requiere migrar los datos del usuario.

## Non-goals
- Ocultar o borrar recetas del catálogo desde la app (siguen siendo de solo lectura, como en #18).
- Precedencia por id (una receta del usuario con el mismo id tapa la del catálogo): #18 duplica con id nuevo, así que no hace falta hoy.
- Incluir el catálogo en la copia de seguridad.
- Pasar el catálogo a un fichero por receta, IndexedDB o una base de datos en servidor.

## Users & key scenarios
Manuel, con cuenta existente (con 107 recetas copiadas y alguna de IA o propia).
1. Corrige las macros de una receta en el JSON, despliega y al recargar ve el valor nuevo.
2. Añade `cuisine` a todas las recetas y la app lo ve sin migración.
3. Abre la app tras la actualización: sus recetas de IA y propias siguen ahí y el plan, el diario y la compra están igual.
4. Importa una copia de seguridad antigua (con las 107 recetas dentro): no se duplica nada y sus recetas propias se mantienen.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El catálogo se lee del JSON del bundle en cada carga y no se copia a `localStorage`. | Must |
| R2 | En `mp_<userId>_recipes` solo se guardan recetas del usuario (IA y propias). | Must |
| R3 | Al cargar, una migración idempotente quita de lo guardado las recetas cuyo id es del catálogo (aunque su contenido difiera) y conserva las de IA y propias. | Must |
| R4 | La copia de seguridad exporta solo las recetas del usuario. | Must |
| R5 | Importar una copia antigua (con las recetas del catálogo dentro) funciona y no crea duplicados. | Must |
| R6 | Las pantallas, el plan, el diario, la lista de la compra y los favoritos se comportan igual que hoy: el usuario ve el catálogo y sus recetas juntos. | Must |
| R7 | Un id del catálogo que ya no existe no rompe el plan, el diario ni la compra: el hueco del plan se muestra como "Receta no disponible" y se puede quitar. | Should |

Regla de contenido (no es un requisito de software): un id del catálogo no se borra; una receta retirada se redirige a otra con `RETIRED_RECIPE_IDS`, como ya se hace.

## User flows
1. **Cambio de catálogo.** Manuel edita el JSON → despliega → recarga la app → ve la receta nueva o corregida en Recetas, Plan, Diario y Compra, sin ninguna acción.
2. **Primera carga tras la actualización.** La app carga las recetas guardadas → quita las del catálogo → guarda solo las del usuario → muestra catálogo + usuario.
3. **Importar copia antigua.** Perfil → importar → la copia pasa por las mismas migraciones que la carga (R3) → quedan solo las recetas del usuario de la copia.

## Acceptance criteria
**R1**
- Given una cuenta existente, when se cambia una macro o se añade un campo en `src/data/recipes.json` y se recarga, then la pantalla muestra el valor nuevo sin borrar datos ni migrar nada.
- Given una receta nueva en el JSON, when se recarga, then aparece en Recetas.

**R2**
- Given una cuenta nueva, when se abre la app, then `mp_<userId>_recipes` está vacío o no existe.
- Given una receta generada con IA o creada por el usuario, when se guarda, then se persiste en `mp_<userId>_recipes` y no se añade ninguna del catálogo.

**R3**
- Given una cuenta con las recetas del catálogo guardadas más 2 de IA y 1 propia, when carga la app, then en `mp_<userId>_recipes` quedan exactamente esas 3.
- Given que ya se migró, when se vuelve a cargar, then el almacén no cambia.
- Given una receta guardada con id del catálogo y contenido distinto al del JSON, when carga, then se quita y se ve la versión del JSON.
- Given un perfil sincronizado con #22, when carga, then el almacén local se limpia igual y la comprobación `hasUserData` sigue considerando solo las recetas del usuario.

**R4**
- Given una cuenta con 107 del catálogo, 2 de IA y 1 propia, when se exporta la copia, then `data.recipes` contiene solo las 3 del usuario.

**R5**
- Given una copia antigua con las recetas del catálogo + las de IA/propias, when se importa, then el resultado contiene cada receta del usuario una sola vez y ninguna del catálogo guardada.
- Given una copia nueva, when se importa en la app, then el resultado es el mismo que si se hubiera cargado.
- Given una copia, when se importa, then sigue siendo todo o nada, como hoy.

**R6**
- Given un plan, un diario, una lista de la compra y favoritos que referencian recetas del catálogo, when se migra, then se ven igual que antes (mismos nombres, macros e ingredientes).
- Given una receta del catálogo marcada como favorita, when se migra, then sigue siendo favorita.

**R7**
- Given un hueco del plan con un id sin receta, when se abre el Plan, then se muestra "Receta no disponible", los macros y la lista de la compra lo omiten sin fallar, y se puede quitar el hueco.
- Given una entrada del diario con un id sin receta, when se abre el diario, then se muestra sin romper la pantalla.

## Edge cases
- Una receta de IA con id parecido a uno del catálogo: los ids de IA son `ai_NNN`, no `recipe_*`, así que no se confunden con el catálogo.
- Un perfil o una copia con `recipes` vacío o ausente: queda vacío y el usuario ve solo el catálogo.
- Una receta retirada con alias (`RETIRED_RECIPE_IDS`): las entradas y el plan siguen migrando al id que se queda (R3 no lo cambia).
- Dos dispositivos sincronizados, uno con la versión antigua de la app: el antiguo vuelve a sembrar el catálogo en su almacén y lo sube al servidor. La carga de la versión nueva lo vuelve a quitar (R3 es idempotente).

## Success metrics
Sin métricas formales (app de uso propio): se verifica con los criterios de aceptación y con un cambio real del JSON que llega a una cuenta existente.

## Risks & dependencies
- Un id del catálogo pasa a ser un contrato con el plan, el diario y la compra (regla de contenido + R7).
- `schemaVersion` de la copia de seguridad: subirlo o no se decide en el tech design. Una copia nueva no debería romper una versión antigua de la app, que vuelve a sembrar el catálogo.
- Toca `userData.ts`, `store.tsx`, `backup.ts` y `syncMigration.ts`, y los tests de #20, #18, #22 y la copia de seguridad.
- Debe ir antes de [recetas-cocina](../recetas-cocina/brief.md), que es lo primero que cambia el JSON.

## Open questions
- [ ] ¿Sube `schemaVersion` de la copia de seguridad? (tech design)
- [ ] ¿Cómo se comporta un dispositivo con la app antigua en sincronización (edge case de arriba)? ¿Basta la idempotencia de R3 o hay que evitar la subida? (tech design)
- [ ] ¿Qué ocurre con los ids de recetas de IA duplicados entre generaciones (`ai_001` repetido)? Ya existe hoy; fuera de esta spec salvo que el tech design vea un riesgo. (Manuel)
