// Spec: docs/pm/15-autocompletar-semana-ia/spec.md › Acceptance criteria R2–R14, Edge cases y Success metrics.
// Tech: docs/pm/15-autocompletar-semana-ia/tech.md › APIs / interfaces (`src/lib/plan/fillWeek.ts`), State & edge cases
// y Testing strategy.
// Contrato: `fillWeek({ plan, dates, meals, recipes, profile, favorites, ratings, random })` → { plan, filled, unmetDays }
// y `emptySlots(plan, dates, meals)` → número de franjas vacías. Funciones puras: no mutan el plan de entrada.
// `random` lleva semilla (fixtures › seeded): los resultados son reproducibles; la app usa Math.random.
//
// Datos: tests/fixtures/rellenar-semana.ts (recetas inventadas) y el recetario real (CATALOG) para la métrica.
// Fallan hasta que exista src/lib/plan/fillWeek.ts (tareas 1–3 del tech design). R1, R6 y R15 son UI: e2e.
import { describe, expect, it } from "vitest";
import { emptySlots, fillWeek, type FillInput } from "@/lib/plan/fillWeek";
import { CATALOG } from "@/lib/catalog";
import { ingredientMatches, recipeViolations } from "@/lib/allergens";
import { dayPlanSummary, macroStatus, macroTarget } from "@/lib/planMacros";
import { tolerancePct } from "@/lib/tolerance";
import type { MealType, Recipe, UserProfile, WeekPlan } from "@/lib/types";
import { manuel } from "../fixtures/profiles";
import {
  CARNE_CENA,
  CARNE_COMIDA,
  CENAS,
  CENA_A,
  CENA_B,
  CENA_B_NUTRI,
  COMIDAS,
  COMIDA_ENORME,
  COMIDA_GRANDE,
  CREMA_CALABAZA,
  DESAYUNOS,
  FILL_PROFILE,
  FILL_RECIPES,
  FROM_TODAY,
  HUEVOS_RELLENOS,
  HUEVOS_REVUELTOS,
  HUMMUS_GARBANZO,
  MARISCO_COMIDA,
  MERLUZA_HORNO,
  PESCADO_CENA,
  PRE_GYM,
  PUCHERO_GARBANZOS,
  SIN_MACROS,
  SNACKS,
  TOSTADA_SALMON,
  WEEK,
  WITH_ANIMAL,
  seeded,
  slotAt,
  slotsOf,
} from "../fixtures/rellenar-semana";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function input(over: Partial<FillInput> = {}): FillInput {
  const profile = over.profile ?? FILL_PROFILE;
  return {
    plan: {},
    dates: WEEK,
    meals: profile.meals,
    recipes: FILL_RECIPES,
    profile,
    favorites: [],
    ratings: {},
    random: seeded(1),
    ...over,
  };
}

const byId = (recipes: Recipe[]) => new Map(recipes.map((r) => [r.id, r]));

/** ¿El día cumple kcal y proteína, con la misma regla que el resumen del día del Plan? */
function dayOk(plan: WeekPlan, date: string, recipes: Recipe[], profile: UserProfile): boolean {
  const summary = dayPlanSummary({ slots: plan[date] ?? [], recipes, meals: profile.meals });
  if (!summary) return false;
  const tol = tolerancePct(profile);
  return (
    macroStatus(summary.totals.calories, macroTarget("calories", profile), tol) === "within" &&
    macroStatus(summary.totals.protein, macroTarget("protein", profile), tol) === "within"
  );
}

/** Ids asignados en un día y comida a lo largo de N rellenos con semillas distintas. */
function picksOver(n: number, make: (seed: number) => FillInput, date: string, mealType: MealType): string[] {
  return Array.from({ length: n }, (_, i) => slotAt(fillWeek(make(i + 1)).plan, date, mealType)?.recipeId ?? "");
}

