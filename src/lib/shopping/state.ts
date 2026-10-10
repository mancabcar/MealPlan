// Estado persistido de la lista (docs/pm/lista-compra › R6–R9, R13, R14). Solo se guarda la intención
// del usuario; la lista en sí se deriva del plan en cada render. Transiciones puras.

import { addDays, mondayOf } from "../week";

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
}

/**
 * Estado por semana (docs/pm/78-plan-navegar-semanas › R3): cada lunes guarda sus propias marcas.
 * `lastMove` es único y global (con la semana en que se hizo) para que la Despensa pueda deshacerlo
 * sin depender de la semana que se esté viendo.
 */
export interface ShoppingState {
  weeks: Record<string, ShoppingWeekState>;
  lastMove?: ShoppingMove & { week: string };
}

export const EMPTY: ShoppingState = { weeks: {} };

/** Semanas pasadas que se conservan; las futuras no se podan nunca. */
const KEEP_PAST_WEEKS = 26;

const emptyWeek = (monday: string): ShoppingWeekState => ({ week: monday, bought: {}, overrides: [], moved: {} });

/** Estado de la semana `monday`; una semana sin estado se lee como vacía y se guarda en la próxima escritura. */
export function weekOf(state: ShoppingState, monday: string): ShoppingWeekState {
  return state.weeks[monday] ?? emptyWeek(monday);
}

/** Aplica `fn` a la semana `monday` sin tocar las demás. */
export function updateWeek(state: ShoppingState, monday: string, fn: (week: ShoppingWeekState) => ShoppingWeekState): ShoppingState {
  return { ...state, weeks: { ...state.weeks, [monday]: fn(weekOf(state, monday)) } };
}

/** Descarta las semanas de hace más de 26 semanas; sin nada que descartar devuelve el mismo objeto. */
export function pruneWeeks(state: ShoppingState, today: string): ShoppingState {
  const cutoff = addDays(mondayOf(today), -7 * KEEP_PAST_WEEKS);
  const kept = Object.entries(state.weeks).filter(([monday]) => monday >= cutoff);
  if (kept.length === Object.keys(state.weeks).length) return state;
  return { ...state, weeks: Object.fromEntries(kept) };
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

/** Lo movido sale de comprados y queda en `moved` (R13, R14). El Deshacer global lo guarda `moveToPantry`. */
export function recordMove(week: ShoppingWeekState, move: ShoppingMove): ShoppingWeekState {
  const bought = { ...week.bought };
  for (const k of Object.keys(move.entries)) delete bought[k];
  return { ...week, bought, moved: { ...week.moved, ...move.entries } };
}

export function undoMove(week: ShoppingWeekState, move: ShoppingMove): ShoppingWeekState {
  const moved = { ...week.moved };
  for (const k of Object.keys(move.entries)) delete moved[k];
  return { ...week, bought: { ...week.bought, ...move.entries }, moved };
}

/** Registra el movimiento en la semana `monday` y lo deja como último para poder deshacerlo (R13). */
export function moveToPantry(state: ShoppingState, monday: string, move: ShoppingMove): ShoppingState {
  return { ...updateWeek(state, monday, (w) => recordMove(w, move)), lastMove: { ...move, week: monday } };
}

/** Deshace el último movimiento en la semana en que se hizo, aunque se esté viendo otra (review N4). */
export function undoLastMove(state: ShoppingState): ShoppingState {
  if (!state.lastMove) return state;
  const { week, ...move } = state.lastMove;
  return { weeks: updateWeek(state, week, (w) => undoMove(w, move)).weeks };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const stringRecord = (v: unknown): Record<string, string> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter(([, s]) => typeof s === "string")) as Record<string, string> : {};

/** Clave de semana válida: un lunes con formato YYYY-MM-DD. */
const isMonday = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && mondayOf(v) === v;

function loadWeek(monday: string, raw: unknown): ShoppingWeekState {
  const w = isRecord(raw) ? raw : {};
  return {
    week: monday,
    bought: stringRecord(w.bought),
    overrides: Array.isArray(w.overrides) ? w.overrides.filter((k): k is string => typeof k === "string") : [],
    moved: stringRecord(w.moved),
  };
}

function loadMove(raw: unknown): ShoppingMove | undefined {
  if (!isRecord(raw) || typeof raw.at !== "string" || !Array.isArray(raw.pantryIds)) return undefined;
  return { at: raw.at, pantryIds: raw.pantryIds.filter((id): id is string => typeof id === "string"), entries: stringRecord(raw.entries) };
}

/**
 * Lo guardado en localStorage puede venir incompleto, corrupto (review N5) o con el formato anterior
 * `{ current, usage }` (#78): `current` pasa a `weeks[current.week]`, su `lastMove` sube a la raíz y `usage`
 * se descarta (ninguna pantalla lo leía). Las semanas y el último movimiento cuya clave no es un lunes YYYY-MM-DD se
 * descartan (#116): nadie las lee y `pruneWeeks`, que compara texto, no las quitaría nunca. Idempotente: se reaplica en cada lectura.
 */
export function loadShoppingState(raw: unknown): ShoppingState {
  if (!isRecord(raw)) return EMPTY;
  if (isRecord(raw.weeks)) {
    const weeks = Object.fromEntries(Object.entries(raw.weeks).filter(([monday, w]) => isMonday(monday) && isRecord(w)).map(([monday, w]) => [monday, loadWeek(monday, w)]));
    const move = loadMove(raw.lastMove);
    const week = isRecord(raw.lastMove) ? raw.lastMove.week : undefined;
    return { weeks, ...(move && isMonday(week) ? { lastMove: { ...move, week } } : {}) };
  }
  const c = raw.current;
  if (!isRecord(c) || !isMonday(c.week)) return EMPTY;
  const move = loadMove(c.lastMove);
  return { weeks: { [c.week]: loadWeek(c.week, c) }, ...(move ? { lastMove: { ...move, week: c.week } } : {}) };
}

/**
 * Quita de `bought` las marcas que ya no valen: el total cambió (R9 la desmarca a la vista) o el
 * ingrediente salió del plan. Se aplica en cada escritura para que `usage` no cuente marcas
 * caducadas al cerrar la semana (review N6). `moved` no se toca: lo movido sí se compró.
 */
export function pruneBought(week: ShoppingWeekState, signatures: Record<string, string>): ShoppingWeekState {
  const bought = Object.fromEntries(Object.entries(week.bought).filter(([key, sig]) => signatures[key] === sig));
  return Object.keys(bought).length === Object.keys(week.bought).length ? week : { ...week, bought };
}
