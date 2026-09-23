# Lista de la compra desde el plan semanal
_Status: reviewed — ⚠️ Approve with follow-ups ([PR #24](https://github.com/mancabcar/MealPlan/pull/24), [review](review.md)) · Updated: 2026-09-23 · Origen: [issue #5](https://github.com/mancabcar/MealPlan/issues/5) · Prototype: [canvas](https://claude.ai/artifact/P1MhiwSReXZZ668pVjNAgW) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

> Brainstorm omitido: el issue #5 ya trae problema, propuesta, criterios de aceptación y notas técnicas. Se pasa directamente a prototipo (decisión del usuario, 2026-09-23).

## Problema
El Plan semanal solo guarda `recipeId` por franja; no hay forma de saber qué comprar para la semana. Es la razón principal por la que se usa un planificador (Mealime, Paprika, Samsung Food y Eat This Much la tienen).

## Apuesta
- Nueva vista "Lista de la compra" (desde Plan o como pestaña) que agrega los ingredientes de las recetas planificadas en un rango de fechas (por defecto, la semana visible).
- Descontar lo que ya hay en la Despensa (coincidencia por nombre, con posibilidad de desmarcar).
- Marcar ítems como comprados y, opcionalmente, pasarlos a la Despensa.

## Criterios de aceptación (del issue)
- Con recetas asignadas en la semana, la lista muestra sus ingredientes agrupados, sin duplicados exactos.
- Los ingredientes presentes en la Despensa aparecen como "ya lo tienes".
- Marcar un ítem como comprado persiste (localStorage por usuario).
- Solo cuenta las franjas de las comidas activas del perfil (igual que el total de kcal del Plan).

## Notas técnicas (del issue)
- `Recipe.ingredients` es `string[]` libre ("200 g de pollo"): sumar cantidades requiere parsear cantidad/unidad; una primera versión puede agrupar por texto normalizado y dejar la suma para después.
- Relacionado: `src/app/plan/page.tsx`, `src/lib/types.ts` (`WeekPlan`, `PantryItem`).

## Prototype
_Design: [Lista de la compra prototype](https://claude.ai/artifact/P1MhiwSReXZZ668pVjNAgW) · 2026-09-23_

Dibujado con el lenguaje visual de `design-refresh` (oscuro, acento lima, Space Grotesk + Manrope), porque ese rediseño ya está en tech design y saldrá antes. Datos: recetas reales de `recipes.json` y una Despensa coherente con el prototipo del rediseño.

- **Pantallas** (flujo de izquierda a derecha, todas clicables en Play):
  1. Plan semanal: tarjeta «Lista de la compra · 38 por comprar · 6 ya los tienes»
  2. Lista de la compra: progreso, productos por pasillo, «Ya lo tienes» y «Especias y básicos» (interactiva: al marcar un producto baja a «Comprados»)
  3. Detalle de «ya lo tienes» (Pechuga de pollo): con qué producto de la Despensa coincide, qué comidas lo usan y el botón «Añadir a la lista de todos modos»
  4. En la tienda: 35 de 38 comprados, y el botón «Pasar 35 comprados a la Despensa»
  5. Pasar a la Despensa: hoja con el sitio propuesto para cada producto (Nevera, Despensa o Congelador)
  6. Despensa actualizada: productos «Nuevo» y aviso con «Deshacer»
  7. Estado vacío: no hay recetas en el plan de la semana
- **Decisiones tomadas al prototipar (ASSUMPTIONs)**:
  - Se entra desde Plan (una tarjeta), no desde una 6ª pestaña.
  - Se agrupa por pasillo (Frutas y verduras, Carne y pescado, Lácteos y huevos, Despensa y conservas) con una clasificación por palabras clave.
  - Se suman las cantidades cuando el ingrediente es exactamente el mismo y la unidad coincide (brócoli 150 g + 150 g = 300 g; huevos 1 + 1 + 2 = 4). Con unidades distintas se muestran juntas sin sumar («200 g + 1 bote»). Si el texto es distinto, la línea es distinta («Patata» y «Patata pequeña» salen por separado).
  - Solo cuentan las comidas activas del perfil; el prototipo lo dice en la cabecera («17 comidas planificadas · Desayuno, Comida y Cena»).
  - Lo caducado en la Despensa no cuenta como «ya lo tienes»: los espárragos caducados salen en la lista con un aviso.
  - La coincidencia con la Despensa es por nombre y enseña con qué producto ha coincidido («Tienes: Arroz integral · 1 kg»). El detalle muestra el total necesario (420 g de pollo) al lado de lo que hay (3 filetes); decide el usuario y puede anular la coincidencia.
  - Las especias y los básicos (sal, pimienta, vinagre…) van en un grupo plegado que no cuenta en el total.
  - Los productos comprados bajan a una sección plegada «Comprados» en vez de quedarse tachados en su sitio.
  - Pasar a la Despensa es opcional. Propone el sitio según el pasillo (se puede cambiar) y la cantidad llega ya sumada. Se puede deshacer.
  - El rango es la semana visible del Plan, sin selector.
- **Qué aprender al probarlo**: si la lista con cantidades sumadas es lo bastante fiable para ir a comprar; si «ya lo tienes» por coincidencia de nombre da confianza sin comparar cantidades (el caso del pollo: 3 filetes para 420 g); si pasar los comprados a la Despensa merece la pena; si la tarjeta en Plan se encuentra bien.
- **Decisiones del usuario sobre el prototipo (2026-09-23)**:
  1. Sumar cantidades cuando el ingrediente sea exactamente el mismo (mismo texto normalizado y misma unidad).
  2. «Ya lo tienes» por coincidencia de nombre, sin comparar cantidades: vale por ahora.
  3. Al pasar a la Despensa, las cantidades llegan sumadas.
- **Pregunta abierta para la spec**: si un producto comprado ya estaba en la Despensa, ¿se suma a lo que había o se crea otra línea?

## Estado y siguiente paso (2026-09-23)
- **Decidido:** se construye después de `design-refresh` (ya en `main`, PR #4). Pasar a la Despensa siempre crea una línea nueva. Todos los defaults de la tech design están aceptados y recogidos en [spec.md](spec.md) (estado: Approved).
- **Hecho:** tests-first en la rama local `feature/lista-compra` (commit `a718565`, sin push). 141 casos unitarios y 31 e2e, todos en rojo solo porque el código no existe. Los tests fijan la API: ver [tech.md](tech.md) › Test notes.
- **Siguiente:** `dev-code` en esa rama, siguiendo tech.md › Tasks (1 → 14) hasta poner los tests en verde, y después PR (pedir confirmación antes de abrirlo) y `dev-review`.
- **A tener en cuenta:** revisar el snapshot del corpus antes de commitearlo; `npm run typecheck` falla hasta que existan los módulos; el ruido de `npm run lint` viene de `.claude/worktrees/` (sin seguimiento en git), no del proyecto.
