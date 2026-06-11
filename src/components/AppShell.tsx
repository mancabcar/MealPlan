"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import Onboarding from "./Onboarding";

const TABS = [
  { href: "/", label: "Diario", icon: "📒" },
  { href: "/plan", label: "Plan", icon: "📅" },
  { href: "/recetas", label: "Recetas", icon: "🍳" },
  { href: "/despensa", label: "Despensa", icon: "🧺" },
  { href: "/perfil", label: "Perfil", icon: "👤" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile, loaded } = useApp();
  const pathname = usePathname();

  if (!loaded) return null;
  if (!profile) return <Onboarding />;

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full">
      <main className="flex-1 px-4 pt-6 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 ${
              pathname === tab.href
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-zinc-500"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
