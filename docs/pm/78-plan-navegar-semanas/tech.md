# Plan: navegar por semanas: Technical design
_Status: Draft · Updated: 2026-10-04_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Un hook `useWeekParam` lee la semana de `?semana=<lunes>` (validada y normalizada al lunes) y `/plan` y `/plan/compra` la usan en vez de `todayStr()`. El estado de la compra pasa de `{ current, usage }` a `{ weeks: Record<lunes, ShoppingWeekState>, lastMove? }`, con migración en el loader. Esfuerzo M, sin dependencias nuevas.

## Context
- `src/lib/week.ts`: `mondayOf`, `weekDates`, `addDays` ya existen y sirven para navegar.
- `src/app/plan/page.tsx:37` y `src/app/plan/compra/page.tsx:204` usan `weekDates(todayStr())`; `src/lib/shopping/useShoppingList.ts` usa `mondayOf(todayStr())`.
- `src/lib/shopping/state.ts`: `ShoppingState = { current, usage }`; `forWeek` resume la semana anterior en `usage` y la descarta. `usage` no lo lee ninguna UI.
- `src/app/despensa/page.tsx:33` usa `lastMove` y `undoLastMove` de `useShoppingList` para el «Deshacer» tras mover a la Despensa.
- Persistencia: `src/lib/store.tsx` (blob en localStorage, `mp_<user>_shopping`), migraciones en `src/lib/userData.ts`, backup valida `shopping` solo con `isObject` (`src/lib/backup.ts:109`), sync sube el blob entero (`src/lib/syncMigration.ts:41` mira `usage`/`current`).
- Proyecto estático (`output: "export"`, `next.config.ts`): `useSearchParams` exige `<Suspense>` (docs de Next en `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`).

## Approaches considered
### A. `weeks` por lunes (chosen)
`{ weeks: Record<lunes, ShoppingWeekState>, lastMove?: ShoppingMove & { week } }`. `loadShoppingState` acepta el formato viejo y lo convierte (`current` → `weeks[current.week]`; `usage` se descarta, ya que se deriva de `weeks`). **Pros** un único sitio donde mirar, `forWeek` desaparece. **Cons** toca varios tests y el loader. **Effort** M.
### B. Mantener `current`/`usage` y añadir `others`
Aditivo, pero dos lugares para el estado y `forWeek` sigue descartando. **Effort** M.
### C. Una clave de localStorage por semana
Rompe backup y sync (claves fijas). Descartada.

Motivo de la elección: lo recomendado coincide con lo elegido por el usuario.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Semana en URL | `src/lib/useWeekParam.ts` (nuevo) | Lee `semana` con `useSearchParams`, valida `AAAA-MM-DD`, normaliza con `mondayOf`; si falta o no vale, semana actual. Devuelve `{ monday, dates, isCurrent, href(week) }`. |
| Navegación | `src/components/plan/WeekNav.tsx` (nuevo) | ‹ › y «Hoy», rango de fechas e indicador de semana (R1, R6). `router.replace`. |
| Estado compra | `src/lib/shopping/state.ts` | Nuevo `ShoppingState`; transiciones sobre `weeks[monday]`; poda >26 semanas atrás (las futuras se conservan); `loadShoppingState` acepta ambos formatos. |
| Hook compra | `src/lib/shopping/useShoppingList.ts` | Recibe `monday`; `weekDates(monday)`; `today` solo para caducidad; `lastMove` global. |
| Plan | `src/app/plan/page.tsx` | `<Suspense>` + componente interno; `dates` de la semana vista; selección al cambiar semana (lunes, u hoy si es la actual); enlace a compra con `?semana=`. |
| Compra | `src/app/plan/compra/page.tsx` | Idem; `DetailSheet` usa la semana vista (R5); enlace de vuelta con `?semana=`. |
| Despensa | `src/app/despensa/page.tsx` | Sin cambio funcional: `lastMove` sigue global. |
| Sync | `src/lib/syncMigration.ts` | Detección de datos no vacíos lee `weeks`. |
| Swipe (R7) | `WeekNav` o hook en la página | Gestos con pointer events, última tarea. |

### Data model
```ts
interface ShoppingState {
  weeks: Record<string, ShoppingWeekState>; // clave = lunes
  lastMove?: ShoppingMove & { week: string };
}
```
`ShoppingWeekState` pierde `lastMove` (sube a la raíz). Migración en `loadShoppingState`: `current` con `week` no vacío → `weeks[week]`, su `lastMove` → raíz; `usage` se ignora. Backups antiguos pasan por la misma función. Escrituras: `update` crea la entrada de la semana vista si no existe y poda.

### APIs / interfaces
`useShoppingList(monday)`; `useWeekParam()`; `weekHref(path, monday)` (omite el parámetro si es la semana actual).

### UI
Cabecera del Plan con `WeekNav` encima del `DaySelector`; misma barra en la compra. Sin prototipo.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `useWeekParam` + `WeekNav` (‹ › «Hoy»), sin límite |
| R2 | `?semana=` en ambos enlaces; semana inválida → actual |
| R3 | `weeks` por lunes, loader con migración, backup/sync sin cambio de contrato, poda 26 semanas |
| R4 | El plan ya es por fecha (`weekPlan[date]`); solo cambian las fechas mostradas |
| R5 | `DetailSheet` usa `dates` de la semana vista |
| R6 | Indicador en `WeekNav` |
| R7 | Gesto de deslizar, última tarea |

