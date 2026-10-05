"use client";

import { useCallback, useId, useState, type MouseEvent, type ReactNode } from "react";
import { Check, CheckCheck, Plus, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { dailyTotals, weekDayStates, type StatsPeriod } from "@/lib/diaryStats";
import { addDays, dayName } from "@/lib/week";
import {
  foodEntry,
  parseServings,
  pendingSlots,
  quantityLabel,
  recentMeals,
  recipeEntry,
  repeatEntry,
  servingsLabel,
} from "@/lib/diary";
import { macroStatus } from "@/lib/planMacros";
import { TOLERANCE_DEFAULT } from "@/lib/tolerance";
import { FIBER_ERROR, dayFiber, entryFiber, fiberGoal, formatFiber, parseFiber } from "@/lib/fiber";
import {
  MEAL_TYPES,
  MealType,
  todayStr,
} from "@/lib/types";
import { MEAL_TYPE_ICON_COMPONENTS } from "@/lib/categoryIcons";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { WeekBarChart } from "@/components/ui/WeekBarChart";
import { PeriodSummary, loadStatsDays, saveStatsDays } from "@/components/diario/PeriodSummary";
import { RecentMeals } from "@/components/diario/RecentMeals";
import { WaterCard } from "@/components/diario/WaterCard";
import { glassMl, waterGoalMl } from "@/lib/water";
import { ServingsField } from "@/components/ui/ServingsField";
import { RecipePicker } from "@/components/recetas/RecipePicker";
import { FoodPicker } from "@/components/diario/FoodPicker";
import { Toast } from "@/components/ui/Toast";
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
  valueText,
  flag,
  note,
}: {
  label: string;
  value: number;
  goal: number;
  tone: ChipTone;
  /** Texto del chip si no es «valor / objetivo» redondeado (la fibra lleva decimales). */
  valueText?: string;
  /** Marca junto al chip (el «parcial» de la fibra, #23). */
  flag?: ReactNode;
  /** Línea bajo la barra. */
  note?: string;
  /** Rango prescrito (R17): se dibuja como banda y cualquier valor dentro cuenta como cumplido. */
  range?: { min: number; max: number };
}) {
  const scale = range ? range.max : goal;
  const pct = Math.min(100, scale > 0 ? (value / scale) * 100 : 0);
  // Mismo criterio que el Plan (docs/pm/10-macros-plan, R3): se juzga el valor redondeado que se muestra
  // Un rango no usa la tolerancia (solo los objetivos numéricos): el valor que se pasa no influye
  const inBand = range && macroStatus(value, range, TOLERANCE_DEFAULT) === "within";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        <span className="flex items-center gap-1.5">
          {inBand && <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" role="img" aria-label="Cumplido" />}
          {flag}
          <Chip tone={tone}>
            {valueText ?? (range ? `${Math.round(value)} / ${range.min}–${range.max}` : `${Math.round(value)} / ${goal}`)}
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
      {note && <p className="text-xs text-[var(--color-text-muted)]">{note}</p>}
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

// Pestañas de «Añadir comida», en este orden (docs/pm/13-base-alimentos, R1)
type AddMode = "recipe" | "food" | "custom";
const MODES: [AddMode, string][] = [
  ["recipe", "Receta"],
  ["food", "Alimento"],
  ["custom", "Personalizada"],
];

export default function DiaryPage() {
  const { profile, entries, recipes, weekPlan, water, setWaterDay, addEntry, removeEntry } = useApp();
  const userId = useAuth().user?.id;
  // Medias y adherencia (docs/pm/11-medias-adherencia): 7 por defecto, la opción se recuerda por usuario (R11)
  const [statsDays, setStatsDays] = useState<StatsPeriod>(() => loadStatsDays(userId));
  const idPrefix = useId();
  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [mealType, setMealType] = useState<MealType>(() =>
    !profile || profile.meals.includes("Comida") ? "Comida" : profile.meals[0],
  );
  const [mode, setMode] = useState<AddMode>("recipe");
  const [recipeId, setRecipeId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customMacros, setCustomMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  // Fibra opcional de «Personalizada» (#23, R8): texto tal cual se teclea; vacío = sin dato
  const [customFiber, setCustomFiber] = useState("");
  const [customFiberError, setCustomFiberError] = useState(false);
  // Raciones (docs/pm/raciones): texto tal cual se teclea ("0,5"); el error solo sale al pulsar "Añadir"
  const [servingsText, setServingsText] = useState("1");
  const [servingsError, setServingsError] = useState(false);
  const servingsId = `${idPrefix}-servings`;
  // Base de alimentos (docs/pm/13-base-alimentos, R10): aviso con Deshacer tras añadir un alimento
  const [added, setAdded] = useState<{ entryId: string; text: string } | null>(null);
  const hideAdded = useCallback(() => setAdded(null), []);

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
  // Registro rápido (docs/pm/12-registro-rapido): se recalcula en cada render, así que sigue a la franja elegida (R3).
  // Solo con el formulario abierto, que es el único sitio donde se ve.
  const recents = showAdd ? recentMeals({ entries, recipes, mealType }) : [];

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

  // Fibra del día (#23, R2): las entradas sin dato no suman y marcan el total como parcial
  const fiberDay = dayFiber(dayEntries, recipes);
  const fiberTarget = fiberGoal(profile);

  // Gráfica semanal: últimos 7 días terminando en la fecha seleccionada
  // #50: cada día lleva su estado (cumple, no cumple, sin registros, hoy) con el mismo criterio que la adherencia
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const weekStates = weekDayStates({ entries, profile, dates: weekDates, today: todayStr() });
  // Las kcal salen del mismo dailyTotals que el estado: una entrada de backup sin kcal suma 0, no NaN
  const weekTotals = dailyTotals(entries, weekDates);
  const week = weekDates.map((key) => {
    const d = new Date(key + "T00:00:00");
    return {
      label: ["D", "L", "M", "X", "J", "V", "S"][d.getDay()],
      value: weekTotals.get(key)?.calories ?? 0,
      state: weekStates.get(key)!,
      // Con la fecha borrada no hay día de la semana: "" y el texto accesible solo dice el estado
      name: dayName(key) ?? "",
    };
  });

  const submitAdd = () => {
    // Fecha borrada en el input: una entrada sin fecha no saldría en ningún día (review de #12)
    if (date === "") return;
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
      const fiber = parseFiber(customFiber);
      if (fiber === null) {
        setCustomFiberError(true);
        return;
      }
      addEntry({ id: crypto.randomUUID(), date, mealType, customName, ...customMacros, ...(fiber !== undefined && { fiber }) });
    }
    setShowAdd(false);
    editServings("1");
    setCustomName("");
    setCustomMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    setCustomFiber("");
    setCustomFiberError(false);
  };

  return (
    // Mientras se ve el aviso (fixed, bottom-24), hueco al final para que «Añadir comida» pueda quedar por encima
    // y se pueda añadir otro alimento seguido (review de #13)
    <div className={`flex flex-col gap-4 ${added ? "pb-20" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Diario</h1>
        <input type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
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

      <PeriodSummary
        days={statsDays}
        onDaysChange={(d) => {
          setStatsDays(d);
          saveStatsDays(userId, d);
        }}
        entries={entries}
        profile={profile}
        date={date}
        today={todayStr()}
      />

      <Card className="flex flex-col gap-4">
        <MacroBar label="Proteínas" value={totals.protein} goal={profile.proteinGoal} range={profile.proteinRange} tone="protein" />
        <MacroBar label="Carbohidratos" value={totals.carbs} goal={profile.carbsGoal} tone="carbs" />
        <MacroBar label="Grasas" value={totals.fat} goal={profile.fatGoal} tone="fat" />
        <MacroBar
          label="Fibra"
          value={fiberDay.total}
          goal={fiberTarget}
          tone="fiber"
          valueText={`${formatFiber(fiberDay.total)} / ${fiberTarget}`}
          flag={fiberDay.missing > 0 && <Chip tone="expiring">parcial</Chip>}
          note={
            fiberDay.missing > 0
              ? `Faltan datos de fibra en ${fiberDay.missing} de ${fiberDay.count} ${fiberDay.count === 1 ? "entrada" : "entradas"}`
              : undefined
          }
        />
      </Card>

      {/* Agua (#23): sigue la fecha elegida */}
      <WaterCard ml={water[date] ?? 0} goalMl={waterGoalMl(profile)} glass={glassMl(profile)} onChange={(ml) => date !== "" && setWaterDay(date, ml)} />

      {/* R8: con ≥ 2 pendientes, encima de las tarjetas */}
      {pending.length >= 2 && (
        <button
          onClick={singleClick(() => pending.forEach((p) => addEntry(recipeEntry(p.recipe, date, p.mealType, { servings: p.servings }))))}
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
                    onClick={singleClick(() => addEntry(recipeEntry(slot.recipe, date, mt, { servings: slot.servings })))}
                    aria-describedby={recipeNameId}
                    className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold border border-[var(--color-accent)] text-[var(--color-accent)]"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden />
                    Hecho
                  </button>
                  <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5 text-[var(--color-text-muted)]">
                    <span id={recipeNameId}>
                      {slot.recipe.name}
                      {/* Raciones planificadas (docs/pm/29-raciones-plan R6): nada con 1 */}
                      {servingsLabel({ servings: slot.servings }) && <span> {servingsLabel({ servings: slot.servings })}</span>}
                    </span>
                    <Chip tone="neutral">Pendiente</Chip>
                    <AllergenBadge recipe={slot.recipe} allergies={profile.allergies} />
                  </div>
                  <span className="shrink-0 py-0.5 text-[var(--color-text-muted)]">{Math.round(slot.recipe.calories * slot.servings)} kcal</span>
                </div>
              )}
              {items.map((e) => {
                // Raciones (R4): "× 0,5" junto al nombre; nada con 1 ración o en entradas anteriores (R5).
                // Alimentos (#13, R9): "150 g" o "2 ud · 120 g"; una entrada tiene una cosa o la otra.
                const label = servingsLabel(e) ?? quantityLabel(e);
                const fiber = entryFiber(e, recipes);
                return (
                  <div key={e.id} className="flex justify-between items-center py-1 text-sm">
                    <div>
                      <span>
                        {e.customName ?? recipes.find((r) => r.id === e.recipeId)?.name ?? "Receta"}
                        {label && <span className="text-[var(--color-text-muted)]"> {label}</span>}
                      </span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {fiber === undefined ? "Fibra: sin dato" : `Fibra ${formatFiber(fiber)} g`}
                      </span>
                    </div>
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
            onChange={(e) => {
              setMealType(e.target.value as MealType);
              // La receta elegida era de otra franja: el selector nuevo no la resalta, así que no se arrastra a «Añadir»
              setRecipeId("");
            }}
            className={inputCls}
          >
            {profile.meals.map((mt) => (
              <option key={mt}>{mt}</option>
            ))}
          </select>
          {/* R1: fuera del condicional de modo, visible en Receta y en Personalizada. R4: un toque añade y cierra;
              no toca lo que hubiera a medio rellenar en el formulario */}
          <RecentMeals
            recents={recents}
            onPick={(r, ev) =>
              singleClick(() => {
                // Sin fecha no se añade nada, como en submitAdd
                if (date === "") return;
                addEntry(repeatEntry(r.entry, date, mealType));
                setShowAdd(false);
              })(ev)
            }
          />
          <div className="flex gap-2 text-sm">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-lg border ${
                  mode === m
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* R1, Edge cases: montado mientras el formulario está abierto, oculto fuera de su pestaña, para que la
              búsqueda y sus resultados sobrevivan a un cambio de pestaña */}
          <FoodPicker
            hidden={mode !== "food"}
            onAdd={(food, qty, ev) =>
              singleClick(() => {
                // Sin fecha no se añade nada, como en submitAdd
                if (date === "") return;
                const entry = foodEntry(food, date, mealType, qty);
                addEntry(entry);
                setShowAdd(false);
                setAdded({ entryId: entry.id, text: `Añadido a ${mealType} · ${quantityLabel(entry)}` });
              })(ev)
            }
            onManual={(name) => {
              // R14: Personalizada con el nombre ya escrito
              setCustomName(name);
              setMode("custom");
            }}
          />
          {mode === "food" ? null : mode === "recipe" ? (
            <>
              {/* Mismo selector que el Plan (docs/pm/20-recetas-filtros R1): filtrado por la franja elegida arriba. key: al
                  cambiar de franja se reinician el buscador y «Ver todas» */}
              <RecipePicker key={mealType} mealType={mealType} value={recipeId} onPick={setRecipeId} />
              {/* Raciones (docs/pm/raciones, R1/R6): independiente de la receta elegida; se valida al pulsar "Añadir" */}
              <ServingsField
                id={servingsId}
                value={servingsText}
                onChange={editServings}
                error={servingsError}
                // R9: vista previa, solo con receta elegida y valor válido
                preview={previewKcal !== null && <span className="shrink-0 text-[var(--color-text-muted)]">= {previewKcal} kcal</span>}
              />
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
              <label className="w-1/4 text-[10px] text-[var(--color-text-muted)] flex flex-col gap-0.5">
                fibra
                <input
                  inputMode="decimal"
                  className={inputCls}
                  value={customFiber}
                  aria-invalid={customFiberError}
                  onChange={(e) => {
                    setCustomFiber(e.target.value);
                    setCustomFiberError(false);
                  }}
                />
              </label>
              {customFiberError && (
                <span role="alert" className="text-xs text-[var(--color-expired)]">
                  {FIBER_ERROR}
                </span>
              )}
            </>
          )}
          <div className="flex gap-2">
            {/* En «Alimento» se añade con el botón de la tarjeta («Añadir 150 g») */}
            {mode !== "food" && (
              <button
                onClick={submitAdd}
                className="flex-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm"
              >
                Añadir
              </button>
            )}
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 rounded-lg py-2 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"
            >
              Cancelar
            </button>
          </div>
        </Card>
      ) : (
        // singleClick: el segundo clic de un doble toque en una reciente cae aquí al cerrarse el formulario (R4)
        <button
          onClick={singleClick(openAdd)}
          className="flex items-center justify-center gap-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-xl py-3 font-semibold"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Añadir comida
        </button>
      )}

      {added && (
        // R10: mismo componente y duración que el aviso de la Despensa. La key lo remonta con cada alimento añadido,
        // así el segundo aviso seguido tiene sus 10 s enteros (review de #13).
        <Toast
          key={added.entryId}
          onDismiss={hideAdded}
          action={{
            label: "Deshacer",
            onClick: () => {
              removeEntry(added.entryId);
              hideAdded();
            },
          }}
        >
          {added.text}
        </Toast>
      )}
    </div>
  );
}
