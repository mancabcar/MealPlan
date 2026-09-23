// Spec: docs/pm/lista-compra/spec.md › R1, R5–R9, R11, R12, R14, Edge cases (semanas antiguas, contadores de 12 semanas).
// Tech: docs/pm/lista-compra/tech.md › state.ts (`EMPTY`, `forWeek`, `toggleBought`, `setOverride`, `recordMove`,
// `undoMove`) y view.ts (`buildShoppingView`). Ver tech.md › "Test notes" para las decisiones de API.
import { describe, expect, it } from "vitest";
import { aggregate, amountSignature, collectSources, type ShoppingItem } from "@/lib/shopping/aggregate";
import { normalizeKey } from "@/lib/shopping/parse";
import {
  EMPTY,
  forWeek,
  loadShoppingState,
  recordMove,
  setOverride,
  toggleBought,
  undoLastMove,
  undoMove,
  type ShoppingState,
  type ShoppingWeekState,
} from "@/lib/shopping/state";
import { buildShoppingView } from "@/lib/shopping/view";
import type { MealType, PantryItem, WeekPlan } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import {
  CREMA_CALABAZA,
  LAST_WEEK_MONDAY,
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

const emptyWeek = (): ShoppingWeekState => forWeek(EMPTY, MONDAY).current;

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
  const moveBrocoli = (week: ShoppingWeekState) =>
    recordMove(week, { at: TODAY, pantryIds: ["nuevo-1"], entries: { [key("brócoli")]: sig("brócoli") } });

  it("lo movido sale de Comprados (y de toda la lista); lo demás sigue comprado", () => {
    const v = view({ state: moveBrocoli(boughtBoth()) });
    expect(rowIn(allRows(v), "brócoli")).toBeUndefined();
    expect(rowIn(v.bought, "huevo")).toBeDefined();
  });

  it("guarda lastMove para poder deshacer", () => {
    expect(moveBrocoli(boughtBoth()).lastMove).toEqual({
      at: TODAY,
      pantryIds: ["nuevo-1"],
      entries: { [key("brócoli")]: sig("brócoli") },
    });
  });

  it("Deshacer devuelve lo movido a Comprados y borra lastMove", () => {
    const undone = undoMove(moveBrocoli(boughtBoth()));
    expect(undone.lastMove).toBeUndefined();
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

describe("R8: estado por semana y contadores de uso", () => {
  it("EMPTY → semana actual vacía", () => {
    const s = forWeek(EMPTY, MONDAY);
    expect(s.current).toMatchObject({ week: MONDAY, bought: {}, overrides: [], moved: {} });
    expect(s.current.lastMove).toBeUndefined();
    expect(s.usage).toEqual({});
  });

  it("misma semana → no cambia nada", () => {
    const current = toggleBought(emptyWeek(), key("brócoli"), sig("brócoli"));
    const state: ShoppingState = { current, usage: {} };
    expect(forWeek(state, MONDAY)).toEqual(state);
  });

  it("empieza una semana nueva → nada comprado, y la semana anterior queda como contador", () => {
    const old: ShoppingWeekState = {
      week: LAST_WEEK_MONDAY,
      bought: { a: "x", b: "y" },
      overrides: ["c"],
      moved: { d: "z" },
    };
    const s = forWeek({ current: old, usage: {} }, MONDAY);
    expect(s.current).toMatchObject({ week: MONDAY, bought: {}, overrides: [], moved: {} });
    // "comprados" de la semana = marcados + los ya pasados a la Despensa
    expect(s.usage[LAST_WEEK_MONDAY]).toEqual({ bought: 3, overrides: 1 });
  });

  it("lo comprado la semana pasada no aparece como comprado esta semana", () => {
    const lastWeek = { ...emptyWeek(), week: LAST_WEEK_MONDAY, bought: { [key("brócoli")]: sig("brócoli") } };
    const current = forWeek({ current: lastWeek, usage: {} }, MONDAY).current;
    expect(view({ state: current }).bought).toEqual([]);
  });

  it("se guardan como mucho las 12 últimas semanas de contadores", () => {
    const usage: ShoppingState["usage"] = {};
    // 12 semanas anteriores a LAST_WEEK_MONDAY: 2026-06-22 … 2026-09-07
    for (let i = 0; i < 12; i++) {
      const monday = new Date(Date.UTC(2026, 5, 22 + 7 * i)).toISOString().slice(0, 10); // UTC: sin saltos por zona horaria
      usage[monday] = { bought: 1, overrides: 0 };
    }
    const s = forWeek({ current: { ...emptyWeek(), week: LAST_WEEK_MONDAY }, usage }, MONDAY);
    expect(Object.keys(s.usage)).toHaveLength(12);
    expect(s.usage).toHaveProperty(LAST_WEEK_MONDAY);
    expect(s.usage).not.toHaveProperty("2026-06-22");
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

describe("Revisión N4: Deshacer tras cambiar de semana", () => {
  it("deshace en la semana del movimiento y la resume en usage; la semana nueva empieza vacía", () => {
    const moved = recordMove(
      { ...emptyWeek(), week: LAST_WEEK_MONDAY, bought: { a: "x", b: "y" } },
      { at: "2026-09-20T23:59:55Z", pantryIds: ["n1"], entries: { a: "x" } },
    );
    const s = undoLastMove({ current: moved, usage: {} }, MONDAY);
    expect(s.current).toMatchObject({ week: MONDAY, bought: {}, moved: {} });
    expect(s.current.lastMove).toBeUndefined();
    // a vuelve a comprados (no movido) en la semana pasada: 2 comprados, 0 movidos
    expect(s.usage[LAST_WEEK_MONDAY]).toEqual({ bought: 2, overrides: 0 });
  });

  it("en la misma semana equivale a undoMove", () => {
    const moved = recordMove(emptyWeek(), { at: TODAY, pantryIds: ["n1"], entries: { a: "x" } });
    expect(undoLastMove({ current: moved, usage: {} }, MONDAY).current).toEqual(undoMove(moved));
  });
});

describe("Revisión N5: estado guardado incompleto o corrupto", () => {
  it.each([null, undefined, 42, "x", [], {}])("%j → EMPTY o equivalente, sin lanzar", (raw) => {
    expect(loadShoppingState(raw)).toEqual(EMPTY);
  });

  it("completa los campos que faltan y descarta los de tipo incorrecto", () => {
    const s = loadShoppingState({ current: { week: MONDAY, bought: { a: "x", b: 3 }, overrides: ["c", 1] }, usage: { w: "nope" } });
    expect(s).toEqual({ current: { week: MONDAY, bought: { a: "x" }, overrides: ["c"], moved: {} }, usage: {} });
    // y la vista se puede construir con él
    expect(() => view({ state: forWeek(s, MONDAY).current })).not.toThrow();
  });

  it("un estado válido se conserva tal cual", () => {
    const valid: ShoppingState = {
      current: { ...emptyWeek(), bought: { a: "x" }, lastMove: { at: TODAY, pantryIds: ["n1"], entries: { a: "x" } } },
      usage: { [LAST_WEEK_MONDAY]: { bought: 3, overrides: 1 } },
    };
    expect(loadShoppingState(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });
});
