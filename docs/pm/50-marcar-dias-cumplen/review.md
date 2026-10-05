# Marcar los días que cumplen en la gráfica semanal: Review
_PR: [#146](https://github.com/mancabcar/MealPlan/pull/146) · Reviewed: 2026-10-05 · Verdict: ✅ approved_

## Summary
Los 3 Must (R1–R3) y el Should (R4) están implementados con tests en tres capas (unit, componente y e2e). El code-review de nivel high encontró cuatro problemas menores en el borde de datos de la gráfica, y se corrigieron en la misma rama antes de cerrar el review ([2b40efd](https://github.com/mancabcar/MealPlan/commit/2b40efd)). Dos divergencias respecto a `tech.md` quedan aceptadas por el usuario.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | `src/lib/diaryStats.ts:79` (`weekDayStates`), `src/components/ui/WeekBarChart.tsx` (check bajo la barra) | ✅ unit, componente y e2e |
| R2 | ✅ Done | `weekDayStates` (hoy → `today`, futuro o sin entradas → `empty`, incumplido → `missed` sin icono) | ✅ unit y e2e |
| R3 | ✅ Done | `WeekBarChart.tsx` (`sr-only` con 4 estados, día y kcal) | ✅ componente y e2e |
| R4 | ✅ Done | `WeekBarChart.tsx` (leyenda siempre visible) | ✅ componente y e2e |

Métrica de éxito: el test unitario compara los días `met` con `periodStats(...).compliantDays`, y el e2e con «2 de 3 días dentro del objetivo».

## Blocking
Ninguno.

## Non-blocking
- ✅ fixed in 2b40efd: las kcal de la barra salían de una suma sin sanear y el estado de `dailyTotals`. Con una entrada de backup sin `calories` se leía «NaN kcal». Ahora las kcal salen de `dailyTotals`, lo que también quita la suma duplicada por día. Test: e2e «una entrada restaurada sin kcal suma 0».
- ✅ fixed in 2b40efd: con la fecha del Diario borrada, las 7 barras leían «undefined, sin registros». Ahora el texto dice solo el estado. Tests: componente «sin nombre de día» y e2e «fecha borrada».
- Divergencias de `tech.md` aceptadas por el usuario: el día en curso se lee con el nombre del día (no «hoy», ya corregido en `tech.md`), y las barras y la línea del objetivo quedan separadas de la fila de letras para que la línea coincida con las barras.
- Sin comprobar: tema claro y móvil real. Usa los tokens del tema, y la captura de la gráfica en el viewport móvil de Playwright salió bien.

## Code review findings
Los cuatro hallazgos del code-review (nivel high) están recogidos arriba: dos correcciones, la suma duplicada (resuelta con el primer arreglo) y la falta de tests de borde (resuelta con los dos tests nuevos).

## History
- 2026-10-05 pass 1: ✅ approved. 4 hallazgos menores en el borde de datos, todos clasificados no bloqueantes y corregidos en la rama; Vitest 1450/1450 y Playwright 531 pasados, 5 omitidos.
