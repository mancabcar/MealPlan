# 🥗 MealPlanner (web)

Planificador de comidas: diario de macros, plan semanal, recetario (40 recetas en español + generación con IA) y despensa con avisos de caducidad.

Antes era una app iOS (SwiftUI/SwiftData) — el código está en el historial de git. Se portó a web para no depender de Mac ni de licencia de desarrollador de Apple.

## Stack

- **Next.js 15** (App Router) + **Tailwind CSS** + TypeScript
- **Persistencia:** localStorage del navegador (sin backend ni base de datos — los datos viven en tu dispositivo)
- **IA:** API de Claude vía route handler de servidor ([src/app/api/recipes/route.ts](src/app/api/recipes/route.ts)) — la key nunca llega al navegador

## Desarrollo local

```sh
npm install
npm run dev        # http://localhost:3000
```

Para usar la generación de recetas con IA, crea `.env.local` con:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Despliegue gratis en Vercel

1. Importa el repo en [vercel.com](https://vercel.com) (login con GitHub).
2. En **Settings → Environment Variables** añade `ANTHROPIC_API_KEY`.
3. Deploy. Cada push a `main` redespliega automáticamente.

## Secciones

| Pestaña | Qué hace |
|---|---|
| 📒 Diario | Progreso de macros del día + gráfica semanal de calorías con línea de objetivo |
| 📅 Plan | Plan semanal (desayuno/comida/cena por día) con total de kcal |
| 🍳 Recetas | Buscador, detalle con ingredientes y pasos, botón ✨ para generar recetas con IA según tu perfil y despensa |
| 🧺 Despensa | Inventario por categoría con avisos de "caduca pronto" y "caducado" |
| 👤 Perfil | Objetivos de macros, restricciones y gustos (editables) |

El primer arranque muestra un onboarding de 3 pasos que crea tu perfil.
