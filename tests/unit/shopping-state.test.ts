// Spec: docs/pm/lista-compra/spec.md › R1, R5–R9, R11, R12, R14, Edge cases (semanas antiguas, contadores de 12 semanas).
// #78 (docs/pm/78-plan-navegar-semanas, R3): el estado pasa de { current, usage } a { weeks, lastMove? }.
// Tech: docs/pm/lista-compra/tech.md › state.ts (`EMPTY`, `forWeek`, `toggleBought`, `setOverride`, `recordMove`,
// `undoMove`) y view.ts (`buildShoppingView`). Ver tech.md › "Test notes" para las decisiones de API.
import { describe, expect, it } from "vitest";
import { aggregate, amountSignature, collectSources, type ShoppingItem } from "@/lib/shopping/aggregate";
import { normalizeKey } from "@/lib/shopping/parse";
import {
  EMPTY,
  loadShoppingState,
  moveToPantry,
  pruneBought,
  pruneWeeks,
  recordMove,
  setOverride,
  toggleBought,
  undoLastMove,
  undoMove,
  updateWeek,
  weekOf,
  type ShoppingState,
  type ShoppingWeekState,
} from "@/lib/shopping/state";
import { buildShoppingView } from "@/lib/shopping/view";
import type { MealType, PantryItem, WeekPlan } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  CREMA_CALABAZA,
  LAST_WEEK_MONDAY,
  NEXT_MONDAY,
  LUCIA_EXPECTED,
  MONDAY,
  SHOPPING_PANTRY,
  SHOPPING_PLAN,
  SHOPPING_RECIPES,
  TODAY,
  WEEK,
} from "../fixtures/shopping";

type View = ReturnType<typeof buildShoppingView>;
type Row = View["haveIt"][number];

const key = (name: string) => normalizeKey(name);

function itemsOf(plan: WeekPlan = SHOPPING_PLAN, meals: MealType[] = lucia.meals): ShoppingItem[] {
  return aggregate(collectSources({ weekPlan: plan, recipes: SHOPPING_RECIPES, dates: WEEK, meals }));
}

function sig(name: string, plan: WeekPlan = SHOPPING_PLAN): string {
  const item = itemsOf(plan).find((i) => i.key === key(name));
  expect(item, `falta "${name}"`).toBeDefined();
  return amountSignature(item!);
}

const emptyWeek = (): ShoppingWeekState => weekOf(EMPTY, MONDAY);

function view({
  plan = SHOPPING_PLAN,
  pantry = SHOPPING_PANTRY,
  state = emptyWeek(),
}: { plan?: WeekPlan; pantry?: PantryItem[]; state?: ShoppingWeekState } = {}): View {
  return buildShoppingView({ items: itemsOf(plan), pantry, state, today: TODAY });
}

const toBuyRows = (v: View): Row[] => Object.values(v.toBuy).flat();
const allRows = (v: View): Row[] => [...toBuyRows(v), ...v.haveIt, ...v.basics, ...v.bought];
const keysOf = (rows: Row[]) => rows.map((r) => r.item.key);
const rowIn = (rows: Row[], name: string) => rows.find((r) => r.item.key === key(name));

/** Plan sin la Comida del lunes (Pollo al horno con brócoli): el brócoli pasa de 300 g a 150 g. */
const PLAN_WITHOUT_MONDAY_LUNCH: WeekPlan = {
  ...SHOPPING_PLAN,
  [WEEK[0]]: SHOPPING_PLAN[WEEK[0]].filter((s) => s.mealType !== "Comida"),
};
/** Cambio no relacionado: se añade una crema de calabaza el jueves. */
const PLAN_WITH_UNRELATED_CHANGE: WeekPlan = {
  ...SHOPPING_PLAN,
  [WEEK[3]]: [{ mealType: "Comida", recipeId: CREMA_CALABAZA.id }],
};

