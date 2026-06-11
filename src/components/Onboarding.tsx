"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";

const RESTRICTION_OPTIONS = [
  "vegetariano",
  "vegano",
  "sin gluten",
  "sin lactosa",
  "sin frutos secos",
];

export default function Onboarding() {
  const { setProfile } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(120);
  const [carbsGoal, setCarbsGoal] = useState(200);
  const [fatGoal, setFatGoal] = useState(65);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [disliked, setDisliked] = useState("");

  const finish = () => {
    setProfile({
      name,
      calorieGoal,
      proteinGoal,
      carbsGoal,
      fatGoal,
      dietaryRestrictions: restrictions,
      dislikedIngredients: disliked
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      mealsPerDay: 3,
      createdAt: new Date().toISOString(),
    });
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2";

  return (
    <div className="max-w-md mx-auto w-full px-6 py-12 flex flex-col gap-6 min-h-screen justify-center">
      {step === 0 && (
        <>
          <h1 className="text-3xl font-bold">🥗 MealPlanner</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Planifica tus comidas, controla tus macros y genera recetas con IA.
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            ¿Cómo te llamas?
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
          </label>
          <button
            onClick={() => setStep(1)}
            disabled={!name.trim()}
            className="bg-emerald-600 text-white rounded-lg py-3 font-semibold disabled:opacity-40"
          >
            Continuar
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="text-2xl font-bold">Tus objetivos diarios</h2>
          {[
            { label: "Calorías (kcal)", value: calorieGoal, set: setCalorieGoal },
            { label: "Proteínas (g)", value: proteinGoal, set: setProteinGoal },
            { label: "Carbohidratos (g)", value: carbsGoal, set: setCarbsGoal },
            { label: "Grasas (g)", value: fatGoal, set: setFatGoal },
          ].map((f) => (
            <label key={f.label} className="flex flex-col gap-1 text-sm font-medium">
              {f.label}
              <input
                type="number"
                className={inputCls}
                value={f.value}
                onChange={(e) => f.set(Number(e.target.value))}
              />
            </label>
          ))}
          <button
            onClick={() => setStep(2)}
            className="bg-emerald-600 text-white rounded-lg py-3 font-semibold"
          >
            Continuar
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-2xl font-bold">Restricciones y gustos</h2>
          <div className="flex flex-wrap gap-2">
            {RESTRICTION_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() =>
                  setRestrictions((prev) =>
                    prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
                  )
                }
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  restrictions.includes(r)
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ingredientes que no te gustan (separados por comas)
            <input
              className={inputCls}
              value={disliked}
              onChange={(e) => setDisliked(e.target.value)}
              placeholder="jamón, judías verdes..."
            />
          </label>
          <button
            onClick={finish}
            className="bg-emerald-600 text-white rounded-lg py-3 font-semibold"
          >
            ¡Empezar!
          </button>
        </>
      )}
    </div>
  );
}
