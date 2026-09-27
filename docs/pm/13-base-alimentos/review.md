# Base de datos de alimentos: Review
_PR: [#63](https://github.com/mancabcar/MealPlan/pull/63) · Reviewed: 2026-09-27 · Verdict: ⚠️ approved with follow-ups_

## Summary
Los 14 requisitos (R1–R14) están implementados y tienen test automático. La CI está verde (test y Vercel) y el PR solo añade tests: no se ha saltado ni relajado ninguno. La review se hizo después del merge (el PR se mergeó el 2026-09-27 a las 18:05), así que lo que sale queda como follow-ups. Ningún hallazgo afecta a un Must. Hay dos bugs visibles para el usuario: las comillas en la búsqueda de marcas y la duración del aviso. El usuario los ha clasificado como no bloqueantes.

## Spec conformance
| Req | Status | Where | Tested |
|---|---|---|---|
| R1 | ✅ Done | src/app/page.tsx:343, :358 | ✅ e2e |
| R2 | ✅ Done | src/lib/foods.ts:52; src/components/diario/FoodPicker.tsx:286 | ✅ unit + e2e |
| R3 | ✅ Done | src/data/foods.json (161), scripts/build-foods.mjs, scripts/foods-list.json; cita en src/lib/foods.ts:44 | ✅ unit + e2e |
| R4 | ✅ Done | src/app/api/foods/search/route.ts:67, :102; FoodPicker.tsx:307, :354 | ✅ unit + e2e |
| R5 | ✅ Done | FoodPicker.tsx:129, :158, :126 | ✅ e2e |
| R6 | ✅ Done | src/lib/foods.ts:68; FoodPicker.tsx:243 | ✅ unit + e2e |
| R7 | ✅ Done | src/lib/foods.ts:100; FoodPicker.tsx:166 | ✅ unit + e2e |
| R8 | ✅ Done | src/lib/diary.ts:65; src/app/page.tsx:358 | ✅ unit + e2e |
| R9 | ✅ Done | src/lib/diary.ts:85; src/app/page.tsx:275 | ✅ unit + e2e |
| R10 | ✅ Done | src/app/page.tsx:484 | ✅ e2e (ver follow-up del temporizador) |
| R11 | ✅ Done | route.ts (429/502); FoodPicker.tsx:339 | ✅ unit + e2e |
| R12 | ✅ Done | src/lib/foods.ts:111; src/lib/useBrandSearch.ts:58 | ✅ unit + e2e |
| R13 | ✅ Done | src/lib/diary.ts:150; src/components/diario/RecentMeals.tsx:23 | ✅ unit + e2e |
| R14 | ✅ Done | FoodPicker.tsx:373; src/app/page.tsx:358 (`onManual`) | ✅ e2e |

Decisiones del usuario en la review:
- **R2:** «primero las que empiezan por lo escrito» se lee como «por la primera palabra escrita». Es la lectura que quería.
- **Divergencias del prototipo, aceptadas:** el botón de marcas va en el color de acento (lima), no en azul, porque la paleta no tiene un azul para esto. El aviso muestra la misma etiqueta que el Diario («Añadido a Comida · 2 ud · 120 g»).
- **Cambio fuera de la feature, aceptado en dev-code:** `aria-label="Fecha"` en el selector de fecha del Diario.

## Blocking
Ninguno.

## Non-blocking
- **Las comillas y los dos puntos rompen la búsqueda de marcas:** src/app/api/foods/search/route.ts:67. El texto del usuario va sin escapar dentro de la consulta de Search-a-licious. Con `yogur "griego`, el filtro de España acaba convertido en una frase y OFF devuelve 0 productos (comprobado contra la API real). → Quitar o escapar `"`, `:`, `(`, `)` y demás sintaxis de la consulta antes de añadir `countries_tags:"en:spain"`, con un test.
- **El aviso con Deshacer se acorta si se añaden dos alimentos seguidos:** src/app/page.tsx:484. El `Toast` sigue montado y su temporizador no se reinicia, así que el segundo aviso dura lo que le quedaba al primero (R10: «la misma duración»). → `key={added.entryId}` en el `Toast`.
- **El 429 de OFF se pierde al recargar:** src/lib/useBrandSearch.ts. `blockedUntil` (Retry-After) solo vive en el estado de React; el contador sí va en sessionStorage. Tras recargar, el botón vuelve a estar activo mientras OFF sigue limitando. → Guardarlo en sessionStorage junto a `mp_off_searches`.
- **Elección frágil del XML:** scripts/build-foods.mjs. `readXml("alim_")` también casa con `alim_grp_2020_07_07.xml` y solo funciona por el orden del listado. → Buscar `/^alim_\d/`.
- **«Lomo embuchado» es una aproximación** (delegado a Claude en dev-code): no existe ni en CIQUAL ni en USDA, y usa «Jambon sec, découenné, dégraissé» (CIQUAL 28802). → Revisar el valor o buscar otra fuente con licencia abierta.
- **Caso límite sin test:** el spec dice que los totales, las medias y la adherencia (#11) cuentan las entradas de alimento por sus macros. Funciona porque son entradas con `calories`/`protein`…, pero ningún test lo cubre. → Un caso en `diaryStats.test.ts` (dev-test).

## Code review findings
- **Pestañas copiadas:** src/app/page.tsx:325–354. Los botones Receta / Alimento / Personalizada repiten tres veces el mismo `className`. → Un `map` sobre `[modo, etiqueta]`.
- **`normalize` repetido:** src/lib/foods.ts:52. `searchLocalFoods` normaliza los 161 nombres en cada llamada, y `FoodPicker` la llama en cada render del Diario mientras hay texto. → Precalcular los nombres normalizados una vez.
- **sessionStorage en cada render:** src/lib/useBrandSearch.ts. `cooldown` se calcula en render con `readStamps()`, que lee y parsea sessionStorage en cada tecla del formulario. → Cargar las marcas de tiempo una vez en un ref y actualizarlas en `run()`.
