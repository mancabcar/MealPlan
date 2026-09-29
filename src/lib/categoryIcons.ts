// Iconos Lucide para categorías de Despensa y tipos de comida (docs/pm/design-refresh).
// Separado de lib/types.ts (issue #69): server/ importa tipos de types.ts y no puede arrastrar
// lucide-react, que solo hace falta para la UI de la raíz.
import { Apple, Archive, Carrot, Coffee, Dumbbell, type LucideIcon, Moon, Refrigerator, Snowflake, UtensilsCrossed } from "lucide-react";
import type { MealType, PantryCategory } from "./types";

// Rediseño visual (docs/pm/design-refresh): único consumidor es despensa/page.tsx (pantalla en
// alcance), sin ruta de Onboarding/Login por medio — se convierte a iconos Lucide en el sitio.
export const PANTRY_CATEGORY_ICONS: Record<PantryCategory, LucideIcon> = {
  Nevera: Refrigerator,
  Despensa: Archive,
  Congelador: Snowflake,
};

// Rediseño visual (docs/pm/design-refresh, ver tech.md § Spec feedback): NO tocar MEAL_TYPE_ICONS
// de lib/types.ts — profile/steps.tsx (Onboarding) lo interpola como string y no puede consumir un
// componente. Este mapa hermano es solo para las pantallas rediseñadas (Diario, Plan, Perfil y el
// fork components/perfil/steps.tsx), que sí pueden renderizar <Icon />.
export const MEAL_TYPE_ICON_COMPONENTS: Record<MealType, LucideIcon> = {
  Desayuno: Coffee,
  "Media mañana": Apple,
  Comida: UtensilsCrossed,
  Merienda: Carrot,
  "Pre-entreno": Dumbbell,
  Cena: Moon,
};
