// Búsqueda y orden de la pantalla Recetas (docs/pm/combobox-recetas/tech.md › Components & files). Lógica pura: la UI
// vive en src/app/recetas/page.tsx. Misma regla de coincidencia que el selector (groupRecipes): sin tildes ni mayúsculas.
import { normalize } from "./text";
import type { Recipe } from "./types";

/** Recetas cuyo nombre o alguna etiqueta contiene la consulta; sin consulta, todas. */
export function searchRecipes<T extends Recipe>(recipes: T[], query: string): T[] {
  const q = normalize(query);
  if (!q) return recipes;
  return recipes.filter((r) => normalize(r.name).includes(q) || r.tags.some((t) => normalize(t).includes(q)));
}

/** Copia ordenada A–Z por nombre, en español (la Ñ va tras la N). */
export function sortByName<T extends Recipe>(recipes: T[]): T[] {
  return [...recipes].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
