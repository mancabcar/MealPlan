"use client";

// Pasos del perfil (prototipo 1–6), controlados: los usan el onboarding y Perfil.
import { useId } from "react";
import { ALLERGEN_LABELS, PRESET_ALLERGENS } from "@/lib/allergens";
import type { Derivation } from "@/lib/nutrition";
import { parseBody, parsePrescribed, type BodyDraft, type MacroDraft, type PrescribedDraft } from "@/lib/profileDraft";
import {
  MEAL_TYPES,
  MEAL_TYPE_ICONS,
  type ActivityLevel,
  type Allergies,
  type DietType,
  type Goal,
  type MealType,
  type PresetAllergen,
  type Sex,
  type TargetSource,
} from "@/lib/types";
import { ChipInput, ChoiceGroup, Field, MultiChoice, type Option } from "./ui";

// ---------------------------------------------------------------- 1 · Objetivo (R1)

export const GOAL_OPTIONS: Option<Goal>[] = [
  { value: "lose", label: "Perder grasa" },
  { value: "maintain", label: "Mantenerme" },
  { value: "gain", label: "Ganar músculo" },
];

export function GoalPicker({ value, onChange }: { value: Goal; onChange: (g: Goal) => void }) {
  return <ChoiceGroup legend="¿Cuál es tu objetivo?" name="goal" options={GOAL_OPTIONS} value={value} onChange={onChange} />;
}

// ---------------------------------------------------------------- 2 · Ruta (R2)

export const SOURCE_LABELS: Record<TargetSource, string> = {
  calculated: "Calcúlalo por mí",
  prescribed: "Tengo un plan de mi nutricionista",
};

