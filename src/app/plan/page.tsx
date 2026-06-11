"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { MEAL_TYPES, MEAL_TYPE_ICONS, MealType, todayStr } from "@/lib/types";

function weekDates(start: string): string[] {
  const d = new Date(start + "T00:00:00");
  // lunes de la semana actual
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
}

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function PlanPage() {
  const { weekPlan, setWeekPlan, recipes } = useApp();
  const [editing, setEditing] = useState<{ date: string; mealType: MealType } | null>(null);

  const dates = weekDates(todayStr());

  const assign = (recipeId: string) => {
    if (!editing) return;
    const slots = (weekPlan[editing.date] ?? []).filter((s) => s.mealType !== editing.mealType);
    setWeekPlan({
      ...weekPlan,
      [editing.date]: recipeId ? [...slots, { mealType: editing.mealType, recipeId }] : slots,
    });
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Plan semanal</h1>

      {editing && (
        <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm flex flex-col gap-2">
          <h3 className="font-semibold text-sm">
            {MEAL_TYPE_ICONS[editing.mealType]} {editing.mealType} —{" "}
            {DAY_NAMES[dates.indexOf(editing.date)]}
          </h3>
          <select
            autoFocus
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            defaultValue={weekPlan[editing.date]?.find((s) => s.mealType === editing.mealType)?.recipeId ?? ""}
            onChange={(e) => assign(e.target.value)}
          >
            <option value="">— Sin asignar —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.calories} kcal)
              </option>
            ))}
          </select>
          <button onClick={() => setEditing(null)} className="text-sm text-zinc-500 self-start">
            Cancelar
          </button>
        </section>
      )}

      {dates.map((date, i) => {
        const slots = weekPlan[date] ?? [];
        const dayKcal = slots.reduce(
          (s, slot) => s + (recipes.find((r) => r.id === slot.recipeId)?.calories ?? 0),
          0,
        );
        return (
          <section key={date} className={`bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm ${date === todayStr() ? "ring-2 ring-emerald-500" : ""}`}>
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="text-sm font-semibold">{DAY_NAMES[i]}</h2>
              <span className="text-xs text-zinc-500">{dayKcal > 0 ? `${dayKcal} kcal` : ""}</span>
            </div>
            <div className="flex flex-col gap-1">
              {MEAL_TYPES.slice(0, 3).map((mt) => {
                const slot = slots.find((s) => s.mealType === mt);
                const recipe = slot ? recipes.find((r) => r.id === slot.recipeId) : undefined;
                return (
                  <button
                    key={mt}
                    onClick={() => setEditing({ date, mealType: mt })}
                    className="flex justify-between items-center text-sm py-1 text-left"
                  >
                    <span className="text-zinc-500">
                      {MEAL_TYPE_ICONS[mt]} {mt}
                    </span>
                    <span className={recipe ? "" : "text-zinc-400 italic"}>
                      {recipe ? recipe.name : "Añadir"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
