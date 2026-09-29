# Crear y editar recetas propias: Technical design
_Status: Draft · Updated: 2026-09-29_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Extendemos el store y la página Recetas: una lógica pura nueva (`src/lib/recipeEdit.ts`), dos acciones en el store (`saveRecipe`, `removeRecipe`) y un formulario en `Sheet`. Las recetas propias llevan `isCustom: true` e id `custom_<uuid>`. Esfuerzo M, sin dependencias nuevas ni migración.

## Context
- `Recipe` (`src/lib/types.ts`) no tiene campo de origen salvo `isAIGenerated`. Ids: semilla `recipe_NNN`, IA `ai_NNN`.
- `recipes` vive en el store (`src/lib/store.tsx`, `usePersisted`, localStorage por usuario). Solo hay `addRecipes`.
- La siembra `withSeedRecipes` (`src/lib/userData.ts`) reinyecta por id las semilla que falten.
- Plan (`src/app/plan/page.tsx`), Diario (`src/app/page.tsx`), Compra (`src/lib/shopping/`) y macros del Plan (`src/lib/planMacros.ts`) buscan la receta por id en `recipes`.
- `MealEntry` guarda sus propios macros (`recipeEntry` en `src/lib/diary.ts`); el nombre se resuelve por `recipeId` salvo que haya `customName`. `recentMeals` ignora entradas con `recipeId` sin receta.
- `WeekPlan` (`DayPlanSlot`) es un mapa fecha → franjas para todas las fechas; las tandas de #17 comparten `recipeId` entre cocinada y sobras.
- Export estático (`next.config.ts`, `output: "export"`): no hay rutas dinámicas por id.
- `Sheet` (`src/components/ui/Sheet.tsx`) es la hoja modal con foco atrapado; `MeasurementForm` (`src/components/evolucion/MeasurementForm.tsx`) es el patrón de formulario.
- Tests: Vitest + Testing Library (`tests/unit`), Playwright (`tests/e2e`).
- `AGENTS.md` avisa de que este Next difiere de lo conocido; el diseño no añade rutas ni APIs de Next, solo componentes de cliente y estado existente.

## Approaches considered
### A. Extender store y página Recetas (chosen)
Acciones en `store.tsx`, lógica pura en `lib/recipeEdit.ts`, formulario en Sheet dentro de `/recetas`. **Pros:** sigue `saveMeasurement` y `lib/plan/batch.ts`; sin rutas nuevas; poco estado duplicado. **Cons:** la página Recetas crece (se extrae `RecipeForm`). **Effort** M.
### B. Ruta nueva `/recetas/nueva`
Página aparte para el formulario. **Pros:** encaja con `trailingSlash`. **Cons:** editar por id exigiría query params y duplicar estado. **Effort** M–L.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Tipos | `src/lib/types.ts` | `Recipe.isCustom?: true` |
| Lógica pura | `src/lib/recipeEdit.ts` (nuevo) | `validateRecipeDraft`, `suggestCalories`, `duplicateRecipe`, `withoutRecipe` (entradas y plan), `slotsUsingRecipe`, `suggestedTags` |
| Store | `src/lib/store.tsx` | `saveRecipe(r)` (alta o edición por id) y `removeRecipe(id)` (entradas → plan → receta) |
| UI | `src/components/recetas/RecipeForm.tsx` (nuevo) | Formulario dentro de `Sheet` |
| Página | `src/app/recetas/page.tsx` | "Nueva receta", "Editar", "Duplicar y editar", "Borrar" con aviso, distintivo "Propia" |
| Tests | `tests/unit/`, `tests/e2e/` | ver Testing strategy |
### Data model
- `Recipe.isCustom?: true` (opcional, sin migración). Id `custom_<crypto.randomUUID()>`, sin choque con la siembra.
- Edición: mismo id, se conservan `isCustom` e `isAIGenerated`. Duplicar una semilla: id nuevo, `isCustom: true`, sin `isAIGenerated`, nombre "<nombre> (copia)".
- Borrado: cada `MealEntry` con ese `recipeId` pasa a `customName: <nombre>` y pierde el `recipeId`; macros y `servings` intactos. Del `WeekPlan` se quitan todas las franjas con ese `recipeId` (cocinada y sobras de tandas).
### APIs / interfaces
- `saveRecipe: (r: Recipe) => void` y `removeRecipe: (id: string) => void` en `AppState`.
- `recipeEdit.ts`, funciones puras: `validateRecipeDraft(draft)` devuelve `{ ok, errors }` (nombre, ≥1 ingrediente y kcal; P/C/G y tiempo valen 0 si están vacíos; sin negativos ni no numéricos), `suggestCalories(p, c, g) = 4p + 4c + 9g`, `slotsUsingRecipe(plan, id)`, `withoutRecipe({ entries, plan, recipe })`.
### UI
- Cabecera de Recetas: botón "Nueva receta" junto a "Sugerir con IA".
- Detalle: "Editar" y "Borrar" en propias e IA; "Duplicar y editar" en semilla (solo lectura).
- Formulario: nombre, ingredientes (textarea, una línea por ingrediente, con pista "cantidad + ingrediente, p. ej. 200 g de pollo"), pasos (textarea, una línea por paso), tiempo, kcal (con sugerencia 4P+4C+9G) y P/C/G por ración, tags (texto libre + sugeridos por uso).
- Aviso de borrado: si la receta está en el Plan, lista las franjas afectadas antes de confirmar; si no, confirmación simple.
- Distintivo "Propia" solo en lista y detalle de Recetas (no en selectores de Plan y Diario).

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `RecipeForm` + `validateRecipeDraft` + `saveRecipe` (alta) |
| R2 | `saveRecipe` (edición por id) desde "Editar"; las semilla no muestran Editar/Borrar |
| R3 | `slotsUsingRecipe` para el aviso; `removeRecipe` vacía las franjas con ese `recipeId` (incluye tandas) |
| R4 | `duplicateRecipe` abre el formulario precargado; la semilla no se toca |
| R5 | Todos los consumidores leen `recipes` del store; nada que cambiar en Diario, Plan ni Compra |
| R6 | Las entradas guardan sus macros; no se recalculan al editar |
| R7 | `AllergenBadge` se calcula desde `ingredients`; no cambia |
| R8 | `withoutRecipe` convierte las entradas a `customName` sin `recipeId` |
| R9 | `suggestedTags` (tags ya usadas) y chip "Propia" por `isCustom` |
| R10 | `suggestCalories`; el valor de kcal sigue editable |

