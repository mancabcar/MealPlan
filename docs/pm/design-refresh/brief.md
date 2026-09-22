# Rediseño visual moderno de Comidas

_Status: tech design · [spec.md](spec.md) · [tech.md](tech.md)_

_No hay brief previo de pm-brainstorm — este documento arranca directamente en la fase de prototipo, a partir de la petición del usuario en el chat._

## Contexto

La app actual (Diario, Plan semanal, Recetas, Despensa, Perfil) usa Tailwind con paleta neutra zinc + acento emerald, tarjetas blancas/zinc-900 con soporte claro/oscuro automático, y emoji como iconografía (📒 📅 🍳 🧺 👤). El usuario la considera "muy básica" y quiere una imagen más moderna, citando **Hevy** y **FuertaFit** como referencia de energía visual (apps de entrenamiento: oscuras, con números grandes, mucha densidad de datos bien organizada).

## Pregunta a validar con el prototipo

¿Funciona un lenguaje visual oscuro, con tipografía marcada y un único acento vibrante — más cercano a una app de entrenamiento — aplicado a las pantallas reales de esta app de planificación de comidas? ¿Es esta dirección algo sobre lo que merece la pena construir antes de tocar el código real?

## Prototype
_Design: [comidas — modern redesign prototype](https://claude.ai/artifact/9AJqcaxB4w9awBJGaWdxdw) · 2026-09-22_

- **Pantallas** (6, en el orden del flujo): Diario (dashboard) · Plan semanal · Recetas (lista) · Receta (detalle) · Despensa · Perfil. La navegación inferior es idéntica y funcional en las seis, con enlaces reales entre pantallas (lista de recetas → detalle, avatar del Diario → Perfil, etc.).
- **Terminología**: se reutiliza literalmente el vocabulario de la app actual (Diario, Plan semanal, Recetas, Despensa, Perfil, Desayuno/Media mañana/Comida/Merienda/Cena, Nevera/Despensa/Congelador, caducado/caduca pronto, Sugerir con IA, Objetivos diarios, etc.).
- **Decisiones de diseño (ASSUMPTIONs) tomadas al prototipar**:
  - Tema oscuro por defecto (en vez de claro/oscuro automático como hoy), con un único acento lima vibrante, tipografía Space Grotesk (títulos/números) + Manrope (texto), y radios de esquina grandes — buscando la energía de una app de entrenamiento.
  - Todos los emoji se sustituyen por iconos de trazo (nav, chispa de "Sugerir con IA", llama de calorías, reloj, etc.).
  - Se mantiene la paleta semántica de macros (azul=proteína, naranja=carbohidratos, coral=grasas) y de estado (rojo=caducado, ámbar=caduca pronto) para no romper la asociación que el usuario ya tiene con la app actual.
  - El Diario pasa de barras de progreso simples a un anillo de calorías + gráfico de barras de los últimos 7 días.
  - El Plan semanal cambia de lista vertical Lunes–Domingo a un selector de días con scroll horizontal + tarjetas de las franjas del día seleccionado.
- **Qué está simulado**: todos los datos (comidas, macros, recetas, ingredientes, productos de despensa) son ficticios pero realistas y en español; no hay backend, IA ni autenticación reales detrás de los botones.
- **Qué aprender al testearlo**: si el tono oscuro/energético encaja con cómo el usuario quiere sentirse usando la app (motivador tipo gimnasio) o si resulta demasiado "intenso" para una app de comida/nutrición; si el selector de días horizontal en Plan semanal es más rápido de usar que la lista vertical actual; si el acento lima es suficientemente legible/agradable o conviene explorar otro tono.

## Siguiente paso

Cuando el usuario esté conforme con la dirección, pm-spec puede escribir la spec de este rediseño (alcance: qué pantallas/componentes entran en la primera iteración, cómo migrar sin romper el modo claro/oscuro si se quiere conservar, etc.).