describe("R2: solo franjas vacías de las comidas activas, de hoy en adelante", () => {
  it("R2: las franjas ya asignadas (normal, raciones, tanda, sobra, receta borrada) quedan idénticas", () => {
    const plan: WeekPlan = {
      [WEEK[1]]: [
        { mealType: "Desayuno", recipeId: DESAYUNOS[0].id, servings: 1.5 },
        { mealType: "Comida", recipeId: COMIDAS[0].id, batchId: "tanda", cookedServings: 3 },
      ],
      [WEEK[2]]: [
        { mealType: "Comida", recipeId: COMIDAS[0].id, batchId: "tanda", leftover: true },
        { mealType: "Cena", recipeId: "receta-borrada" },
      ],
    };
    const { plan: out } = fillWeek(input({ plan: clone(plan) }));
    expect(slotAt(out, WEEK[1], "Desayuno")).toEqual(plan[WEEK[1]][0]);
    expect(slotAt(out, WEEK[1], "Comida")).toEqual(plan[WEEK[1]][1]);
    expect(slotAt(out, WEEK[2], "Comida")).toEqual(plan[WEEK[2]][0]);
    expect(slotAt(out, WEEK[2], "Cena")).toEqual(plan[WEEK[2]][1]);
  });

  it("R2: solo rellena los días recibidos (de hoy en adelante): el lunes no cambia", () => {
    const { plan } = fillWeek(input({ dates: FROM_TODAY }));
    expect(plan[WEEK[0]] ?? []).toEqual([]);
    for (const date of FROM_TODAY) expect((plan[date] ?? []).length).toBe(3);
  });

  it("R2: en una semana futura rellena los 7 días", () => {
    const { plan, filled } = fillWeek(input());
    expect(filled).toBe(21);
    for (const date of WEEK) expect((plan[date] ?? []).map((s) => s.mealType).sort()).toEqual(["Cena", "Comida", "Desayuno"]);
  });

  it("R2: no crea franjas de comidas que no están activas, y no toca las que ya tenían", () => {
    const plan: WeekPlan = { [WEEK[1]]: [{ mealType: "Merienda", recipeId: SNACKS[0].id }] };
    const { plan: out } = fillWeek(input({ plan: clone(plan), recipes: [...FILL_RECIPES, ...SNACKS] }));
    expect(slotsOf(out, WEEK).filter((s) => s.mealType === "Merienda")).toEqual([{ date: WEEK[1], mealType: "Merienda", recipeId: SNACKS[0].id }]);
  });

  it("R2: no muta el plan de entrada ni toca otras semanas", () => {
    const plan: WeekPlan = { "2026-09-28": [{ mealType: "Comida", recipeId: COMIDAS[1].id }] };
    const before = clone(plan);
    const { plan: out } = fillWeek(input({ plan }));
    expect(plan).toEqual(before);
    expect(out["2026-09-28"]).toEqual(before["2026-09-28"]);
  });

  it("`filled` cuenta solo las franjas creadas", () => {
    const plan: WeekPlan = { [WEEK[0]]: [{ mealType: "Comida", recipeId: COMIDAS[0].id }] };
    expect(fillWeek(input({ plan })).filled).toBe(20);
  });
});

