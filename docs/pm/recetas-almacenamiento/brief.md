# Dónde viven las recetas: JSON, localStorage o base de datos
_Status: in review · Updated: 2026-10-05 · Issue: [#42](https://github.com/mancabcar/MealPlan/issues/42) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#133](https://github.com/mancabcar/MealPlan/pull/133)_

## Follow-ups
- `saveRecipe` con un id del catálogo guardaría una receta que la carga siguiente descarta (la migración quita por id). Hoy la interfaz no lo permite (las del catálogo se duplican con id nuevo); si #18 llega a editar in situ, decidir la precedencia por id.
- Si algún día se hace la sincronización entre dispositivos ([#22](https://github.com/mancabcar/MealPlan/issues/22)), las recetas del usuario van a la base de datos con el resto de sus datos. El catálogo puede seguir en el bundle.
- Crear y editar recetas propias ([#18](https://github.com/mancabcar/MealPlan/issues/18)): editar una receta del catálogo tiene que hacer una copia del usuario (copy-on-edit), no modificar el catálogo.
- «Promocionar» al catálogo una receta generada con IA que guste (de la copia de seguridad a `src/data/recipes.json` con un script). Solo si el catálogo empieza a crecer a mano.

## Problem
Manuel (único usuario) quiere que el recetario crezca: cocinas nuevas ([recetas-cocina](../recetas-cocina/brief.md)), recetas de temporada ([temporada](../temporada/brief.md)), recetas propias ([#18](https://github.com/mancabcar/MealPlan/issues/18)) e importadas ([#19](https://github.com/mancabcar/MealPlan/issues/19)). Se pregunta si `src/data/recipes.json` debería ser una base de datos.

**¿Raíz o síntoma?** Síntoma, y la pregunta parte de una premisa que no es del todo cierta. Las recetas **no se guardan en el JSON**: el JSON es solo una semilla. Al cargar, `withSeedRecipes` (`src/lib/userData.ts`) copia las 40 recetas al `localStorage` de cada usuario (`mp_<userId>_recipes`), y ahí se añaden también las generadas con IA. La lista guardada en `localStorage` es la fuente de verdad.

Eso tiene un problema real, y no es de base de datos: **la siembra solo añade las recetas cuyo id falta**. Si se corrige una receta del JSON o se le añade un campo, los usuarios que ya existen no lo ven nunca. Cambiar las macros de `recipe_002`, arreglar una errata o añadir `cuisine: "Asiática"` a las 40 recetas (justo lo que pide recetas-cocina) llega a una cuenta nueva y no a la de Manuel. Hoy no ha molestado porque el JSON no se ha tocado desde el port inicial (commit 90955ed). Con recetas-cocina y temporada se va a tocar.

Replanteado: *Manuel necesita que los cambios del catálogo de recetas (correcciones, campos nuevos, recetas nuevas) le lleguen, sin perder las recetas que genera o crea él, porque el recetario va a crecer y cambiar de forma. Hoy cada cuenta tiene una copia congelada del catálogo y la única forma de ver un cambio es borrar sus datos.*

¿Hace falta una base de datos por tamaño o rendimiento? No. 40 recetas ocupan 32 KB; `localStorage` admite unos 5 MB, es decir, unas 6.000 recetas. Filtrar y buscar 40, 400 o 2.000 recetas en memoria es instantáneo. Lo único que de verdad pide una base de datos (en un servidor) es compartir datos entre dispositivos, y eso es [#22](https://github.com/mancabcar/MealPlan/issues/22), no una cuestión de recetas.

## Success looks like
- Cambiar una receta en `src/data/recipes.json` (macros, campo `cuisine`, receta nueva) se ve en la cuenta de Manuel al recargar, sin borrar nada.
- Las recetas generadas con IA (y en el futuro las propias) se conservan igual que hoy, en la copia de seguridad incluida.
- Añadir un campo a las recetas (cocina, temporada) no necesita una migración de datos del usuario.

## Constraints & assumptions
- Next.js 16 sin backend; todos los datos del usuario viven en `localStorage` bajo `mp_<userId>_<clave>`, se cargan de forma síncrona en `AppProvider` (`src/lib/store.tsx`) para evitar el parpadeo del onboarding, y la copia de seguridad (`src/lib/backup.ts`) exporta la clave `recipes` tal cual.
- Hoy no hay forma de editar ni borrar recetas en la app: solo se añaden las de IA (`addRecipes`). Por tanto, todas las recetas `recipe_*` guardadas son idénticas a las del JSON.
- Supuesto: el catálogo lo cura Manuel en el repo (con PRs, como el resto), no los usuarios desde la app.
- Supuesto: un solo usuario real, así que el catálogo no necesita gestión de contenidos ni panel de administración.

## Directions considered

### A. Semilla versionada: arreglar la siembra y nada más
Cada receta del JSON lleva un `version` (o se compara un hash). Al cargar, `withSeedRecipes` sustituye las recetas guardadas del catálogo cuya versión haya cambiado, además de añadir las que faltan. Es un cambio de unas pocas líneas en `userData.ts` más un test. **Risk:** sigue guardando una copia del catálogo por usuario, y cuando exista la edición (#18) habrá que distinguir entre «receta del catálogo que el usuario ha cambiado» y «receta vieja que hay que actualizar». Eso complica justo el caso que viene después.

### B. Separar catálogo y recetas del usuario (recomendada)
El catálogo se lee directamente del JSON del bundle en cada carga y **deja de copiarse** a `localStorage`. En `mp_<userId>_recipes` solo se guardan las recetas del usuario (IA hoy, propias mañana). El store expone `recipes = [...catálogo, ...delUsuario]`, así que las páginas no cambian. La migración es de una vez y es idempotente: quitar de lo guardado las recetas `recipe_*` (hoy son idénticas al catálogo). La copia de seguridad pasa a exportar solo las recetas del usuario. **Risk:** los ids del catálogo pasan a ser un contrato: si un día se quita una receta del JSON y había comidas del plan o del diario que la referenciaban, hay que tratarlo (hoy el plan guarda el id de la receta).

### C. IndexedDB en el navegador
Pasar las recetas (o todos los datos) de `localStorage` a IndexedDB, con Dexie o similar, para tener una base de datos local con índices y consultas. **Risk:** mucho esfuerzo sin problema que lo pida: la API es asíncrona, así que rompe la carga síncrona del store (vuelve el parpadeo del onboarding) y obliga a reescribir `usePersisted`, la copia de seguridad y los tests. Y además no arregla el catálogo congelado, porque seguiría siendo una copia.

### D. Base de datos en servidor (Supabase / Postgres), dentro de #22
Mover todos los datos del usuario a un backend con cuentas reales, que es lo que pide la sincronización entre dispositivos. El catálogo podría ser una tabla compartida. **Risk:** es el proyecto más grande del backlog (auth, coste, conflictos, modo sin conexión) y solo tiene sentido si Manuel usa la app en más de un dispositivo. Hacerlo **solo para las recetas** es lo peor de los dos mundos: toda la complejidad de un backend y los demás datos siguen siendo locales.

### E. El catálogo como contenido: un fichero por receta
Contrario a la intuición: en vez de alejar las recetas del repo, hacerlas más editables en él. `src/data/recipes/<id>.json` (o Markdown con frontmatter), validados por un test de esquema en CI, y el bundle los junta en build. Añadir recetas de temporada o de una cocina es un PR con ficheros pequeños y diffs legibles. **Risk:** mejora la edición, no el problema de raíz. Sin B, los cambios siguen sin llegar a las cuentas que ya existen. Y con 40 recetas un único JSON aún se maneja bien.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Semilla versionada | Med | Low | Med | Nadie va a editar recetas del catálogo (lo contradice #18) |
| B. Separar catálogo y usuario | High | Low–Med | High | Ninguna receta del catálogo se va a quitar o renombrar mientras el plan o el diario la referencian |
| C. IndexedDB | Low | High | Low | El tamaño o las consultas de `localStorage` se van a quedar cortos |
| D. Backend (#22) | High (si hay varios dispositivos) | Very high | Low | Manuel necesita usar la app en más de un dispositivo |
| E. Un fichero por receta | Low–Med | Low | Med | Editar un único JSON grande va a ser un problema real |

## Recommended bet
**B: separar el catálogo (JSON del bundle, solo lectura) de las recetas del usuario (`localStorage`), y no meter una base de datos.**

La respuesta corta a la pregunta es «todavía no». El JSON no es el problema: el problema es que se copia y se congela. Con B el JSON se convierte en lo que de verdad es, contenido de la app que se despliega con cada push, y `localStorage` guarda solo lo que es del usuario. Deja preparados recetas-cocina y temporada (añadir `cuisine` o `season` al JSON llega a todos al momento, sin migración) y #18 (editar una receta del catálogo se convierte en «guardar una copia del usuario con el mismo id», que tapa la del catálogo). También hace más fácil #22, si llega: solo hay que sincronizar las recetas del usuario, no 40 copias del catálogo.

A es tentadora por barata, pero es un parche que se complica en cuanto exista la edición. C y D resuelven problemas que la app no tiene.

**Qué me haría cambiar de opinión:**
- Si Manuel usa la app de verdad en móvil y ordenador y lo echa en falta → no hacer B por separado: diseñar #22 directamente con catálogo compartido y recetas del usuario en el servidor (la separación de B pasa a ser parte de ese diseño).
- Si el catálogo va a crecer a cientos de recetas curadas → añadir E encima de B.
- Si se quiere que las recetas del catálogo se puedan editar y borrar desde la app antes de hacer #18 → decidir el modelo de copy-on-edit ahora, en la spec de B.

**La forma más barata de comprobar la suposición más arriesgada:** buscar en `src/app/plan`, `src/lib/diary.ts`, `src/lib/planMacros.ts` y `src/lib/shopping` cómo se referencia una receta (¿solo por id?, ¿se copian nombre y macros?) y qué pasa hoy si el id no existe. Es media hora de lectura de código y decide si B necesita un plan para ids huérfanos.

## What to prototype
Nada de UI: B no cambia ninguna pantalla. Recomiendo **saltar pm-prototype** e ir a pm-spec (corta) o directamente a dev-technical-opinion. La pregunta que tiene que responder el tech design es:
- el modelo de datos (catálogo + recetas del usuario, precedencia por id para el futuro copy-on-edit);
- la migración idempotente de `mp_<userId>_recipes` (y el formato de copia de seguridad: ¿sube `schemaVersion`? ¿importar una copia antigua con las 40 recetas dentro sigue funcionando?);
- el comportamiento con ids del catálogo que desaparecen.

## Open questions
- ¿Usa Manuel la app en más de un dispositivo? Si la respuesta es sí, el camino es #22 y no B por separado.
- ¿Se debería poder ocultar o borrar una receta del catálogo que no gusta? Si sí, hace falta una lista `hiddenRecipeIds` en los datos del usuario.
- Copia de seguridad: ¿exportar solo las recetas del usuario, o también el catálogo por si acaso? (Recomendación: solo las del usuario; el catálogo viene con la app.)
- ¿Se hace B como paso previo de recetas-cocina, o dentro de su tech design? Recomendación: antes, porque recetas-cocina es la primera que cambia el JSON.
