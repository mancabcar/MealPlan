# 🥗 MealPlanner (web)

Planificador de comidas: diario de macros, plan semanal, recetario (40 recetas en español + generación con IA) y despensa con avisos de caducidad.

Antes era una app iOS (SwiftUI/SwiftData) — el código está en el historial de git. Se portó a web para no depender de Mac ni de licencia de desarrollador de Apple.

## Stack

- **Next.js 16** (App Router) + **Tailwind CSS** + TypeScript
- **Persistencia:** localStorage del navegador (sin backend ni base de datos — los datos viven en tu dispositivo)
- **Dos proyectos Next en este repo** (issue [#69](https://github.com/mancabcar/MealPlan/issues/69)): la raíz es la app (`output: "export"`, sitio estático) y [server/](server/) son las tres rutas que necesitan servidor — se explica en «Despliegue» más abajo.
- **IA:** API de Claude vía route handler de servidor ([server/app/api/recipes/route.ts](server/app/api/recipes/route.ts)) — la key nunca llega al navegador

## Desarrollo local

```sh
npm install
npm run dev        # raíz (la app): http://localhost:3000
```

Así, sin nada más, funciona todo lo que no depende de red (la mayoría de la app). Para la generación de recetas con IA, la búsqueda de alimentos por nombre/marca (#13) y el escáner de código de barras (#14), hace falta levantar también `server/`:

```sh
cd server
npm install
npm run dev        # server/ (las 3 rutas): http://localhost:3001
```

Y decirle a la raíz dónde está, en `.env.local` (raíz, no `server/`):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Y a `server/` qué origen puede llamarle, en `server/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
CORS_ALLOWED_ORIGIN=http://localhost:3000
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
- Los e2e del service worker (`tests/e2e/pwa.spec.ts`) necesitan el build: en CI corren siempre; en local se saltan con `next dev`. Para ejecutarlos: `npm run build`, `npx serve out -l 3000` en otra terminal y `PWA_E2E=1 npm run test:e2e -- tests/e2e/pwa.spec.ts`.

## Instalar la app y usarla sin conexión

La app es una PWA (issue [#21](https://github.com/mancabcar/MealPlan/issues/21)): manifest en `src/app/manifest.ts`, iconos en `public/icons/` (se regeneran con `node scripts/generate-icons.mjs` desde `icon.svg`) y un service worker que `npm run build` genera en `out/sw.js` (`scripts/generate-sw.mjs`, a partir de `scripts/sw.template.js`). Solo existe en el build: con `npm run dev` no se registra.

- **Android / PC (Chrome o Edge):** menú del navegador → «Instalar app», o el botón «Instalar app» de Perfil.
- **iPhone (Safari):** Compartir → «Añadir a pantalla de inicio». Safari no ofrece botón propio, así que Perfil no lo muestra.
- **Sin conexión:** tras una primera visita con red, la app abre en cualquier pantalla con los datos de este dispositivo. Las funciones que necesitan red (recetas con IA, búsqueda de marcas, códigos de barras) avisan de que no hay conexión.
- **Actualizaciones:** al publicar una versión nueva, el service worker la descarga y la usa en la siguiente apertura con red; no hay que borrar la caché.
- **Ojo en iPhone:** iOS puede borrar los datos de una web que no se abre durante un tiempo. Haz copias de seguridad desde Perfil › «Tus datos» (la sincronización entre dispositivos está en el issue [#22](https://github.com/mancabcar/MealPlan/issues/22)).

## Despliegue

Dos sitios, un repo (issue [#69](https://github.com/mancabcar/MealPlan/issues/69)):

- **La app, estática, en IONOS.** Ya configurado con [IONOS Deploy Now](https://docs.ionos.space): cada push construye la raíz (`npm run build`, `output: "export"`) y publica `out/`, sin nada que tocar aquí (`.github/workflows/MealPlan-*.yaml`, `deploy-to-ionos.yaml`, generados por IONOS).
- **Las tres rutas de servidor (`server/`), en Vercel:**
  1. Importa el repo en [vercel.com](https://vercel.com) (login con GitHub) como un proyecto nuevo, con **Root Directory: `server`**.
  2. En **Settings → Environment Variables** añade `ANTHROPIC_API_KEY` y `CORS_ALLOWED_ORIGIN` (el origen del sitio en IONOS, p. ej. `https://home-5021533470.app-ionos.space`).
  3. Deploy. Anota la URL que te da Vercel.
  4. En el proyecto de **IONOS Deploy Now**, añade la variable de entorno `NEXT_PUBLIC_API_BASE_URL` con esa URL de Vercel, y vuelve a desplegar la raíz para que quede fijada en el HTML/JS estático (es `NEXT_PUBLIC_*`: se fija en build time, cambiarla exige reconstruir).

## Secciones

| Pestaña | Qué hace |
|---|---|
| 📒 Diario | Progreso de macros del día (la proteína puede ser un rango, dibujado como banda) + gráfica semanal de calorías con línea de objetivo. «Añadir comida» registra una receta, un alimento buscado por nombre (en gramos o unidades) o una comida a mano |
| 📅 Plan | Plan semanal con las comidas que haces (hasta 6: desayuno, media mañana, comida, merienda, pre-entreno, cena) y total de kcal |
| 🍳 Recetas | Buscador, detalle con ingredientes y pasos, aviso "⚠ contiene…" si lleva uno de tus alérgenos, y botón ✨ para generar recetas con IA según tu perfil y despensa (las que lleven un alérgeno se descartan) |
| 🧺 Despensa | Inventario por categoría con avisos de "caduca pronto" y "caducado" |
| 👤 Perfil | Objetivo, objetivos diarios (con su origen: "Calculado" o "De tu nutricionista"), datos corporales, comidas del día, alergias, dieta y gustos. Si cambias el peso o la actividad con objetivos calculados, te ofrece recalcular |

Al entrar se pide usuario y contraseña (cuentas locales en este navegador, contraseña con hash PBKDF2; "Recordarme" mantiene la sesión abierta y guarda el usuario para elegirlo rápido). Cada usuario tiene sus propios datos.

Tras crear la cuenta, el onboarding pide nombre y objetivo y ofrece dos rutas:
- **Calcúlalo por mí:** con sexo, año de nacimiento, altura, peso y actividad sugiere calorías y macros (Mifflin-St Jeor), explicando de dónde salen. Todo es editable.
- **Tengo un plan de mi nutricionista:** escribes las cifras de tu plan. La proteína puede ser un rango, y los carbos y las grasas que dejes vacíos se calculan.

Después eliges qué comidas haces al día y declaras alergias (exclusión estricta), dieta y lo que no te gusta (preferencia). Los perfiles antiguos se migran solos al abrir la app.

## Importar recetas desde una URL

En Recetas, «Importar desde URL» pide la dirección de una receta y abre el formulario de receta prerrellenado para revisarla; nada se guarda hasta pulsar «Guardar». La ruta `POST /api/recipes/import` (en [server/](server/), ver «Despliegue») descarga la página, usa el JSON-LD `schema.org/Recipe` si lo hay (sin IA) y, si no, pide a Claude Haiku 4.5 que extraiga la receta y estime los macros (se marcan como «estimados»).

Límites: solo http/https; rechaza destinos internos (también tras redirecciones); 2 MB, 8 s y 3 redirecciones por descarga; 10 importaciones por IP cada 10 minutos (en memoria, por instancia). Usa las mismas variables que `/api/recipes` (`ANTHROPIC_API_KEY`, `CORS_ALLOWED_ORIGIN`); tras añadirla hay que redesplegar `server/` en Vercel.

## Datos de alimentos

La pestaña «Alimento» de «Añadir comida» busca en dos fuentes:

- **Básicos** (`src/data/foods.json`, ~160 genéricos, sin red): valores por 100 g de [CIQUAL 2020](https://ciqual.anses.fr) (ANSES, Licence Ouverte Etalab) y, cuando CIQUAL no tiene el alimento, de [USDA FoodData Central](https://fdc.nal.usda.gov) (dominio público). La cita va en el pie del bloque.
- **Productos de marca**: [Open Food Facts](https://world.openfoodfacts.org) (ODbL) a través de `GET /api/foods/search` (en [server/](server/), ver «Despliegue»), solo al pulsar el botón (OFF permite ~10 búsquedas por minuto).

Para cambiar la tabla, edita la lista curada `scripts/foods-list.json` (nombre en español, código y nombre en la fuente, peso de 1 ud) y regenera el JSON con el XML de CIQUAL 2020 (`XML_2020_07_07.zip`, enlazado desde [data.gouv.fr](https://www.data.gouv.fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual-2020/); no se commitea):

```bash
node scripts/build-foods.mjs <carpeta con el XML descomprimido>
```

Los alimentos USDA llevan sus valores copiados en la lista, con su `fdcId`. Si CIQUAL no trae la energía, el script la calcula con los factores del Reglamento UE 1169/2011 (4·P + 4·C + 9·G + 2·fibra…). No cambies el `id` de un alimento: forma parte de las entradas guardadas.