export function TargetSourcePicker({ onPick }: { onPick: (s: TargetSource) => void }) {
  const hints: Record<TargetSource, string> = {
    calculated: "Con tu altura, peso y actividad te sugerimos calorías y macros.",
    prescribed: "Escribe las cifras de tu plan. La proteína puede ser un rango.",
  };
  return (
    <div className="flex flex-col gap-3">
      {(["calculated", "prescribed"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          aria-describedby={`source-${s}-hint`}
          className="text-left rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 hover:border-emerald-600"
        >
          <span className="block font-semibold">{SOURCE_LABELS[s]}</span>
          <span id={`source-${s}-hint`} className="block text-sm text-zinc-500 mt-1">
            {hints[s]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 3a · Datos corporales (R3)

export const SEX_OPTIONS: Option<Sex>[] = [
  { value: "female", label: "Mujer" },
  { value: "male", label: "Hombre" },
  { value: "unspecified", label: "Prefiero no decirlo" },
];

export const ACTIVITY_OPTIONS: Option<ActivityLevel>[] = [
  { value: "poco", label: "Poco", hint: "sin ejercicio" },
  { value: "algo", label: "Algo", hint: "1–3 días/semana" },
  { value: "bastante", label: "Bastante", hint: "3–5 días/semana" },
  { value: "mucho", label: "Mucho", hint: "6–7 días/semana" },
];

export function BodyDataForm({
  value,
  onChange,
  now,
}: {
  value: BodyDraft;
  onChange: (d: BodyDraft) => void;
  now?: Date;
}) {
  const { errors } = parseBody(value, now);
  const set = (patch: Partial<BodyDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup
        legend="Sexo"
        note="solo para el cálculo"
        name="sex"
        options={SEX_OPTIONS}
        value={value.sex}
        onChange={(sex) => set({ sex })}
      />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año de nacimiento" value={value.birthYear} onChange={(birthYear) => set({ birthYear })} error={errors.birthYear} placeholder="1992" />
        <Field label="Altura (cm)" value={value.heightCm} onChange={(heightCm) => set({ heightCm })} error={errors.heightCm} placeholder="165" />
        <Field label="Peso (kg)" inputMode="decimal" value={value.weightKg} onChange={(weightKg) => set({ weightKg })} error={errors.weightKg} placeholder="62,0" />
      </div>
      <ChoiceGroup
        legend="¿Cuánto te mueves?"
        name="activity"
        options={ACTIVITY_OPTIONS}
        value={value.activity}
        onChange={(activity) => set({ activity })}
      />
    </div>
  );
}

// ---------------------------------------------------------------- 4a · Objetivos sugeridos (R4)

export function MacroFields({ value, onChange }: { value: MacroDraft; onChange: (d: MacroDraft) => void }) {
  const set = (patch: Partial<MacroDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Calorías (kcal)" value={value.kcal} onChange={(kcal) => set({ kcal })} />
      <Field label="Proteínas (g)" value={value.protein} onChange={(protein) => set({ protein })} />
      <Field label="Carbohidratos (g)" value={value.carbs} onChange={(carbs) => set({ carbs })} />
      <Field label="Grasas (g)" value={value.fat} onChange={(fat) => set({ fat })} />
    </div>
  );
}

const ADJUSTMENT_TEXT: Record<string, string> = {
  "-15": "−15% para perder grasa",
  "0": "sin ajuste para mantenerte",
  "10": "+10% para ganar músculo",
};

export function SuggestedTargets({
  value,
  onChange,
  derivation,
  suggestedKcal,
  proteinPerKg,
  activity,
}: {
  value: MacroDraft;
  onChange: (d: MacroDraft) => void;
  derivation: Derivation;
  suggestedKcal: number;
  proteinPerKg: number;
  activity: ActivityLevel;
}) {
  const activityLabel = ACTIVITY_OPTIONS.find((a) => a.value === activity)?.label;
  return (
    <div className="flex flex-col gap-4">
      <MacroFields value={value} onChange={onChange} />
      <details open className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-4 text-sm">
        <summary className="font-semibold cursor-pointer">¿De dónde salen estas cifras?</summary>
        <ul className="mt-2 flex flex-col gap-1 text-zinc-600 dark:text-zinc-300">
          <li>Metabolismo basal (Mifflin-St Jeor): {derivation.bmr} kcal</li>
          <li>
            × {derivation.factor} por tu actividad{activityLabel ? ` (${activityLabel})` : ""} = {derivation.tdee} kcal
          </li>
          <li>
            {ADJUSTMENT_TEXT[String(derivation.adjustmentPct)]}, redondeado a 50 → {suggestedKcal} kcal
          </li>
          {derivation.floorApplied && (
            <li>
              Te sugerimos el mínimo recomendado de {derivation.floorApplied} kcal: el cálculo daba menos.
            </li>
          )}
          <li>
            Proteína {proteinPerKg} g por kg, grasa 0,9 g por kg; los carbohidratos son el resto.
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Es una estimación y no sustituye a un profesional.</p>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- 3b · Plan del nutricionista (R5, R6)

export function PrescribedTargetsForm({
  value,
  onChange,
}: {
  value: PrescribedDraft;
  onChange: (d: PrescribedDraft) => void;
}) {
  const { errors, value: parsed, mismatch } = parsePrescribed(value);
  const set = (patch: Partial<PrescribedDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Calorías (kcal)" value={value.kcal} onChange={(kcal) => set({ kcal })} error={errors.kcal} placeholder="1980" />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.isRange}
          onChange={(e) => set({ isRange: e.target.checked })}
          className="accent-emerald-600"
        />
        Es un rango
      </label>
      {value.isRange ? (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proteína mínima (g)" value={value.proteinMin} onChange={(proteinMin) => set({ proteinMin })} placeholder="130" />
            <Field label="Proteína máxima (g)" value={value.proteinMax} onChange={(proteinMax) => set({ proteinMax })} placeholder="170" />
          </div>
          {errors.proteinRange && (
            <span role="alert" className="text-xs text-rose-600">
              {errors.proteinRange}
            </span>
          )}
        </div>
      ) : (
        <Field label="Proteínas (g)" value={value.protein} onChange={(protein) => set({ protein })} error={errors.protein} placeholder="150" />
      )}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Carbohidratos (g)" value={value.carbs} onChange={(carbs) => set({ carbs })} placeholder="opcional" />
        <Field label="Grasas (g)" value={value.fat} onChange={(fat) => set({ fat })} placeholder="opcional" />
        <Field label="Peso (kg)" inputMode="decimal" value={value.weightKg} onChange={(weightKg) => set({ weightKg })} error={errors.weightKg} placeholder="opcional" />
      </div>
      <p className="text-xs text-zinc-500">
        Si dejas carbohidratos o grasas vacíos, los calculamos con las calorías que quedan.
      </p>
      {parsed && mismatch !== undefined && mismatch > 0.1 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Ojo: con estos macros salen {4 * parsed.proteinGoal + 4 * parsed.carbsGoal + 9 * parsed.fatGoal} kcal, no{" "}
          {parsed.calorieGoal}. Puedes seguir igualmente.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 5 · Comidas del día (R7)

const MEAL_OPTIONS: Option<MealType>[] = MEAL_TYPES.map((m) => ({ value: m, label: `${MEAL_TYPE_ICONS[m]} ${m}` }));

/** Devuelve siempre las comidas en el orden canónico. */
export function MealSlotPicker({ value, onChange }: { value: MealType[]; onChange: (m: MealType[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <MultiChoice
        legend="¿Qué comidas haces al día?"
        options={MEAL_OPTIONS}
        value={value}
        onChange={(v) => onChange(MEAL_TYPES.filter((m) => v.includes(m)))}
      />
      {value.length === 0 && <p className="text-xs text-rose-600">Elige al menos una comida.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- 6 · Alergias, dieta y gustos (R9, R11, R12)

export const DIET_OPTIONS: Option<DietType>[] = [
  { value: "omnivore", label: "Como de todo" },
  { value: "pescetarian", label: "Pescetariana" },
  { value: "vegetarian", label: "Vegetariana" },
  { value: "vegan", label: "Vegana" },
];

const ALLERGY_OPTIONS: Option<PresetAllergen>[] = PRESET_ALLERGENS.map((a) => ({ value: a, label: ALLERGEN_LABELS[a] }));

export interface Preferences {
  allergies: Allergies;
  diet: DietType;
  dislikedIngredients: string[];
}

export function AllergyDietDislikes({ value, onChange }: { value: Preferences; onChange: (p: Preferences) => void }) {
  const dietName = useId();
  const set = (patch: Partial<Preferences>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-rose-200 dark:border-rose-900 p-4">
        <MultiChoice
          legend="Alergias e intolerancias · nunca aparecerán en tus recetas"
          tone="rose"
          options={ALLERGY_OPTIONS}
          value={value.allergies.preset}
          onChange={(preset) => set({ allergies: { ...value.allergies, preset } })}
        />
        <ChipInput
          label="Otra alergia"
          tone="rose"
          placeholder="Escribe y pulsa Enter"
          values={value.allergies.custom}
          onChange={(custom) => set({ allergies: { ...value.allergies, custom } })}
        />
      </div>
      <ChoiceGroup legend="Tipo de dieta" name={`diet-${dietName}`} options={DIET_OPTIONS} value={value.diet} onChange={(diet) => set({ diet })} />
      <ChipInput
        label="No me gusta"
        placeholder="Escribe y pulsa Enter"
        values={value.dislikedIngredients}
        onChange={(dislikedIngredients) => set({ dislikedIngredients })}
      />
      <p className="text-xs text-zinc-500 -mt-3">Intentaremos evitarlo, pero no es una regla.</p>
    </div>
  );
}
