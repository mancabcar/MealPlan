import type { MetadataRoute } from "next";

// PWA instalable (issue #21, docs/pm/21-pwa-recordatorios/tech.md). Los colores son los del tema oscuro
// de globals.css (--color-bg); el sitio sirve en la raíz de IONOS, por eso start_url y los iconos son absolutos.
// Estático: con `output: "export"` el manifest se genera en el build (out/manifest.webmanifest).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MealPlanner",
    short_name: "MealPlanner",
    description: "Planificador de comidas con macros y recetas con IA",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
