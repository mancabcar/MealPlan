"use client";

import { Suspense, useCallback, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { useApp } from "@/lib/store";
import { MEAL_TYPES, MealType, WeekPlan, todayStr } from "@/lib/types";
import { MEAL_TYPE_ICON_COMPONENTS } from "@/lib/categoryIcons";
import { Card } from "@/components/ui/Card";
import { DaySelector } from "@/components/ui/DaySelector";
import { DayMacroSummary } from "@/components/plan/DayMacroSummary";
import { dayPlanSummary, slotServings } from "@/lib/planMacros";
import { formatServings, parseServings, servingsLabel } from "@/lib/diary";
import { batchOf, deleteOrigin, type SlotRef } from "@/lib/plan/batch";
import { BatchSheet, BatchWarningSheet, LeftoverSheet } from "@/components/plan/BatchSheet";
import { ServingsSheet } from "@/components/plan/ServingsSheet";
import { ServingsField } from "@/components/ui/ServingsField";
import { dayName } from "@/lib/week";
import { RecipePicker } from "@/components/recetas/RecipePicker";
import { DAY_NAMES } from "@/lib/week";
import { useShoppingList } from "@/lib/shopping/useShoppingList";
import { useWeekParam, weekHref } from "@/lib/useWeekParam";
import { WeekNav } from "@/components/plan/WeekNav";
import { Toast } from "@/components/ui/Toast";
import { applyCopy, isSourceEmpty, type CopyMode } from "@/lib/plan/copyWeek";

/**
 * Hoja abierta sobre una tanda (docs/pm/17-sobras-batch-cooking): crear/editar, ver una sobra o decidir qué hacer con
 * ellas; o las raciones de una franja (docs/pm/29-raciones-plan).
 */
type Modal =
  | { kind: "batch"; origin: SlotRef }
  | { kind: "leftover"; at: SlotRef }
  | { kind: "servings"; at: SlotRef }
  | { kind: "warning"; at: SlotRef; batchId: string; recipeId: string; servings: number }; // recipeId "" = borrar la franja

// useSearchParams (semana en la URL) exige un Suspense con el export estático
export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanContent />
    </Suspense>
  );
}

