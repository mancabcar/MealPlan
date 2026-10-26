"use client";

import { Suspense, useCallback, useId, useMemo, useRef, useState } from "react";
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
import { dayName, mondayOf } from "@/lib/week";
import { RecipePicker } from "@/components/recetas/RecipePicker";
import { DAY_NAMES } from "@/lib/week";
import { useShoppingList } from "@/lib/shopping/useShoppingList";
import { useWeekParam, weekHref } from "@/lib/useWeekParam";
import { WeekNav } from "@/components/plan/WeekNav";
import { Toast } from "@/components/ui/Toast";
import { isSourceEmpty, planCopy, type CopyMode } from "@/lib/plan/copyWeek";
import { restoreDays, snapshotDays, type DaysSnapshot } from "@/lib/plan/restoreDays";
import { CopyWeekSheet } from "@/components/plan/CopyWeekSheet";
import { emptySlots, fillWeek } from "@/lib/plan/fillWeek";

/**
 * Hoja abierta sobre una tanda (docs/pm/17-sobras-batch-cooking): crear/editar, ver una sobra o decidir qué hacer con
 * ellas; o las raciones de una franja (docs/pm/29-raciones-plan).
 */
type Modal =
  | { kind: "batch"; origin: SlotRef }
  | { kind: "leftover"; at: SlotRef }
  | { kind: "servings"; at: SlotRef }
  | { kind: "copy"; conflicts: number } // conflictos de «Copiar semana anterior» (docs/pm/53-copiar-semana-anterior R2)
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
  const { profile, weekPlan, setWeekPlan, recipes, favorites, ratings } = useApp();
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
  // Aviso tras «Copiar semana anterior» (docs/pm/53-copiar-semana-anterior R5) o «Rellenar semana» (docs/pm/15, R6, R15)
  // `before`: los 7 días de la semana vista antes del cambio; Deshacer restaura solo esos (sin él, no hay Deshacer)
  const [planNotice, setPlanNotice] = useState<{ id: number; text: string; before?: DaysSnapshot } | null>(null);
  // `id` remonta el Toast con cada aviso: el segundo no hereda los 10 s del primero (como el de «Añadido» del Diario)
  const noticeId = useRef(0);
  const hidePlanNotice = useCallback(() => setPlanNotice(null), []);
  const copyHelpId = useId();
  const fillHelpId = useId();
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
    setPlanNotice(null);
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

  // R1, R2: con franjas ocupadas que la copia pisaría se pregunta antes de tocar nada
  const startCopy = () => {
    setEditing(null);
    setPlanNotice(null);
    const prepared = planCopy(weekPlan, monday, recipeIds, meals);
    if (prepared.conflicts > 0) setModal({ kind: "copy", conflicts: prepared.conflicts });
    else copyWeek("keep", prepared);
  };
  // Tras el diálogo de conflictos se recalcula sobre el plan de ese momento (pudo cambiar por la sincronización)
  const copyWeek = (mode: CopyMode, prepared = planCopy(weekPlan, monday, recipeIds, meals)) => {
    const { plan, copied } = prepared.apply(mode);
    if (copied === 0) {
      setPlanNotice({ id: ++noticeId.current, text: "No hay nada nuevo que copiar" });
      return;
    }
    setWeekPlan(plan);
    setPlanNotice({
      id: ++noticeId.current,
      text: copied === 1 ? "Copiada 1 franja" : `Copiadas ${copied} franjas`,
      before: snapshotDays(weekPlan, dates),
    });
  };
  // Rellenar semana (docs/pm/15-autocompletar-semana-ia R2, R15): solo de hoy en adelante, con «hoy» evaluado al pulsar
  // (una pestaña abierta tras medianoche no rellena el día que ya pasó)
  const startFill = () => {
    if (!profile) return;
    setEditing(null);
    setPlanNotice(null);
    const now = todayStr();
    const { plan, filled, unmetDays } = fillWeek({
      plan: weekPlan,
      dates: dates.filter((d) => d >= now),
      meals,
      recipes,
      profile,
      favorites,
      ratings,
      random: Math.random,
    });
    if (filled === 0) {
      setPlanNotice({ id: ++noticeId.current, text: "No hay recetas que encajen en las comidas vacías" });
      return;
    }
    setWeekPlan(plan);
    const k = unmetDays.length;
    setPlanNotice({
      id: ++noticeId.current,
      text:
        (filled === 1 ? "Rellenada 1 franja" : `Rellenadas ${filled} franjas`) +
        (k === 0 ? "" : k === 1 ? " · 1 día no cumple" : ` · ${k} días no cumplen`),
      before: snapshotDays(weekPlan, dates),
    });
  };
  // R1: en la semana actual y las futuras; sin comidas vacías de hoy en adelante, desactivado con explicación
  const canFill = !!profile && monday >= mondayOf(today);
  const nothingToFill = emptySlots(weekPlan, dates.filter((d) => d >= today), meals) === 0;

  // R5: devuelve los 7 días de la semana destino a como estaban; lo demás del plan no se toca
  const undoPlanNotice = () => {
    const before = planNotice?.before;
    if (!before) return;
    setWeekPlan(restoreDays(weekPlan, before, dates));
    setPlanNotice(null);
  };
  const sourceEmpty = isSourceEmpty(weekPlan, monday, meals);

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

      {/* Copiar semana anterior (docs/pm/53-copiar-semana-anterior R1, R4) y Rellenar semana (docs/pm/15 R1), a partes iguales */}
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1">
          <button
            type="button"
            onClick={startCopy}
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
        {canFill && (
          <div className="flex-1 flex flex-col gap-1">
            <button
              type="button"
              onClick={startFill}
              disabled={nothingToFill}
              aria-describedby={nothingToFill ? fillHelpId : undefined}
              className="min-h-11 rounded-xl border border-[var(--color-border)] text-sm font-medium disabled:opacity-50"
            >
              Rellenar semana
            </button>
            {nothingToFill && (
              <p id={fillHelpId} className="text-xs text-[var(--color-text-muted)] text-center">
                No quedan comidas vacías desde hoy
              </p>
            )}
          </div>
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
      {modal?.kind === "copy" && (
        <CopyWeekSheet
          conflicts={modal.conflicts}
          onChoose={(mode) => {
            setModal(null);
            if (mode) copyWeek(mode);
          }}
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

      {planNotice && (
        <Toast key={planNotice.id} onDismiss={hidePlanNotice} action={planNotice.before ? { label: "Deshacer", onClick: undoPlanNotice } : undefined}>
          {planNotice.text}
        </Toast>
      )}
    </div>
  );
}
