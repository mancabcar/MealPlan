"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Recipe } from "@/lib/types";

export default function RecipesPage() {
  const { recipes, addRecipes, profile, pantry } = useApp();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const filtered = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, pantryItems: pantry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando recetas");
      addRecipes(data.recipes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando recetas");
    } finally {
      setGenerating(false);
    }
  };

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setSelected(null)} className="text-emerald-600 text-sm self-start">
          ← Volver
        </button>
        <h1 className="text-2xl font-bold">
          {selected.isAIGenerated && "✨ "}
          {selected.name}
        </h1>
        <div className="flex gap-3 text-sm text-zinc-500">
          <span>⏱️ {selected.prepTimeMinutes} min</span>
          <span>🔥 {selected.calories} kcal</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          {[
            ["Proteínas", selected.protein],
            ["Carbos", selected.carbs],
            ["Grasas", selected.fat],
          ].map(([label, v]) => (
            <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-sm">
              <div className="font-bold">{v}g</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
        <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Ingredientes</h2>
          <ul className="list-disc list-inside text-sm flex flex-col gap-1">
            {selected.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </section>
        <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Preparación</h2>
          <ol className="list-decimal list-inside text-sm flex flex-col gap-2">
            {selected.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recetas</h1>
        <button
          onClick={generate}
          disabled={generating}
          className="bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {generating ? "Generando..." : "✨ Sugerir con IA"}
        </button>
      </div>
      {error && <p className="text-rose-500 text-sm">{error}</p>}
      <input
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        placeholder="Buscar por nombre o etiqueta..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm text-left"
          >
            <div className="font-semibold text-sm">
              {r.isAIGenerated && "✨ "}
              {r.name}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {r.calories} kcal · P {r.protein}g · C {r.carbs}g · G {r.fat}g · ⏱️ {r.prepTimeMinutes} min
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {r.tags.map((t) => (
                <span key={t} className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