describe("R1: recuentos (los mismos que muestra la tarjeta de Plan)", () => {
  it("N por comprar y M ya los tienes, sin contar especias y básicos", () => {
    expect(view().counts).toEqual({ pending: LUCIA_EXPECTED.pending, toBuyTotal: LUCIA_EXPECTED.pending, bought: 0, haveIt: LUCIA_EXPECTED.haveIt });
  });

  it("N baja al marcar algo como comprado", () => {
    const state = toggleBought(emptyWeek(), key("brócoli"), sig("brócoli"));
    expect(view({ state }).counts).toEqual({
      pending: LUCIA_EXPECTED.pending - 1,
      toBuyTotal: LUCIA_EXPECTED.pending,
      bought: 1,
      haveIt: LUCIA_EXPECTED.haveIt,
    });
  });

  it("pending coincide con las filas por comprar y haveIt con las de Ya lo tienes", () => {
    const v = view();
    expect(toBuyRows(v)).toHaveLength(v.counts.pending);
    expect(v.haveIt).toHaveLength(v.counts.haveIt);
  });
});

describe("R5: Ya lo tienes", () => {
  it('"60g arroz" con "Arroz integral · 1 kg" en la Despensa → Ya lo tienes, no por comprar', () => {
    const v = view();
    const arroz = rowIn(v.haveIt, "arroz");
    expect(arroz?.match).toMatchObject({ name: "Arroz integral", quantity: "1 kg" });
    expect(rowIn(toBuyRows(v), "arroz")).toBeUndefined();
  });

  it("Espárragos verdes caducados en la Despensa → por comprar, con el artículo caducado para la nota", () => {
    const v = view();
    const esparragos = rowIn(v.toBuy["Frutas y verduras"], "espárragos verdes");
    expect(esparragos?.match).toBeUndefined();
    expect(esparragos?.expiredMatch).toMatchObject({ name: "Espárragos verdes", expiryDate: "2026-09-20" });
    expect(rowIn(v.haveIt, "espárragos verdes")).toBeUndefined();
  });

  it("el aceite de oliva se cruza con la Despensa como cualquier otro ingrediente (R12)", () => {
    const pantry = [...SHOPPING_PANTRY, { id: "p-aceite", name: "Aceite de oliva virgen extra", quantity: "1 l", category: "Despensa" as const }];
    expect(rowIn(view({ pantry }).haveIt, "aceite de oliva")?.match?.id).toBe("p-aceite");
  });
});

describe("R6: detalle y 'Añadir a la lista de todos modos'", () => {
  it("Pechuga de pollo en Ya lo tienes: total 420 g, las tres comidas que la usan y el artículo de la Despensa", () => {
    const pollo = rowIn(view().haveIt, "pechuga de pollo")!;
    expect(pollo.amount).toBe("420 g");
    expect(pollo.item.sources.map((s) => [s.date, s.mealType, s.recipeName, s.raw])).toEqual([
      ["2026-09-21", "Comida", "Pollo al horno con brócoli", "150g pechuga de pollo"],
      ["2026-09-22", "Comida", "Salteado de pollo y brócoli", "120g pechuga de pollo"],
      ["2026-09-23", "Cena", "Ensalada de pollo y garbanzos", "150g pechuga de pollo"],
    ]);
    expect(pollo.match).toMatchObject({ name: "Pechuga de pollo", quantity: "3 filetes", category: "Congelador" });
  });

  it("al forzarlo pasa a por comprar (Carne y pescado) y cuenta en N; deshacerlo lo devuelve", () => {
    const forced = setOverride(emptyWeek(), key("pechuga de pollo"), true);
    const v = view({ state: forced });
    const pollo = rowIn(v.toBuy["Carne y pescado"], "pechuga de pollo");
    expect(pollo).toBeDefined();
    expect(pollo?.overridden).toBe(true);
    expect(pollo?.match?.name).toBe("Pechuga de pollo"); // el detalle sigue mostrando lo que hay en casa
    expect(rowIn(v.haveIt, "pechuga de pollo")).toBeUndefined();
    expect(v.counts).toMatchObject({ pending: LUCIA_EXPECTED.pending + 1, haveIt: LUCIA_EXPECTED.haveIt - 1 });

    const undone = setOverride(forced, key("pechuga de pollo"), false);
    expect(rowIn(view({ state: undone }).haveIt, "pechuga de pollo")).toBeDefined();
  });

  it("forzar dos veces no duplica", () => {
    const twice = setOverride(setOverride(emptyWeek(), key("arroz"), true), key("arroz"), true);
    expect(twice.overrides).toEqual([key("arroz")]);
  });
});

