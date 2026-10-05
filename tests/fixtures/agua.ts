// Datos de "Seguimiento de agua y fibra" (docs/pm/23-agua-fibra-micros/spec.md › entrega 2, R10–R13).
// Compartidos por tests/unit/water.test.ts, store-water.test.tsx, backup-water.test.ts y tests/e2e/agua.spec.ts.
// "Hoy" es el martes 2026-09-22 (mismo TODAY que tests/e2e/helpers.ts). Lucía no tiene objetivo de agua ni vaso: 2 L y 250 ml.
export const TODAY = "2026-09-22";
export const YESTERDAY = "2026-09-21";

/** Agua guardada: ayer 1,5 L; hoy 1,25 L (5 vasos de 250 ml). */
export const AGUA_DOS_DIAS: Record<string, number> = { [YESTERDAY]: 1500, [TODAY]: 1250 };
