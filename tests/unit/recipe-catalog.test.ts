// Spec: docs/pm/recetas-almacenamiento/spec.md › Acceptance criteria R2, R3, R5.
// Tech: tech.md › Testing strategy. La migración del almacén (LOAD_OPTIONS.recipes.upgrade) deja de sembrar el catálogo:
// solo conserva las recetas del usuario (IA y propias). Es la misma que aplica parseBackup al importar una copia.
import { describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { buildBackup, parseBackup } from "@/lib/backup";
import { RETIRED_RECIPE_IDS } from "@/lib/migrate";
import { hasUserData } from "@/lib/syncMigration";
import type { Recipe } from "@/lib/types";
import { LOAD_OPTIONS } from "@/lib/userData";
import { AI_RECIPE } from "../fixtures/backup";

const SEED = seedData.recipes as Recipe[];
const upgrade = LOAD_OPTIONS.recipes.upgrade;

const AI_2: Recipe = { ...AI_RECIPE, id: "ai_k3x9_1", name: "Pollo al limón con quinoa" };
const CUSTOM: Recipe = {
  id: "custom_7c1e",
  name: "Macarrones de mamá",
  ingredients: ["80g macarrones", "tomate frito"],
  instructions: ["Cocer."],
  prepTimeMinutes: 20,
  calories: 520,
  protein: 18,
  carbs: 80,
  fat: 12,
  tags: ["comida"],
  isCustom: true,
};
const USER = [AI_RECIPE, AI_2, CUSTOM];

describe("R3: la migración del almacén conserva solo las recetas del usuario", () => {
  it("catálogo + 2 de IA + 1 propia → quedan exactamente esas 3", () => {
    expect(upgrade([...SEED, AI_RECIPE, AI_2, CUSTOM])).toEqual(USER);
  });

  it("el catálogo mezclado entre las del usuario también se quita, y el orden del usuario se conserva", () => {
    expect(upgrade([SEED[0], AI_RECIPE, SEED[1], CUSTOM, SEED[2], AI_2])).toEqual([AI_RECIPE, CUSTOM, AI_2]);
  });

  it("es idempotente: una segunda pasada no cambia nada", () => {
    const once = upgrade([...SEED, ...USER]);
    expect(upgrade(once)).toEqual(once);
  });

  it("una receta con id del catálogo y contenido distinto al del JSON se quita igualmente", () => {
    const stale = { ...SEED[0], name: "Tortilla vieja", calories: 1 };
    expect(upgrade([stale, AI_RECIPE])).toEqual([AI_RECIPE]);
  });

  it("las recetas retiradas (RETIRED_RECIPE_IDS) se quitan y las del usuario no se tocan", () => {
    const retired = Object.keys(RETIRED_RECIPE_IDS).map((id) => ({ ...SEED[0], id }));
    expect(upgrade([...retired, ...USER])).toEqual(USER);
  });

  it("no toca los campos de las recetas del usuario", () => {
    const [kept] = upgrade([...SEED, { ...AI_RECIPE, fiber: 4.5 }]);
    expect(kept).toEqual({ ...AI_RECIPE, fiber: 4.5 });
  });
});

describe("R2: un almacén nuevo no guarda nada del catálogo", () => {
  it("sin nada guardado (cuenta nueva), upgrade devuelve una lista vacía", () => {
    expect(upgrade(null)).toEqual([]);
  });

  it("una lista vacía sigue vacía", () => {
    expect(upgrade([])).toEqual([]);
  });
});

describe("R5: importar una copia de seguridad (pasa por la misma migración)", () => {
  const backupText = (recipes: Recipe[]) =>
    JSON.stringify({ app: "mealplan", schemaVersion: 1, exportedAt: "2026-09-24T08:00:00.000Z", data: { recipes } });

  it("una copia antigua (catálogo + usuario) deja cada receta del usuario una vez y ninguna del catálogo", () => {
    const result = parseBackup(backupText([AI_RECIPE, ...SEED, CUSTOM]));
    expect(result.ok && result.data.recipes).toEqual([AI_RECIPE, CUSTOM]);
  });

  it("una copia nueva (solo recetas del usuario) da el mismo resultado que cargarla", () => {
    const result = parseBackup(backupText(USER));
    expect(result.ok && result.data.recipes).toEqual(USER);
  });

  it("una copia sin recetas queda vacía (el catálogo viene con la app)", () => {
    const result = parseBackup(JSON.stringify({ app: "mealplan", schemaVersion: 1, exportedAt: "", data: {} }));
    expect(result.ok && result.data.recipes).toEqual([]);
  });

  it("sigue siendo todo o nada: una sección recipes mal formada invalida la copia", () => {
    const result = parseBackup(JSON.stringify({ app: "mealplan", schemaVersion: 1, data: { recipes: {} } }));
    expect(result.ok).toBe(false);
  });
});

describe("sync (#22): hasUserData solo cuenta las recetas del usuario", () => {
  class MemoryStorage implements Storage {
    private m = new Map<string, string>();
    get length() {
      return this.m.size;
    }
    clear() {
      this.m.clear();
    }
    getItem(key: string) {
      return this.m.get(key) ?? null;
    }
    key(i: number) {
      return [...this.m.keys()][i] ?? null;
    }
    removeItem(key: string) {
      this.m.delete(key);
    }
    setItem(key: string, value: string) {
      this.m.set(key, value);
    }
  }
  const withRecipes = (recipes: Recipe[]) => {
    const s = new MemoryStorage();
    s.setItem("mp_u_recipes", JSON.stringify(recipes));
    return s;
  };

  it("solo el catálogo guardado (cuenta sin datos propios) no cuenta como datos", () => {
    expect(hasUserData(withRecipes(SEED), "u")).toBe(false);
  });

  // #134: los ids retirados siguen guardados en dispositivos con el catálogo antiguo y la carga ya los trata como no del usuario.
  it("#134: el catálogo antiguo con ids retirados guardado no cuenta como datos", () => {
    const retired = Object.keys(RETIRED_RECIPE_IDS).map((id) => ({ ...SEED[0], id }));
    expect(retired.length).toBeGreaterThan(0);
    expect(hasUserData(withRecipes(retired), "u")).toBe(false);
    expect(hasUserData(withRecipes([...SEED, ...retired]), "u")).toBe(false);
  });

  it("#134: una receta propia sigue contando aunque haya ids retirados al lado", () => {
    const retired = Object.keys(RETIRED_RECIPE_IDS).map((id) => ({ ...SEED[0], id }));
    expect(hasUserData(withRecipes([...retired, CUSTOM]), "u")).toBe(true);
  });

  it("una receta de IA o propia sí cuenta, con o sin el catálogo al lado", () => {
    expect(hasUserData(withRecipes([AI_RECIPE]), "u")).toBe(true);
    expect(hasUserData(withRecipes([...SEED, CUSTOM]), "u")).toBe(true);
  });

  it("buildBackup exporta lo que haya en el almacén tal cual (la migración ya lo dejó solo con las del usuario)", () => {
    const s = withRecipes(USER);
    expect(buildBackup(s, "u").data.recipes).toEqual(USER);
  });
});