## Risks & mitigations
- **Dispositivo con versión antigua** (PWA con caché) lee el blob nuevo y lo ve vacío. Mitigación: aceptado por el usuario como riesgo menor (app personal); el loader nuevo siempre convierte.
- **Build estático sin `<Suspense>`** falla. Mitigación: envolver las dos páginas y probar `next build`.
- **Pérdida de datos al migrar**. Mitigación: tests de migración con datos reales de la forma antigua; el estado de la semana actual se conserva íntegro.
- **`usage` desaparece**: nadie lo leía; se anota en el PR.

## Testing strategy
- Unit: `tests/unit/shopping-state.test.ts` (transiciones por semana, poda, undo global, loader viejo→nuevo, datos corruptos); helpers de `useWeekParam` (validación y normalización); `tests/unit/backup.test.ts` (importar backup con formato antiguo y nuevo).
- E2E: `tests/e2e/shopping-list.spec.ts` y nuevo `plan-semanas.spec.ts`: navegar ‹ › y «Hoy», compra de otra semana con estado propio, persistencia al recargar, URL inválida, vacío, «Se usa en».

## Tasks
1. [ ] Nuevo modelo `weeks` y loader con migración, poda y undo global, con tests unitarios (covers R3)
2. [ ] `useWeekParam` y `weekHref`, con tests (covers R1, R2)
3. [ ] `useShoppingList(monday)` y ajuste de Despensa/sync (covers R3, R5)
4. [ ] `WeekNav` y Plan con `<Suspense>`, enlace a compra con semana (covers R1, R2, R4, R6)
5. [ ] Compra con semana en URL y `DetailSheet` (covers R2, R5)
6. [ ] Tests e2e y comprobación de `next build` (covers R1–R6)
7. [ ] Deslizar para cambiar de semana, descartable (covers R7)

## Spec feedback
- Resuelta la pregunta abierta de la spec sobre retención: se podan las semanas con más de 26 semanas de antigüedad; las futuras se conservan.
- Abierta: texto exacto del indicador de semana (R6) y comportamiento del deslizado (R7); se deciden al implementar, con el usuario.

## Test coverage
Los tests definen «hecho» para dev-code; fallan porque la funcionalidad no existe (no por errores de sintaxis). API fijada por los tests: `src/lib/useWeekParam.ts` (`parseWeekParam`, `shiftWeek`, `weekHref`) y `src/lib/shopping/state.ts` (`EMPTY = { weeks: {} }`, `weekOf`, `updateWeek`, `recordMove(week, move)`, `undoMove(week, move)`, `moveToPantry(state, monday, move)`, `undoLastMove(state)`, `pruneWeeks(state, today)`, `loadShoppingState`). Contrato de UI en la cabecera de `tests/e2e/plan-semanas.spec.ts`.

| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/unit/week-param.test.ts › "R1: shiftWeek" | unit | 🔴 failing (not built) |
| R1 | tests/e2e/plan-semanas.spec.ts › "R1: …" (›, ‹, «Hoy», lunes seleccionado, sin límite) | e2e | 🔴 failing (not built) |
| R2 | tests/unit/week-param.test.ts › "R2: parseWeekParam", "R2: weekHref" | unit | 🔴 failing (not built) |
| R2 | tests/e2e/plan-semanas.spec.ts › "R2: …" (URL, recarga, lista sigue la semana, semana vacía) | e2e | 🔴 failing (not built) |
| R3 | tests/unit/shopping-state.test.ts › "R3: …" (weeks, poda 26 semanas, lastMove global) y "Revisión N5 + R3" (migración) | unit | 🔴 failing (not built) |
| R3 | tests/unit/backup.test.ts › "R3 (#78): una copia con el estado { current, usage }…" | unit | 🔴 failing (not built) |
| R3 | tests/unit/store.test.tsx, tests/e2e/backup-datos.spec.ts (adaptados al formato `weeks`) | unit/e2e | 🔴 failing (not built) |
| R3 | tests/e2e/plan-semanas.spec.ts › "R3: …" (estado por semana, persistencia, formato anterior, Deshacer) | e2e | 🔴 failing (not built) |
| R4 | tests/e2e/plan-semanas.spec.ts › "R4: …" | e2e | 🔴 failing (not built) |
| R5 | tests/e2e/plan-semanas.spec.ts › "R5: …" | e2e | 🔴 failing (not built) |
| R6 | tests/e2e/plan-semanas.spec.ts › "R6: …" (rango y «Hoy»); el texto del indicador «no es la actual» queda pendiente | e2e | 🔴 failing (not built) / ⏳ texto pendiente |
| R7 | — | — | ⏳ sin test (Could; decidido con el usuario) |
| Sync | detección de datos no vacíos en `syncMigration.ts` lee `weeks` | — | ⏳ sin test aún (revisar en dev-code) |
