"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { allergenWarning } from "@/lib/allergens";
import { MEAL_TYPES, MEAL_TYPE_ICON_COMPONENTS, MealType, todayStr } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { DaySelector } from "@/components/ui/DaySelector";
import { inputCls } from "@/components/ui/input";

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
  const { profile, weekPlan, setWeekPlan, recipes } = useApp();
  const [editing, setEditing] = useState<{ date: string; mealType: MealType } | null>(null);
  // Selector de días (R8): qué día de la semana se muestra debajo
  const [selectedDate, setSelectedDate] = useState(todayStr());
  // Solo las comidas que el usuario hace, en el orden canónico (R8)
  const meals = profile?.meals ?? MEAL_TYPES;

  const dates = weekDates(todayStr());
  // Si el tab se queda montado al cruzar la medianoche, `dates` se recalcula (nueva semana) pero
  // `selectedDate` no: cae de vuelta a hoy en lugar de quedar en un índice inexistente (-1).
  const rawDayIndex = dates.indexOf(selectedDate);
  const dayIndex = rawDayIndex === -1 ? dates.indexOf(todayStr()) : rawDayIndex;
  const effectiveSelectedDate = dates[dayIndex] ?? dates[0];
  const EditingIcon = editing ? MEAL_TYPE_ICON_COMPONENTS[editing.mealType] : null;

  const assign = (recipeId: string) => {
    if (!editing) return;
    const slots = (weekPlan[editing.date] ?? []).filter((s) => s.mealType !== editing.mealType);
    setWeekPlan({
      ...weekPlan,
      [editing.date]: recipeId ? [...slots, { mealType: editing.mealType, recipeId }] : slots,
    });
    setEditing(null);
  };

  // Las asignaciones a comidas desmarcadas se conservan, pero no se muestran ni suman
  const slots = (weekPlan[effectiveSelectedDate] ?? []).filter((s) => meals.includes(s.mealType));
  const dayKcal = slots.reduce((s, slot) => s + (recipes.find((r) => r.id === slot.recipeId)?.calories ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Plan semanal</h1>

      <DaySelector dates={dates} selected={effectiveSelectedDate} onSelect={setSelectedDate} todayDate={todayStr()} />

      {editing && (
        <Card className="flex flex-col gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            {EditingIcon && <EditingIcon className="w-4 h-4" aria-hidden />}
            {editing.mealType} — {DAY_NAMES[dates.indexOf(editing.date)]}
          </h3>
          <select
            autoFocus
            className={inputCls}
            defaultValue={weekPlan[editing.date]?.find((s) => s.mealType === editing.mealType)?.recipeId ?? ""}
            onChange={(e) => assign(e.target.value)}
          >
            <option value="">— Sin asignar —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {[`${r.name} (${r.calories} kcal)`, allergenWarning(r, profile?.allergies)].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          <button onClick={() => setEditing(null)} className="text-sm text-[var(--color-text-muted)] self-start">
            Cancelar
          </button>
        </Card>
      )}

      <Card>
        <div className="flex justify-between items-baseline mb-2">
          <h2 className="font-display text-lg font-semibold">{DAY_NAMES[dayIndex]}</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{dayKcal > 0 ? `${dayKcal} kcal` : ""}</span>
        </div>
        <div className="flex flex-col gap-1">
          {meals.map((mt) => {
            const slot = slots.find((s) => s.mealType === mt);
            const recipe = slot ? recipes.find((r) => r.id === slot.recipeId) : undefined;
            const Icon = MEAL_TYPE_ICON_COMPONENTS[mt];
            return (
              <button
                key={mt}
                onClick={() => setEditing({ date: effectiveSelectedDate, mealType: mt })}
                className="flex justify-between items-center text-sm py-1.5 text-left"
              >
                <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Icon className="w-4 h-4" aria-hidden /> {mt}
                </span>
                <span className={recipe ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)] italic"}>
                  {recipe ? recipe.name : "Añadir"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
