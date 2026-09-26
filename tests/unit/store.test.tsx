// @vitest-environment jsdom
// docs/pm/lista-compra/review.md › limpieza "store setter": el setter de usePersisted encadena las
// escrituras del mismo evento en vez de quedarse solo con la última (cierre obsoleto).
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seedData from "@/data/recipes.json";
// backup.ts y userData.ts aún no existen: se importan dentro de los tests nuevos para que los de arriba sigan corriendo.
import { AppProvider, useApp } from "@/lib/store";
import type { PantryItem, Recipe } from "@/lib/types";
import type { UserData } from "@/lib/userData";
import {
  AI_RECIPE,
  backupText,
  BACKUP_ENTRIES,
  BACKUP_PANTRY,
  BACKUP_PLAN,
  BACKUP_PROFILE,
  LEGACY_V1_PROFILE,
  MONDAY,
  SNACK_ENTRY,
} from "../fixtures/backup";
import { HOME_WEIGHTS, measurement, NUTRI_JULY } from "../fixtures/measurements";

const item = (id: string): PantryItem => ({ id, name: id, quantity: "1", category: "Despensa" });

function mount() {
  const ref: { app: ReturnType<typeof useApp> | null } = { app: null };
  function Probe() {
    ref.app = useApp();
    return null;
  }
  render(
    <AppProvider userId="u">
      <Probe />
    </AppProvider>,
  );
  return ref;
}

const stored = (k: string) => JSON.parse(localStorage.getItem(`mp_u_${k}`) ?? "null");

