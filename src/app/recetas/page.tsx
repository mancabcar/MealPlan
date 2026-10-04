"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChefHat, Clock, Download, ExternalLink, Flame, Plus, Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { Recipe, daysUntil, todayStr } from "@/lib/types";
import { rankByPantry, recipesUsingItem, type RecipeUsage } from "@/lib/pantryRecipes";
import { toRecipeProfile } from "@/lib/recipePrompt";
import { apiUrl } from "@/lib/apiBase";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { FavoriteStar } from "@/components/recetas/FavoriteStar";
import { inputCls } from "@/components/ui/input";
import { Sheet } from "@/components/ui/Sheet";
import { RecipeForm, type ImportedDraft } from "@/components/recetas/RecipeForm";
import { ImportRecipeSheet } from "@/components/recetas/ImportRecipeSheet";
import { dayName } from "@/lib/week";
import { duplicateRecipe, slotsUsingRecipe, suggestedTags } from "@/lib/recipeEdit";
import { searchRecipes, sortByName } from "@/lib/recipeSearch";
import { Highlight } from "@/components/ui/Highlight";

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
  const { recipes, favorites, addRecipes, saveRecipe, removeRecipe, weekPlan, profile, pantry, recipeFocus, setRecipeFocus } =
    useApp();
  const [search, setSearch] = useState("");
  const [usePantry, setUsePantry] = useState(false);
  // R5 (docs/pm/20-recetas-filtros): solo las marcadas con la estrella
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  // Por id, para que el detalle muestre los cambios al editar
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Receta en el formulario: "new" = nueva; una receta = editar (o la copia sin guardar de "Duplicar y editar")
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  // Importación desde URL (#19): el diálogo, y el borrador que abre el formulario de receta nueva (nada se guarda antes)
  const [importing, setImporting] = useState(false);
  const [importedDraft, setImportedDraft] = useState<ImportedDraft | null>(null);
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
    else list = sortByName(base).map((recipe) => ({ recipe })); // A–Z; con «Usa lo que tengo» manda el ranking
    const found = new Set(searchRecipes(list.map((x) => x.recipe), search));
    return list.filter(({ recipe: r }) => (!onlyFavorites || favorites.includes(r.id)) && found.has(r));
  }, [recipes, favorites, onlyFavorites, pantry, focusItem, usePantry, search, today]);

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
      // fetch solo rechaza si no hay red (PWA, issue #21 R5): mejor que el "Failed to fetch" del navegador
      const res = await fetch(apiUrl("/api/recipes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Solo lo que usa el prompt: sexo, edad y peso no salen del navegador
        body: JSON.stringify({ profile: profile && toRecipeProfile(profile), pantryItems: pantry }),
      }).catch(() => null);
      if (!res) throw new Error("Sin conexión. Prueba de nuevo cuando vuelvas a tener red.");
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
    setImportedDraft(null);
  };
  const formSheet = editing && (
    <RecipeForm
      recipe={editing === "new" ? undefined : editing}
      imported={editing === "new" ? (importedDraft ?? undefined) : undefined}
      suggestedTags={suggestedTags(recipes)}
      onSave={onSave}
      onClose={() => {
        setEditing(null);
        setImportedDraft(null);
      }}
    />
  );
  const importSheet = importing && (
    <ImportRecipeSheet
      onImported={(draft) => {
        setImporting(false);
        setImportedDraft(draft);
        setEditing("new");
      }}
      onManual={(sourceUrl) => {
        setImporting(false);
        // Formulario vacío; con la URL como origen si era válida (R9)
        setImportedDraft(sourceUrl ? { recipe: { name: "", ingredients: [], instructions: [] }, source: "jsonld", sourceUrl } : null);
        setEditing("new");
      }}
      onClose={() => setImporting(false)}
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
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            {selected.isAIGenerated && <Sparkles className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />}
            {selected.name}
          </h1>
          <FavoriteStar recipe={selected} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AllergenBadge recipe={selected} allergies={profile?.allergies} />
          {selected.isCustom && <Chip tone="accent">Propia</Chip>}
          {selected.macrosEstimated && <Chip tone="expiring">Macros estimados</Chip>}
        </div>
        {selected.sourceUrl && /^https?:[/][/]/i.test(selected.sourceUrl) && (
          <a
            href={selected.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-[var(--color-accent)] self-start"
          >
            <ExternalLink className="w-4 h-4" aria-hidden /> Ver receta original
          </a>
        )}
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
      {importSheet}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Recetas</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-1.5 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm font-semibold"
          >
            <Download className="w-4 h-4" aria-hidden />
            Importar desde URL
          </button>
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
        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          aria-pressed={onlyFavorites}
          className={`rounded-full px-3 py-1 text-sm font-semibold border ${
            onlyFavorites
              ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent"
              : "border-[var(--color-border)] text-[var(--color-text-muted)]"
          }`}
        >
          Solo favoritas
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
      {results.length === 0 && (focusItem || usePantry || onlyFavorites || search.trim()) && (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
          <p>
            {search.trim()
              ? `Sin resultados para «${search.trim()}»`
              : onlyFavorites && favorites.length === 0
                ? "Aún no tienes recetas favoritas. Toca la estrella de una receta para marcarla."
                : focusItem
                  ? `Ninguna receta usa ${focusItem.name}`
                  : usePantry
                    ? "Nada que aprovechar todavía"
                    : "Ninguna favorita coincide con los filtros"}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {results.map(({ recipe: r, usage }) => (
          // La estrella va fuera del botón de la tarjeta (un botón dentro de otro no es válido)
          <div key={r.id} className="relative">
            <button onClick={() => selectRecipe(r)} className="text-left w-full">
              <Card className="flex gap-3">
                <RecipeImagePlaceholder className="h-16 w-16" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5 pr-10">
                    {r.isAIGenerated && <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" aria-hidden />}
                    <span className="truncate">
                      <Highlight text={r.name} query={search} />
                    </span>
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
            <FavoriteStar recipe={r} className="absolute top-1 right-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
