"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { withoutAllergies } from "@/lib/migrate";
import { calculateTargets, PROTEIN_G_PER_KG, type Targets } from "@/lib/nutrition";
import {
  bodyDraftFrom,
  macroDraftFrom,
  parseBody,
  parseMacros,
  parsePrescribed,
  prescribedDraftFrom,
  type BodyDraft,
  type MacroDraft,
  type PrescribedDraft,
} from "@/lib/profileDraft";
import { MEAL_TYPES, type BodyData, type Goal, type MealType, type TargetSource, type UserProfile } from "@/lib/types";
import {
  AllergyDietDislikes,
  BodyDataForm,
  GoalPicker,
  MealSlotPicker,
  PrescribedTargetsForm,
  SuggestedTargets,
  TargetSourcePicker,
  type Preferences,
} from "./profile/steps";
import { inputCls, primaryBtn, secondaryBtn } from "./profile/ui";

// Pasos del prototipo: 1 → 2 → (3a → 4a | 3b) → 5 → 6
type Step = "name" | "source" | "body" | "suggested" | "prescribed" | "meals" | "prefs";

const TITLES: Record<Step, string> = {
  name: "🥗 MealPlanner",
  source: "¿Cómo fijamos tus objetivos?",
  body: "Calcúlalo: datos corporales",
  suggested: "Objetivos sugeridos",
  prescribed: "Tengo un plan de mi nutricionista",
  meals: "Comidas del día",
  prefs: "Alergias y gustos",
};

export default function Onboarding() {
  const { setProfile } = useApp();
  const { user, logout } = useAuth();

  // Historial de pasos: "Atrás" vuelve al anterior y el borrador conserva todo lo escrito
  const [history, setHistory] = useState<Step[]>(["name"]);
  const step = history[history.length - 1];
  const go = (s: Step) => setHistory([...history, s]);
  const back = () => setHistory(history.slice(0, -1));

  const [name, setName] = useState(user?.username ?? "");
  const [goal, setGoal] = useState<Goal>("lose");
  const [source, setSource] = useState<TargetSource>("calculated");
  const [bodyDraft, setBodyDraft] = useState<BodyDraft>(bodyDraftFrom());
  const [suggestion, setSuggestion] = useState<{ body: BodyData; targets: Targets } | null>(null);
  const [macroDraft, setMacroDraft] = useState<MacroDraft>({ kcal: "", protein: "", carbs: "", fat: "" });
  const [prescribedDraft, setPrescribedDraft] = useState<PrescribedDraft>(prescribedDraftFrom());
  const [meals, setMeals] = useState<MealType[]>([...MEAL_TYPES]);
  const [prefs, setPrefs] = useState<Preferences>({
    allergies: { preset: [], custom: [] },
    diet: "omnivore",
    dislikedIngredients: [],
  });

  const body = parseBody(bodyDraft).value;
  const macros = parseMacros(macroDraft);
  const prescribed = parsePrescribed(prescribedDraft).value;

  const calculate = () => {
    if (!body) return;
    const targets = calculateTargets({ ...body, goal });
    setSuggestion({ body, targets });
    setMacroDraft(macroDraftFrom(targets));
    go("suggested");
  };

  const finish = () => {
    const base = {
      schemaVersion: 2 as const,
      name: name.trim(),
      goal,
      meals,
      allergies: prefs.allergies,
      diet: prefs.diet,
      // Lo que ya es alergia no se guarda también como "no me gusta"
      dislikedIngredients: withoutAllergies(prefs.dislikedIngredients, prefs.allergies),
      createdAt: new Date().toISOString(),
    };
    let profile: UserProfile | null = null;
    if (source === "calculated" && suggestion && macros) {
      profile = {
        ...base,
        targetSource: "calculated",
        body: suggestion.body,
        calorieGoal: macros.kcal,
        proteinGoal: macros.protein,
        carbsGoal: macros.carbs,
        fatGoal: macros.fat,
      };
    } else if (source === "prescribed" && prescribed) {
      profile = { ...base, targetSource: "prescribed", ...prescribed };
    }
    if (profile) setProfile(profile);
  };

  const backBtn = (
    <button type="button" onClick={back} className={`flex-1 ${secondaryBtn}`}>
      Atrás
    </button>
  );
  const nav = (next: React.ReactNode) => <div className="flex gap-3">{backBtn}{next}</div>;

  return (
    <div className="max-w-md mx-auto w-full px-6 py-12 flex flex-col gap-6 min-h-screen justify-center">
      <h1 className={step === "name" ? "text-3xl font-bold" : "text-2xl font-bold"}>{TITLES[step]}</h1>

      {step === "name" && (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            Planifica tus comidas, controla tus macros y genera recetas con IA.
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            ¿Cómo te llamas?
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </label>
          <GoalPicker value={goal} onChange={setGoal} />
          <button onClick={() => go("source")} disabled={!name.trim()} className={primaryBtn}>
            Continuar
          </button>
          <button onClick={logout} className="text-sm text-zinc-500">
            Cerrar sesión
          </button>
        </>
      )}

      {step === "source" && (
        <>
          <TargetSourcePicker
            onPick={(s) => {
              setSource(s);
              go(s === "calculated" ? "body" : "prescribed");
            }}
          />
          {backBtn}
        </>
      )}

      {step === "body" && (
        <>
          <BodyDataForm value={bodyDraft} onChange={setBodyDraft} />
          {nav(
            <button onClick={calculate} disabled={!body} className={`flex-[2] ${primaryBtn}`}>
              Calcular mis objetivos
            </button>,
          )}
        </>
      )}

      {step === "suggested" && suggestion && (
        <>
          <SuggestedTargets
            value={macroDraft}
            onChange={setMacroDraft}
            derivation={suggestion.targets.derivation}
            suggestedKcal={suggestion.targets.kcal}
            proteinPerKg={PROTEIN_G_PER_KG[goal]}
            activity={suggestion.body.activity}
          />
          {nav(
            <button onClick={() => go("meals")} disabled={!macros} className={`flex-[2] ${primaryBtn}`}>
              Usar estos objetivos
            </button>,
          )}
        </>
      )}

      {step === "prescribed" && (
        <>
          <PrescribedTargetsForm value={prescribedDraft} onChange={setPrescribedDraft} />
          {nav(
            <button onClick={() => go("meals")} disabled={!prescribed} className={`flex-[2] ${primaryBtn}`}>
              Continuar
            </button>,
          )}
        </>
      )}

      {step === "meals" && (
        <>
          <MealSlotPicker value={meals} onChange={setMeals} />
          {nav(
            <button onClick={() => go("prefs")} disabled={meals.length === 0} className={`flex-[2] ${primaryBtn}`}>
              Continuar
            </button>,
          )}
        </>
      )}

      {step === "prefs" && (
        <>
          <AllergyDietDislikes value={prefs} onChange={setPrefs} />
          {nav(
            <button onClick={finish} className={`flex-[2] ${primaryBtn}`}>
              Empezar
            </button>,
          )}
        </>
      )}
    </div>
  );
}