describe("usePersisted: varias escrituras en un mismo evento", () => {
  beforeEach(() => localStorage.clear());

  it("dos addPantryItem seguidos conservan los dos, en pantalla y en localStorage", () => {
    const ref = mount();
    act(() => {
      ref.app!.addPantryItem(item("a"));
      ref.app!.addPantryItem(item("b"));
    });
    expect(ref.app!.pantry.map((p) => p.id)).toEqual(["a", "b"]);
    expect(stored("pantry").map((p: PantryItem) => p.id)).toEqual(["a", "b"]);
  });

  it("añadir y quitar en el mismo evento se aplican en orden", () => {
    const ref = mount();
    act(() => {
      ref.app!.addPantryItems([item("a"), item("b"), item("c")]);
      ref.app!.removePantryItem("b");
    });
    expect(ref.app!.pantry.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("setShopping acepta una función del valor más reciente", () => {
    const ref = mount();
    act(() => {
      ref.app!.setShopping((s) => ({ ...s, current: { ...s.current, week: "2026-09-21" } }));
      ref.app!.setShopping((s) => ({ ...s, current: { ...s.current, overrides: ["x"] } }));
    });
    expect(ref.app!.shopping.current).toMatchObject({ week: "2026-09-21", overrides: ["x"] });
  });
});

// ---------------------------------------------------------------------------
// docs/pm/backup-datos/spec.md › R6, R7, R8 y tech.md › "Store" (importData escribe y relee las seis claves
// sin remontar AppProvider; si la escritura falla, no cambia nada).

const IMPORTED: UserData = {
  profile: BACKUP_PROFILE,
  recipes: [AI_RECIPE, ...(seedData.recipes as Recipe[])],
  entries: BACKUP_ENTRIES,
  pantry: BACKUP_PANTRY,
  weekplan: BACKUP_PLAN,
  shopping: { current: { week: MONDAY, bought: { "brócoli|g": "150g" }, overrides: [], moved: {} }, usage: {} },
  measurements: [NUTRI_JULY],
};

const PREVIOUS = {
  profile: { ...BACKUP_PROFILE, name: "Antes" },
  entries: [{ id: "old", date: "2026-09-01", mealType: "Comida", customName: "Antes", calories: 1, protein: 1, carbs: 1, fat: 1 }],
  pantry: [item("antes")],
};

function mountCounting() {
  const ref: { app: ReturnType<typeof useApp> | null; mounts: number } = { app: null, mounts: 0 };
  function Probe() {
    ref.app = useApp();
    useEffect(() => {
      ref.mounts++;
    }, []);
    return null;
  }
  render(
    <AppProvider userId="u">
      <Probe />
    </AppProvider>,
  );
  return ref;
}

const seedPrevious = () => {
  for (const [k, v] of Object.entries(PREVIOUS)) localStorage.setItem(`mp_u_${k}`, JSON.stringify(v));
};

const snapshot = () => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));

describe("R6: importData sustituye los datos sin recargar", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("el contexto muestra los siete datos importados", () => {
    seedPrevious();
    const ref = mountCounting();
    expect(ref.app!.profile?.name).toBe("Antes");

    act(() => ref.app!.importData(IMPORTED));

    expect(ref.app!.profile).toEqual(IMPORTED.profile);
    expect(ref.app!.recipes).toEqual(IMPORTED.recipes);
    expect(ref.app!.entries).toEqual(IMPORTED.entries);
    expect(ref.app!.pantry).toEqual(IMPORTED.pantry);
    expect(ref.app!.weekPlan).toEqual(IMPORTED.weekplan);
    expect(ref.app!.shopping).toEqual(IMPORTED.shopping);
    expect(ref.app!.measurements).toEqual(IMPORTED.measurements);
  });

  it("y los guarda en localStorage (recargar los sigue mostrando)", () => {
    seedPrevious();
    const ref = mountCounting();
    act(() => ref.app!.importData(IMPORTED));
    for (const k of ["profile", "recipes", "entries", "pantry", "weekplan", "shopping", "measurements"] as const)
      expect(stored(k), k).toEqual(IMPORTED[k]);
  });

  it("sin remontar AppProvider ni sus hijos", () => {
    seedPrevious();
    const ref = mountCounting();
    act(() => ref.app!.importData(IMPORTED));
    expect(ref.mounts).toBe(1);
  });

  it("las escrituras posteriores parten de lo importado", () => {
    seedPrevious();
    const ref = mountCounting();
    act(() => ref.app!.importData(IMPORTED));
    act(() => ref.app!.addPantryItem(item("nuevo")));
    expect(stored("pantry").map((p: PantryItem) => p.id)).toEqual([...BACKUP_PANTRY.map((p) => p.id), "nuevo"]);
  });

  it("importar datos ya migrados no crea copias *_v1_backup", () => {
    const ref = mountCounting();
    act(() => ref.app!.importData(IMPORTED));
    expect(Object.keys(localStorage).filter((k) => k.endsWith("_v1_backup"))).toEqual([]);
  });

  it("perfil null → el contexto queda sin perfil (la app lleva al onboarding)", () => {
    seedPrevious();
    const ref = mountCounting();
    act(() => ref.app!.importData({ ...IMPORTED, profile: null }));
    expect(ref.app!.profile).toBeNull();
  });
});

describe("R8: si la escritura falla, importData lanza y nada cambia", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("ni en pantalla ni en localStorage", () => {
    seedPrevious();
    const ref = mountCounting();
    const before = snapshot();
    const shown = { profile: ref.app!.profile, entries: ref.app!.entries, pantry: ref.app!.pantry };
    expect(ref.app!.importData).toBeTypeOf("function"); // que el toThrow de abajo sea por la cuota, no por su ausencia

    const realSetItem = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (++calls === 4) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return realSetItem.call(this, k, v);
    });

    expect(() => act(() => ref.app!.importData(IMPORTED))).toThrow();
    vi.restoreAllMocks();

    expect(snapshot()).toEqual(before);
    expect({ profile: ref.app!.profile, entries: ref.app!.entries, pantry: ref.app!.pantry }).toEqual(shown);
  });
});

