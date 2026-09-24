"use client";

import { useId, useState, type MouseEvent } from "react";
import { Check, CheckCheck, Minus, Plus, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { allergenWarning } from "@/lib/allergens";
import {
  SERVINGS,
  SERVINGS_ERROR,
  formatServings,
  parseServings,
  pendingSlots,
  recipeEntry,
  servingsLabel,
  stepServings,
} from "@/lib/diary";
import {
  MEAL_TYPES,
  MEAL_TYPE_ICON_COMPONENTS,
  MealType,
  todayStr,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { WeekBarChart } from "@/components/ui/WeekBarChart";
import { inputCls } from "@/components/ui/input";

// Rediseño visual (docs/pm/design-refresh, R7): proteína/carbohidratos/grasas se quedan como barras
// de progreso (no como el anillo, solo para calorías), re-tokenizadas con --color-protein/carbs/fat.
// Conserva la lógica de "cumplido" (R17) intacta: dentro del rango prescrito cuenta como cumplido,
// ahora señalado con un icono Lucide (Check, con nombre accesible) en vez del glifo "✓" en el texto.
function MacroBar({
  label,
  value,
  goal,
  tone,
  range,
}: {
  label: string;
  value: number;
  goal: number;
  tone: ChipTone;
  /** Rango prescrito (R17): se dibuja como banda y cualquier valor dentro cuenta como cumplido. */
  range?: { min: number; max: number };
}) {
  const scale = range ? range.max : goal;
  const pct = Math.min(100, scale > 0 ? (value / scale) * 100 : 0);
  const inBand = range && value >= range.min && value <= range.max;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        <span className="flex items-center gap-1.5">
          {inBand && <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" role="img" aria-label="Cumplido" />}
          <Chip tone={tone}>
            {range ? `${Math.round(value)} / ${range.min}–${range.max}` : `${Math.round(value)} / ${goal}`}
          </Chip>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        {range && (
          <div
            aria-hidden
            className="absolute inset-y-0 right-0"
            style={{
              left: `${(range.min / range.max) * 100}%`,
              backgroundColor: `color-mix(in oklab, var(--color-${tone}) 35%, transparent)`,
            }}
          />
        )}
        <div className="relative h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: `var(--color-${tone})` }} />
      </div>
    </div>
  );
}

// Registrar y borrar ignoran el segundo clic de un doble toque (detail > 1): tras el primero la fila cambia
// (la pendiente pasa a entrada con ✕, o "Registrar todo el día" desaparece y las tarjetas suben) y el segundo
// caería sobre otro botón. Un toque suelto siempre tiene detail 1.
const singleClick = (action: () => void) => (ev: MouseEvent) => {
  if (ev.detail > 1) return;
  action();
};

// Botones − / + de "Raciones": cuadrados con borde, como los toggles Receta/Personalizada
const stepBtnCls =
  "shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-40";

export default function DiaryPage() {
  const { profile, entries, recipes, weekPlan, addEntry, removeEntry } = useApp();
  const idPrefix = useId();
  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [mealType, setMealType] = useState<MealType>(() =>
    !profile || profile.meals.includes("Comida") ? "Comida" : profile.meals[0],
  );
  const [mode, setMode] = useState<"recipe" | "custom">("recipe");
  const [recipeId, setRecipeId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customMacros, setCustomMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  // Raciones (docs/pm/raciones): texto tal cual se teclea ("0,5"); el error solo sale al pulsar "Añadir"
  const [servingsText, setServingsText] = useState("1");
  const [servingsError, setServingsError] = useState(false);
  const servingsId = `${idPrefix}-servings`;
  const servingsErrorId = `${servingsId}-error`;

  if (!profile) return null;

  const editServings = (text: string) => {
    setServingsText(text);
    setServingsError(false);
  };

  const selectedRecipe = recipes.find((x) => x.id === recipeId);
  const parsedServings = parseServings(servingsText);
  const previewKcal = selectedRecipe && parsedServings !== null ? Math.round(selectedRecipe.calories * parsedServings) : null;

  // Flujo paso 5: cada vez que se abre el formulario, "Raciones" vuelve a 1
  const openAdd = () => {
    editServings("1");
    setShowAdd(true);
  };

  const pending = pendingSlots({ date, today: todayStr(), weekPlan, recipes, entries, meals: profile.meals });

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
    return { label: ["D", "L", "M", "X", "J", "V", "S"][d.getDay()], value: kcal };
  });

  const submitAdd = () => {
    if (mode === "recipe") {
      if (!selectedRecipe) return;
      // R6: no se añade y el formulario sigue abierto con el mensaje junto al campo
      if (parsedServings === null) {
        setServingsError(true);
        return;
      }
      addEntry(recipeEntry(selectedRecipe, date, mealType, { servings: parsedServings }));
    } else {
      if (!customName.trim()) return;
      addEntry({ id: crypto.randomUUID(), date, mealType, customName, ...customMacros });
    }
    setShowAdd(false);
    editServings("1");
    setCustomName("");
    setCustomMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Diario</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      </div>

      <Card className="flex flex-col items-center gap-3 py-6">
        <ProgressRing value={totals.calories} max={profile.calorieGoal} label={`${Math.round(totals.calories)}`} sublabel="kcal" />
        <p className="text-sm text-[var(--color-text-muted)]">
          {Math.round(totals.calories)} / {profile.calorieGoal}
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-semibold mb-3">Calorías esta semana</h2>
        <WeekBarChart data={week} goal={profile.calorieGoal} />
      </Card>

      <Card className="flex flex-col gap-4">
        <MacroBar label="Proteínas" value={totals.protein} goal={profile.proteinGoal} range={profile.proteinRange} tone="protein" />
        <MacroBar label="Carbohidratos" value={totals.carbs} goal={profile.carbsGoal} tone="carbs" />
        <MacroBar label="Grasas" value={totals.fat} goal={profile.fatGoal} tone="fat" />
      </Card>

      {/* R8: con ≥ 2 pendientes, encima de las tarjetas */}
      {pending.length >= 2 && (
        <button
          onClick={singleClick(() => pending.forEach((p) => addEntry(recipeEntry(p.recipe, date, p.mealType))))}
          className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 border border-[var(--color-accent)] text-[var(--color-accent)] font-semibold text-sm"
        >
          <CheckCheck className="w-4 h-4" aria-hidden />
          Registrar todo el día
        </button>
      )}

      <section className="flex flex-col gap-3">
        {MEAL_TYPES.map((mt, i) => {
          const items = dayEntries.filter((e) => e.mealType === mt);
          // Cualquier entrada de esa comida quita la pendiente: la tarjeta tiene entradas o una fila pendiente
          const slot = pending.find((p) => p.mealType === mt);
          if (items.length === 0 && !slot) return null;
          const Icon = MEAL_TYPE_ICON_COMPONENTS[mt];
          const headingId = `${idPrefix}-meal-${i}`;
          const recipeNameId = `${headingId}-recipe`;
          return (
            <Card key={mt} as="section" aria-labelledby={headingId}>
              <h3 id={headingId} className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Icon className="w-4 h-4" aria-hidden /> {mt}
              </h3>
              {slot && (
                // "Hecho" a la izquierda y arriba: al registrar, la fila se convierte en la entrada y un segundo
                // toque cae sobre su nombre, no sobre la ✕ (a la derecha). Además, singleClick.
                <div className="flex items-start gap-2 text-sm">
                  <button
                    onClick={singleClick(() => addEntry(recipeEntry(slot.recipe, date, mt)))}
                    aria-describedby={recipeNameId}
                    className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold border border-[var(--color-accent)] text-[var(--color-accent)]"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden />
                    Hecho
                  </button>
                  <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5 text-[var(--color-text-muted)]">
                    <span id={recipeNameId}>{slot.recipe.name}</span>
                    <Chip tone="neutral">Pendiente</Chip>
                    <AllergenBadge recipe={slot.recipe} allergies={profile.allergies} />
                  </div>
                  <span className="shrink-0 py-0.5 text-[var(--color-text-muted)]">{slot.recipe.calories} kcal</span>
                </div>
              )}
              {items.map((e) => {
                // Raciones (R4): "× 0,5" junto al nombre; nada con 1 ración o en entradas anteriores (R5)
                const label = servingsLabel(e);
                return (
                  <div key={e.id} className="flex justify-between items-center py-1 text-sm">
                    <span>
                      {e.customName ?? recipes.find((r) => r.id === e.recipeId)?.name ?? "Receta"}
                      {label && <span className="text-[var(--color-text-muted)]"> {label}</span>}
                    </span>
                    <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                      {/* Con raciones los macros pueden no ser enteros (0,25 × 150 = 37,5): se redondea al mostrar */}
                      {Math.round(e.calories)} kcal
                      <button onClick={singleClick(() => removeEntry(e.id))} aria-label="Eliminar" className="text-[var(--color-expired)]">
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    </span>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </section>

      {showAdd ? (
        <Card className="flex flex-col gap-3">
          <h3 className="font-semibold">Añadir comida</h3>
          {/* Nuevas entradas: solo las comidas del usuario (R8). El historial de arriba muestra todas. */}
          <select
            aria-label="Comida del día"
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className={inputCls}
          >
            {profile.meals.map((mt) => (
              <option key={mt}>{mt}</option>
            ))}
          </select>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode("recipe")}
              className={`flex-1 py-1.5 rounded-lg border ${
                mode === "recipe"
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}
            >
              Receta
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`flex-1 py-1.5 rounded-lg border ${
                mode === "custom"
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}
            >
              Personalizada
            </button>
          </div>
          {mode === "recipe" ? (
            <>
              <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className={inputCls}>
                <option value="">Elige una receta...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {[`${r.name} (${r.calories} kcal)`, allergenWarning(r, profile.allergies)].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
              {/* Raciones (docs/pm/raciones, R1/R6): independiente de la receta elegida; se valida al pulsar "Añadir" */}
              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor={servingsId} className="font-medium">
                  Raciones
                </label>
                <div className="flex items-center gap-2 max-w-72">
                  {/* R8: ±0,25, deshabilitados en los extremos */}
                  <button
                    type="button"
                    onClick={() => editServings(formatServings(stepServings(servingsText, -1)))}
                    disabled={parsedServings === SERVINGS.min}
                    aria-label="Quitar 0,25 raciones"
                    className={stepBtnCls}
                  >
                    <Minus className="w-4 h-4" aria-hidden />
                  </button>
                  <input
                    id={servingsId}
                    inputMode="decimal"
                    value={servingsText}
                    onChange={(e) => editServings(e.target.value)}
                    aria-invalid={servingsError}
                    aria-describedby={servingsError ? servingsErrorId : undefined}
                    className={`${inputCls} min-w-0 text-center ${servingsError ? "border-[var(--color-expired)]" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => editServings(formatServings(stepServings(servingsText, 1)))}
                    disabled={parsedServings === SERVINGS.max}
                    aria-label="Añadir 0,25 raciones"
                    className={stepBtnCls}
                  >
                    <Plus className="w-4 h-4" aria-hidden />
                  </button>
                  {/* R9: vista previa, solo con receta elegida y valor válido */}
                  {previewKcal !== null && (
                    <span className="shrink-0 text-[var(--color-text-muted)]">= {previewKcal} kcal</span>
                  )}
                </div>
                {servingsError && (
                  <span id={servingsErrorId} role="alert" className="text-xs text-[var(--color-expired)]">
                    {SERVINGS_ERROR}
                  </span>
                )}
              </div>
            </>
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
                  <label key={k} className="text-[10px] text-[var(--color-text-muted)] flex flex-col gap-0.5">
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
            <button
              onClick={submitAdd}
              className="flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm"
            >
              Añadir
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 rounded-lg py-2 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"
            >
              Cancelar
            </button>
          </div>
        </Card>
      ) : (
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-xl py-3 font-semibold"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Añadir comida
        </button>
      )}
    </div>
  );
}