## Risks & mitigations
- **Escritura no transaccional** en tres claves de localStorage: `removeRecipe` escribe entradas, luego plan y al final la receta; si algo falla antes, no se pierde nada y el borrado se puede repetir. (Aceptado.)
- **Siembra**: las semilla siguen sin poder borrarse; las propias usan ids `custom_` que no colisionan.
- **Guardado en localStorage**: puede migrar con [#42](https://github.com/mancabcar/MealPlan/issues/42); sin migración aquí.
- **Ingredientes en texto libre**: si la Compra no parsea el formato, esos ingredientes salen como línea suelta; no se valida el formato (aceptado).

## Testing strategy
- **Unit** (`tests/unit`): `recipeEdit.ts` (validación, sugerencia de kcal, duplicar, `withoutRecipe` sobre entradas y plan incluidas tandas, tags sugeridas); R6 editando macros y comprobando que las entradas no cambian.
- **Component** (Testing Library): `RecipeForm` (campos obligatorios, sugerencia de kcal, precarga al duplicar/editar).
- **E2E** (Playwright, un flujo): crear una receta con un ingrediente alérgeno → ver aviso; planificarla; borrar con aviso de Plan; el Diario conserva la entrada. Comprobación axe del formulario.

## Tasks
1. [ ] Tipos y `lib/recipeEdit.ts` puro con tests unitarios (covers R1, R3, R4, R6, R8, R9, R10)
2. [ ] `saveRecipe` y `removeRecipe` en el store, con tests (covers R2, R3, R8)
3. [ ] `RecipeForm` en `Sheet` con tests de componente (covers R1, R7, R10)
4. [ ] Recetas: "Nueva receta", "Editar", "Duplicar y editar" y distintivo "Propia" (covers R1, R2, R4, R5, R9)
5. [ ] "Borrar" con aviso de Plan (covers R3, R8)
6. [ ] Test e2e del flujo crear → planificar → borrar (covers R5, R7)
7. [ ] Revisión de accesibilidad (axe) y ajustes

## Spec feedback
- Sin cambios en `spec.md`.
- La pregunta abierta del distintivo queda resuelta: solo en Recetas (lista y detalle).
