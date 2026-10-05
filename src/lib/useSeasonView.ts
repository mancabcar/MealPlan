"use client";

// Vista de temporada en Recetas (docs/pm/34-temporada/tech.md › UI): la página de producto va en `?producto=<id>` y el
// calendario completo en `?vista=calendario`, así se puede recargar o enlazar. Como `?semana=` (useWeekParam), debe
// usarse dentro de un <Suspense> (export estático).
import { useSearchParams } from "next/navigation";
import { SEASONAL_PRODUCTS, type SeasonalProduct } from "./seasonal";

export const RECIPES_HREF = "/recetas";
export const CALENDAR_HREF = "/recetas?vista=calendario";
export const productHref = (id: string) => `/recetas?producto=${encodeURIComponent(id)}`;

/** Producto de `?producto=` (un id desconocido se ignora) y si se pidió el calendario completo. */
export function useSeasonView(): { product: SeasonalProduct | null; calendar: boolean } {
  const params = useSearchParams();
  const id = params.get("producto");
  const product = id ? (SEASONAL_PRODUCTS.find((p) => p.id === id) ?? null) : null;
  return { product, calendar: !product && params.get("vista") === "calendario" };
}
