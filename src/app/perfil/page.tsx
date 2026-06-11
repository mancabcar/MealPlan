"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";

export default function ProfilePage() {
  const { profile, setProfile } = useApp();
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);

  if (!profile || !draft) return null;

  const save = () => {
    setProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    if (confirm("¿Borrar tu perfil y volver al inicio? Tus datos de diario y despensa se conservan.")) {
      setProfile(null);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <label className="text-sm font-medium flex flex-col gap-1">
          Nombre
          <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        {(
          [
            ["Calorías objetivo (kcal)", "calorieGoal"],
            ["Proteínas (g)", "proteinGoal"],
            ["Carbohidratos (g)", "carbsGoal"],
            ["Grasas (g)", "fatGoal"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="text-sm font-medium flex flex-col gap-1">
            {label}
            <input
              type="number"
              className={inputCls}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label className="text-sm font-medium flex flex-col gap-1">
          Restricciones (separadas por comas)
          <input
            className={inputCls}
            value={draft.dietaryRestrictions.join(", ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                dietaryRestrictions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="text-sm font-medium flex flex-col gap-1">
          No me gusta (separado por comas)
          <input
            className={inputCls}
            value={draft.dislikedIngredients.join(", ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                dislikedIngredients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <button onClick={save} className="bg-emerald-600 text-white rounded-lg py-2 font-semibold text-sm">
          {saved ? "✓ Guardado" : "Guardar cambios"}
        </button>
      </section>

      <button onClick={reset} className="text-rose-500 text-sm py-2">
        Borrar perfil
      </button>
    </div>
  );
}
