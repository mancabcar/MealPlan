// Del plan semanal a la lista agregada (docs/pm/lista-compra › R2, R4). Puro.
import { normalize } from "@/lib/text";
import { MEAL_TYPES, type MealType, type Recipe, type WeekPlan } from "@/lib/types";
import { classify, type Aisle } from "./classify";
import { normalizeKey, parseIngredientLine, type ParsedIngredient, type Unit } from "./parse";

/** Un ingrediente de una receta concreta en un hueco concreto del plan (para el detalle, R6). */
export type ItemSource = { date: string; mealType: MealType; recipeId: string; recipeName: string } & ParsedIngredient;

export interface ShoppingItem {
  key: string;
  name: string;
  /** Suma por unidad, en orden de aparición. unit null = recuento. */
  amounts: { unit: Unit | null; qty: number }[];
  sources: ItemSource[];
  optional: boolean;
  aisle: Aisle;
  basic: boolean;
}

/** Fuentes de la semana: solo días de `dates`, comidas activas y recetas que existen (R2). */
export function collectSources(i: { weekPlan: WeekPlan; recipes: Recipe[]; dates: string[]; meals: MealType[] }): ItemSource[] {
  const byId = new Map(i.recipes.map((r) => [r.id, r]));
  const sources: ItemSource[] = [];
  for (const date of i.dates) {
    const slots = (i.weekPlan[date] ?? [])
      .filter((s) => i.meals.includes(s.mealType))
      .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));
    for (const slot of slots) {
      const recipe = byId.get(slot.recipeId);
      if (!recipe) continue; // receta borrada después de planificarla
      for (const line of recipe.ingredients) {
        for (const parsed of parseIngredientLine(line)) {
          sources.push({ date, mealType: slot.mealType, recipeId: recipe.id, recipeName: recipe.name, ...parsed });
        }
      }
    }
  }
  return sources;
}

/** El stemmer cambió algo → el nombre estaba en plural. */
const isPlural = (name: string) => normalizeKey(name) !== normalize(name);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Agrupa por clave normalizada y suma por unidad idéntica (R4). */
export function aggregate(sources: ItemSource[]): ShoppingItem[] {
  const groups = new Map<string, ItemSource[]>();
  for (const s of sources) {
    const g = groups.get(s.key);
    if (g) g.push(s);
    else groups.set(s.key, [s]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const amounts: ShoppingItem["amounts"] = [];
    for (const s of group) {
      if (s.qty === null) continue;
      const a = amounts.find((x) => x.unit === s.unit);
      if (a) a.qty += s.qty;
      else amounts.push({ unit: s.unit, qty: s.qty });
    }
    const count = amounts.find((a) => a.unit === null)?.qty ?? 0;
    const first = group[0].name;
    const plural = group.find((s) => isPlural(s.name))?.name;
    const name = !isPlural(first) && count > 1 && plural ? plural : first;
    return {
      key,
      name: capitalize(name),
      amounts,
      sources: group,
      optional: group.every((s) => s.optional),
      ...classify(key),
    };
  });
}

const GLYPHS: [number, string][] = [
  [0.25, "¼"],
  [0.5, "½"],
  [0.75, "¾"],
];

function formatQty(n: number): string {
  const whole = Math.floor(n + 0.01);
  const frac = n - whole;
  if (Math.abs(frac) < 0.01) return String(whole);
  const glyph = GLYPHS.find(([v]) => Math.abs(frac - v) < 0.01);
  if (glyph) return (whole > 0 ? String(whole) : "") + glyph[1];
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

const SYMBOL_UNITS: (Unit | null)[] = ["g", "kg", "ml", "l"];

/** "300 g", "200 g + 1 bote", "4", "1½", "al gusto". */
export function formatAmount(item: ShoppingItem): string {
  if (item.amounts.length === 0) return "al gusto";
  return item.amounts
    .map(({ unit, qty }) => {
      const q = formatQty(qty);
      if (!unit) return q;
      const u = !SYMBOL_UNITS.includes(unit) && qty > 1 ? unit + "s" : unit;
      return `${q} ${u}`;
    })
    .join(" + ");
}

/** Firma estable del total: cambia si y solo si cambia alguna cantidad (R9). */
export function amountSignature(item: ShoppingItem): string {
  return item.amounts
    .map(({ unit, qty }) => `${unit ?? "ud"}:${Math.round(qty * 1000) / 1000}`)
    .sort()
    .join("|");
}
