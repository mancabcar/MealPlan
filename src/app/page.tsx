"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import {
  MEAL_TYPES,
  MEAL_TYPE_ICONS,
  MealType,
  todayStr,
} from "@/lib/types";

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-zinc-500">
          {Math.round(value)} / {goal}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DiaryPage() {
  const { profile, entries, recipes, addEntry, removeEntry } = useApp();
  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [mealType, setMealType] = useState<MealType>("Comida");
  const [mode, setMode] = useState<"recipe" | "custom">("recipe");
  const [recipeId, setRecipeId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customMacros, setCustomMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  if (!profile) return null;

  const dayEntries = entries.filter((e) => e.date === date);
  const totals = dayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // Gráfica semanal: últimos 7 días terminando en la fecha seleccionada
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const kcal = entries.filter((e) => e.date === key).reduce((s, e) => s + e.calories, 0);
    return { label: ["D", "L", "M", "X", "J", "V", "S"][d.getDay()], kcal };
  });
  const maxKcal = Math.max(profile.calorieGoal, ...week.map((w) => w.kcal), 1);

  const submitAdd = () => {
    if (mode === "recipe") {
      const r = recipes.find((x) => x.id === recipeId);
      if (!r) return;
      addEntry({
        id: crypto.randomUUID(),
        date,
        mealType,
        recipeId: r.id,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
      });
    } else {
      if (!customName.trim()) return;
      addEntry({ id: crypto.randomUUID(), date, mealType, customName, ...customMacros });
    }
    setShowAdd(false);
    setCustomName("");
    setCustomMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Diario</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
        />
      </div>

      <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
        <MacroBar label="Calorías" value={totals.calories} goal={profile.calorieGoal} color="bg-emerald-500" />
        <MacroBar label="Proteínas" value={totals.protein} goal={profile.proteinGoal} color="bg-sky-500" />
        <MacroBar label="Carbohidratos" value={totals.carbs} goal={profile.carbsGoal} color="bg-amber-500" />
        <MacroBar label="Grasas" value={totals.fat} goal={profile.fatGoal} color="bg-rose-500" />
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-3">Calorías esta semana</h2>
        <div className="relative flex items-end gap-2 h-28">
          {/* línea de objetivo */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-emerald-500"
            style={{ bottom: `${(profile.calorieGoal / maxKcal) * 100}%` }}
          />
          {week.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full rounded-t bg-emerald-400 dark:bg-emerald-600 min-h-[2px]"
                style={{ height: `${(w.kcal / maxKcal) * 100}%` }}
              />
              <span className="text-[10px] text-zinc-500">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {MEAL_TYPES.map((mt) => {
          const items = dayEntries.filter((e) => e.mealType === mt);
          if (items.length === 0) return null;
          return (
            <div key={mt} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-2">
                {MEAL_TYPE_ICONS[mt]} {mt}
              </h3>
              {items.map((e) => (
                <div key={e.id} className="flex justify-between items-center py-1 text-sm">
                  <span>{e.customName ?? recipes.find((r) => r.id === e.recipeId)?.name ?? "Receta"}</span>
                  <span className="flex items-center gap-2 text-zinc-500">
                    {e.calories} kcal
                    <button onClick={() => removeEntry(e.id)} className="text-rose-500">
                      ✕
                    </button>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      {showAdd ? (
        <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm flex flex-col gap-3">
          <h3 className="font-semibold">Añadir comida</h3>
          <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className={inputCls}>
            {MEAL_TYPES.map((mt) => (
              <option key={mt}>{mt}</option>
            ))}
          </select>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode("recipe")}
              className={`flex-1 py-1.5 rounded-lg border ${mode === "recipe" ? "bg-emerald-600 text-white border-emerald-600" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              Receta
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`flex-1 py-1.5 rounded-lg border ${mode === "custom" ? "bg-emerald-600 text-white border-emerald-600" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              Personalizada
            </button>
          </div>
          {mode === "recipe" ? (
            <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className={inputCls}>
              <option value="">Elige una receta...</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.calories} kcal)
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                className={inputCls}
                placeholder="Nombre"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <div className="grid grid-cols-4 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
                  <label key={k} className="text-[10px] text-zinc-500 flex flex-col gap-0.5">
                    {{ calories: "kcal", protein: "prot", carbs: "carb", fat: "grasa" }[k]}
                    <input
                      type="number"
                      className={inputCls}
                      value={customMacros[k] || ""}
                      onChange={(e) => setCustomMacros({ ...customMacros, [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={submitAdd} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 font-semibold text-sm">
              Añadir
            </button>
            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg py-2 border border-zinc-300 dark:border-zinc-700 text-sm">
              Cancelar
            </button>
          </div>
        </section>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white rounded-xl py-3 font-semibold shadow-sm"
        >
          + Añadir comida
        </button>
      )}
    </div>
  );
}
