"use client";

// Único archivo no puro de lib/shopping: conecta el store con la vista derivada (lista-compra tech.md).
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { MEAL_TYPES, todayStr, type PantryCategory, type PantryItem } from "@/lib/types";
import { mondayOf, weekDates } from "@/lib/week";
import { aggregate, amountSignature, collectSources, formatAmount, type ShoppingItem } from "./aggregate";
import { forWeek, pruneBought, recordMove, setOverride, toggleBought, undoLastMove, type ShoppingWeekState } from "./state";
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

  // Cada escritura limpia las marcas caducadas, para que el contador semanal sea fiel (review N6)
  const update = (fn: (week: ShoppingWeekState) => ShoppingWeekState) => {
    const signatures = Object.fromEntries(items.map((i) => [i.key, amountSignature(i)]));
    setShopping((prev) => {
      const s = forWeek(prev, monday);
      return { ...s, current: pruneBought(fn(s.current), signatures) };
    });
  };

  return {
    view,
    meals,
    /** Huecos con receta de la semana, incluidos los ya pasados a la Despensa (review N2) */
    plannedMeals: new Set(items.flatMap((i) => i.sources.map((s) => `${s.date}|${s.mealType}`))).size,
    /** Semana sin recetas en comidas activas (R10) */
    empty: items.length === 0,
    // Sin pasar por forWeek: un movimiento de justo antes del lunes sigue pudiéndose deshacer (review N4)
    lastMove: shopping.current.lastMove,
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
      if (!shopping.current.lastMove) return;
      removePantryItems(shopping.current.lastMove.pantryIds);
      setShopping((prev) => undoLastMove(prev, monday));
    },
  };
}