describe("R3: alérgenos y dieta", () => {
  it("R3: ninguna receta asignada tiene alérgenos del perfil (preset y propios)", () => {
    const profile: UserProfile = { ...FILL_PROFILE, allergies: { preset: ["lactosa", "frutos_secos"], custom: ["kiwi"] } };
    const { plan } = fillWeek(input({ profile }));
    const recipes = byId(FILL_RECIPES);
    const assigned = slotsOf(plan, WEEK).map((s) => recipes.get(s.recipeId)!);
    expect(assigned.length).toBeGreaterThan(0);
    for (const r of assigned) expect(recipeViolations(r, profile.allergies)).toEqual([]);
  });

  const dietCase = (diet: UserProfile["diet"], allowed: (r: Recipe) => boolean) => {
    const profile: UserProfile = { ...FILL_PROFILE, diet };
    const recipes = byId(WITH_ANIMAL);
    for (let seed = 1; seed <= 5; seed++) {
      const { plan } = fillWeek(input({ profile, recipes: WITH_ANIMAL, random: seeded(seed) }));
      for (const s of slotsOf(plan, WEEK)) expect(allowed(recipes.get(s.recipeId)!), recipes.get(s.recipeId)!.name).toBe(true);
    }
  };
  const has = (r: Recipe, ...tags: string[]) => tags.some((t) => r.tags.includes(t));

  it("R3: vegetariana → solo «vegetariano» o «vegano»", () => dietCase("vegetarian", (r) => has(r, "vegetariano", "vegano")));
  it("R3: vegana → solo «vegano»", () => dietCase("vegan", (r) => has(r, "vegano")));
  it("R3: pescetariana → «vegetariano», «vegano», «pescado» o «marisco»", () =>
    dietCase("pescetarian", (r) => has(r, "vegetariano", "vegano", "pescado", "marisco")));

  it("R3: omnívora → la dieta no filtra (puede salir carne)", () => {
    const only = [DESAYUNOS[0], CARNE_COMIDA, CARNE_CENA];
    const { plan } = fillWeek(input({ recipes: only, dates: [WEEK[0]] }));
    expect(slotAt(plan, WEEK[0], "Comida")?.recipeId).toBe(CARNE_COMIDA.id);
    expect(slotAt(plan, WEEK[0], "Cena")?.recipeId).toBe(CARNE_CENA.id);
  });

  it("R3: con dieta pescetariana pueden salir pescado y marisco", () => {
    const only = [DESAYUNOS[0], MARISCO_COMIDA, PESCADO_CENA];
    const { plan } = fillWeek(input({ profile: { ...FILL_PROFILE, diet: "pescetarian" }, recipes: only, dates: [WEEK[0]] }));
    expect(slotAt(plan, WEEK[0], "Comida")?.recipeId).toBe(MARISCO_COMIDA.id);
    expect(slotAt(plan, WEEK[0], "Cena")?.recipeId).toBe(PESCADO_CENA.id);
  });
});

describe("R4: cada día cumple kcal y proteína", () => {
  it("R4: con recetas que pueden cuadrar, todos los días rellenados cumplen (proteína con rango)", () => {
    const { plan, unmetDays } = fillWeek(input());
    expect(unmetDays).toEqual([]);
    for (const date of WEEK) expect(dayOk(plan, date, FILL_RECIPES, FILL_PROFILE), date).toBe(true);
  });

  it("R4: también con la proteína sin rango (objetivo con tolerancia)", () => {
    const profile: UserProfile = { ...FILL_PROFILE, proteinRange: undefined, proteinGoal: 105 };
    const { plan } = fillWeek(input({ profile }));
    for (const date of WEEK) expect(dayOk(plan, date, FILL_RECIPES, profile), date).toBe(true);
  });

  it("R4: cuenta lo ya asignado en el día y compensa con el resto", () => {
    const recipes = [...FILL_RECIPES, COMIDA_GRANDE];
    const plan: WeekPlan = { [WEEK[0]]: [{ mealType: "Comida", recipeId: COMIDA_GRANDE.id }] };
    const { plan: out, unmetDays } = fillWeek(input({ plan, recipes, dates: [WEEK[0]] }));
    expect(unmetDays).toEqual([]);
    expect(dayOk(out, WEEK[0], recipes, FILL_PROFILE)).toBe(true);
  });

  it("R4: usa la tolerancia del perfil", () => {
    // 1500 ±5 %: 1425–1575. Con 1 ración de cada franja (1500) cumple; el test fija que no se juzga con ±10 % fijo
    const profile: UserProfile = { ...FILL_PROFILE, tolerancePct: 5 };
    const { plan } = fillWeek(input({ profile }));
    for (const date of WEEK) expect(dayOk(plan, date, FILL_RECIPES, profile), date).toBe(true);
  });
});

describe("R5: días que no se pueden cuadrar", () => {
  it("R5: si lo asignado ya supera las kcal, el día sale en `unmetDays` y se rellena igualmente", () => {
    const recipes = [...FILL_RECIPES, COMIDA_ENORME];
    const plan: WeekPlan = { [WEEK[0]]: [{ mealType: "Comida", recipeId: COMIDA_ENORME.id }] };
    const { plan: out, unmetDays } = fillWeek(input({ plan, recipes, dates: [WEEK[0]] }));
    expect(unmetDays).toEqual([WEEK[0]]);
    expect(slotAt(out, WEEK[0], "Desayuno")).toBeDefined();
    expect(slotAt(out, WEEK[0], "Cena")).toBeDefined();
  });

  it("R5: una franja sin ninguna receta posible queda vacía y el día no cumple", () => {
    const profile: UserProfile = { ...FILL_PROFILE, meals: ["Desayuno", "Comida", "Merienda", "Cena"] };
    const { plan, unmetDays } = fillWeek(input({ profile, dates: [WEEK[0]] })); // ninguna receta «snack»
    expect(slotAt(plan, WEEK[0], "Merienda")).toBeUndefined();
    expect(unmetDays).toEqual([WEEK[0]]);
  });
});

