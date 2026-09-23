"use client";

// Único archivo no puro de lib/shopping: conecta el store con la vista derivada (lista-compra tech.md).
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { MEAL_TYPES, todayStr, type PantryCategory, type PantryItem } from "@/lib/types";
import { mondayOf, weekDates } from "@/lib/week";
import { aggregate, amountSignature, collectSources, formatAmount, type ShoppingItem } from "./aggregate";
import { forWeek, recordMove, setOverride, toggleBought, undoMove, type ShoppingWeekState } from "./state";
import { buildShoppingView } from "./view";

export function useShoppingList() {
  const { profile, weekPlan, recipes, pantry, shopping, setShopping, addPantryItems, removePantryItems } = useApp();
  const today = todayStr();
  const monday = mondayOf(today);
  const meals = profile?.meals ?? MEAL_TYPES;

  // Una semana nueva se lee como vacía; se guarda (y la anterior pasa a `usage`) en la próxima escritura
  const state = useMemo(() => forWeek(shopping, monday), [shopping, monday]);
  const week = state.current;
  const items = useMemo(
    () => aggregate(collectSources({ weekPlan, recipes, dates: weekDates(today), meals })),
    [weekPlan, recipes, today, meals],
  );
  const view = useMemo(
    () => buildShoppingView({ items, pantry, state: week, today }),
    [items, pantry, week, today],
  );

  const update = (fn: (week: ShoppingWeekState) => ShoppingWeekState) => setShopping({ ...state, current: fn(state.current) });

  return {
    view,
    meals,
    /** Semana sin recetas en comidas activas (R10) */
    empty: items.length === 0,
    lastMove: state.current.lastMove,
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
      update((w) =>
        recordMove(w, {
          // Marca de tiempo completa: la Despensa muestra "Deshacer" solo justo después de mover (R13)
          at: new Date().toISOString(),
          pantryIds: added.map((p) => p.id),
          entries: Object.fromEntries(moves.map(({ item }) => [item.key, amountSignature(item)])),
        }),
      );
      return added.length;
    },
    undoLastMove: () => {
      if (!state.current.lastMove) return;
      removePantryItems(state.current.lastMove.pantryIds);
      update(undoMove);
    },
  };
}
