// Rediseño visual (docs/pm/design-refresh): primitiva compartida por las 5 pantallas rediseñadas.
// Sustituye el `bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm` repetido en cada pantalla.
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export function Card({
  children,
  className = "",
  as,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
} & ComponentPropsWithoutRef<"div">) {
  const As = as ?? "div";
  return (
    <As className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 ${className}`} {...rest}>
      {children}
    </As>
  );
}
