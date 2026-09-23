// Cruce con la Despensa (docs/pm/lista-compra › R5 "Despensa matching"). Puro.
import type { PantryItem } from "@/lib/types";
import { normalizeKey } from "./parse";

const words = (key: string) => key.split(" ").filter((w) => w && w !== "de");

/** Despensa con los nombres ya normalizados: se calcula una vez por vista, no una vez por ingrediente. */
export type PantryIndex = { item: PantryItem; words: Set<string> }[];

export function indexPantry(pantry: PantryItem[]): PantryIndex {
  return pantry.map((item) => ({ item, words: new Set(words(normalizeKey(item.name))) }));
}

/**
 * Un ingrediente coincide con un artículo si todas sus palabras están en el nombre del artículo.
 * Devuelve la primera coincidencia no caducada (orden de la Despensa) o, si todas han caducado,
 * `expiredMatch`. Caducado = `expiryDate < today`; sin fecha cuenta como no caducado.
 */
export function matchIndexed(key: string, index: PantryIndex, today: string): { match?: PantryItem; expiredMatch?: PantryItem } {
  const wanted = words(key);
  if (wanted.length === 0) return {};
  let expiredMatch: PantryItem | undefined;
  for (const { item, words: have } of index) {
    if (!wanted.every((w) => have.has(w))) continue;
    if (item.expiryDate && item.expiryDate < today) expiredMatch ??= item;
    else return { match: item };
  }
  return expiredMatch ? { expiredMatch } : {};
}

/** Igual que `matchIndexed`, para un solo ingrediente sin índice previo. */
export function matchPantry(key: string, pantry: PantryItem[], today: string): { match?: PantryItem; expiredMatch?: PantryItem } {
  return matchIndexed(key, indexPantry(pantry), today);
}