describe("R7: no repetir recetas en la semana", () => {
  it("R7: ninguna receta se repite en la semana rellenada", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const ids = slotsOf(fillWeek(input({ random: seeded(seed) })).plan, WEEK).map((s) => s.recipeId);
      expect(new Set(ids).size, `semilla ${seed}`).toBe(ids.length);
    }
  });

  it("R7: tampoco usa una receta que ya estaba asignada a mano esa semana", () => {
    const plan: WeekPlan = { [WEEK[0]]: [{ mealType: "Cena", recipeId: CENAS[0].id }] };
    for (let seed = 1; seed <= 5; seed++) {
      const { plan: out } = fillWeek(input({ plan, dates: FROM_TODAY, random: seeded(seed) }));
      expect(slotsOf(out, FROM_TODAY).filter((s) => s.recipeId === CENAS[0].id)).toEqual([]);
    }
  });

  it("R7: si no hay recetas suficientes, repite antes que dejar la franja vacía", () => {
    const recipes = [...DESAYUNOS, ...COMIDAS, CENAS[0], CENAS[1]];
    const { plan } = fillWeek(input({ recipes }));
    for (const date of WEEK) expect(slotAt(plan, date, "Cena"), date).toBeDefined();
  });
});

describe("R8: coherencia — ningún ingrediente base repetido en el día", () => {
  const day = (fixedDesayuno: Recipe | null, fixedComida: Recipe | null, cenas: Recipe[]): FillInput => {
    const fixed = [
      ...(fixedDesayuno ? [{ mealType: "Desayuno" as const, recipeId: fixedDesayuno.id }] : []),
      ...(fixedComida ? [{ mealType: "Comida" as const, recipeId: fixedComida.id }] : []),
    ];
    return input({
      plan: { [WEEK[0]]: fixed },
      dates: [WEEK[0]],
      recipes: [...DESAYUNOS, ...COMIDAS, ...(fixedDesayuno ? [fixedDesayuno] : []), ...(fixedComida ? [fixedComida] : []), ...cenas],
    });
  };

  it("R8: no junta «Puchero de garbanzos» con «Hummus de garbanzo» (plural y singular), contando lo ya asignado", () => {
    const picks = picksOver(20, (seed) => ({ ...day(null, PUCHERO_GARBANZOS, [HUMMUS_GARBANZO, CREMA_CALABAZA]), random: seeded(seed) }), WEEK[0], "Cena");
    expect(picks.every((id) => id === CREMA_CALABAZA.id)).toBe(true);
  });

  it("R8: pescados distintos sí pueden ir el mismo día (salmón por la mañana, merluza por la noche)", () => {
    const { plan } = fillWeek(day(TOSTADA_SALMON, null, [MERLUZA_HORNO]));
    expect(slotAt(plan, WEEK[0], "Cena")?.recipeId).toBe(MERLUZA_HORNO.id);
  });

  it("R8: el huevo no cuenta como ingrediente base", () => {
    const { plan } = fillWeek(day(HUEVOS_REVUELTOS, null, [HUEVOS_RELLENOS]));
    expect(slotAt(plan, WEEK[0], "Cena")?.recipeId).toBe(HUEVOS_RELLENOS.id);
  });
});

describe("R9: raciones para afinar", () => {
  it("R9: las raciones van de 0,5 a 2 en pasos de 0,25, y con 1 ración no se guarda `servings`", () => {
    // 2000 kcal: con 1 ración de cada franja (1500) no llega, así que tiene que subir raciones
    const profile: UserProfile = { ...FILL_PROFILE, calorieGoal: 2000, proteinRange: { min: 120, max: 160 } };
    const { plan, unmetDays } = fillWeek(input({ profile }));
    expect(unmetDays).toEqual([]);
    const slots = slotsOf(plan, WEEK);
    expect(slots.some((s) => s.servings !== undefined)).toBe(true);
    for (const s of slots) {
      if (s.servings === undefined) continue;
      expect(s.servings).not.toBe(1);
      expect(s.servings).toBeGreaterThanOrEqual(0.5);
      expect(s.servings).toBeLessThanOrEqual(2);
      expect((s.servings * 4) % 1).toBe(0);
    }
  });

  it("R9: no crea sobras ni tandas", () => {
    for (const s of slotsOf(fillWeek(input()).plan, WEEK)) {
      expect(s).not.toHaveProperty("batchId");
      expect(s).not.toHaveProperty("leftover");
      expect(s).not.toHaveProperty("cookedServings");
    }
  });
});

