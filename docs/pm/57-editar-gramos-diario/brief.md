# Diario: editar los gramos de una entrada ya registrada

_Status: merged (2026-10-19) · Updated: 2026-10-19 · Issue: [#57](https://github.com/mancabcar/MealPlan/issues/57) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#173](https://github.com/mancabcar/MealPlan/pull/173) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Problema
Con la base de alimentos (#13), una entrada del Diario guarda nombre + gramos + macros calculados. Si me equivoco de cantidad, hoy la única salida es borrarla con la ✕ y volver a registrarla: ninguna entrada del Diario se edita.

## Apuesta
Poder cambiar los gramos (o unidades) de una entrada ya registrada y que sus macros se recalculen.

## Decisiones del pipeline
- 2026-10-19: el usuario confirma este resumen del issue como brief y entra directo a spec (sin brainstorm ni prototipo: problema y solución claros, interacción pequeña).
- 2026-10-19 (spec): alcance alimentos (g/ud, mismo modo) + raciones de receta (Should); editor en la fila al tocarla; kcal en vivo; aviso con Deshacer que se cierra si la entrada vuelve a cambiar; sin métricas.
- 2026-10-19 (tech): recálculo en proporción (rescaleEntry), replaceEntry, DiaryEntryRow nuevo, FoodQuantityForm generalizado; Deshacer con doble red (cierra aviso + comprueba que la entrada no cambió); un aviso a la vez.
- 2026-10-19 (tests): fila «Cambiar cantidad de <nombre>»; vista previa con la etiqueta de la fila; helper puro undoEdit para el guard de Deshacer; fixture nuevo editar-cantidad.ts (arroz en vez de avena, que no está en los fixtures).

## Follow-ups
_De la review de la PR #173 (2026-10-19); pendientes de decidir si merecen issue al cerrar._
- Tocar la fila con el editor abierto no lo pliega (aria-expanded=true).
- Entradas antiguas en gramos no enteros abren el editor en error (parseGrams solo enteros).
- Unificar los avisos del Diario en un único estado `notice` (hoy, exclusión manual en 6 sitios).
- ServingsEditor duplica los botones de FoodQuantityForm y no desactiva «Guardar cambios».
- replaceEntry escribe y sincroniza aunque la id no exista.
- Sin test: entrada que desaparece por sync con el editor abierto; toques al desplazar en móvil real.
