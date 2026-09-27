# Base de datos de alimentos: Technical design
_Status: Draft · Updated: 2026-09-27_
_Related: [spec](spec.md) · [brief](brief.md) · [prototype](https://claude.ai/artifact/8TZ5a1jtbR6xst5EvzzBJK)_

## Summary
La pestaña «Alimento» se apoya en un módulo puro, `src/lib/foods.ts` (búsqueda, cálculo y validación), en una tabla empaquetada, `src/data/foods.json` (~150 genéricos de CIQUAL, con USDA de reserva, generada por un script), y en un route handler, `GET /api/foods/search`, que hace de proxy a Search-a-licious de Open Food Facts. La UI vive en `src/components/diario/FoodPicker.tsx`, y `MealEntry` gana tres campos opcionales (`foodId`, `grams`, `units`) sin migración. Esfuerzo: M–L; la parte L es preparar y revisar los datos.

## Context
- **Stack:** Next 16.2.9 (App Router), React 19, Tailwind 4, TypeScript. Tests con Vitest (`tests/unit/`) y Playwright (`tests/e2e/`); la CI (`.github/workflows/ci.yml`) pasa lint, typecheck, unit, build y e2e.
- **Datos del usuario** en localStorage por usuario (`src/lib/userData.ts`, `src/lib/store.tsx`). Las entradas pasan por `migrateEntries` (`src/lib/migrate.ts`). La copia de seguridad (`src/lib/backup.ts:91`) solo valida la forma mínima de las entradas y conserva los campos extra.
- **«Añadir comida»** está en `src/app/page.tsx` (422 líneas): `mode: "recipe" | "custom"`, `submitAdd()`, y la lista del Diario muestra `e.customName ?? receta.name` más `servingsLabel(e)` (`src/lib/diary.ts`).
- **Patrones reutilizables:** `recipeEntry()` y `servingsLabel()` en `src/lib/diary.ts`; `parseDecimal` en `src/lib/nutrition.ts`; `normalize()` en `src/lib/text.ts` (sin tildes, minúsculas, espacios colapsados); `Toast` con acción en `src/components/ui/Toast.tsx` (10 s por defecto, el mismo que usa la Despensa); `singleClick` contra el doble toque en `page.tsx`; `ChipRadios` y `Chip` en `src/components/ui/`.
- **Route handler existente:** `src/app/api/recipes/route.ts` (POST, `NextResponse.json`, errores con `{ error }` y 4xx/5xx). Tiene su test unitario (`tests/unit/recipes-route.test.ts`, que simula el SDK) y el e2e intercepta la ruta con `page.route`.
- Según la guía de Next 16 (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`), los GET no se cachean por defecto, y leer `request.url` o hacer `fetch` los hace dinámicos. No hace falta configuración extra.

## Approaches considered
### A. Módulo puro + tabla empaquetada + proxy de servidor (chosen)
`lib/foods.ts` y `data/foods.json` para los básicos (sin red), `GET /api/foods/search` para OFF y `FoodPicker` para la UI. · **Pros:** sigue el patrón de `recipes/route.ts`; el User-Agent que exige OFF se fija en el servidor; la lógica es pura y testeable; los básicos funcionan sin red. · **Cons:** una ruta más que mantener; todas las búsquedas salen de la IP del servidor (con un solo usuario, aceptable). · **Effort** M–L.

Elegido por el usuario (coincide con la recomendación).

### B. OFF directamente desde el navegador
Sin route handler: `fetch` a OFF desde el cliente (OFF permite CORS). · **Pros:** una pieza menos; el límite se aplica por usuario. · **Cons:** el navegador no deja fijar el `User-Agent` que OFF exige para identificar la app, y va contra la nota técnica del issue. · **Effort** M.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Datos | `scripts/foods-list.json` | Nuevo. Lista curada: id, nombre en español, fuente (`CIQUAL`/`USDA`), código en la fuente, nombre original en la fuente y `unitGrams` opcional. |
| Datos | `scripts/build-foods.mjs` | Nuevo. Node sin dependencias: lee el XML de CIQUAL descargado (ruta por argumento; no se commitea) y los valores USDA indicados, y escribe `src/data/foods.json`. |
| Datos | `src/data/foods.json` | Nuevo, generado. ~150 alimentos. |
| Lógica | `src/lib/foods.ts` | Nuevo. Tipos, búsqueda local, cálculo por gramos, redondeo para mostrar, validación de gramos y unidades, limitador de búsquedas de OFF. |
| Lógica | `src/lib/diary.ts` | `foodEntry()` y `quantityLabel()`, junto a `recipeEntry()` y `servingsLabel()`. |
| Tipos | `src/lib/types.ts` | `MealEntry` + `foodId?`, `grams?`, `units?`. |
| Servidor | `src/app/api/foods/search/route.ts` | Nuevo. GET, proxy a Search-a-licious. |
| Cliente | `src/lib/useBrandSearch.ts` | Nuevo. Hook: llama a la ruta, estados, limitador con sessionStorage, cuenta atrás. |
| UI | `src/components/diario/FoodPicker.tsx` | Nuevo. Buscador, bloques «Básicos» y «Productos de marca», tarjeta del alimento, cantidad. |
| UI | `src/app/page.tsx` | Tercer modo `"food"` (Receta / Alimento / Personalizada), alta de la entrada, Toast con Deshacer, `quantityLabel` en la lista del Diario, «¿No lo encuentras?» → Personalizada con el nombre. |
| Docs | `README.md` | Fuentes de datos (CIQUAL, USDA, OFF/ODbL) y cómo regenerar la tabla. |

### Data model
**`MealEntry`** (`src/lib/types.ts`): tres campos opcionales nuevos. Una entrada de alimento guarda su nombre en `customName`, así el Diario, las medias y adherencia (`diaryStats.ts`) y las copias de seguridad la tratan sin cambios.

```ts
export interface MealEntry {
  // …campos actuales…
  customName?: string;   // "Arroz blanco, cocido" · "Yogur griego natural · Marca"
  /** Alimento de origen (#13): "local:<id>" de foods.json, u "off:<código de barras>". */
  foodId?: string;
  /** Gramos registrados; si se registró en unidades, el equivalente (units × unitGrams). */
  grams?: number;
  /** Unidades (0,5–10, pasos de 0,5); solo si se registró en unidades. */
  units?: number;
}
```

Los macros se guardan sin redondear (como en las entradas con raciones) y se redondean al mostrar. **Sin migración:** las entradas existentes no llevan estos campos y `backup.ts` ya conserva los campos extra.

**`src/data/foods.json`:**

```ts
interface LocalFood {
  id: string;            // "arroz-blanco-cocido" (estable: forma parte de foodId)
  name: string;          // "Arroz blanco, cocido"
  kcal: number; protein: number; carbs: number; fat: number;  // por 100 g
  source: "CIQUAL" | "USDA";
  sourceCode: string;    // código del alimento en la fuente
  unitGrams?: number;    // peso típico de 1 ud (huevo, pieza de fruta, rebanada…)
}
```

La tabla no guarda la cita; la cita de CIQUAL/USDA es fija y va en el pie del bloque «Básicos».

**sessionStorage** `mp_off_searches`: marcas de tiempo (ms) de las búsquedas de OFF del último minuto. No son datos del usuario ni van en la copia de seguridad.

### APIs / interfaces
**`GET /api/foods/search?q=<texto>`** (`src/app/api/foods/search/route.ts`)
- `q` con menos de 2 caracteres, tras quitar espacios → `400 { error: "bad_query" }`.
- Llama a Search-a-licious (`https://search.openfoodfacts.org/search`) con el texto, filtrando por productos vendidos en España (`countries_tags` = `en:spain`), y pide solo los campos necesarios: código, `product_name_es` / `product_name`, `brands`, `nutriments` (`energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`), `serving_quantity` y su unidad. La sintaxis exacta del filtro y de los campos se comprueba contra la documentación de Search-a-licious al implementar.
- Cabecera `User-Agent: MealPlan/0.1 (+https://github.com/mancabcar/MealPlan)`.
- Normaliza y filtra: descarta los productos sin alguno de los cuatro macros por 100 g (R4) y devuelve como mucho 5. `servingGrams` solo si la unidad de la ración es `g`.
- Respuestas:
  - `200 { products: BrandProduct[] }` (puede venir vacía).
  - `429 { error: "rate_limited", retryAfter: <segundos> }` si OFF responde 429 (`retryAfter` sale de su cabecera `Retry-After`, o 60).
  - `502 { error: "unavailable" }` ante cualquier otro fallo de OFF: red, estado no 2xx o una forma inesperada.
- Timeout de la petición a OFF: 8 s → `502`.

```ts
interface BrandProduct {
  code: string;           // código de barras → foodId "off:<code>"
  name: string;           // nombre en español si existe
  brand?: string;         // primera marca de "brands"
  kcal: number; protein: number; carbs: number; fat: number;  // por 100 g
  servingGrams?: number;  // peso de 1 ud si serving_size viene en g
}
```

**`src/lib/foods.ts`** (puro, sin React):
- `searchLocalFoods(query: string, foods = FOODS, limit = 8): LocalFood[]`: devuelve vacío con menos de 2 caracteres; aplica `normalize()` y exige todas las palabras; primero van los nombres que empiezan por lo escrito y luego el orden de la tabla (R2).
- `scaleMacros(per100: Macros, grams: number): Macros`: sin redondear.
- `displayMacro(value: number, kind: "kcal" | "protein" | "carbs" | "fat"): string`: redondea a entero; la grasa lleva un decimal si es < 1 g (R6).
- `parseGrams(text): number | null`: enteros de 1 a 2000.
- `parseUnits(text): number | null`: de 0,5 a 10, en pasos de 0,5, con coma o punto (vía `parseDecimal`).
- `OFF_LIMIT = { max: 10, windowMs: 60_000 }`; `offCooldown(timestamps: number[], now: number): number`: los segundos que faltan (0 si se puede buscar).
- `FOODS_CITATION`: el texto del pie de «Básicos» con la cita de CIQUAL/USDA.

**`src/lib/diary.ts`:**
- `foodEntry(food: { foodId, name, per100 }, date, mealType, { grams, units?, id? }): MealEntry`: guarda el nombre en `customName`, más `foodId`, `grams`, `units` (solo si se usaron) y los macros de `scaleMacros`.
- `quantityLabel(entry): string | null`: «150 g»; «2 ud · 120 g» si hay `units`; `null` si no hay `grams`. Los gramos se muestran redondeados a entero.

**`useBrandSearch()`** (`src/lib/useBrandSearch.ts`):
- Devuelve `{ state, products, search(q), retry(), cooldown }`. `state` es `"idle" | "loading" | "ok" | "offline" | "error" | "rate_limited"`.
- `search()` no llama si `offCooldown > 0`. Al llamar, añade la marca de tiempo a sessionStorage (las lecturas y escrituras van en try/catch).
- Un fallo de `fetch` (sin red) da `offline`; `429` da `rate_limited` con la cuenta atrás de `retryAfter`; otro error da `error`.

### UI
| Artboard | Implementación |
|---|---|
| `0 · Escribiendo: solo básicos` | `FoodPicker`: input de búsqueda; bloque «Básicos» con `searchLocalFoods` en cada tecla; debajo, el botón «Buscar «…» en productos de marca»; pie con la cita de CIQUAL/USDA. Sin coincidencias: «Ningún básico coincide». |
| `1A · Resultados en dos bloques` | Bloque «Productos de marca» bajo «Básicos», alimentado por `useBrandSearch`, con el pie ODbL y «revisa la etiqueta». Si se cambia el texto, el bloque se oculta (state vuelve a `idle`). |
| `2 · Cantidad en gramos` | La tarjeta sustituye a la lista: nombre, «← Otro alimento», campo de gramos + chips 50/100/150/200 (con `ChipRadios` o `Chip`), macros en vivo con `displayMacro`, botón «Añadir 150 g». Aviso junto al campo si `parseGrams` da `null`. |
| `3 · Cantidad en unidades` | Selector Gramos/Unidades solo si hay `unitGrams` o `servingGrams`; abre en Unidades; chips 1–4 ud; «= 120 g». |
| `4A · Marcas: sin conexión` / `4B · Marcas: demasiadas búsquedas` | Los errores se muestran dentro del bloque de marcas, con «Reintentar» (4A) o con el botón desactivado y la cuenta atrás (4B). |
| `5 · Registrado en el Diario` | `page.tsx`: `quantityLabel(e)` junto al nombre; `Toast` «Añadido a <franja> · <cantidad>» con «Deshacer» → `removeEntry(id)`. |

- **Estado entre pestañas:** `FoodPicker` sigue montado (oculto) mientras el formulario está abierto, así la búsqueda y los resultados sobreviven a un cambio de pestaña. Al cerrar el formulario se desmonta.
- **Doble toque:** el botón de añadir usa `singleClick`.

#### UI test contract
Nombres accesibles que usa `tests/e2e/food.spec.ts` (acordados en dev-test, 2026-09-27):
- Pestañas: botones «Receta», «Alimento», «Personalizada» (en ese orden).
- Buscador: campo con etiqueta «Buscar alimento».
- Bloques: encabezados «Básicos» y «Productos de marca». Cada resultado es un botón cuyo nombre empieza por el nombre del alimento y contiene «<kcal> kcal» (y la marca en OFF). El pie de «Básicos» contiene «CIQUAL»; el de marcas, «ODbL» y «revisa la etiqueta».
- Sin coincidencias en básicos: texto «Ningún básico coincide».
- Botón de marcas: «Buscar «<texto>» en productos de marca»; al llegar al límite se desactiva y muestra los segundos que faltan (calculados con `Date.now()` en cada tick, no con un contador que se decrementa: el e2e adelanta el reloj).
- Tarjeta: botón «Otro alimento»; radios «Gramos» / «Unidades»; campo de cantidad con etiqueta «Gramos» o «Unidades»; chips como botones «150 g», «2 ud»; botón «Añadir <cantidad>» («Añadir 150 g»). Cantidad inválida: botón desactivado y campo con `aria-invalid="true"` y `aria-describedby` apuntando al aviso.
- Errores de OFF: botón «Reintentar» dentro del bloque de marcas.
- Aviso: `role="status"` (el `Toast`) con «Añadido a <franja> · <cantidad>» y botón «Deshacer».
- R14: texto clicable «¿No lo encuentras? Añádelo a mano».
- Nombres de la tabla real que usa el e2e (contrato): «Arroz blanco, crudo», «Arroz blanco, cocido», «Plátano», «Huevo» (con `unitGrams`).
- **R14:** `FoodPicker` recibe `onManual(name)`; `page.tsx` cambia a `"custom"` con `customName` ya relleno.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | Tercer botón de modo en `page.tsx`, en el orden Receta / Alimento / Personalizada. |
| R2 | `searchLocalFoods` + bloque «Básicos» en `FoodPicker`. |
| R3 | `scripts/build-foods.mjs` + `foods-list.json` → `src/data/foods.json` (CIQUAL/USDA, `sourceCode`, `unitGrams`); cita en el pie de «Básicos». |
| R4 | `GET /api/foods/search` (filtro España, descarte sin macros, máx. 5) + `useBrandSearch` (solo al pulsar) + bloque de marcas con pie ODbL. |
| R5 | Estado `selected` en `FoodPicker`; «← Otro alimento» vuelve sin perder la búsqueda. |
| R6 | `parseGrams`, `scaleMacros` y `displayMacro`; chips; botón desactivado con aviso. |
| R7 | `unitGrams` / `servingGrams` + `parseUnits`; selector que abre en Unidades. |
| R8 | `foodEntry()` + `addEntry`; nombre «Producto · Marca» (o solo el producto si no hay marca); `singleClick`. |
| R9 | `quantityLabel()` en la lista del Diario. |
| R10 | `Toast` existente con acción «Deshacer» → `removeEntry`. |
| R11 | Respuestas `429` / `502` / error de red → estados de `useBrandSearch`, mostrados solo en el bloque de marcas; los básicos no dependen de la red. |
| R12 | `offCooldown` + sessionStorage `mp_off_searches`; el 429 real también activa la cuenta atrás. |
| R13 | Tarea 11, condicionada a que #12 esté mergeado: identidad = `foodId` + `grams` + `units`. |
| R14 | Enlace en `FoodPicker` → `onManual(name)`. |

## Risks & mitigations
- **Valores mal elegidos en la tabla** (un código de CIQUAL equivocado, un cocido tomado por crudo): la lista curada anota el código y el nombre original en la fuente, para revisarlos, y `foods-data.test.ts` comprueba que están los alimentos de los planes y que los valores son plausibles (kcal ≈ 4P + 4C + 9G, ±15 %). Aceptado.
- **OFF caído o con un formato distinto:** el route handler valida la forma de la respuesta y trata cualquier sorpresa como `502` (R11). Aceptado.
- **Bloqueo de la IP por superar el límite:** limitador en el cliente antes de llegar a OFF, persistido en sessionStorage para que recargar no lo salte. Aceptado.
- **CIQUAL está en francés:** el nombre en español sale siempre de la lista curada, nunca del dataset. Aceptado.
- **Crecimiento de `page.tsx`:** toda la lógica de la pestaña va en `FoodPicker`. Aceptado.
- **Licencias:** CIQUAL (Licence Ouverte Etalab) y USDA (dominio público) permiten empaquetar los datos citando la fuente; la cita va en el pie de «Básicos». Los datos de OFF (ODbL) se muestran con su pie y no se guardan aparte de la entrada.

## Testing strategy
Los tests se escriben antes del código, con dev-test.
- **Unitarios** (`tests/unit/`):
  - `foods.test.ts`: búsqueda (2 letras, tildes, todas las palabras, prefijo primero, máximo 8, crudo/cocido separados), `scaleMacros` (el caso de 150 g del spec), `displayMacro` (la grasa < 1 g con un decimal), `parseGrams`, `parseUnits` y `offCooldown`.
  - `foods-data.test.ts`: esquema de cada alimento, ids únicos, `source` y `sourceCode` presentes, los alimentos de los planes de agosto y septiembre presentes, y los valores plausibles.
  - `foods-route.test.ts`: `fetch` simulado; normalización, descarte de los productos sin macros, máximo 5, nombre en español, `servingGrams` solo en g, cabecera `User-Agent`, 400 con `q` corto, 429 → `rate_limited` + `retryAfter`, fallo de red o timeout → 502.
  - `diary.test.ts` (ampliar): `foodEntry` (con gramos y con unidades) y `quantityLabel`.
- **E2E** (`tests/e2e/food.spec.ts`), con `page.route("**/api/foods/search")` para no llamar a OFF:
  - flujo en gramos, en unidades y con productos de marca;
  - sin red (`route.abort()`) → 4A, y 429 → 4B con la cuenta atrás;
  - Deshacer;
  - el Diario muestra «150 g» y «2 ud · 120 g»;
  - la búsqueda se conserva al cambiar de pestaña;
  - R14;
  - el doble toque añade una sola entrada;
  - accesibilidad con axe en la pestaña Alimento.
- Los criterios de aceptación del spec se mapean uno a uno a estos tests en la tabla Test coverage que genera dev-test.
- **Ajustes de dev-test:** los tests de `foodEntry` / `quantityLabel` van en `tests/unit/diary-food.test.ts` (no en `diary.test.ts`), para que los tests existentes sigan en verde mientras no exista el código. La plausibilidad de los valores usa **±15 % o ±15 kcal, lo que sea mayor**, porque CIQUAL cuenta la fibra y en verduras ligeras un ±15 % estricto da falsos fallos.
- **Avisos para dev-code:**
  - 0,3 × 1,5 = 0,4499… en coma flotante, y el spec exige mostrar «0,5»: `displayMacro` tiene que redondear de forma robusta (p. ej., redondear antes a 6 decimales).
  - El timeout de 8 s hacia OFF se implementa con `AbortController` + `setTimeout`, no con `AbortSignal.timeout()`, porque el test usa timers falsos de Vitest.
  - La cuenta atrás de R12 se calcula a partir de `Date.now()` en cada tick.

## Test coverage
| Req | Test | Layer | Status |
|---|---|---|---|
| R1 | tests/e2e/food.spec.ts › "R1: pestaña Alimento" | e2e | 🔴 failing (not built) |
| R2 | tests/unit/foods.test.ts › "R2: búsqueda en los básicos" (8) | unit | 🔴 failing (not built) |
| R2 | tests/e2e/food.spec.ts › "R2 · R3: búsqueda en los básicos" (1 letra, «arroz coc», «platano», crudo/cocido, sin coincidencias) | e2e | 🔴 failing (not built) |
| R3 | tests/unit/foods-data.test.ts › "R3: forma de la tabla local", "R3: cubre los alimentos de los planes" | unit | 🔴 failing (not built) |
| R3 | tests/e2e/food.spec.ts › "el pie de Básicos cita las fuentes", "sin red, los básicos salen igual" | e2e | 🔴 failing (not built) |
| R4 | tests/unit/foods-route.test.ts › "R4: petición a Search-a-licious", "R4: normalización de los productos" | unit | 🔴 failing (not built) |
| R4 | tests/e2e/food.spec.ts › "R4: productos de marca" (3) | e2e | 🔴 failing (not built) |
| R5 | tests/e2e/food.spec.ts › "R5: tarjeta del alimento" (+ Edge cases de pestañas y de cambio de texto) | e2e | 🔴 failing (not built) |
| R6 | tests/unit/foods.test.ts › "R6: macros por gramos", "R6: gramos válidos" | unit | 🔴 failing (not built) |
| R6 | tests/e2e/food.spec.ts › "R6 · R8 · R9: registrar en gramos" (chips, inválidos, doble toque) | e2e | 🔴 failing (not built) |
| R7 | tests/unit/foods.test.ts › "R7: unidades válidas" | unit | 🔴 failing (not built) |
| R7 | tests/e2e/food.spec.ts › "R7: registrar en unidades" (4) | e2e | 🔴 failing (not built) |
| R8 | tests/unit/diary-food.test.ts › "R8: entrada de alimento" (6) | unit | 🔴 failing (not built) |
| R8 | tests/e2e/food.spec.ts › "R8: producto de marca", "150 g de «Arroz blanco, cocido» …" | e2e | 🔴 failing (not built) |
| R9 | tests/unit/diary-food.test.ts › "R9: cantidad junto al nombre en el Diario" (5) | unit | 🔴 failing (not built) |
| R9 | tests/e2e/food.spec.ts › "… el Diario muestra «150 g»", "2 ud → «2 ud · N g»", "se ven como antes" | e2e | 🔴 failing (not built) |
| R10 | tests/e2e/food.spec.ts › "R10: aviso con Deshacer" | e2e | 🔴 failing (not built) |
| R11 | tests/unit/foods-route.test.ts › "R11: errores de OFF" (7) | unit | 🔴 failing (not built) |
| R11 | tests/e2e/food.spec.ts › "R11: errores de OFF" (3) | e2e | 🔴 failing (not built) |
| R12 | tests/unit/foods.test.ts › "R12: límite de búsquedas en OFF" | unit | 🔴 failing (not built) |
| R12 | tests/e2e/food.spec.ts › "R12: límite de búsquedas" (429 + cuenta atrás) | e2e | 🔴 failing (not built) |
| R13 | — | — | ⏸ pending (#12 sin mergear; tarea 11) |
| R14 | tests/e2e/food.spec.ts › "R14: no lo encuentro → Personalizada" | e2e | 🔴 failing (not built) |
| — | tests/e2e/food.spec.ts › "Accesibilidad de la pestaña Alimento" (axe) | e2e | 🔴 failing (not built) |

## Tasks
1. [ ] Script `scripts/build-foods.mjs` + lista curada `scripts/foods-list.json` + `src/data/foods.json` generado (R3)
2. [ ] `src/lib/foods.ts`: tipos, `searchLocalFoods`, `scaleMacros`, `displayMacro`, `parseGrams`, `parseUnits`, `offCooldown` (R2, R6, R7, R12)
3. [ ] `MealEntry` + `foodEntry()` + `quantityLabel()`; el Diario muestra la cantidad (R8, R9)
4. [ ] Route handler `GET /api/foods/search` (R4, R11)
5. [ ] Hook `useBrandSearch` con limitador y sessionStorage (R4, R11, R12)
6. [ ] `FoodPicker`: pestaña, bloque Básicos con cita, tarjeta en gramos y alta de la entrada en `page.tsx` (R1, R2, R5, R6, R8)
7. [ ] Unidades en la tarjeta (R7)
8. [ ] Bloque de productos de marca, errores 4A/4B y cuenta atrás (R4, R11, R12)
9. [ ] Toast «Añadido a … · Deshacer» (R10)
10. [ ] «¿No lo encuentras? Añádelo a mano» → Personalizada con el nombre (R14)
11. [ ] Si #12 está mergeado: entradas de alimento en Recientes, con identidad `foodId` + `grams` + `units` (R13). Si no, anotarlo en `docs/pm/12-registro-rapido/` como pendiente.
12. [ ] README: fuentes de datos, licencias y cómo regenerar la tabla

## Spec feedback
- **R3, fuente de los valores:** el spec decía «BEDCA o USDA» y «la fuente no se muestra». Las [condiciones de uso de BEDCA](https://www.bedca.net/bdpub/UsoBD.pdf) solo permiten el uso personal, educativo o no comercial, citando la fuente de forma clara y sin modificar los datos; el repo es público y la app está desplegada. El usuario decidió usar **CIQUAL, con USDA de reserva** (licencias abiertas), y mostrar **una línea de cita en el pie del bloque «Básicos»**, sin la fuente por alimento. `spec.md` y el brief están actualizados; la open question de BEDCA queda cerrada.
- **R4, endpoint:** se usa Search-a-licious, el recomendado por OFF para texto libre (`search.pl` es heredado). El límite de 10 búsquedas por minuto es el mismo.
- **R12, límite:** lo cuenta el cliente antes de llegar a OFF y persiste en sessionStorage durante la sesión del navegador.
- No queda ninguna open question que bloquee el código.
