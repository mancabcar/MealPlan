import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import AppShell from "@/components/AppShell";

// Rediseño visual (docs/pm/design-refresh): tipografía autohospedada vía next/font/google, en el mismo
// sitio y con el mismo mecanismo que Geist usaba antes (cero peticiones al navegador, sin CLS) — no el
// CDN de Google Fonts del prototipo. Space Grotesk para títulos/números, Manrope para el resto del texto.
// Las variables se exponen aquí, pero SOLO las 5 pantallas rediseñadas + su nav las activan (ver
// AppShell.tsx): el <body> sigue con su font-family actual a propósito, para que Login/Onboarding —
// fuera de alcance de este rediseño — no cambien de tipografía (ver tech.md § Spec feedback, fork).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MealPlanner",
  description: "Planificador de comidas con macros y recetas con IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
