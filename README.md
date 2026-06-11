# MealPlanner

App iOS de planificación y seguimiento de comidas. Funciona offline con una base de recetas local y usa la API de Claude para sugerencias personalizadas según tu perfil y lo que tengas en la despensa.

- **Plataforma:** iOS 17+
- **Stack:** Swift 5.9, SwiftUI, SwiftData (sin backend)
- **IA:** Anthropic Claude API

## Cómo compilarlo (necesitas un Mac con Xcode 15+)

El proyecto Xcode se genera con [XcodeGen](https://github.com/yonaskolb/XcodeGen) a partir de `project.yml`:

```bash
brew install xcodegen
cd Comidas
xcodegen generate
open MealPlanner.xcodeproj
```

Alternativa sin XcodeGen: crea en Xcode un proyecto nuevo (iOS App, SwiftUI, SwiftData) llamado `MealPlanner` y arrastra dentro las carpetas de `MealPlanner/` (App, Models, Views, Services, Helpers, Resources), marcando "Copy items if needed" y el target de la app. Asegúrate de que `recipes.json` queda incluido en *Target Membership*.

## API key de Claude (opcional hasta la Fase 6)

La generación de recetas con IA lee la key de `MealPlanner/Resources/Secrets.plist`, que está excluido de Git:

```bash
cp MealPlanner/Resources/Secrets.example.plist MealPlanner/Resources/Secrets.plist
# edita Secrets.plist y pon tu key (console.anthropic.com)
```

Sin la key, toda la app funciona igualmente; solo fallan (con un mensaje claro) los botones de sugerencias con IA.

## Estructura

```
MealPlanner/
├── App/MealPlannerApp.swift      # Entry point + ModelContainer + seed de recetas
├── Models/                       # @Model de SwiftData
│   ├── UserProfile.swift         # Objetivos de macros y preferencias
│   ├── Recipe.swift              # Receta (local o generada por IA)
│   ├── MealPlan.swift            # Plan semanal (DayPlan por día)
│   ├── MealEntry.swift           # Entrada del diario
│   └── PantryItem.swift          # Item de nevera/despensa/congelador
├── Views/
│   ├── MainTabView.swift         # Onboarding en primer arranque; luego 5 pestañas
│   ├── Onboarding/               # Flujo de primer arranque (crea el UserProfile)
│   ├── Diary/                    # Diario: progreso de macros + gráfica semanal (Charts)
│   ├── MealPlan/                 # Plan semanal con asignación de recetas por hueco
│   ├── Recipes/                  # Lista con búsqueda, filtros, detalle y botón IA ✨
│   ├── Pantry/                   # Lista por categoría, alta/edición, aviso caducidad
│   └── Profile/                  # Formulario de perfil y objetivos
├── Services/
│   ├── RecipeStore.swift         # Carga recipes.json en SwiftData (primer arranque)
│   ├── ClaudeService.swift       # Generación de recetas con la API de Claude
│   └── NotificationService.swift # Notificaciones locales de caducidad
├── Helpers/
│   ├── MacroCalculator.swift
│   └── DateHelpers.swift
└── Resources/
    ├── recipes.json              # 40 recetas base en español
    └── Secrets.example.plist     # Plantilla para la API key
```

## Estado actual vs roadmap

| Fase | Estado |
|---|---|
| 1. Fundamentos (proyecto, modelos, perfil, tabs) | ✅ Hecho |
| 2. Despensa (CRUD, categorías, caducidad, notificaciones) | ✅ Hecho |
| 3. Recetas locales (JSON, lista, búsqueda, filtros, detalle) | ✅ Hecho (40 recetas) |
| 4. Plan semanal (asignar recetas, totales por día) | ✅ Versión básica hecha |
| 5. Diario (registro + progreso de macros) | ✅ Hecho (barras de progreso + gráfica semanal con Swift Charts) |
| 6. Integración IA | 🔶 Botón "Sugerir recetas ✨" en Recetas funcionando; falta migrar la key a Keychain |
| 7. Pulido (onboarding, accesibilidad, TestFlight) | 🔶 Onboarding hecho; falta accesibilidad y TestFlight |

## Próximos pasos sugeridos

1. Compilar en el Mac y probar en el simulador (es la primera compilación: puede haber ajustes menores).
2. Probar el flujo completo de IA con una API key real en `Secrets.plist`.
3. Migrar la API key de `Secrets.plist` a Keychain.
4. Repaso de accesibilidad (Dynamic Type, VoiceOver) y preparación para TestFlight.
