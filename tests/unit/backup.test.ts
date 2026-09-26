// Spec: docs/pm/backup-datos/spec.md › R1–R4, R7, R8 y Casos límite.
// Tech: docs/pm/backup-datos/tech.md › Data model, APIs / interfaces ("Validación de parseBackup", "writeUserData")
// y Testing strategy (Unit). Funciones puras con un Storage en memoria; ninguna toca localStorage.
// docs/pm/9-historial-medidas/tech.md › Data model: las mediciones son el séptimo dato del usuario y viajan en la copia.
import { afterEach, describe, expect, it, vi } from "vitest";
import seedData from "@/data/recipes.json";
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  buildBackup,
  formatExportDate,
  parseBackup,
  writeUserData,
} from "@/lib/backup";
import { EMPTY_USER_DATA, LOAD_OPTIONS, USER_DATA_KEYS, withSeedRecipes, type UserData } from "@/lib/userData";
import { EMPTY as EMPTY_SHOPPING, loadShoppingState } from "@/lib/shopping/state";
import { migrateEntries, migrateProfile, migrateWeekPlan, PROFILE_SCHEMA_VERSION } from "@/lib/migrate";
import type { Recipe } from "@/lib/types";
import {
  ACCOUNT_A,
  ACCOUNT_A_DATA,
  AI_RECIPE,
  backupText,
  BACKUP_ENTRIES,
  BACKUP_MEASUREMENTS,
  BACKUP_PANTRY,
  BACKUP_PLAN,
  BACKUP_PROFILE,
  EXPORTED_AT,
  LEGACY_V1_PROFILE,
  MONDAY,
  OTHER_ACCOUNT,
  OTHER_MARKER,
  SNACK_ENTRY,
  TODAY,
} from "../fixtures/backup";

const SEED_RECIPES = seedData.recipes as Recipe[];
const U = ACCOUNT_A.id;
const V = OTHER_ACCOUNT.id;

/** Storage en memoria. `failOnSetItem = n` hace que la n-ésima llamada a setItem lance (cuota llena). */
class MemoryStorage implements Storage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name: string]: any;
  private map = new Map<string, string>();
  setItemCalls = 0;
  constructor(private failOnSetItem = 0) {}
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.setItemCalls++;
    if (this.failOnSetItem && this.setItemCalls === this.failOnSetItem) {
      throw new Error("QuotaExceededError: The quota has been exceeded.");
    }
    this.map.set(key, String(value));
  }
  /** Siembra sin contar como escritura del código probado. */
  seed(key: string, value: unknown) {
    this.map.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}

const SHOPPING_A = {
  current: { week: MONDAY, bought: { "brócoli|g": "150g" }, overrides: [], moved: {} },
  usage: { "2026-09-14": { bought: 3, overrides: 1 } },
};

/** Navegador con la cuenta A (seis datos), otra cuenta y las credenciales de las dos. */
function browserWithAccounts() {
  const s = new MemoryStorage();
  s.seed(
    "mp_users",
    [ACCOUNT_A, OTHER_ACCOUNT].map((a) => ({ ...a, createdAt: "2026-09-01T00:00:00Z" })),
  );
  s.seed("mp_session", { id: ACCOUNT_A.id, username: ACCOUNT_A.username });
  s.seed("mp_remembered", [ACCOUNT_A.username, OTHER_ACCOUNT.username]);
  for (const [k, v] of Object.entries(ACCOUNT_A_DATA)) s.seed(`mp_${U}_${k}`, v);
  s.seed(`mp_${U}_shopping`, SHOPPING_A);
  s.seed(`mp_${U}_profile_v1_backup`, { name: "copia interna v1" });
  s.seed(`mp_${V}_profile`, { ...BACKUP_PROFILE, name: OTHER_MARKER });
  s.seed(`mp_${V}_entries`, [{ ...BACKUP_ENTRIES[0], customName: OTHER_MARKER }]);
  return s;
}

