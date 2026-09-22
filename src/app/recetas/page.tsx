"use client";

import { useState } from "react";
import { ArrowLeft, ChefHat, Clock, Flame, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { Recipe } from "@/lib/types";
import { toRecipeProfile } from "@/lib/recipePrompt";
import { allergenWarning } from "@/lib/allergens";
import type { Allergies } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]";

/** Aviso no bloqueante: las recetas del recetario no se filtran, solo se señalan. */
function AllergenBadge({ recipe, allergies }: { recipe: Recipe; allergies?: Allergies }) {
  const warning = allergenWarning(recipe, allergies);
  if (!warning) return null;
  return (
    <span
      className="inline-block mt-1 text-xs font-medium rounded-full px-2 py-0.5"
      style={{ color: "var(--color-expired)", backgroundColor: "color-mix(in oklab, var(--color-expired) 18%, var(--color-surface))" }}
    >
      {warning}
    </span>
  );
}

/** Placeholder de imagen (R9/non-goal: sin fotos reales todavía, ver spec § Non-goals). */
function RecipeImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] shrink-0 ${className}`}
    >
      <ChefHat className="w-7 h-7" />
    </div>
  );
}

export default function RecipesPage() {
  const { recipes, addRecipes, profile, pantry } = useApp();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const filtered = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  const selectRecipe = (r: Recipe) => {
    setSelected(r);
    setCheckedIngredients(new Set()); // checklist efimera (R9): no persiste entre recetas/visitas
  };

  const toggleIngredient = (i: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Solo lo que usa el prompt: sexo, edad y peso no salen del navegador
        body: JSON.stringify({ profile: profile && toRecipeProfile(profile), pantryItems: pantry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando recetas");
      if (data.recipes.length === 0 && data.droppedCount > 0) {
        throw new Error("Ninguna receta era segura para tus alergias. Prueba de nuevo.");
      }
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
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-[var(--color-accent)] text-sm self-start"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Volver
        </button>
        <RecipeImagePlaceholder className="h-40 w-full" />
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          {selected.isAIGenerated && <Sparkles className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />}
          {selected.name}
        </h1>
        <AllergenBadge recipe={selected} allergies={profile?.allergies} />
        <div className="flex gap-3 text-sm text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" aria-hidden /> {selected.prepTimeMinutes} min
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-4 h-4" aria-hidden /> {selected.calories} kcal
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          {(
            [
              ["Proteínas", selected.protein, "--color-protein"],
              ["Carbos", selected.carbs, "--color-carbs"],
              ["Grasas", selected.fat, "--color-fat"],
            ] as const
          ).map(([label, v, colorVar]) => (
            <Card key={label} padding="sm">
              <div className="font-display font-bold text-lg" style={{ color: `var(${colorVar})` }}>
                {v}g
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
            </Card>
          ))}
        </div>
        <Card>
          <h2 className="font-semibold mb-2">Ingredientes</h2>
          <ul className="flex flex-col gap-1.5">
            {selected.ingredients.map((ing, i) => {
              const checked = checkedIngredients.has(i);
              return (
                <li key={i}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIngredient(i)}
                      className="accent-[var(--color-accent)] w-4 h-4"
                    />
                    <span className={checked ? "line-through text-[var(--color-text-muted)]" : ""}>{ing}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold mb-2">Preparación</h2>
          <ol className="list-decimal list-inside text-sm flex flex-col gap-2">
            {selected.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Recetas</h1>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          {generating ? "Generando..." : "Sugerir con IA"}
        </button>
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--color-expired)" }}>
          {error}
        </p>
      )}
      <input className={inputCls} placeholder="Buscar por nombre o etiqueta..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="flex flex-col gap-2">
        {filtered.map((r) => (
          <button key={r.id} onClick={() => selectRecipe(r)} className="text-left w-full">
            <Card className="flex gap-3">
              <RecipeImagePlaceholder className="h-16 w-16" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {r.isAIGenerated && <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" aria-hidden />}
                  <span className="truncate">{r.name}</span>
                </div>
                <AllergenBadge recipe={r} allergies={profile?.allergies} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Chip icon={Flame}>{r.calories} kcal</Chip>
                  <Chip tone="protein">P {r.protein}g</Chip>
                  <Chip icon={Clock}>{r.prepTimeMinutes} min</Chip>
                  {r.tags.map((t) => (
                    <Chip key={t} tone="neutral">
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
