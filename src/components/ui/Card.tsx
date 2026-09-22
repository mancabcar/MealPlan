// Rediseño visual (docs/pm/design-refresh): primitiva compartida por las 5 pantallas rediseñadas.
// Sustituye el `bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm` repetido en cada pantalla.
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type CardPadding = "none" | "sm" | "md";

// Variante en vez de dejar que un className de llamada (p.ej. "p-3") compita con el p-4 por defecto:
// Tailwind resuelve conflictos de la misma propiedad por orden de la hoja generada, no por orden en
// el string de clases, así que un className añadido no gana de forma fiable (review.md hallazgo #2).
const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

export function Card({
  children,
  className = "",
  as,
  padding = "md",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  padding?: CardPadding;
} & ComponentPropsWithoutRef<"div">) {
  const As = as ?? "div";
  return (
    <As
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl ${PADDING[padding]} ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}
