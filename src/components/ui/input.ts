// Rediseño visual (docs/pm/design-refresh): clase compartida por los inputs/selects de las 5
// pantallas rediseñadas (Diario, Plan, Recetas, Despensa, Perfil), en vez de repetir el mismo
// string en cada page.tsx. No toca components/profile/ui.tsx ni components/perfil/ui.tsx: ese
// fork es intencional (ver docs/pm/design-refresh/tech.md § Risks y review.md hallazgo #4/#5).
export const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]";