function PlanContent() {
  const { profile, weekPlan, setWeekPlan, recipes } = useApp();
  // Semana vista (docs/pm/78-plan-navegar-semanas): `?semana=<lunes>`, la actual si falta
  const { monday, dates, today } = useWeekParam();
  // Mismos recuentos que la lista (R1): ambos salen de buildShoppingView
  const shopping = useShoppingList(monday);
  const [editing, setEditing] = useState<{ date: string; mealType: MealType } | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  // Raciones de la tarjeta de asignación (docs/pm/29-raciones-plan R2): texto tal cual se teclea; el error sale al elegir receta
  const [servingsText, setServingsText] = useState("1");
  const [servingsError, setServingsError] = useState(false);
  const servingsId = useId();
  // Aviso tras «Copiar semana anterior» (docs/pm/53-copiar-semana-anterior R5)
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const hideCopyNotice = useCallback(() => setCopyNotice(null), []);
  const copyHelpId = useId();
  const recipeIds = useMemo(() => new Set(recipes.map((r) => r.id)), [recipes]);
  // Selector de días (R8): qué día de la semana se muestra debajo
  const [selectedDate, setSelectedDate] = useState(todayStr());
  // Al cambiar de semana se cierra lo que estuviera abierto (apuntaría a una fecha que ya no se ve) y el día vuelve
  // a hoy (semana actual) o al lunes (otra); ajuste de estado durante el render, como recomienda React
  const [shownWeek, setShownWeek] = useState(monday);
  if (shownWeek !== monday) {
    setShownWeek(monday);
    setEditing(null);
    setModal(null);
    setCopyNotice(null);
    setSelectedDate(today);
  }
  // Solo las comidas que el usuario hace, en el orden canónico (R8)
  const meals = profile?.meals ?? MEAL_TYPES;

  // Si `selectedDate` no cae en la semana vista (otra semana, o el tab cruzó la medianoche) se muestra hoy
  // si es esa semana y, si no, el lunes.
  const effectiveSelectedDate = dates.includes(selectedDate) ? selectedDate : dates.includes(today) ? today : dates[0];
  const dayIndex = dates.indexOf(effectiveSelectedDate);
  const EditingIcon = editing ? MEAL_TYPE_ICON_COMPONENTS[editing.mealType] : null;

  // Con 1 ración la franja no guarda `servings` (R1)
  const commitAssign = (plan: WeekPlan, at: SlotRef, recipeId: string, servings: number) => {
    const slots = (plan[at.date] ?? []).filter((s) => s.mealType !== at.mealType);
    setWeekPlan({
      ...plan,
      [at.date]: recipeId
        ? [...slots, { mealType: at.mealType, recipeId, ...(servings !== 1 && { servings }) }]
        : slots,
    });
  };

  // Abre el selector de la franja con sus raciones actuales en el campo (R2, R9)
  const startEditing = (at: SlotRef) => {
    const current = (weekPlan[at.date] ?? []).find((s) => s.mealType === at.mealType);
    setServingsText(formatServings(current ? slotServings(current) : 1));
    setServingsError(false);
    setEditing(at);
  };

  const assign = (recipeId: string) => {
    if (!editing) return;
    // R2: un valor inválido no asigna y el selector sigue abierto con el mensaje; "Quitar" no depende de las raciones
    const servings = recipeId ? parseServings(servingsText) : 1;
    if (servings === null) {
      setServingsError(true);
      return;
    }
    const current = (weekPlan[editing.date] ?? []).find((s) => s.mealType === editing.mealType);
    const batch = current?.batchId && current.cookedServings !== undefined ? batchOf(weekPlan, current.batchId) : null;
    setEditing(null);
    if (batch && batch.leftovers.length > 0) {
      // Borrar o cambiar la receta de una cocinada con sobras: se pregunta antes de tocar nada (R4, R9)
      setModal({ kind: "warning", at: editing, batchId: current!.batchId!, recipeId, servings });
      return;
    }
    // Una cocinada sin sobras deja de ser tanda al cambiar de receta
    commitAssign(batch ? deleteOrigin(weekPlan, current!.batchId!, "all") : weekPlan, editing, recipeId, servings);
  };

  // R1: copia la semana anterior a la vista; sin Deshacer ni aviso de conflictos todavía (tareas 3 y 4)
  const copyWeek = (mode: CopyMode) => {
    setEditing(null);
    const { plan, copied } = applyCopy(weekPlan, monday, recipeIds, mode);
    if (copied === 0) {
      setCopyNotice("No hay nada nuevo que copiar");
      return;
    }
    setWeekPlan(plan);
    setCopyNotice(copied === 1 ? "Copiada 1 franja" : `Copiadas ${copied} franjas`);
  };
  const sourceEmpty = isSourceEmpty(weekPlan, monday);

  const recipeName = (id: string) => recipes.find((r) => r.id === id)?.name ?? "la receta";
  const slotOf = (at: SlotRef) => (weekPlan[at.date] ?? []).find((s) => s.mealType === at.mealType);

  // Las asignaciones a comidas desmarcadas se conservan, pero no se muestran ni suman
  const slots = (weekPlan[effectiveSelectedDate] ?? []).filter((s) => meals.includes(s.mealType));
  // Macros del día frente a los objetivos (docs/pm/10-macros-plan); null si no hay recetas que sumar
  const daySummary = dayPlanSummary({ slots, recipes, meals });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Plan semanal</h1>

      <WeekNav monday={monday} today={today} path="/plan" />

      {/* Copiar semana anterior (docs/pm/53-copiar-semana-anterior R1, R4) */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => copyWeek("keep")}
          disabled={sourceEmpty}
          aria-describedby={sourceEmpty ? copyHelpId : undefined}
          className="min-h-11 rounded-xl border border-[var(--color-border)] text-sm font-medium disabled:opacity-50"
        >
          Copiar semana anterior
        </button>
        {sourceEmpty && (
          <p id={copyHelpId} className="text-xs text-[var(--color-text-muted)] text-center">
            La semana anterior no tiene nada que copiar
          </p>
        )}
      </div>

      <DaySelector dates={dates} selected={effectiveSelectedDate} onSelect={setSelectedDate} todayDate={today} />

      {/* Tarjeta de semana (no sigue al día seleccionado): mismo aspecto que Card, pero es un enlace */}
      <Link
        href={weekHref("/plan/compra", monday, today)}
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
          <RecipePicker
            key={`${editing.date}-${editing.mealType}`}
            mealType={editing.mealType}
            value={weekPlan[editing.date]?.find((s) => s.mealType === editing.mealType)?.recipeId ?? ""}
            onPick={assign}
            onClear={() => assign("")}
          />
          {/* Raciones (docs/pm/29-raciones-plan R2): se leen al elegir la receta */}
          <ServingsField
            id={servingsId}
            value={servingsText}
            onChange={(text) => {
              setServingsText(text);
              setServingsError(false);
            }}
            error={servingsError}
          />
          <button onClick={() => setEditing(null)} className="text-sm text-[var(--color-text-muted)] self-start min-h-11">
            Cancelar
          </button>
        </Card>
      )}

      {modal?.kind === "batch" && (
        <BatchSheet
          plan={weekPlan}
          origin={modal.origin}
          recipeName={recipeName(slotOf(modal.origin)?.recipeId ?? "")}
          meals={meals}
          onSave={(next) => {
            setWeekPlan(next);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "leftover" && (
        <LeftoverSheet
          plan={weekPlan}
          at={modal.at}
          recipeName={recipeName(slotOf(modal.at)?.recipeId ?? "")}
          onSave={(next) => {
            setWeekPlan(next);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "servings" && (
        <ServingsSheet
          plan={weekPlan}
          at={modal.at}
          recipeName={recipeName(slotOf(modal.at)?.recipeId ?? "")}
          onSave={(next) => {
            setWeekPlan(next);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "warning" && (
        <BatchWarningSheet
          recipeName={recipeName(slotOf(modal.at)?.recipeId ?? "")}
          leftovers={batchOf(weekPlan, modal.batchId)?.leftovers.length ?? 0}
          onChoose={(mode) => {
            if (mode) commitAssign(deleteOrigin(weekPlan, modal.batchId, mode), modal.at, modal.recipeId, modal.servings);
            setModal(null);
          }}
        />
      )}

      <Card>
        <h2 className="font-display text-lg font-semibold mb-2">{DAY_NAMES[dayIndex]}</h2>
        {daySummary && <DayMacroSummary summary={daySummary} profile={profile} />}
        <div className="flex flex-col gap-1">
          {meals.map((mt) => {
            const slot = slots.find((s) => s.mealType === mt);
            const recipe = slot ? recipes.find((r) => r.id === slot.recipeId) : undefined;
            const Icon = MEAL_TYPE_ICON_COMPONENTS[mt];
            const at = { date: effectiveSelectedDate, mealType: mt };
            // Tanda (sobras y batch cooking): una sobra sin su cocinada se ve y se edita como una franja normal (R10)
            const origin = slot?.leftover && slot.batchId ? batchOf(weekPlan, slot.batchId)?.origin : undefined;
            const isLeftover = origin !== undefined;
            const tag = isLeftover ? `Sobras · de ${dayName(origin.date)}` : slot?.cookedServings ? `Cocinar ×${slot.cookedServings}` : null;
            return (
              <div key={mt} className="flex flex-col">
                <button
                  onClick={() => (isLeftover ? setModal({ kind: "leftover", at }) : startEditing(at))}
                  className="flex justify-between items-center text-sm py-1.5 text-left"
                >
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Icon className="w-4 h-4" aria-hidden /> {mt}
                  </span>
                  <span className={recipe ? "text-[var(--color-text)] text-right" : "text-[var(--color-text-muted)] italic"}>
                    {recipe ? recipe.name : "Añadir"}
                    {recipe && slot && servingsLabel(slot) && <span className="text-[var(--color-text-muted)]"> {servingsLabel(slot)}</span>}
                    {recipe && tag && (
                      <span className="block text-xs text-[var(--color-accent)] not-italic">{tag}</span>
                    )}
                  </span>
                </button>
                {recipe && slot && (
                  <div className="self-end flex gap-4 pb-1">
                    {/* Raciones (docs/pm/29-raciones-plan R3, R8): en toda franja con receta, también las sobras */}
                    <button
                      onClick={() => setModal({ kind: "servings", at })}
                      aria-label={`Raciones: ${servingsLabel(slot) ?? "1"} (${mt})`}
                      className="text-xs text-[var(--color-accent)]"
                    >
                      Raciones: {servingsLabel(slot) ?? "1"}
                    </button>
                    {!isLeftover && (
                      <button
                        onClick={() => setModal({ kind: "batch", origin: at })}
                        aria-label={`Cocinar para varias comidas (${mt})`}
                        className="text-xs text-[var(--color-accent)]"
                      >
                        Cocinar para varias comidas
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {copyNotice && <Toast onDismiss={hideCopyNotice}>{copyNotice}</Toast>}
    </div>
  );
}
