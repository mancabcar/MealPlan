"use client";

// Único archivo no puro de lib/shopping: conecta el store con la vista derivada (lista-compra tech.md).
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { MEAL_TYPES, todayStr, type PantryCategory, type PantryItem } from "@/lib/types";
import { weekDates } from "@/lib/week";
import { aggregate, amountSignature, collectSources, formatAmount, leftoverSlotKeys, type ShoppingItem } from "./aggregate";
import { moveToPantry, pruneBought, pruneWeeks, setOverride, toggleBought, undoLastMove, updateWeek, weekOf, type ShoppingState, type ShoppingWeekState } from "./state";
import { buildShoppingView } from "./view";

/** Lista de la semana `monday` (docs/pm/78-plan-navegar-semanas): cada semana tiene su propio estado. */
export function useShoppingList(monday: string) {
  const { profile, weekPlan, recipes, pantry, shopping, setShopping, addPantryItems, removePantryItems } = useApp();
  const today = todayStr();
  const meals = profile?.meals ?? MEAL_TYPES;

  // Una semana sin estado se lee como vacía; se guarda en la próxima escritura
  const week = useMemo(() => weekOf(shopping, monday), [shopping, monday]);
  const { items, leftoverKeys } = useMemo(() => {
    const input = { weekPlan, recipes, dates: weekDates(monday), meals };
    return { items: aggregate(collectSources(input)), leftoverKeys: leftoverSlotKeys(input) };
  }, [weekPlan, recipes, monday, meals]);
  const view = useMemo(
    () => buildShoppingView({ items, pantry, state: week, today }),
    [items, pantry, week, today],
  );

  // Cada escritura limpia las marcas caducadas, para que el contador semanal sea fiel (review N6), también al mover (#116)
  const signatures = () => Object.fromEntries(items.map((i) => [i.key, amountSignature(i)]));
  const tidy = (state: ShoppingState, sigs: Record<string, string>) =>
    pruneWeeks(updateWeek(state, monday, (w) => pruneBought(w, sigs)), today);
  const update = (fn: (week: ShoppingWeekState) => ShoppingWeekState) => {
    const sigs = signatures();
    setShopping((prev) => tidy(updateWeek(prev, monday, fn), sigs));
  };

  return {
    view,
    meals,
    /** Huecos con receta de la semana, incluidos los ya pasados a la Despensa (review N2) y las sobras */
    plannedMeals: new Set([...items.flatMap((i) => i.sources.map((s) => `${s.date}|${s.mealType}`)), ...leftoverKeys]).size,
    /** Semana sin recetas en comidas activas (R10) */
    empty: items.length === 0,
    // Global: se puede deshacer aunque se esté viendo otra semana (review N4)
    lastMove: shopping.lastMove,
    toggleBought: (item: ShoppingItem) => update((w) => toggleBought(w, item.key, amountSignature(item))),
    setOverride: (item: ShoppingItem, on: boolean) => update((w) => setOverride(w, item.key, on)),
    /** Una escritura a la Despensa y una al estado, sea cual sea el número de artículos (R13). */
    moveToPantry: (moves: { item: ShoppingItem; category: PantryCategory }[]) => {
      const added: PantryItem[] = moves.map(({ item, category }) => ({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: formatAmount(item),
        category,
        addedFromListAt: today,
      }));
      addPantryItems(added);
      const sigs = signatures();
      setShopping((prev) =>
        tidy(
          moveToPantry(prev, monday, {
            // Marca de tiempo completa: la Despensa muestra "Deshacer" solo justo después de mover (R13)
            at: new Date().toISOString(),
            pantryIds: added.map((p) => p.id),
            entries: Object.fromEntries(moves.map(({ item }) => [item.key, amountSignature(item)])),
          }),
          sigs,
        ),
      );
      return added.length;
    },
    undoLastMove: () => {
      if (!shopping.lastMove) return;
      removePantryItems(shopping.lastMove.pantryIds);
      setShopping(undoLastMove);
    },
  };
}
