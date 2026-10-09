// Tolerancia de «cumplido» (docs/pm/49-tolerancia-cumplido/tech.md › Design). Puro: sin React ni store.
// Un único valor del perfil que comparten el Plan y el Diario; macroStatus lo recibe como parámetro.
import { parseDecimal } from "./nutrition";
import type { UserProfile } from "./types";

/** Tolerancia de quien no ha guardado una (%). */
export const TOLERANCE_DEFAULT = 10;
export const TOLERANCE_MIN = 5;
export const TOLERANCE_MAX = 20;
export const TOLERANCE_ERROR = "Un número entero entre 5 y 20 %";

/** R5: ausente o no numérico = 10; un número fuera de 5–20 se ajusta al límite más cercano (copias antiguas o rotas). */
export function tolerancePct(profile: Pick<UserProfile, "tolerancePct">): number {
  const v = profile.tolerancePct;
  if (typeof v !== "number" || !Number.isFinite(v)) return TOLERANCE_DEFAULT;
  return Math.min(TOLERANCE_MAX, Math.max(TOLERANCE_MIN, Math.round(v)));
}

/** «15» → 15; fuera de 5–20, con decimales, con «%» o no numérico → null. */
export function parseTolerance(text: string): number | null {
  const v = parseDecimal(text);
  return Number.isInteger(v) && v >= TOLERANCE_MIN && v <= TOLERANCE_MAX ? v : null;
}