describe("R10, R14: preferencias a igualdad de ajuste", () => {
  // Una sola cena posible entre dos idénticas en macros; en 100 rellenos la preferida sale en más de la mitad
  const oneDay = (cenas: Recipe[], over: Partial<FillInput> = {}) => (seed: number) =>
    input({ dates: [WEEK[0]], recipes: [...DESAYUNOS, ...COMIDAS, ...cenas], random: seeded(seed), ...over });
  const share = (picks: string[], id: string) => picks.filter((p) => p === id).length / picks.length;

  it("R10: prioriza las recetas «plan nutricionista»", () => {
    expect(share(picksOver(100, oneDay([CENA_A, CENA_B_NUTRI]), WEEK[0], "Cena"), CENA_B_NUTRI.id)).toBeGreaterThan(0.5);
  });

  it("R10: prioriza las favoritas", () => {
    expect(share(picksOver(100, oneDay([CENA_A, CENA_B], { favorites: [CENA_B.id] }), WEEK[0], "Cena"), CENA_B.id)).toBeGreaterThan(0.5);
  });

  it("R10: prioriza, no obliga: si la «plan nutricionista» no cuadra, elige la que sí", () => {
    const nutriGrande: Recipe = { ...CENA_B_NUTRI, id: "f-cena-nutri-grande", calories: 1200, protein: 35 };
    const picks = picksOver(20, oneDay([CENA_A, nutriGrande]), WEEK[0], "Cena");
    expect(picks.every((id) => id === CENA_A.id)).toBe(true);
  });

  it("R14: prioriza las mejor valoradas", () => {
    expect(share(picksOver(100, oneDay([CENA_A, CENA_B], { ratings: { [CENA_B.id]: 5 } }), WEEK[0], "Cena"), CENA_B.id)).toBeGreaterThan(0.5);
  });

  it("R14: una receta valorada con 1 estrella nunca sale", () => {
    const picks = picksOver(100, oneDay([CENA_A, CENA_B], { ratings: { [CENA_B.id]: 1 } }), WEEK[0], "Cena");
    expect(picks).not.toContain(CENA_B.id);
  });
});

describe("R11: Pre-entreno prefiere «pre-gym»", () => {
  const profile: UserProfile = { ...FILL_PROFILE, meals: ["Desayuno", "Comida", "Pre-entreno", "Cena"], calorieGoal: 1700, proteinRange: { min: 100, max: 135 } };
  const recipes = [...FILL_RECIPES, ...SNACKS, PRE_GYM];

  it("R11: el primer día con Pre-entreno lleva la receta «pre-gym»", () => {
    const picks = picksOver(20, (seed) => input({ profile, recipes, dates: [WEEK[0]], random: seeded(seed) }), WEEK[0], "Pre-entreno");
    expect(picks.every((id) => id === PRE_GYM.id)).toBe(true);
  });

  it("R11: sin más «pre-gym» disponibles, completa con otros snacks", () => {
    const { plan } = fillWeek(input({ profile, recipes }));
    for (const date of WEEK) expect(slotAt(plan, date, "Pre-entreno"), date).toBeDefined();
  });
});

describe("R12: «no me gusta»", () => {
  it("R12: excluye las recetas con un ingrediente que no le gusta (en el nombre o en los ingredientes)", () => {
    const profile: UserProfile = { ...FILL_PROFILE, dislikedIngredients: ["setas", "queso"] };
    const recipes = byId(FILL_RECIPES);
    for (let seed = 1; seed <= 5; seed++) {
      const { plan } = fillWeek(input({ profile, random: seeded(seed) }));
      for (const s of slotsOf(plan, WEEK)) {
        const r = recipes.get(s.recipeId)!;
        for (const d of profile.dislikedIngredients)
          expect([r.name, ...r.ingredients].some((t) => ingredientMatches(t, d)), `${r.name} / ${d}`).toBe(false);
      }
    }
  });
});

