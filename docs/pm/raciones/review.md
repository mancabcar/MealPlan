# Raciones al registrar recetas: Review
_PR: [#30](https://github.com/mancabcar/MealPlan/pull/30) · Revisado: 2026-09-24 · Veredicto: ✅ Aprobar_

## Resumen
El PR construye los nueve requisitos (7 Must, 1 Should y 1 Could) como describe tech.md (enfoque A): los macros se guardan ya escalados y sin redondear en la entrada, y `servings` solo se guarda cuando es distinto de 1. Por eso los totales, la gráfica y los pendientes no cambian, y las entradas antiguas cuentan como 1 ración sin migración. Cada criterio de aceptación tiene un test automático. En la cabeza del PR (`995fe28`) están en verde los unit (390/390), los e2e (131/131), typecheck y lint. No hay nada bloqueante. Los hallazgos son menores y opcionales.

## Conformidad con el spec
| Req | Estado | Dónde | Test |
|---|---|---|---|
| R1 (Must) | ✅ Hecho | campo "Raciones" en modo "Receta" (`src/app/page.tsx:297`–`:352`), valor inicial "1" (`:104`, `:122`); rango y paso en `SERVINGS` (`src/lib/diary.ts:7`) | ✅ unit + e2e |
| R2 (Must) | ✅ Hecho | `recipeEntry` multiplica los 4 macros (`src/lib/diary.ts:14`); los totales ya suman las entradas (`src/app/page.tsx:129`); redondeo solo al mostrar (`:175`, `:177`, `:248`) | ✅ unit + e2e (0,5 → 300; 1,5 → 900; sin tocar → 600; 3 × 0,25 de 150 → 113) |
| R3 (Must) | ✅ Hecho | `servings` guardado si ≠ 1 (`src/lib/diary.ts:30`); tipo en `src/lib/types.ts:28` | ✅ unit + e2e (incluida la recarga) |
| R4 (Must) | ✅ Hecho | `servingsLabel` (`src/lib/diary.ts:54`) → "× 0,5" junto al nombre (`src/app/page.tsx:239`); nada con 1 | ✅ unit + e2e |
| R5 (Must) | ✅ Hecho | sin campo = 1 ración; `servingsLabel` devuelve `null`; sin migración | ✅ unit + e2e (datos sin reescribir) |
| R6 (Must) | ✅ Hecho | `parseServings` sobre `parseDecimal` (`src/lib/diary.ts:35`); en `submitAdd` no añade y muestra el error (`src/app/page.tsx:152`, `:347`, con `aria-invalid` y `aria-describedby`) | ✅ unit + e2e ("0", "0,1", "4,25", "5", "abc", "", extremos) + caso axe |
| R7 (Must) | ✅ Hecho | "Hecho" y "Registrar todo el día" llaman a `recipeEntry` sin opciones (`src/app/page.tsx:195`, `:222`) → la misma entrada que antes | ✅ e2e (`raciones.spec.ts` › R7 y `diario-desde-plan.spec.ts` › R2) |
| R8 (Should) | ✅ Hecho | − / + con `stepServings` (`src/lib/diary.ts:43`), deshabilitados en los extremos (`src/app/page.tsx:317`, `:335`) | ✅ unit + e2e |
| R9 (Could) | ✅ Hecho | "= N kcal" con receta elegida y valor válido (`src/app/page.tsx:118`, `:342`) | ✅ e2e |

**Casos límite:** receta borrada después ✅ (e2e: "Receta × 0,5", 300 kcal) · cambiar de receta mantiene las raciones ✅ (e2e) · modo "Personalizada" oculta el campo y la entrada no lleva `servings` ✅ (e2e) · receta con macros cambiados después ✅ (por construcción: la entrada no se recalcula) · flujo paso 5, "Raciones" vuelve a 1 al reabrir tras añadir y tras cancelar ✅ (e2e).

**Alcance:** no se ha construido nada de lo que el spec deja fuera: ni raciones en el Plan ([issue #29](https://github.com/mancabcar/MealPlan/issues/29)), ni `Recipe.servings`, ni edición de entradas, ni raciones en "Personalizada". El diff solo toca `src/app/page.tsx`, `src/lib/diary.ts`, `src/lib/types.ts`, tests, fixtures y docs. No se ha saltado, borrado ni relajado ningún test: las 4 llamadas a `recipeEntry` de `diary.test.ts` pasan de `id` posicional a `{ id }` (el cambio de firma de tech.md) con las mismas aserciones, y `diario-desde-plan.spec.ts` › R2 gana una aserción.

**Tech design:** se ha seguido, sin desviaciones relevantes. Solo cambia un detalle de implementación: `parseServings` comprueba `Number.isInteger(v / SERVINGS.step)` en vez de `v * 4`. Con el paso actual (0,25) es equivalente. Las decisiones por defecto de tech.md › Spec feedback (1–6) están implementadas tal cual.

## Bloqueantes
Ninguno.

## No bloqueantes
1. **Sin aviso si no hay receta elegida**: `src/app/page.tsx:150`. `submitAdd` sale sin avisar antes de validar las raciones, así que con "abc" y sin receta, "Añadir" no hace nada y no muestra ningún mensaje. Ya pasaba antes y tech.md lo deja fuera de alcance, pero ahora el formulario tiene un patrón de error. → Si se quiere, en un issue aparte: validar primero las raciones, o mostrar "Elige una receta" con el mismo patrón.
2. ✅ _Arreglado (review fixes)._ **Comentario desfasado en `parseServings`**: `src/lib/diary.ts:37`. Dice "v * 4 es exacto", pero el código divide por `SERVINGS.step`. Si algún día el paso deja de ser una potencia de 2 (por ejemplo 0,1), `v / 0.1` no es exacto en coma flotante y se rechazarían valores válidos. → Ajustar el comentario, o usar `Number.isInteger(v * 4)` como en tech.md.
3. ✅ _Arreglado (review fixes)._ **Kcal de la fila de pendiente sin redondear**: `src/app/page.tsx:234`. La fila de pendiente muestra `{slot.recipe.calories} kcal` tal cual, y las filas de entrada ahora usan `Math.round`. Con las recetas actuales (kcal enteras) no se nota; con una receta de kcal decimales, la fila de pendiente y la entrada que crea "Hecho" mostrarían cifras distintas. Ya pasaba antes. → `Math.round` también ahí, si se toca esa zona.

## Hallazgos de la revisión de código
- **Robustez**: `servingsLabel` (`src/lib/diary.ts:54`) formatea cualquier número finito con `String(n)`, así que un valor raro guardado a mano (por ejemplo 0,1 + 0,2) saldría como "× 0,30000000000000004". Desde la UI solo se escriben múltiplos de 0,25, así que solo importa si una importación de copias de seguridad llega a traer entradas de fuera. → Redondear a 2 decimales en `formatServings` cuando haga falta.
- **Simplificación**: el reset a "1" tras añadir (`src/app/page.tsx:162`) repite el que ya hace `openAdd` (`:122`) cada vez que se abre el formulario. Lo pide tech.md y no hace daño, así que es opcional.
