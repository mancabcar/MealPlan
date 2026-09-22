# 🥗 MealPlanner (web)

Planificador de comidas: diario de macros, plan semanal, recetario (40 recetas en español + generación con IA) y despensa con avisos de caducidad.

Antes era una app iOS (SwiftUI/SwiftData) — el código está en el historial de git. Se portó a web para no depender de Mac ni de licencia de desarrollador de Apple.

## Stack

- **Next.js 16** (App Router) + **Tailwind CSS** + TypeScript
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

## Tests

```sh
npm test            # unitarios (Vitest), una pasada
npm run test:watch  # unitarios en modo watch
npm run test:e2e    # end-to-end (Playwright + Chromium); arranca `npm run dev` o reutiliza el que ya corre
npm run typecheck   # tsc --noEmit
```

- Unitarios en `tests/unit/` (entorno `node`; para componentes añade `// @vitest-environment jsdom`).
- E2E en `tests/e2e/`; `helpers.ts` siembra una sesión local para saltarse el login.
- La primera vez: `npx playwright install chromium`.
- CI (`.github/workflows/ci.yml`) ejecuta lint, typecheck, unitarios, build y e2e en cada PR.

## Despliegue gratis en Vercel

1. Importa el repo en [vercel.com](https://vercel.com) (login con GitHub).
2. En **Settings → Environment Variables** añade `ANTHROPIC_API_KEY`.
3. Deploy. Cada push a `main` redespliega automáticamente.

## Secciones

| Pestaña | Qué hace |
|---|---|
| 📒 Diario | Progreso de macros del día (la proteína puede ser un rango, dibujado como banda) + gráfica semanal de calorías con línea de objetivo |
| 📅 Plan | Plan semanal con las comidas que haces (hasta 6: desayuno, media mañana, comida, merienda, pre-entreno, cena) y total de kcal |
| 🍳 Recetas | Buscador, detalle con ingredientes y pasos, aviso "⚠ contiene…" si lleva uno de tus alérgenos, y botón ✨ para generar recetas con IA según tu perfil y despensa (las que lleven un alérgeno se descartan) |
| 🧺 Despensa | Inventario por categoría con avisos de "caduca pronto" y "caducado" |
| 👤 Perfil | Objetivo, objetivos diarios (con su origen: "Calculado" o "De tu nutricionista"), datos corporales, comidas del día, alergias, dieta y gustos. Si cambias el peso o la actividad con objetivos calculados, te ofrece recalcular |

Al entrar se pide usuario y contraseña (cuentas locales en este navegador, contraseña con hash PBKDF2; "Recordarme" mantiene la sesión abierta y guarda el usuario para elegirlo rápido). Cada usuario tiene sus propios datos.

Tras crear la cuenta, el onboarding pide nombre y objetivo y ofrece dos rutas:
- **Calcúlalo por mí:** con sexo, año de nacimiento, altura, peso y actividad sugiere calorías y macros (Mifflin-St Jeor), explicando de dónde salen. Todo es editable.
- **Tengo un plan de mi nutricionista:** escribes las cifras de tu plan. La proteína puede ser un rango, y los carbos y las grasas que dejes vacíos se calculan.

Después eliges qué comidas haces al día y declaras alergias (exclusión estricta), dieta y lo que no te gusta (preferencia). Los perfiles antiguos se migran solos al abrir la app.
