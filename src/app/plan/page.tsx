"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { useApp } from "@/lib/store";
import { allergenWarning } from "@/lib/allergens";
import { MEAL_TYPES, MEAL_TYPE_ICON_COMPONENTS, MealType, todayStr } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { DaySelector } from "@/components/ui/DaySelector";
import { DayMacroSummary } from "@/components/plan/DayMacroSummary";
import { dayPlanSummary } from "@/lib/planMacros";
import { inputCls } from "@/components/ui/input";
import { DAY_NAMES, weekDates } from "@/lib/week";
import { useShoppingList } from "@/lib/shopping/useShoppingList";

export default function PlanPage() {
  const { profile, weekPlan, setWeekPlan, recipes } = useApp();
  // Mismos recuentos que la lista (R1): ambos salen de buildShoppingView
  const shopping = useShoppingList();
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
  // Macros del día frente a los objetivos (docs/pm/10-macros-plan); null si no hay recetas que sumar
  const daySummary = dayPlanSummary({ slots, recipes, meals });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Plan semanal</h1>

      <DaySelector dates={dates} selected={effectiveSelectedDate} onSelect={setSelectedDate} todayDate={todayStr()} />

      {/* Tarjeta de semana (no sigue al día seleccionado): mismo aspecto que Card, pero es un enlace */}
      <Link
        href="/plan/compra"
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex items-center gap-3"
      >
        <ShoppingCart className="w-5 h-5 text-[var(--color-accent)] shrink-0" aria-hidden />
        <span className="flex-1 flex flex-col">
          <span className="text-sm font-semibold">Lista de la compra</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {shopping.empty
              ? "Nada que comprar todavía"
              : `${shopping.view.counts.pending} por comprar · ${shopping.view.counts.haveIt} ya los tienes`}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden />
      </Link>

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
        <h2 className="font-display text-lg font-semibold mb-2">{DAY_NAMES[dayIndex]}</h2>
        {daySummary && <DayMacroSummary summary={daySummary} profile={profile} />}
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
