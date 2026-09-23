"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookText, CalendarDays, ChefHat, ShoppingBasket, User, type LucideIcon } from "lucide-react";
import { AppProvider, useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import Login from "./Login";
import Onboarding from "./Onboarding";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Diario", icon: NotebookText },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/recetas", label: "Recetas", icon: ChefHat },
  { href: "/despensa", label: "Despensa", icon: ShoppingBasket },
  { href: "/perfil", label: "Perfil", icon: User },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loaded } = useAuth();

  if (!loaded) return null;
  if (!user) return <Login />;

  // key: al cambiar de usuario se remonta el store y se leen sus datos
  return (
    <AppProvider key={user.id} userId={user.id}>
      <UserShell>{children}</UserShell>
    </AppProvider>
  );
}

function UserShell({ children }: { children: ReactNode }) {
  const { profile, loaded } = useApp();
  const pathname = usePathname();

  if (!loaded) return null;
  if (!profile) return <Onboarding />;

  // Rediseño visual (docs/pm/design-refresh): la tipografía y los tokens oscuros nuevos se aplican
  // aquí, en el contenedor de las 5 pantallas rediseñadas + su nav — no en <body> (ver globals.css) —
  // para que Login/Onboarding (fuera de alcance) no cambien de tipografía/color.
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
      <main className="flex-1 px-4 pt-6 pb-28">{children}</main>
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full shadow-lg shadow-black/40 flex px-1 py-1"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          // Subrutas (p.ej. /plan/compra) mantienen activa su pestaña; "/" solo coincide consigo misma
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href + "/"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center py-2 rounded-full text-[11px] gap-0.5 transition-colors ${
                active
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] font-semibold"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