const NOW = new Date("2026-09-24T08:30:00.000Z");

/** Datos completos y ya migrados, como los que produce parseBackup o la carga del store. */
const FULL_DATA: UserData = {
  profile: BACKUP_PROFILE,
  recipes: [AI_RECIPE, ...SEED_RECIPES],
  entries: BACKUP_ENTRIES,
  pantry: BACKUP_PANTRY,
  weekplan: BACKUP_PLAN,
  shopping: SHOPPING_A as UserData["shopping"],
  measurements: BACKUP_MEASUREMENTS,
};

function expectError(text: string, message: string) {
  const result = parseBackup(text);
  expect(result).toEqual({ ok: false, error: message });
}

const NOT_JSON = "El fichero no es un JSON válido.";
const NOT_A_BACKUP = "Este fichero no es una copia de MealPlan.";
const NEWER_VERSION = "Esta copia es de una versión más nueva de la app.";
const badSection = (k: string) => `La sección «${k}» no tiene el formato esperado.`;

// ---------------------------------------------------------------------------

describe("userData: registro compartido de los datos del usuario (base de R7)", () => {
  it("las siete claves, en este orden (historial-medidas añade «measurements» al final)", () => {
    expect(USER_DATA_KEYS).toEqual(["profile", "recipes", "entries", "pantry", "weekplan", "shopping", "measurements"]);
  });

  it("EMPTY_USER_DATA: sin perfil y todo vacío", () => {
    expect(EMPTY_USER_DATA).toEqual({
      profile: null,
      recipes: [],
      entries: [],
      pantry: [],
      weekplan: {},
      shopping: EMPTY_SHOPPING,
      measurements: [],
    });
  });

  it("LOAD_OPTIONS aplica las mismas migraciones que la carga del store", () => {
    expect(LOAD_OPTIONS.profile.upgrade(LEGACY_V1_PROFILE)).toEqual(migrateProfile(LEGACY_V1_PROFILE));
    expect(LOAD_OPTIONS.entries.upgrade([SNACK_ENTRY])).toEqual(migrateEntries([SNACK_ENTRY]));
    const plan = { [TODAY]: [{ mealType: "Snack", recipeId: "r1" }] };
    expect(LOAD_OPTIONS.weekplan.upgrade(plan)).toEqual(migrateWeekPlan(plan));
    expect(LOAD_OPTIONS.shopping.upgrade({ current: { week: MONDAY } })).toEqual(loadShoppingState({ current: { week: MONDAY } }));
    expect(LOAD_OPTIONS.recipes.upgrade(null)).toEqual(SEED_RECIPES);
    expect(LOAD_OPTIONS.pantry.upgrade(null)).toEqual([]);
    expect(LOAD_OPTIONS.pantry.upgrade(BACKUP_PANTRY)).toEqual(BACKUP_PANTRY);
    // Saneado de lo mal formado: sanitizeMeasurements (tests/unit/measurements.test.ts)
    expect(LOAD_OPTIONS.measurements.upgrade([...BACKUP_MEASUREMENTS, null, { id: 1 }])).toEqual(BACKUP_MEASUREMENTS);
    expect(LOAD_OPTIONS.measurements.upgrade(BACKUP_MEASUREMENTS)).toEqual(BACKUP_MEASUREMENTS);
  });

  it("LOAD_OPTIONS: nulo → el vacío de cada dato", () => {
    for (const k of USER_DATA_KEYS) {
      expect(LOAD_OPTIONS[k].upgrade(null) ?? LOAD_OPTIONS[k].fallback, k).toEqual(
        k === "recipes" ? SEED_RECIPES : EMPTY_USER_DATA[k],
      );
    }
  });

  it("LOAD_OPTIONS conserva la copia *_v1_backup donde la había (perfil, diario y plan)", () => {
    expect(LOAD_OPTIONS.profile.backup).toBe(true);
    expect(LOAD_OPTIONS.entries.backup).toBe(true);
    expect(LOAD_OPTIONS.weekplan.backup).toBe(true);
    expect(LOAD_OPTIONS.recipes.backup).toBeFalsy();
    expect(LOAD_OPTIONS.pantry.backup).toBeFalsy();
    expect(LOAD_OPTIONS.shopping.backup).toBeFalsy();
    expect(LOAD_OPTIONS.measurements.backup).toBeFalsy();
  });

  it("withSeedRecipes añade las de ejemplo que faltan y es idempotente", () => {
    const once = withSeedRecipes([AI_RECIPE]);
    expect(once).toEqual([AI_RECIPE, ...SEED_RECIPES]);
    expect(withSeedRecipes(once)).toEqual(once);
    expect(withSeedRecipes([SEED_RECIPES[0]]).filter((r) => r.id === SEED_RECIPES[0].id)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe("R1: nombre del fichero", () => {
  afterEach(() => vi.useRealTimers());

  it("mealplan-backup-AAAA-MM-DD.json", () => {
    expect(backupFileName("2026-09-24")).toBe("mealplan-backup-2026-09-24.json");
  });

  it("por defecto, la fecha local de hoy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 23, 30)); // 23:30 locales del 24/09 (en UTC puede ser otro día)
    expect(backupFileName()).toBe("mealplan-backup-2026-09-24.json");
  });
});

describe("R3: cabecera de la copia", () => {
  it("identificador de la app y versión del formato", () => {
    expect(BACKUP_APP_ID).toBe("mealplan");
    expect(BACKUP_SCHEMA_VERSION).toBe(1);
  });

  it("buildBackup incluye app, schemaVersion 1 y exportedAt en ISO", () => {
    const backup = buildBackup(browserWithAccounts(), U, NOW);
    expect(backup.app).toBe("mealplan");
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe("2026-09-24T08:30:00.000Z");
  });
});

describe("R2: la copia contiene los siete datos del usuario tal como están guardados", () => {
  it("perfil, recetas, diario, despensa, plan, lista de la compra y mediciones", () => {
    const { data } = buildBackup(browserWithAccounts(), U, NOW);
    expect(data).toEqual({ ...ACCOUNT_A_DATA, shopping: SHOPPING_A });
    expect(Object.keys(data).sort()).toEqual([...USER_DATA_KEYS].sort());
  });

  it("las claves ausentes se omiten", () => {
    const s = new MemoryStorage();
    s.seed(`mp_${U}_profile`, BACKUP_PROFILE);
    s.seed(`mp_${U}_entries`, BACKUP_ENTRIES);
    const { data } = buildBackup(s, U, NOW);
    expect(data).toEqual({ profile: BACKUP_PROFILE, entries: BACKUP_ENTRIES });
  });

  it("no escribe nada en el storage", () => {
    const s = browserWithAccounts();
    const before = s.snapshot();
    buildBackup(s, U, NOW);
    expect(s.snapshot()).toEqual(before);
    expect(s.setItemCalls).toBe(0);
  });
});

describe("R4: la copia no contiene credenciales, sesión ni datos de otras cuentas", () => {
  const text = () => JSON.stringify(buildBackup(browserWithAccounts(), U, NOW));

  it("ni hash ni sal de la cuenta", () => {
    expect(text()).not.toContain(ACCOUNT_A.hash);
    expect(text()).not.toContain(ACCOUNT_A.salt);
  });

  it("ni id de cuenta ni nombre de usuario (el perfil se llama «Lucía», el usuario «lucia»)", () => {
    expect(text()).not.toContain(ACCOUNT_A.id);
    expect(text()).not.toContain(ACCOUNT_A.username);
    expect(text()).toContain("Lucía");
  });

  it("ni usuarios recordados ni nada de la otra cuenta del navegador", () => {
    expect(text()).not.toContain(OTHER_ACCOUNT.username);
    expect(text()).not.toContain(OTHER_ACCOUNT.id);
    expect(text()).not.toContain(OTHER_ACCOUNT.hash);
    expect(text()).not.toContain(OTHER_MARKER);
  });

  it("ni las copias internas *_v1_backup", () => {
    expect(text()).not.toContain("copia interna v1");
  });

  it("solo app, schemaVersion, exportedAt y data en la cabecera", () => {
    expect(Object.keys(buildBackup(browserWithAccounts(), U, NOW)).sort()).toEqual(
      ["app", "data", "exportedAt", "schemaVersion"],
    );
  });
});

// ---------------------------------------------------------------------------

describe("R10: exportar y volver a leer da los mismos datos", () => {
  it("buildBackup → parseBackup devuelve lo guardado (ya migrado)", () => {
    const s = new MemoryStorage();
    for (const k of USER_DATA_KEYS) s.seed(`mp_${U}_${k}`, FULL_DATA[k]);
    const text = JSON.stringify(buildBackup(s, U, NOW), null, 2);
    expect(parseBackup(text)).toEqual({ ok: true, data: FULL_DATA, exportedAt: "2026-09-24T08:30:00.000Z" });
  });

  it("se conservan campos extra de las entradas (p. ej. servings)", () => {
    const result = parseBackup(backupText({ entries: BACKUP_ENTRIES }));
    expect(result.ok && result.data.entries).toEqual(BACKUP_ENTRIES);
  });
});

describe("Casos límite: secciones ausentes o vacías", () => {
  it("una copia sin secciones da todo vacío y las recetas de ejemplo", () => {
    expect(parseBackup(backupText({}))).toEqual({
      ok: true,
      exportedAt: EXPORTED_AT,
      data: { ...EMPTY_USER_DATA, recipes: SEED_RECIPES },
    });
  });

  it("una copia anterior al historial (sin measurements) es válida y deja el historial vacío", () => {
    const result = parseBackup(backupText({ profile: BACKUP_PROFILE, entries: BACKUP_ENTRIES }));
    expect(result.ok && result.data.measurements).toEqual([]);
  });

  it("una copia sin shopping es válida y la lista queda vacía", () => {
    const result = parseBackup(backupText({ profile: BACKUP_PROFILE, entries: BACKUP_ENTRIES }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.shopping).toEqual(EMPTY_SHOPPING);
    expect(result.data.pantry).toEqual([]);
    expect(result.data.weekplan).toEqual({});
  });

  it("profile: null es válido (tras importar, onboarding)", () => {
    const result = parseBackup(backupText({ profile: null }));
    expect(result.ok && result.data.profile).toBeNull();
  });

  it("las recetas de ejemplo no se duplican si la copia ya las trae", () => {
    const result = parseBackup(backupText({ recipes: [AI_RECIPE, ...SEED_RECIPES] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.data.recipes.map((r) => r.id);
    expect(ids).toHaveLength(SEED_RECIPES.length + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("las recetas de ejemplo que falten se vuelven a añadir", () => {
    const result = parseBackup(backupText({ recipes: [AI_RECIPE] }));
    expect(result.ok && result.data.recipes).toEqual([AI_RECIPE, ...SEED_RECIPES]);
  });
});

describe("R7: la importación pasa por las mismas migraciones que la carga", () => {
  const legacy = () => {
    const result = parseBackup(
      backupText({
        profile: LEGACY_V1_PROFILE,
        entries: [SNACK_ENTRY],
        weekplan: { [TODAY]: [{ mealType: "Snack", recipeId: AI_RECIPE.id }] },
        shopping: { current: { week: MONDAY } },
      }),
    );
    if (!result.ok) throw new Error(`parseBackup rechazó la copia antigua: ${result.error}`);
    return result.data;
  };

  it("perfil v1 con ['Vegetariano', 'Sin gluten'] → v2, dieta vegetariana y alergia al gluten", () => {
    expect(legacy().profile).toMatchObject({
      schemaVersion: 2,
      name: "Manuel",
      diet: "vegetarian",
      allergies: { preset: ["gluten"], custom: [] },
      calorieGoal: 1980,
    });
  });

  it("el perfil migrado es el mismo que da migrateProfile al cargar", () => {
    expect(legacy().profile).toEqual(migrateProfile(LEGACY_V1_PROFILE));
  });

  it("'Snack' → 'Merienda' en el diario", () => {
    expect(legacy().entries).toEqual([{ ...SNACK_ENTRY, mealType: "Merienda" }]);
  });

  it("'Snack' → 'Merienda' en el plan", () => {
    expect(legacy().weekplan).toEqual({ [TODAY]: [{ mealType: "Merienda", recipeId: AI_RECIPE.id }] });
  });

  it("el estado de la compra se normaliza con loadShoppingState", () => {
    expect(legacy().shopping).toEqual(loadShoppingState({ current: { week: MONDAY } }));
    expect(legacy().shopping.current).toEqual({ week: MONDAY, bought: {}, overrides: [], moved: {} });
  });

  it("cada sección es exactamente LOAD_OPTIONS[k].upgrade de lo que trae el fichero", () => {
    const raw = { ...ACCOUNT_A_DATA, profile: LEGACY_V1_PROFILE, entries: [SNACK_ENTRY], shopping: SHOPPING_A };
    const result = parseBackup(backupText(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const k of USER_DATA_KEYS) expect(result.data[k], k).toEqual(LOAD_OPTIONS[k].upgrade(raw[k]));
  });
});

describe("R8: un fichero no válido se rechaza con un motivo", () => {
  it("no es JSON", () => {
    expectError("esto no es json {", NOT_JSON);
    expectError("", NOT_JSON);
    expectError('{"app": "mealplan", "schemaVersion": 1, "data": {', NOT_JSON); // cortado
  });

  it("JSON que no es una copia de la app", () => {
    expectError("[]", NOT_A_BACKUP);
    expectError("null", NOT_A_BACKUP);
    expectError('"mealplan"', NOT_A_BACKUP);
    expectError(JSON.stringify({ schemaVersion: 1, exportedAt: EXPORTED_AT, data: {} }), NOT_A_BACKUP); // sin app
    expectError(backupText({}, { app: "otra-app" }), NOT_A_BACKUP);
  });

  it("schemaVersion que no es un entero ≥ 1", () => {
    expectError(backupText({}, { schemaVersion: "1" }), NOT_A_BACKUP);
    expectError(backupText({}, { schemaVersion: 0 }), NOT_A_BACKUP);
    expectError(backupText({}, { schemaVersion: 1.5 }), NOT_A_BACKUP);
    expectError(backupText({}, { schemaVersion: undefined }), NOT_A_BACKUP);
  });

  it("schemaVersion mayor que el conocido → versión más nueva", () => {
    expectError(backupText({}, { schemaVersion: 2 }), NEWER_VERSION);
    expectError(backupText({}, { schemaVersion: 99 }), NEWER_VERSION);
  });

  it("sin data o data que no es un objeto", () => {
    expectError(JSON.stringify({ app: "mealplan", schemaVersion: 1, exportedAt: EXPORTED_AT }), NOT_A_BACKUP);
    expectError(backupText({}, { data: "todo" }), NOT_A_BACKUP);
    expectError(backupText({}, { data: null }), NOT_A_BACKUP);
  });

  it("profile que no es null ni un objeto", () => {
    expectError(backupText({ profile: "Lucía" }), badSection("profile"));
    expectError(backupText({ profile: 42 }), badSection("profile"));
  });

  it("profile de una versión futura (schemaVersion 3) no se migra como v1 (Spec feedback 4)", () => {
    expectError(backupText({ profile: { ...BACKUP_PROFILE, schemaVersion: 3 } }), badSection("profile"));
  });

  it("profile actual al que le faltan campos que leen las pantallas (review 1)", () => {
    const noKcal: Partial<typeof BACKUP_PROFILE> = { ...BACKUP_PROFILE };
    delete noKcal.calorieGoal;
    expectError(backupText({ profile: noKcal }), badSection("profile"));
    expectError(backupText({ profile: { ...BACKUP_PROFILE, meals: [] } }), badSection("profile"));
    expectError(backupText({ profile: { ...BACKUP_PROFILE, allergies: ["gluten"] } }), badSection("profile"));
    expectError(backupText({ profile: { schemaVersion: 2, name: "Lucía" } }), badSection("profile"));
  });

  it("acepta un perfil de la versión actual, sea cual sea (PROFILE_SCHEMA_VERSION, review 2)", () => {
    const result = parseBackup(backupText({ profile: { ...BACKUP_PROFILE, schemaVersion: PROFILE_SCHEMA_VERSION } }));
    expect(result.ok && result.data.profile).toEqual(BACKUP_PROFILE);
  });

  it("recipes que no es una lista de objetos con id", () => {
    expectError(backupText({ recipes: {} }), badSection("recipes"));
    expectError(backupText({ recipes: [null] }), badSection("recipes"));
    expectError(backupText({ recipes: [{ ...AI_RECIPE, id: 7 }] }), badSection("recipes"));
  });

  it("entries que no es una lista (criterio de aceptación)", () => {
    expectError(backupText({ entries: {} }), badSection("entries"));
    expectError(backupText({ entries: "[]" }), badSection("entries"));
  });

  it("entries con un elemento null o sin la forma mínima", () => {
    expectError(backupText({ entries: [null] }), badSection("entries"));
    const withoutDate = Object.fromEntries(Object.entries(BACKUP_ENTRIES[0]).filter(([k]) => k !== "date"));
    expectError(backupText({ entries: [withoutDate] }), badSection("entries"));
    expectError(backupText({ entries: [{ ...BACKUP_ENTRIES[0], mealType: 3 }] }), badSection("entries"));
    expectError(backupText({ entries: [{ ...BACKUP_ENTRIES[0], calories: "320" }] }), badSection("entries"));
    expectError(backupText({ entries: [{ ...BACKUP_ENTRIES[0], protein: null }] }), badSection("entries"));
  });

  it("pantry que no es una lista de objetos con id", () => {
    expectError(backupText({ pantry: "Yogur" }), badSection("pantry"));
    expectError(backupText({ pantry: [{ name: "Yogur" }] }), badSection("pantry"));
  });

  it("weekplan con un día que no es una lista, o una comida sin mealType / recipeId", () => {
    expectError(backupText({ weekplan: "plan" }), badSection("weekplan"));
    expectError(backupText({ weekplan: { [TODAY]: "Comida" } }), badSection("weekplan"));
    expectError(backupText({ weekplan: { [TODAY]: [null] } }), badSection("weekplan"));
    expectError(backupText({ weekplan: { [TODAY]: [{ mealType: "Comida" }] } }), badSection("weekplan"));
  });

  it("shopping que no es un objeto", () => {
    expectError(backupText({ shopping: "comprado" }), badSection("shopping"));
    expectError(backupText({ shopping: 1 }), badSection("shopping"));
  });

  it("measurements: una lista de objetos con id, fecha y valores", () => {
    expectError(backupText({ measurements: {} }), badSection("measurements"));
    expectError(backupText({ measurements: [null] }), badSection("measurements"));
    expectError(backupText({ measurements: [{ ...BACKUP_MEASUREMENTS[0], id: 7 }] }), badSection("measurements"));
    expectError(backupText({ measurements: [{ ...BACKUP_MEASUREMENTS[0], date: 20260731 }] }), badSection("measurements"));
    expectError(backupText({ measurements: [{ ...BACKUP_MEASUREMENTS[0], values: "76" }] }), badSection("measurements"));
    const result = parseBackup(backupText({ measurements: BACKUP_MEASUREMENTS }));
    expect(result.ok && result.data.measurements).toEqual(BACKUP_MEASUREMENTS);
  });

  it("una sola sección mala invalida toda la copia (todo o nada)", () => {
    const result = parseBackup(backupText({ ...ACCOUNT_A_DATA, shopping: SHOPPING_A, entries: {} }));
    expect(result.ok).toBe(false);
  });
});

describe("formatExportDate: fecha de la confirmación (R5)", () => {
  it("ISO → dd/mm/aaaa", () => {
    expect(formatExportDate("2026-09-24T08:00:00.000Z")).toBe("24/09/2026");
    expect(formatExportDate("2026-01-05T12:00:00.000Z")).toBe("05/01/2026");
  });

  it("usa la fecha local, no la UTC", () => {
    expect(formatExportDate(new Date(2026, 8, 24, 0, 30).toISOString())).toBe("24/09/2026");
    expect(formatExportDate(new Date(2026, 8, 24, 23, 30).toISOString())).toBe("24/09/2026");
  });
});

// ---------------------------------------------------------------------------

describe("R8: writeUserData escribe todo o nada", () => {
  const keyOf = (k: string) => `mp_${U}_${k}`;

  it("escribe las siete claves del usuario con JSON.stringify", () => {
    const s = new MemoryStorage();
    writeUserData(s, U, FULL_DATA);
    for (const k of USER_DATA_KEYS) expect(s.getItem(keyOf(k)), k).toBe(JSON.stringify(FULL_DATA[k]));
  });

  it("perfil null se guarda como null", () => {
    const s = new MemoryStorage();
    writeUserData(s, U, { ...FULL_DATA, profile: null });
    expect(JSON.parse(s.getItem(keyOf("profile")) ?? '"ausente"')).toBeNull();
  });

  it("no toca credenciales, sesión, *_v1_backup ni otras cuentas", () => {
    const s = browserWithAccounts();
    const before = s.snapshot();
    writeUserData(s, U, { ...EMPTY_USER_DATA, recipes: SEED_RECIPES });
    const after = s.snapshot();
    const userKeys = new Set(USER_DATA_KEYS.map(keyOf));
    for (const [k, v] of Object.entries(before)) if (!userKeys.has(k)) expect(after[k], k).toBe(v);
    expect(Object.keys(after).sort()).toEqual([...new Set([...Object.keys(before), ...userKeys])].sort());
  });

  it("si falla la 4.ª escritura (cuota), lanza y las siete claves vuelven byte a byte a como estaban", () => {
    const s = new MemoryStorage(4); // profile, recipes, entries → OK; pantry → lanza
    // Unas claves existen (con formato propio) y otras no, para ver que se restaura y se borra según el caso.
    s.seed(keyOf("profile"), '{"schemaVersion":2,"name":"Antes"}');
    s.seed(keyOf("entries"), "[ ]");
    s.seed(keyOf("shopping"), '{"current":{"week":"2026-09-14","bought":{},"overrides":[],"moved":{}},"usage":{}}');
    s.seed("mp_users", "[]");
    const before = s.snapshot();

    expect(() => writeUserData(s, U, FULL_DATA)).toThrow();
    expect(s.snapshot()).toEqual(before);
    expect(s.getItem(keyOf("recipes"))).toBeNull();
    expect(s.getItem(keyOf("pantry"))).toBeNull();
  });

  it("si falla la primera escritura, no queda nada escrito", () => {
    const s = new MemoryStorage(1);
    s.seed(keyOf("pantry"), JSON.stringify(BACKUP_PANTRY));
    const before = s.snapshot();
    expect(() => writeUserData(s, U, FULL_DATA)).toThrow();
    expect(s.snapshot()).toEqual(before);
  });

  it("si falla la última escritura (measurements), también se deshacen las seis anteriores", () => {
    const s = new MemoryStorage(7);
    s.seed(keyOf("profile"), JSON.stringify(BACKUP_PROFILE));
    const before = s.snapshot();
    expect(() => writeUserData(s, U, { ...FULL_DATA, profile: null })).toThrow();
    expect(s.snapshot()).toEqual(before);
  });
});
