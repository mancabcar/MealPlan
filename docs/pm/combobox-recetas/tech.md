# Selector de recetas: búsqueda resaltada y orden A–Z: Technical design
_Status: Draft · Updated: 2026-10-04_
_Related: [spec](spec.md) · [brief](brief.md)_

## Summary
Un helper puro `highlightRanges` y un componente `<Highlight>` pintan el texto que coincide con `<mark>`, en el selector y en Recetas. El filtro y el orden de Recetas pasan a una función pura que reutiliza `normalize`. Esfuerzo S, sin dependencias nuevas ni cambios de datos.

## Context
- `src/lib/text.ts`: `normalize` (NFD sin marcas, minúsculas, espacios colapsados). Lo usan `groupRecipes` (`src/lib/recipeSlots.ts`) y los alérgenos.
- `src/components/recetas/RecipePicker.tsx`: pinta `r.name` en cada fila; el filtro ya es insensible a tildes (R3 del selector, ya cumplido) y agrupa por franja con A–Z.
- `src/app/recetas/page.tsx:64-75`: `results` filtra con `toLowerCase()` y no ordena; `:377-386` pinta `r.name`.
- Tests: Vitest en `tests/unit/`, Playwright en `tests/e2e/` (`recipes.spec.ts`, `favoritos-franja.spec.ts`).
- Sin cambios de API de Next: son componentes cliente y lógica pura, así que no se necesitó leer `node_modules/next/dist/docs/`.

## Approaches considered
### A. Helper puro + componente `<Highlight>` (chosen)
`highlightRanges(text, query)` recorre el texto original por carácter, normaliza cada uno y guarda un mapa de índices normalizado→original; sin regex. `<Highlight text query>` parte el texto en tramos y envuelve los coincidentes en `<mark>`. **Pros** probable con unit tests, los caracteres especiales no rompen, las tildes se resaltan en el texto original. **Cons** unas 25 líneas propias. **Effort** S.
### B. Regex sobre el texto normalizado
**Pros** corto. **Cons** hay que escapar especiales y las posiciones se desajustan si cambia la longitud al normalizar. **Effort** S.
### C. Librería de resaltado
Descartada: dependencia nueva para un caso trivial.

## Design
### Components & files
| Area | File(s) | Change |
|---|---|---|
| Lib | `src/lib/text.ts` | Nuevo `highlightRanges(text, query): [start, end][]` |
| Lib | `src/lib/recipeSearch.ts` (nuevo) | `searchRecipes(list, query)`: filtra por nombre o etiqueta con `normalize`; `sortByName` A–Z `localeCompare("es")` |
| UI | `src/components/ui/Highlight.tsx` (nuevo) | Pinta el texto con `<mark>` en los rangos |
| UI | `src/components/recetas/RecipePicker.tsx` | `r.name` → `<Highlight text={r.name} query={query} />` |
| Pantalla | `src/app/recetas/page.tsx` | `results` usa `searchRecipes`; A–Z si `!usePantry`; nombre con `<Highlight>`; «Sin resultados» también con `search.trim()` (línea 361) |
### Data model
Ninguno.
### APIs / interfaces
- `highlightRanges(text: string, query: string): Array<[number, number]>`; consulta vacía → `[]`. Devuelve rangos sobre el texto original, sin solaparse.
- `<Highlight text query />`: mantiene el texto idéntico al original (mismo nombre accesible).
- `searchRecipes` y `sortByName` son puras, sin estado.
### UI
Sin prototipo. `<mark>` con estilo de los tokens de color existentes (fondo suave, texto heredado), sin cambiar tamaño ni peso de la fila.

## Spec coverage
| Req | How it's met |
|---|---|
| R1 | `<Highlight>` en selector y Recetas; sin coincidencia por nombre, sin `<mark>` |
| R2 | `sortByName` en el `useMemo` de Recetas cuando `!usePantry`; con ítem enfocado también A–Z |
| R3 | `searchRecipes` con `normalize` por nombre y etiqueta |
| R5 | La condición del mensaje «Sin resultados» incluye `search.trim()` |
| R4 | `groupRecipes` y el resto del selector no se tocan; solo cambia el contenido del nombre |

## Risks & mitigations
- **Normalizar cambia longitudes** (p. ej. «ß», ligaduras): el mapa por carácter garantiza que los rangos nunca salgan del texto original; test unitario con casos raros.
- **Resaltado y nombre accesible**: `<mark>` no cambia el texto leído; los e2e de `favoritos-franja.spec.ts` localizan por nombre y se vigilan como R4.
- **Espacios**: `normalize` colapsa espacios y `highlightRanges` no; nombres con dobles espacios pueden no resaltar. Se acepta como límite menor.

## Testing strategy
- Unit (`tests/unit/`): `highlightRanges` (tildes, mayúsculas, vacío, solo espacios, especiales de regex, repetidos, sin coincidencia); `searchRecipes` (nombre, etiqueta, tildes) y `sortByName`.
- e2e (`tests/e2e/recipes.spec.ts`): Recetas sale A–Z; buscar «pure» encuentra «Puré…» con `<mark>`; el selector del Plan resalta.
- R4: los e2e existentes de selector y favoritos deben seguir pasando sin cambios.

## Tasks
1. [x] `highlightRanges` en `src/lib/text.ts` + unit tests (covers R1)
2. [x] `searchRecipes` y `sortByName` en `src/lib/recipeSearch.ts` + unit tests (covers R2, R3)
3. [ ] Componente `<Highlight>` (covers R1)
4. [ ] Usar `<Highlight>` en `RecipePicker` (covers R1, R4)
5. [ ] Recetas: filtro con `searchRecipes`, A–Z si `!usePantry`, resaltado y «Sin resultados» con texto (covers R1–R3, R5)
6. [ ] e2e en `recipes.spec.ts` y pasada de los e2e existentes (covers R1–R4)

## Spec feedback
R5 añadido el 2026-10-04 (Must): el spec afirmaba que Recetas ya mostraba «Sin resultados» con búsqueda de texto y no era así. El resto se construye tal cual. Sin flag: los pasos dejan la app funcionando.
