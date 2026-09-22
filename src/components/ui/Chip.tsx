// Rediseño visual (docs/pm/design-refresh): badge/chip tokenizado para macros (R5) y estados
// (caducado/caduca pronto), y para etiquetas neutras (tiempo, alérgenos, tags de receta).
// El fondo es una mezcla ligera del color de tono sobre --color-surface (no el color sólido), para
// que el texto (color de tono, sólido) mantenga el contraste verificado en globals.css (R6).
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ChipTone = "protein" | "carbs" | "fat" | "expired" | "expiring" | "accent" | "neutral";

const TONE_VAR: Record<ChipTone, string> = {
  protein: "--color-protein",
  carbs: "--color-carbs",
  fat: "--color-fat",
  expired: "--color-expired",
  expiring: "--color-expiring",
  accent: "--color-accent",
  neutral: "--color-text-muted",
};

export function Chip({
  tone = "neutral",
  icon: Icon,
  children,
  className = "",
}: {
  tone?: ChipTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const colorVar = `var(${TONE_VAR[tone]})`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${className}`}
      style={{ color: colorVar, backgroundColor: `color-mix(in oklab, ${colorVar} 18%, var(--color-surface))` }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
      {children}
    </span>
  );
}
