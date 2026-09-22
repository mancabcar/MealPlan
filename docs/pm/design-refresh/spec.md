# Rediseño visual moderno de Comidas: Spec
_Status: Draft · Owner: Manuel Cabrera Carmona · Updated: 2026-09-22_
_Related: [brief](brief.md) · [prototipo](https://claude.ai/artifact/9AJqcaxB4w9awBJGaWdxdw)_

## TL;DR
La app actual (Diario, Plan, Recetas, Despensa, Perfil) usa un tema claro/oscuro automático genérico (Tailwind zinc + emerald) con emoji como iconografía, y se percibe como "muy básica". Vamos a sustituir ese sistema visual por uno oscuro, con tipografía marcada, un único acento lima e iconos de trazo — con la energía de apps de entrenamiento como Hevy — aplicado a las 5 pantallas principales, tal y como se validó en el prototipo. Sabremos que ha funcionado si todas las pantallas usan el nuevo sistema sin perder ninguna función actual y el usuario confirma que la app se siente moderna y motivadora al usarla a diario.

## Problem
El usuario (única persona que usa la app) encuentra el diseño actual básico y poco motivador. La app resuelve bien el seguimiento nutricional pero no transmite la energía que sí encuentra en apps de entrenamiento como Hevy o FuertaFit, que usa a diario. No hay evidencia cuantitativa (app de un solo usuario, sin analítica) — la evidencia es la propia percepción del usuario, confirmada al revisar el prototipo ("me gusta el lima, vamos a por la spec").

## Goals
- Sustituir el sistema visual actual (colores, tipografía, iconografía, componentes) por el validado en el prototipo, en las 5 pantallas principales.
- Conservar el 100% de la funcionalidad y la información que muestra hoy la app: ningún dato ni acción se pierde por el cambio visual.
- Mantener la paleta semántica de macros y estados que el usuario ya reconoce (proteína/carbohidratos/grasas, caducado/caduca pronto).

## Non-goals
- Rediseñar Login y Onboarding. Comparten componentes con Perfil (`profile/ui.tsx`, `profile/steps.tsx`) pero no se prototiparon en esta fase; quedan para una iteración posterior explícita.
- Añadir funcionalidad de producto nueva (sugerencias de IA reales más allá de lo que ya existe, gamificación, streaks, notificaciones). Esto es un rediseño visual, no un cambio de alcance funcional.
- Fotografías reales de recetas o un pipeline de imágenes: las tarjetas usan placeholders visuales, igual que en el prototipo.
- Métricas de uso instrumentadas: es una app personal de un único usuario, sin analítica.
- Soporte multi-tema/white-label más allá de la pregunta abierta sobre tema claro (ver Open questions).

## Users & key scenarios
Usuario único: la persona que registra sus comidas y planifica su semana a diario.

1. **Registrar y revisar el día** — abre Diario, ve cuánto lleva de calorías/macros frente a su objetivo y qué comidas le faltan por registrar hoy.
2. **Planificar la semana** — abre Plan, recorre los días y asigna o revisa qué receta toca en cada franja.
3. **Elegir una receta** — busca o filtra en Recetas, entra al detalle de una y la añade al plan o al diario.
4. **Revisar la despensa** — abre Despensa para ver qué tiene y qué está caducado o a punto de caducar antes de decidir qué cocinar.
5. **Ajustar su perfil** — entra en Perfil para revisar o recalcular sus objetivos diarios, o editar datos corporales/alergias.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El sistema define un conjunto de tokens visuales reutilizables (fondo, superficies, borde, texto, acento lima, colores semánticos de macros y estado, tipografía Space Grotesk + Manrope, radios grandes, escala de espaciado) que sustituye la paleta zinc/emerald actual. | Must |
| R2 | La barra de navegación inferior se rediseña como barra flotante redondeada con iconos de trazo + etiqueta, con el destino activo resaltado en lima, y se aplica igual en las 5 pantallas. | Must |
| R3 | Las 5 pantallas principales (Diario, Plan, Recetas, Despensa, Perfil) usan el nuevo sistema visual conservando toda la funcionalidad e información que muestran hoy. | Must |
| R4 | Todo emoji usado como icono de UI (📒 📅 🍳 🧺 👤 🔥 ✨ ⏱️, etc.) se sustituye por un icono de trazo consistente del mismo lenguaje visual. | Must |
| R5 | Se conserva el significado de color de macros y estado ya aprendido: proteína = azul, carbohidratos = naranja, grasas = coral, caducado = rojo, caduca pronto = ámbar. | Must |
| R6 | Todo texto mantiene un contraste mínimo de 4.5:1 sobre su fondo (3:1 si el texto es ≥24px), incluidas las combinaciones lima-sobre-oscuro y texto oscuro sobre botón lima. | Must |
| R7 | El Diario sustituye las barras de progreso planas actuales por un anillo de progreso de calorías más un gráfico de barras de los últimos 7 días frente al objetivo. | Should |
| R8 | El Plan semanal sustituye la lista vertical Lunes–Domingo por un selector de días con scroll horizontal y tarjetas de las franjas del día seleccionado. | Should |
| R9 | Recetas (lista y detalle) usa tarjetas con imagen placeholder, chips de macros/tiempo/alérgenos, y el detalle muestra macros en tarjetas y una checklist de ingredientes. | Should |
| R10 | Un tema claro equivalente (o alternancia manual de tema) está disponible además del oscuro. | Could — ver pregunta abierta |

## User flows
**Diario → Perfil** (artboard `Diario` → `Perfil`): el usuario toca el avatar en la cabecera del Diario y llega a su Perfil.

**Plan → Recetas** (artboard `Plan` → `Recetas`): el usuario toca una franja vacía ("Añadir comida") y llega al buscador de recetas para elegir una.

**Recetas → Receta → (Plan | Diario)** (artboard `Recetas` → `Receta`): el usuario toca una tarjeta de receta, revisa ingredientes y pasos, y pulsa "Añadir al plan de hoy" para incorporarla.

**Navegación global** (barra inferior, presente en las 5 pantallas): el usuario cambia entre Diario, Plan, Recetas, Despensa y Perfil en un toque, con el destino activo siempre visible en lima.

## Acceptance criteria
**R1**
- Given cualquier pantalla de la app, when se renderiza, then usa exclusivamente los tokens de color/tipografía/radio definidos (ningún `zinc-*`/`emerald-*` ni el par `--background`/`--foreground` claro-oscuro actual).

**R2**
- Given el usuario está en cualquiera de las 5 pantallas principales, when mira la parte inferior, then ve la misma barra flotante con 5 destinos e iconos de trazo, y el destino de la pantalla actual aparece resaltado en lima.
- Given el usuario toca un destino distinto al actual, when se completa la navegación, then esa pantalla pasa a ser la resaltada.

**R3**
- Given una función que existe hoy (añadir comida, asignar/quitar receta de una franja, añadir producto a la despensa, editar objetivos/datos corporales/alergias, cerrar sesión, borrar perfil), when se usa la app rediseñada, then esa función sigue disponible y accesible, aunque su presentación visual cambie.

**R4**
- Given cualquier pantalla, when se inspecciona su UI, then no aparece ningún carácter emoji usado como icono funcional (los emoji en contenido de usuario, si los hubiera, no cuentan).

**R5**
- Given una barra o badge de proteína/carbohidratos/grasas o de caducado/caduca pronto, when se renderiza, then usa el color semántico correspondiente (azul/naranja/coral/rojo/ámbar) definido en R1.

**R6**
- Given cualquier combinación de texto y fondo del nuevo sistema, when se mide su contraste, then es ≥4.5:1 (o ≥3:1 si el texto es ≥24px).

**R7**
- Given el Diario con datos del día, when se abre, then muestra un anillo de progreso de calorías (consumidas vs. objetivo) y un gráfico de 7 barras (una por día) con el objetivo marcado.

**R8**
- Given el Plan semanal, when se abre, then muestra un selector horizontal de 7 días y, debajo, las franjas configuradas del día seleccionado (llenas o vacías).

**R9**
- Given la lista de Recetas, when se muestra una receta, then su tarjeta incluye imagen (placeholder si no hay foto real), kcal, macro principal, tiempo de preparación y, si aplica, alérgenos.
- Given el detalle de una receta, when se abre, then muestra sus macros en tarjetas individuales y sus ingredientes como checklist.

## Edge cases
- **Estados vacíos** (sin comidas registradas hoy, plan de un día sin ninguna franja asignada, despensa vacía, búsqueda de recetas sin resultados): no se prototiparon explícitamente; deben construirse con los mismos tokens visuales (superficie, texto muted, icono de trazo) en lugar de reutilizar el estilo claro actual.
- **Objetivos prescritos por nutricionista vs. calculados** (Perfil): la etiqueta "Calculado" / "De tu nutricionista" del prototipo debe reflejar el origen real, igual que hoy.
- **Ítems de despensa sin fecha de caducidad**: no deben mostrar badge de estado (ni "caducado" ni "caduca pronto").
- **Recetas con más de un alérgeno**: la fila de chips debe poder envolver a varias líneas sin romper la tarjeta (ya contemplado con `flex-wrap` en el prototipo).

## Success metrics
Al ser una app personal de un único usuario sin analítica, el éxito es cualitativo:
- El usuario confirma que la app rediseñada "se siente moderna/motivadora" al usarla en su rutina diaria real (no solo en el prototipo).
- Ninguna tarea core (registrar comida, asignar receta, marcar producto de despensa, editar perfil) tarda perceptiblemente más o resulta más confusa que con el diseño actual.

## Risks & dependencies
- **Fuentes**: el prototipo carga Space Grotesk/Manrope vía Google Fonts CDN; la app actual ya usa `next/font` (Geist) autohospedado. Habrá que decidir la estrategia de carga antes del diseño técnico (ver pregunta abierta).
- **Contraste del acento lima**: el lima es muy luminoso; badges y estados de error/advertencia sobre fondo oscuro necesitan verificarse contra R6 en la implementación real, no solo en el mockup.
- **Inconsistencia temporal**: si Login/Onboarding quedan fuera de este rediseño (non-goal), convivirán dos lenguajes visuales hasta una iteración futura.
- **Coste de iconos**: sustituir emoji (gratis) por un set de iconos de trazo consistente implica producir/mantener ese set de SVG.

## Open questions
- [ ] ¿Eliminamos el tema claro (automático vía `prefers-color-scheme`) por completo, o construimos un tema claro equivalente / alternancia manual (R10)? Bloquea si el sistema de tokens necesita soportar dos temas o solo uno. (Manuel)
- [ ] ¿Entra el rediseño de Login y Onboarding en un trabajo inmediatamente posterior, o queda sin fecha? No bloquea esta spec, pero condiciona cuánto tiempo convive la inconsistencia visual. (Manuel)
- [ ] Fuentes vía Google Fonts o autohospedadas con `next/font` como hoy — a resolver en el diseño técnico, no bloquea la spec. (dev-technical-opinion)
- [ ] ¿De dónde saldrán eventualmente imágenes reales de recetas, o los placeholders son la solución permanente? No bloquea esta iteración (non-goal), pero conviene decidirlo antes de invertir en el layout de tarjetas con imagen. (Manuel)