describe("R7: marcar y desmarcar como comprado", () => {
  it("marcar mueve a Comprados; volver a tocar lo devuelve a su pasillo", () => {
    const bought = toggleBought(emptyWeek(), key("brócoli"), sig("brócoli"));
    const v1 = view({ state: bought });
    expect(rowIn(v1.bought, "brócoli")?.bought).toBe(true);
    expect(rowIn(toBuyRows(v1), "brócoli")).toBeUndefined();

    const back = toggleBought(bought, key("brócoli"), sig("brócoli"));
    const v2 = view({ state: back });
    expect(rowIn(v2.bought, "brócoli")).toBeUndefined();
    expect(rowIn(v2.toBuy["Frutas y verduras"], "brócoli")?.bought).toBe(false);
  });

  it("un básico se puede marcar, pero no cuenta en el progreso (R12)", () => {
    const v = view({ state: toggleBought(emptyWeek(), key("sal"), sig("sal")) });
    expect(rowIn(v.bought, "sal")).toBeDefined();
    expect(rowIn(v.basics, "sal")).toBeUndefined();
    expect(v.counts.bought).toBe(0);
  });
});

describe("R9: la lista sigue al plan", () => {
  it('"Brócoli · 300 g" comprado; se quita una de las dos recetas → 150 g y ya no está comprado', () => {
    const state = toggleBought(emptyWeek(), key("brócoli"), sig("brócoli"));
    const v = view({ plan: PLAN_WITHOUT_MONDAY_LUNCH, state });
    const brocoli = rowIn(v.toBuy["Frutas y verduras"], "brócoli");
    expect(brocoli?.amount).toBe("150 g");
    expect(brocoli?.bought).toBe(false);
    expect(rowIn(v.bought, "brócoli")).toBeUndefined();
  });

  it('"Huevos" comprado; cambia un hueco no relacionado → sigue comprado', () => {
    const state = toggleBought(emptyWeek(), key("huevo"), sig("huevo"));
    const v = view({ plan: PLAN_WITH_UNRELATED_CHANGE, state });
    expect(rowIn(v.bought, "huevo")?.bought).toBe(true);
  });

  it("un comprado que desaparece del plan desaparece de la lista", () => {
    const state = toggleBought(emptyWeek(), key("pimienta"), sig("pimienta"));
    const v = view({ plan: PLAN_WITHOUT_MONDAY_LUNCH, state });
    expect(rowIn(allRows(v), "pimienta")).toBeUndefined();
  });

  it("volver a tocar un comprado cuyo total cambió lo marca con el total nuevo", () => {
    const stale = toggleBought(emptyWeek(), key("brócoli"), sig("brócoli"));
    const newSig = sig("brócoli", PLAN_WITHOUT_MONDAY_LUNCH);
    const again = toggleBought(stale, key("brócoli"), newSig);
    expect(rowIn(view({ plan: PLAN_WITHOUT_MONDAY_LUNCH, state: again }).bought, "brócoli")).toBeDefined();
  });
});