describe("Edge cases", () => {
  it("una receta con macros vacíos (NaN) nunca entra", () => {
    const profile: UserProfile = { ...FILL_PROFILE, meals: ["Desayuno", "Comida", "Merienda", "Cena"] };
    const { plan } = fillWeek(input({ profile, recipes: [...FILL_RECIPES, SIN_MACROS] }));
    expect(slotsOf(plan, WEEK).filter((s) => s.recipeId === SIN_MACROS.id)).toEqual([]);
  });

  it("con el recetario vacío no rellena nada", () => {
    const { plan, filled } = fillWeek(input({ recipes: [] }));
    expect(filled).toBe(0);
    expect(slotsOf(plan, WEEK)).toEqual([]);
  });

  it("emptySlots cuenta las franjas vacías de las comidas activas en los días dados", () => {
    const plan: WeekPlan = {
      [WEEK[1]]: [
        { mealType: "Desayuno", recipeId: DESAYUNOS[0].id },
        { mealType: "Merienda", recipeId: SNACKS[0].id }, // comida no activa: no cuenta
      ],
    };
    expect(emptySlots(plan, FROM_TODAY, FILL_PROFILE.meals)).toBe(6 * 3 - 1);
    expect(emptySlots(fillWeek(input({ plan, dates: FROM_TODAY })).plan, FROM_TODAY, FILL_PROFILE.meals)).toBe(0);
  });

  it("emptySlots: una franja con una receta borrada cuenta como ocupada", () => {
    const plan: WeekPlan = { [WEEK[0]]: [{ mealType: "Comida", recipeId: "receta-borrada" }] };
    expect(emptySlots(plan, [WEEK[0]], FILL_PROFILE.meals)).toBe(2);
  });
});

// Success metrics (spec): ≥ 95 % de días que cumplen con el recetario real; 10 semanas por perfil, semillas fijas.
describe("Métrica: días que cumplen con el recetario real", () => {
  const SEPT: UserProfile = {
    ...manuel,
    calorieGoal: 2000,
    proteinGoal: 145,
    proteinRange: { min: 130, max: 160 },
    carbsGoal: 230,
    fatGoal: 69,
    tolerancePct: 10,
  };
  const PROFILES: Record<string, UserProfile> = {
    "plan de septiembre": SEPT,
    vegetariano: { ...SEPT, diet: "vegetarian" },
    "alergia a gluten y lactosa": { ...SEPT, allergies: { preset: ["gluten", "lactosa"], custom: [] } },
  };

  it("≥ 95 % en total y ≥ 80 % en cada perfil", () => {
    let ok = 0;
    let total = 0;
    const perProfile: Record<string, number> = {};
    for (const [name, profile] of Object.entries(PROFILES)) {
      let pOk = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const { plan } = fillWeek({ plan: {}, dates: WEEK, meals: profile.meals, recipes: CATALOG, profile, favorites: [], ratings: {}, random: seeded(seed) });
        for (const date of WEEK) if (dayOk(plan, date, CATALOG, profile)) pOk++;
      }
      perProfile[name] = pOk / 70;
      ok += pOk;
      total += 70;
    }
    for (const [name, share] of Object.entries(perProfile)) expect(share, name).toBeGreaterThanOrEqual(0.8);
    expect(ok / total).toBeGreaterThanOrEqual(0.95);
  });
});

// R13: el cálculo es local y rápido. Mediana de 3 ejecuciones para no depender de un pico de la máquina.
describe("R13: rendimiento", () => {
  it("R13: una semana con el recetario real se calcula en menos de 300 ms (mediana de 3)", () => {
    const times = [1, 2, 3].map((seed) => {
      const t0 = performance.now();
      fillWeek({ plan: {}, dates: WEEK, meals: manuel.meals, recipes: CATALOG, profile: manuel, favorites: [], ratings: {}, random: seeded(seed) });
      return performance.now() - t0;
    });
    expect(times.sort((a, b) => a - b)[1]).toBeLessThan(300);
  });
});
