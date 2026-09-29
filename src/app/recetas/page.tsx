"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChefHat, Clock, Flame, Plus, Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { Recipe, daysUntil, todayStr } from "@/lib/types";
import { rankByPantry, recipesUsingItem, type RecipeUsage } from "@/lib/pantryRecipes";
import { toRecipeProfile } from "@/lib/recipePrompt";
import { apiUrl } from "@/lib/apiBase";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { inputCls } from "@/components/ui/input";
import { Sheet } from "@/components/ui/Sheet";
import { RecipeForm } from "@/components/recetas/RecipeForm";
import { dayName } from "@/components/plan/BatchSheet";
import { duplicateRecipe, slotsUsingRecipe, suggestedTags } from "@/lib/recipeEdit";

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

const secondaryBtn = "flex-1 border border-[var(--color-border)] rounded-lg py-2 text-sm font-semibold";
const newId = () => `custom_${crypto.randomUUID()}`;

export default function RecipesPage() {
  const { recipes, addRecipes, saveRecipe, removeRecipe, weekPlan, profile, pantry, recipeFocus, setRecipeFocus } = useApp();
  const [search, setSearch] = useState("");
  const [usePantry, setUsePantry] = useState(false);
  // Por id, para que el detalle muestre los cambios al editar
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Receta en el formulario: "new" = nueva; una receta = editar (o la copia sin guardar de "Duplicar y editar")
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const today = todayStr();
  const focusItem = recipeFocus ? pantry.find((i) => i.id === recipeFocus) : undefined;
  // El ítem enfocado se borró de la Despensa: se ignora y se limpia
  useEffect(() => {
    if (recipeFocus && !focusItem) setRecipeFocus(null);
  }, [recipeFocus, focusItem, setRecipeFocus]);

  // Pipeline (R7): ítem enfocado → "Usa lo que tengo" → texto
  const results = useMemo(() => {
    let list: { recipe: Recipe; usage?: RecipeUsage }[];
    const base = focusItem ? recipesUsingItem(recipes, focusItem, today) : recipes;
    if (usePantry) list = rankByPantry(base, pantry, today);
    else list = base.map((recipe) => ({ recipe }));
    const q = search.toLowerCase();
    return list.filter(
      ({ recipe: r }) => r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [recipes, pantry, focusItem, usePantry, search, today]);

  const selectRecipe = (r: Recipe) => {
    setSelectedId(r.id);
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
      const res = await fetch(apiUrl("/api/recipes"), {
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

  const onSave = (r: Recipe) => {
    saveRecipe(r);
    setSelectedId(editing === "new" ? null : r.id);
    setEditing(null);
  };
  const formSheet = editing && (
    <RecipeForm
      recipe={editing === "new" ? undefined : editing}
      suggestedTags={suggestedTags(recipes)}
      onSave={onSave}
      onClose={() => setEditing(null)}
    />
  );

  if (selected) {
    // Las semilla son de solo lectura: solo las propias y las de IA se editan y borran
    const editable = selected.isCustom || selected.isAIGenerated;
    const affected = slotsUsingRecipe(weekPlan, selected.id);
    return (
      <div className="flex flex-col gap-4">
        {formSheet}
        {deleting && (
          <Sheet title="Borrar receta" onClose={() => setDeleting(false)}>
            <p className="text-sm">¿Borrar «{selected.name}»? Las entradas del Diario se conservan como comidas sueltas.</p>
            {affected.length > 0 && (
              <div className="text-sm">
                <p className="mb-1">Está en el Plan; estas franjas se vaciarán:</p>
                <ul className="flex flex-col gap-0.5 text-[var(--color-text-muted)]">
                  {affected.map((s) => (
                    <li key={`${s.date}|${s.mealType}`}>
                      {dayName(s.date)} · {s.mealType}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleting(false)} className={secondaryBtn}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  removeRecipe(selected.id);
                  setDeleting(false);
                  setSelectedId(null);
                }}
                className="flex-1 bg-[var(--color-expired)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm"
              >
                Borrar
              </button>
            </div>
          </Sheet>
        )}
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1 text-[var(--color-accent)] text-sm self-start"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Volver
        </button>
        <RecipeImagePlaceholder className="h-40 w-full" />
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          {selected.isAIGenerated && <Sparkles className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />}
          {selected.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <AllergenBadge recipe={selected} allergies={profile?.allergies} />
          {selected.isCustom && <Chip tone="accent">Propia</Chip>}
        </div>
        <div className="flex gap-2">
          {editable ? (
            <>
              <button onClick={() => setEditing(selected)} className={secondaryBtn}>
                Editar
              </button>
              <button onClick={() => setDeleting(true)} className={secondaryBtn}>
                Borrar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(duplicateRecipe(selected, newId()))} className={secondaryBtn}>
              Duplicar y editar
            </button>
          )}
        </div>
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
      {formSheet}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Recetas</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Nueva receta
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" aria-hidden />
            {generating ? "Generando..." : "Sugerir con IA"}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--color-expired)" }}>
          {error}
        </p>
      )}
      <input className={inputCls} placeholder="Buscar por nombre o etiqueta..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setUsePantry(!usePantry)}
          aria-pressed={usePantry}
          className={`rounded-full px-3 py-1 text-sm font-semibold border ${
            usePantry
              ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent"
              : "border-[var(--color-border)] text-[var(--color-text-muted)]"
          }`}
        >
          Usa lo que tengo
        </button>
        {focusItem && (
          <span className="flex items-center gap-1 rounded-full px-3 py-1 text-sm bg-[var(--color-surface-2)]">
            con: {focusItem.name}
            <button onClick={() => setRecipeFocus(null)} aria-label={`Quitar filtro con: ${focusItem.name}`}>
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </span>
        )}
      </div>
      {results.length === 0 && (focusItem || usePantry) && (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
          <p>
            {search.trim()
              ? `Sin resultados para «${search.trim()}»`
              : focusItem
                ? `Ninguna receta usa ${focusItem.name}`
                : "Nada que aprovechar todavía"}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {results.map(({ recipe: r, usage }) => (
          <button key={r.id} onClick={() => selectRecipe(r)} className="text-left w-full">
            <Card className="flex gap-3">
              <RecipeImagePlaceholder className="h-16 w-16" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {r.isAIGenerated && <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" aria-hidden />}
                  <span className="truncate">{r.name}</span>
                  {r.isCustom && <Chip tone="accent">Propia</Chip>}
                </div>
                <AllergenBadge recipe={r} allergies={profile?.allergies} className="mt-1" />
                {usage && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--color-text-muted)]">
                    <span>
                      Tienes {usage.matched} de {usage.total} ingredientes
                    </span>
                    {usage.soonest && daysUntil(usage.soonest) <= 2 && <Chip tone="expiring">caduca pronto</Chip>}
                  </div>
                )}
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