describe("R11 · R12: secciones", () => {
  it("por comprar agrupado en los cinco pasillos (vacíos incluidos)", () => {
    const v = view();
    expect(Object.keys(v.toBuy).sort()).toEqual(
      ["Carne y pescado", "Despensa y conservas", "Frutas y verduras", "Lácteos y huevos", "Otros"].sort(),
    );
    expect(keysOf(v.toBuy["Frutas y verduras"])).toEqual(expect.arrayContaining([key("brócoli"), key("cebolla"), key("tomate")]));
    expect(keysOf(v.toBuy["Lácteos y huevos"])).toContain(key("huevo"));
    expect(keysOf(v.toBuy["Despensa y conservas"])).toContain(key("garbanzos cocidos"));
  });

  it("sal, pimienta, orégano y vinagre van a Especias y básicos, sin cruzarse con la Despensa", () => {
    const v = view(); // SHOPPING_PANTRY tiene "Sal"
    expect(keysOf(v.basics).sort()).toEqual([key("orégano"), key("pimienta"), key("sal"), key("vinagre")].sort());
    expect(rowIn(v.basics, "sal")?.match).toBeUndefined();
    expect(rowIn(v.haveIt, "sal")).toBeUndefined();
  });

  it("cada ingrediente aparece en una sola sección", () => {
    const keys = keysOf(allRows(view()));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("R13 · R14: pasar comprados a la Despensa", () => {
  const boughtBoth = () =>
    toggleBought(toggleBought(emptyWeek(), key("brócoli"), sig("brócoli")), key("huevo"), sig("huevo"));
  const MOVE = { at: TODAY, pantryIds: ["nuevo-1"], entries: { [key("brócoli")]: sig("brócoli") } };
  const moveBrocoli = (week: ShoppingWeekState) => recordMove(week, MOVE);

  it("lo movido sale de Comprados (y de toda la lista); lo demás sigue comprado", () => {
    const v = view({ state: moveBrocoli(boughtBoth()) });
    expect(rowIn(allRows(v), "brócoli")).toBeUndefined();
    expect(rowIn(v.bought, "huevo")).toBeDefined();
  });

  it("Deshacer devuelve lo movido a Comprados", () => {
    const undone = undoMove(moveBrocoli(boughtBoth()), MOVE);
    const v = view({ state: undone });
    expect(rowIn(v.bought, "brócoli")).toBeDefined();
    expect(rowIn(v.bought, "huevo")).toBeDefined();
  });

  it("si luego cambia el total de lo movido, vuelve como por comprar", () => {
    const v = view({ plan: PLAN_WITHOUT_MONDAY_LUNCH, state: moveBrocoli(boughtBoth()) });
    const brocoli = rowIn(v.toBuy["Frutas y verduras"], "brócoli");
    expect(brocoli?.amount).toBe("150 g");
    expect(brocoli?.bought).toBe(false);
  });
});

// R3 (#78): estado de la compra por semana
const W1 = MONDAY;
const W2 = NEXT_MONDAY;
const MOVE_A = { at: "2026-09-22T10:00:00.000Z", pantryIds: ["n1"], entries: { a: "x" } };

describe("R3: estado por semana (weeks)", () => {
  it("EMPTY no tiene semanas ni lastMove", () => {
    expect(EMPTY).toEqual({ weeks: {} });
  });

  it("weekOf de una semana sin estado la devuelve vacía y con su lunes", () => {
    expect(weekOf(EMPTY, W1)).toEqual({ week: W1, bought: {}, overrides: [], moved: {} });
  });

  it("updateWeek solo toca la semana indicada", () => {
    const s = updateWeek(EMPTY, W1, (w) => toggleBought(w, key("brócoli"), sig("brócoli")));
    expect(weekOf(s, W1).bought).toEqual({ [key("brócoli")]: sig("brócoli") });
    expect(weekOf(s, W2).bought).toEqual({});
    expect(weekOf(s, LAST_WEEK_MONDAY).bought).toEqual({});
  });

  it("volver a una semana anterior conserva sus marcas (nada se descarta al cambiar de semana)", () => {
    let s = updateWeek(EMPTY, W1, (w) => setOverride(w, "arroz", true));
    s = updateWeek(s, W2, (w) => setOverride(w, "pasta", true));
    expect(weekOf(s, W1).overrides).toEqual(["arroz"]);
    expect(weekOf(s, W2).overrides).toEqual(["pasta"]);
  });

  it("lo comprado en otra semana no aparece como comprado en esta", () => {
    const s = updateWeek(EMPTY, LAST_WEEK_MONDAY, (w) => toggleBought(w, key("brócoli"), sig("brócoli")));
    expect(view({ state: weekOf(s, W1) }).bought).toEqual([]);
  });

  it("updateWeek no modifica el estado recibido", () => {
    const s = Object.freeze({ weeks: Object.freeze({}) }) as unknown as ShoppingState;
    expect(() => updateWeek(s, W1, (w) => setOverride(w, "a", true))).not.toThrow();
    expect(s.weeks).toEqual({});
  });
});

describe("R3: poda de semanas antiguas", () => {
  const stateWith = (...mondays: string[]): ShoppingState => ({
    weeks: Object.fromEntries(mondays.map((m) => [m, { ...weekOf(EMPTY, m), overrides: ["a"] }])),
  });

  it("descarta las semanas con más de 26 semanas de antigüedad", () => {
    // TODAY = 2026-09-22 → lunes 2026-09-21; 26 semanas atrás = 2026-03-23
    const s = pruneWeeks(stateWith("2026-03-16", "2026-03-23", W1), TODAY);
    expect(Object.keys(s.weeks).sort()).toEqual(["2026-03-23", W1]);
  });

  it("conserva siempre las semanas futuras, por lejanas que sean", () => {
    const s = pruneWeeks(stateWith("2027-09-20", W2), TODAY);
    expect(Object.keys(s.weeks).sort()).toEqual([W2, "2027-09-20"]);
  });

  it("sin nada que podar devuelve el mismo objeto", () => {
    const s = stateWith(W1, W2);
    expect(pruneWeeks(s, TODAY)).toBe(s);
  });
});

describe("R3: Deshacer el último movimiento a la Despensa (lastMove global)", () => {
  it("moveToPantry registra el movimiento en su semana y lo guarda como lastMove con esa semana", () => {
    const base = updateWeek(EMPTY, W1, (w) => toggleBought(w, "a", "x"));
    const s = moveToPantry(base, W1, MOVE_A);
    expect(s.lastMove).toEqual({ ...MOVE_A, week: W1 });
    expect(weekOf(s, W1)).toMatchObject({ bought: {}, moved: { a: "x" } });
  });

  it("undoLastMove deshace en la semana del movimiento aunque se esté viendo otra, y borra lastMove", () => {
    const s = undoLastMove(moveToPantry(updateWeek(EMPTY, W1, (w) => toggleBought(w, "a", "x")), W1, MOVE_A));
    expect(s.lastMove).toBeUndefined();
    expect(weekOf(s, W1)).toMatchObject({ bought: { a: "x" }, moved: {} });
  });

  it("el movimiento de una semana no cambia otra semana", () => {
    const s = moveToPantry(EMPTY, W1, MOVE_A);
    expect(weekOf(s, W2)).toEqual({ week: W2, bought: {}, overrides: [], moved: {} });
  });

  it("sin lastMove, undoLastMove no cambia nada", () => {
    expect(undoLastMove(EMPTY)).toBe(EMPTY);
  });
});

describe("transiciones puras", () => {
  it("no modifican el estado recibido", () => {
    const week = Object.freeze({ ...emptyWeek(), bought: Object.freeze({}), overrides: Object.freeze([]), moved: Object.freeze({}) }) as unknown as ShoppingWeekState;
    expect(() => toggleBought(week, key("brócoli"), sig("brócoli"))).not.toThrow();
    expect(() => setOverride(week, key("arroz"), true)).not.toThrow();
    expect(() => recordMove(week, { at: TODAY, pantryIds: [], entries: {} })).not.toThrow();
    expect(week.bought).toEqual({});
    expect(week.overrides).toEqual([]);
  });
});

describe("Revisión N5 + R3: estado guardado incompleto, corrupto o con el formato anterior", () => {
  it.each([null, undefined, 42, "x", [], {}])("%j → EMPTY, sin lanzar", (raw) => {
    expect(loadShoppingState(raw)).toEqual(EMPTY);
  });

  it("completa los campos que faltan y descarta los de tipo incorrecto", () => {
    const s = loadShoppingState({ weeks: { [MONDAY]: { week: MONDAY, bought: { a: "x", b: 3 }, overrides: ["c", 1] }, malo: 5 } });
    expect(s).toEqual({ weeks: { [MONDAY]: { week: MONDAY, bought: { a: "x" }, overrides: ["c"], moved: {} } } });
    expect(() => view({ state: weekOf(s, MONDAY) })).not.toThrow();
  });

  it("un estado válido se conserva tal cual", () => {
    const valid: ShoppingState = {
      weeks: { [MONDAY]: { ...weekOf(EMPTY, MONDAY), bought: { a: "x" }, moved: { b: "y" } } },
      lastMove: { ...MOVE_A, week: MONDAY },
    };
    expect(loadShoppingState(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it("es idempotente (las migraciones se reaplican en cada lectura)", () => {
    const once = loadShoppingState({ current: { week: MONDAY, bought: { a: "x" }, overrides: [], moved: {} }, usage: {} });
    expect(loadShoppingState(once)).toEqual(once);
  });

  describe("migración del formato { current, usage }", () => {
    it("current pasa a weeks[current.week] sin perder marcas, overrides ni movidos", () => {
      const s = loadShoppingState({
        current: { week: MONDAY, bought: { a: "x" }, overrides: ["c"], moved: { d: "z" } },
        usage: { [LAST_WEEK_MONDAY]: { bought: 3, overrides: 1 } },
      });
      expect(s.weeks).toEqual({ [MONDAY]: { week: MONDAY, bought: { a: "x" }, overrides: ["c"], moved: { d: "z" } } });
    });

    it("el lastMove de current sube a la raíz con su semana", () => {
      const s = loadShoppingState({ current: { week: MONDAY, bought: {}, overrides: [], moved: {}, lastMove: MOVE_A }, usage: {} });
      expect(s.lastMove).toEqual({ ...MOVE_A, week: MONDAY });
      expect(s.weeks[MONDAY]).not.toHaveProperty("lastMove");
    });

    it("usage se descarta (no lo lee ninguna pantalla)", () => {
      const s = loadShoppingState({ current: { week: MONDAY }, usage: { [LAST_WEEK_MONDAY]: { bought: 3, overrides: 1 } } });
      expect(s).not.toHaveProperty("usage");
      expect(Object.keys(s.weeks)).toEqual([MONDAY]);
    });

    it("current sin semana (estado vacío antiguo) → EMPTY", () => {
      expect(loadShoppingState({ current: { week: "", bought: {}, overrides: [], moved: {} }, usage: {} })).toEqual(EMPTY);
    });
  });
});

describe("Revisión N6: el contador semanal no cuenta marcas caducadas", () => {
  const sigsOf = (plan: WeekPlan) => Object.fromEntries(itemsOf(plan).map((i) => [i.key, amountSignature(i)]));

  it("se quitan las marcas cuyo total cambió o cuyo ingrediente salió del plan; las vigentes se quedan", () => {
    let week = emptyWeek();
    for (const n of ["brócoli", "pimienta", "huevo", "tomate", "plátano"]) week = toggleBought(week, key(n), sig(n));
    // Sin la Comida del lunes: el brócoli pasa a 150 g y la pimienta desaparece
    const pruned = pruneBought(week, sigsOf(PLAN_WITHOUT_MONDAY_LUNCH));
    expect(Object.keys(pruned.bought).sort()).toEqual([key("huevo"), key("plátano"), key("tomate")].sort());
  });

  it("sin marcas caducadas devuelve el mismo objeto (no reescribe)", () => {
    const week = toggleBought(emptyWeek(), key("brócoli"), sig("brócoli"));
    expect(pruneBought(week, sigsOf(SHOPPING_PLAN))).toBe(week);
  });

  it("no toca lo movido a la Despensa", () => {
    const week = recordMove(emptyWeek(), { at: TODAY, pantryIds: ["n1"], entries: { [key("brócoli")]: "viejo" } });
    expect(pruneBought(week, sigsOf(SHOPPING_PLAN)).moved).toEqual({ [key("brócoli")]: "viejo" });
  });
});
