// Estado persistido de la lista (docs/pm/lista-compra › R6–R9, R13, R14). Solo se guarda la intención
// del usuario; la lista en sí se deriva del plan en cada render. Transiciones puras.

export interface ShoppingMove {
  at: string;
  pantryIds: string[];
  /** itemKey → firma al moverlo */
  entries: Record<string, string>;
}

export interface ShoppingWeekState {
  /** Lunes, YYYY-MM-DD */
  week: string;
  /** itemKey → amountSignature al marcarlo (R7, R9) */
  bought: Record<string, string>;
  /** itemKeys forzados de "Ya lo tienes" a por comprar (R6) */
  overrides: string[];
  /** itemKey → firma al pasarlo a la Despensa (R14) */
  moved: Record<string, string>;
  /** Para deshacer (R13) */
  lastMove?: ShoppingMove;
}

export interface ShoppingState {
  current: ShoppingWeekState;
  /** Contadores por semana pasada, como mucho 12 (Success metrics) */
  usage: Record<string, { bought: number; overrides: number }>;
}

export const EMPTY: ShoppingState = { current: { week: "", bought: {}, overrides: [], moved: {} }, usage: {} };

const USAGE_WEEKS = 12;

/** Estado de la semana `monday`. Al cambiar de semana, la anterior se resume en `usage` y se descarta. */
export function forWeek(state: ShoppingState, monday: string): ShoppingState {
  const old = state.current;
  if (old.week === monday) return state;
  const usage = { ...state.usage };
  if (old.week) {
    usage[old.week] = {
      bought: Object.keys(old.bought).length + Object.keys(old.moved).length,
      overrides: old.overrides.length,
    };
  }
  const kept = Object.keys(usage).sort().slice(-USAGE_WEEKS);
  return {
    current: { week: monday, bought: {}, overrides: [], moved: {} },
    usage: Object.fromEntries(kept.map((w) => [w, usage[w]])),
  };
}

/** Marca con la firma actual, o desmarca si ya estaba marcado con esa misma firma. */
export function toggleBought(week: ShoppingWeekState, key: string, signature: string): ShoppingWeekState {
  const bought = { ...week.bought };
  if (bought[key] === signature) delete bought[key];
  else bought[key] = signature;
  return { ...week, bought };
}

export function setOverride(week: ShoppingWeekState, key: string, on: boolean): ShoppingWeekState {
  const rest = week.overrides.filter((k) => k !== key);
  return { ...week, overrides: on ? [...rest, key] : rest };
}

export function recordMove(week: ShoppingWeekState, move: ShoppingMove): ShoppingWeekState {
  const bought = { ...week.bought };
  for (const k of Object.keys(move.entries)) delete bought[k];
  return { ...week, bought, moved: { ...week.moved, ...move.entries }, lastMove: move };
}

export function undoMove(week: ShoppingWeekState): ShoppingWeekState {
  if (!week.lastMove) return week;
  const { entries } = week.lastMove;
  const moved = { ...week.moved };
  for (const k of Object.keys(entries)) delete moved[k];
  return { week: week.week, overrides: week.overrides, bought: { ...week.bought, ...entries }, moved };
}

/**
 * Deshace el último movimiento aunque la semana haya cambiado entre medias (review N4): se deshace
 * en la semana en que se hizo y después se pasa a `monday`, que la resume en `usage` si ya acabó.
 */
export function undoLastMove(state: ShoppingState, monday: string): ShoppingState {
  return forWeek({ ...state, current: undoMove(state.current) }, monday);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const stringRecord = (v: unknown): Record<string, string> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter(([, s]) => typeof s === "string")) as Record<string, string> : {};

/**
 * Lo guardado en localStorage puede venir incompleto o corrupto (review N5): se completa con valores
 * por defecto en vez de dejar que /plan y /plan/compra fallen al leer un campo que falta.
 */
export function loadShoppingState(raw: unknown): ShoppingState {
  if (!isRecord(raw)) return EMPTY;
  const c = isRecord(raw.current) ? raw.current : {};
  const lm = c.lastMove;
  const lastMove =
    isRecord(lm) && typeof lm.at === "string" && Array.isArray(lm.pantryIds)
      ? { at: lm.at, pantryIds: lm.pantryIds.filter((id): id is string => typeof id === "string"), entries: stringRecord(lm.entries) }
      : undefined;
  const usage = isRecord(raw.usage)
    ? Object.fromEntries(
        Object.entries(raw.usage)
          .filter(([, u]) => isRecord(u))
          .map(([w, u]) => {
            const r = u as Record<string, unknown>;
            return [w, { bought: Number(r.bought) || 0, overrides: Number(r.overrides) || 0 }];
          }),
      )
    : {};
  return {
    current: {
      week: typeof c.week === "string" ? c.week : "",
      bought: stringRecord(c.bought),
      overrides: Array.isArray(c.overrides) ? c.overrides.filter((k): k is string => typeof k === "string") : [],
      moved: stringRecord(c.moved),
      ...(lastMove ? { lastMove } : {}),
    },
    usage,
  };
}
