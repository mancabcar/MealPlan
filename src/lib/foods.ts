// Base de datos de alimentos (docs/pm/13-base-alimentos/tech.md › APIs). Puro: sin React ni store.
// Los básicos salen de src/data/foods.json (generado por scripts/build-foods.mjs); los productos de marca, de
// GET /api/foods/search (Open Food Facts).
import foodsJson from "@/data/foods.json";
import { parseDecimal } from "./nutrition";
import type { Macros } from "./planMacros";
import { normalize } from "./text";

/** Valores por 100 g, con los mismos nombres en la tabla local y en OFF. */
export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Alimento de la tabla local (R3). */
export interface LocalFood extends Per100 {
  /** Estable: forma parte de `MealEntry.foodId` ("local:<id>"). */
  id: string;
  name: string;
  source: "CIQUAL" | "USDA";
  /** Código del alimento en la fuente (alim_code de CIQUAL, fdcId de USDA). */
  sourceCode: string;
  /** Peso típico de 1 ud (huevo, pieza de fruta, rebanada…). Sin él, solo gramos (R7). */
  unitGrams?: number;
}

/** Producto de Open Food Facts ya normalizado por la ruta (R4). */
export interface BrandProduct extends Per100 {
  /** Código de barras → `MealEntry.foodId` "off:<code>". */
  code: string;
  /** Nombre en español si existe. */
  name: string;
  /** Primera marca de `brands`. */
  brand?: string;
  /** Peso de 1 ud, solo si la ración de OFF viene en gramos (R7). */
  servingGrams?: number;
}

export const FOODS = foodsJson as LocalFood[];

/** Pie del bloque «Básicos» (R3): la fuente no se muestra por alimento. */
export const FOODS_CITATION = "Valores de CIQUAL (ANSES, 2020) y USDA FoodData Central.";

export const BASICS_LIMIT = 8;

/**
 * R2: con 2 caracteres o más, los alimentos cuyo nombre contiene todas las palabras escritas, sin tildes ni
 * mayúsculas. Primero los que empiezan por la primera palabra; dentro de cada grupo, el orden de la tabla.
 */
export function searchLocalFoods(query: string, foods: LocalFood[] = FOODS, limit = BASICS_LIMIT): LocalFood[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const words = q.split(" ");
  const matches = foods
    .map((food) => ({ food, name: normalize(food.name) }))
    .filter(({ name }) => words.every((w) => name.includes(w)));
  // sort es estable: dentro de cada grupo se conserva el orden de la tabla
  const starts = (name: string) => (name.startsWith(words[0]) ? 0 : 1);
  return matches
    .sort((a, b) => starts(a.name) - starts(b.name))
    .slice(0, limit)
    .map(({ food }) => food);
}

/** R6: macros de `grams` gramos, sin redondear (se guardan así y se redondean al mostrar). */
export function scaleMacros(per100: Per100, grams: number): Macros {
  const f = grams / 100;
  return { calories: per100.kcal * f, protein: per100.protein * f, carbs: per100.carbs * f, fat: per100.fat * f };
}

// Antes de redondear se quita el ruido de coma flotante: 0,3 × 1,5 = 0,4499… y debe mostrarse «0,5».
const clean = (n: number) => Number(n.toFixed(6));

/** R6: entero; la grasa, con un decimal (coma) si es menor que 1 g. */
export function displayMacro(value: number, kind: "kcal" | "protein" | "carbs" | "fat"): string {
  const tenths = Math.round(clean(value) * 10) / 10;
  if (kind === "fat" && tenths < 1) return String(tenths).replace(".", ",");
  return String(Math.round(clean(value)));
}

export const GRAMS = { min: 1, max: 2000 } as const;
export const GRAMS_ERROR = "Entre 1 y 2000 g, sin decimales";
export const GRAM_CHIPS = [50, 100, 150, 200] as const;

/** R6: enteros de 1 a 2000; null si no. */
export function parseGrams(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const g = Number(t);
  return g >= GRAMS.min && g <= GRAMS.max ? g : null;
}

export const UNITS = { min: 0.5, max: 10, step: 0.5 } as const;
export const UNITS_ERROR = "Entre 0,5 y 10 ud, en pasos de 0,5";
export const UNIT_CHIPS = [1, 2, 3, 4] as const;

/** R7: de 0,5 a 10 en pasos de 0,5, con coma o punto; null si no. */
export function parseUnits(text: string): number | null {
  const v = parseDecimal(text);
  // v / 0,5 es exacto en coma flotante (0,5 es potencia de 2), como en parseServings
  const ok = Number.isFinite(v) && v >= UNITS.min && v <= UNITS.max && Number.isInteger(v / UNITS.step);
  return ok ? v : null;
}

/** R12: límite de búsquedas en OFF que cuenta el cliente (el de OFF es ~10 por minuto por IP). */
export const OFF_LIMIT = { max: 10, windowMs: 60_000 } as const;

/** R12: segundos (hacia arriba) hasta poder volver a buscar; 0 si se puede ya. */
export function offCooldown(timestamps: number[], now: number): number {
  const recent = timestamps.filter((t) => now - t < OFF_LIMIT.windowMs).sort((a, b) => a - b);
  if (recent.length < OFF_LIMIT.max) return 0;
  // Hay que esperar a que caduque la búsqueda que deja la cuenta por debajo del máximo
  const blocking = recent[recent.length - OFF_LIMIT.max];
  return Math.ceil((blocking + OFF_LIMIT.windowMs - now) / 1000);
}

/**
 * Texto de búsqueda para GET /api/foods/search. Search-a-licious interpreta la consulta con sintaxis tipo Lucene:
 * unas comillas o unos dos puntos del usuario se comerían el filtro de España (review de #13). Se quitan los
 * caracteres de sintaxis y se pasa a minúsculas para que AND/OR/NOT no cuenten como operadores.
 */
export function plainQuery(text: string): string {
  return text
    .replace(/["():[\]{}~^\\/!*?+\-&|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