describe("R7: la carga del store y parseBackup migran igual", () => {
  beforeEach(() => localStorage.clear());

  it("un perfil v1 y entradas 'Snack' dan lo mismo por las dos vías", async () => {
    const backupModule = "@/lib/backup"; // variable: que vite no lo resuelva al transformar mientras no exista
    const { parseBackup } = (await import(/* @vite-ignore */ backupModule)) as typeof import("@/lib/backup");
    localStorage.setItem("mp_u_profile", JSON.stringify(LEGACY_V1_PROFILE));
    localStorage.setItem("mp_u_entries", JSON.stringify([SNACK_ENTRY]));
    const ref = mountCounting();

    const parsed = parseBackup(backupText({ profile: LEGACY_V1_PROFILE, entries: [SNACK_ENTRY] }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.profile).toEqual(ref.app!.profile);
    expect(parsed.data.entries).toEqual(ref.app!.entries);
    expect(parsed.data.recipes).toEqual(ref.app!.recipes);
  });
});

// ---------------------------------------------------------------------------
// docs/pm/9-historial-medidas/spec.md › R5, R6 y tech.md › Components & files ("Store": measurements persistido en
// mp_<userId>_measurements con saveMeasurement / removeMeasurement).

describe("historial-medidas R6: las mediciones persisten por usuario", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado, el historial está vacío", () => {
    expect(mount().app!.measurements).toEqual([]);
  });

  it("carga lo guardado en mp_<userId>_measurements", () => {
    localStorage.setItem("mp_u_measurements", JSON.stringify(HOME_WEIGHTS));
    expect(mount().app!.measurements).toEqual(HOME_WEIGHTS);
  });

  it("al cargar descarta lo mal formado (sanitizeMeasurements)", () => {
    localStorage.setItem("mp_u_measurements", JSON.stringify([NUTRI_JULY, { id: 3 }, null]));
    expect(mount().app!.measurements).toEqual([NUTRI_JULY]);
  });

  it("cada usuario ve solo las suyas", () => {
    localStorage.setItem("mp_otro_measurements", JSON.stringify(HOME_WEIGHTS));
    expect(mount().app!.measurements).toEqual([]);
  });
});

describe("historial-medidas R1 · R5: saveMeasurement y removeMeasurement", () => {
  beforeEach(() => localStorage.clear());

  it("saveMeasurement con un id nuevo la añade y la guarda", () => {
    const ref = mount();
    act(() => ref.app!.saveMeasurement(NUTRI_JULY));
    expect(ref.app!.measurements).toEqual([NUTRI_JULY]);
    expect(stored("measurements")).toEqual([NUTRI_JULY]);
  });

  it("saveMeasurement con un id existente la sustituye (editar), sin duplicarla", () => {
    localStorage.setItem("mp_u_measurements", JSON.stringify(HOME_WEIGHTS));
    const ref = mount();
    const edited = { ...HOME_WEIGHTS[2], values: { weightKg: 75.5 }, savedAt: "2026-09-22T20:00:00.000Z" };
    act(() => ref.app!.saveMeasurement(edited));
    expect(ref.app!.measurements).toHaveLength(HOME_WEIGHTS.length);
    expect(ref.app!.measurements.find((m) => m.id === edited.id)).toEqual(edited);
    expect(stored("measurements")).toEqual(ref.app!.measurements);
  });

  it("removeMeasurement la quita y guarda", () => {
    localStorage.setItem("mp_u_measurements", JSON.stringify(HOME_WEIGHTS));
    const ref = mount();
    act(() => ref.app!.removeMeasurement("home-0922"));
    expect(ref.app!.measurements.map((m) => m.id)).not.toContain("home-0922");
    expect(stored("measurements")).toHaveLength(HOME_WEIGHTS.length - 1);
  });

  it("dos guardados en el mismo evento se encadenan (p. ej. medición + otra de Datos corporales)", () => {
    const ref = mount();
    const a = measurement("a", "2026-09-21", { weightKg: 75.2 });
    const b = measurement("b", "2026-09-22", { weightKg: 75 });
    act(() => {
      ref.app!.saveMeasurement(a);
      ref.app!.saveMeasurement(b);
    });
    expect(stored("measurements")).toEqual([a, b]);
  });
});
