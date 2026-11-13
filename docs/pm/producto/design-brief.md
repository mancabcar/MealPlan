# MealPlan, el producto: Brief de diseño UI/UX
_Status: Draft · Updated: 2026-11-13_
_Related: [app flow](appflow.md) · [spec](spec.md) · [tech](tech.md) · [brief](brief.md)_

## TL;DR
Encargo para diseñar desde cero la interfaz de MealPlan, sin heredar nada de la app actual. El [app flow](appflow.md) ya fija **qué** pantallas hay y cómo se conectan (Hoy · Plan · Cocina · Recetas · Yo, la hoja Añadir comida, registro obligatorio, paywall). Este brief fija **cómo** deben sentirse y verse: una herramienta tranquila y rápida para alguien que sigue un plan de alimentación, que se usa con una mano en la cocina y que nunca regaña. El entregable es un sistema de diseño ligero y las pantallas de los flujos F-1 a F-10, en claro y oscuro, en español e inglés, válidas para web, iOS y Android con una sola UI.

Las decisiones marcadas **P#** son propuestas pendientes de que el dueño del producto las confirme.

## 1. Qué tiene que conseguir el diseño
| Objetivo de producto | Qué significa para el diseño | Cómo lo comprobamos |
|---|---|---|
| G2 Registrar en segundos | Lo planificado se registra con **1 toque** desde Hoy; cualquier otra comida en **≤ 3 toques** desde Hoy | Prueba con 5 usuarios: registrar un reciente en < 10 s |
| G1 Ciclo completo | Cada pestaña deja claro el siguiente paso del ciclo (planificar → comprar → cocinar → registrar → revisar) | En la prueba, el usuario encuentra «Generar lista» sin ayuda |
| Métrica: días dentro de objetivo | El progreso del día se entiende de un vistazo, con la tolerancia de «cumplido» visible | El usuario dice si «va bien hoy» en < 3 s mirando Hoy |
| G3 Tirar menos | Lo que caduca aparece donde el usuario ya mira (Hoy, Despensa), sin alarmismo | — |
| G5, G8 Abierto y en tiendas | Que parezca una app nativa, no una web envuelta (riesgo de la guideline 4.2 de Apple) | Revisión de TestFlight sin rechazo por 4.2 |
| G6 Freemium | Lo gratis se siente completo; lo de pago se ve, se entiende y no molesta | Ninguna pantalla gratis tiene un bloqueo que no sea una función 💎 |

## 2. Usuarios y contexto de uso
- **Quién:** adulto que sigue un plan con objetivos de kcal y macros (propio o de su nutricionista), cocina en casa, no es necesariamente «fitness» ni técnico.
- **Dónde y cómo:**
  - **En la cocina o a la mesa**, con el móvil en una mano y a veces las manos sucias → objetivos táctiles grandes, acciones principales en la mitad inferior de la pantalla.
  - **En el súper**, con prisa y mala cobertura → la Lista de la compra legible a distancia de brazo, marcar con un toque, funciona sin conexión.
  - **El domingo en el sofá o en el PC**, planificando la semana → el Plan aprovecha pantallas anchas y permite ver la semana entera.
  - **Al final del día o de la semana**, revisando → gráficas claras y sin juicios.
- **Emoción de partida:** seguir un plan cansa y genera culpa cuando no se cumple. La app tiene que quitar fricción y culpa, no añadirlas.

## 3. Principios de diseño
1. **Un toque para lo esperado.** Lo planificado y lo habitual siempre a un toque; la precisión (gramos, raciones) se edita después, nunca bloquea.
2. **Calma, no alarma.** Pasarse del objetivo es información, no un error. Nada de rojo para «te has pasado», ni rachas que se rompen, ni mensajes de culpa.
3. **El dato manda.** Números grandes y legibles (kcal, gramos, días), decoración mínima. La comida aporta el color; la interfaz no compite.
4. **Mismo gesto, mismo resultado.** Una sola hoja Añadir comida, un solo patrón de fila deslizable, un solo patrón de vacío. Lo aprendido en una pestaña sirve en todas.
5. **Honesto con el dinero y los datos.** Lo de pago se marca siempre igual y antes de tocarlo; los consentimientos se explican en lenguaje llano; ninguna pantalla usa patrones oscuros.
6. **Funciona sin red y lo dice sin drama.** Lo que no está disponible se ve desactivado con su motivo; nunca desaparece ni falla en silencio.

## 4. Personalidad y tono
- **Es:** sereno, competente, cálido, práctico. Un buen cuaderno de cocina con una calculadora dentro.
- **No es:** una app de gimnasio (nada de negros y neones, ni lenguaje de «destroza tus macros»), una app médica (nada de azules clínicos ni tono de diagnóstico), ni un juego (nada de mascotas, confeti ni puntos).
- **Voz:** frases cortas, segunda persona, verbos de acción en los botones («Registrar», «Generar lista», «Pasar a la Despensa»). Describe hechos («120 kcal por debajo») en lugar de valorar («¡Casi!»). En inglés, el mismo tono, no una traducción literal.

## 5. Dirección visual (propuesta)
**P1. Dirección: «cocina luminosa».** Fondo cálido casi blanco (no blanco puro), superficies con poco contraste entre sí, un color de marca natural y saturado con moderación, y la comida como única fuente de color fuerte. Alternativas descartadas en la propuesta: «oscuro deportivo» (choca con la personalidad) y «clínico blanco y azul» (choca con el non-goal de herramienta médica).

| Elemento | Propuesta |
|---|---|
| **Color de marca** (P2) | Un verde hoja o salvia profundo como primario (acciones, pestaña activa, «cumplido»). Un acento cálido (tomate/terracota suave) solo para avisos de caducidad y 💎. |
| **Semántica de progreso** | Por debajo del rango: neutro · dentro de la tolerancia: primario · por encima: ámbar suave. **Nunca rojo** para el objetivo diario. El rojo se reserva para acciones destructivas (borrar cuenta) y errores reales. |
| **Macros** | Tres colores fijos y distinguibles también para daltonismo (proteína, hidratos, grasa), siempre acompañados de su inicial o nombre, nunca solo por color. |
| **Tipografía** (P3) | Una sans humanista con cifras tabulares y buena lectura en tamaños pequeños, con soporte completo de acentos y del escalado del sistema (Dynamic Type / tamaño de fuente de Android). Por ejemplo Inter, Figtree o Nunito Sans. Cifras grandes para kcal y totales. |
| **Forma** | Esquinas redondeadas medias (12–16 px en tarjetas, píldora en chips), sombras mínimas; la jerarquía la dan el espacio y el tono, no las líneas. |
| **Iconos** | Un solo set de trazo redondeado, del mismo grosor que el texto. Iconos con etiqueta en la barra de pestañas. |
| **Imágenes** (P4) | Recetas con foto cuando exista; si no, un marcador ilustrado o un patrón de color con la inicial, nunca un hueco gris. Ilustraciones sencillas solo en vacíos y onboarding. |
| **Densidad** | Cómoda en móvil (filas de al menos 56 px), más compacta en el Plan en pantallas anchas. |
| **Modo oscuro** (P5) | Desde el principio, siguiendo el ajuste del sistema y con opción manual en Yo › Ajustes. Fondos gris carbón cálido, no negro puro. |

## 6. Plataformas y adaptación
Una sola UI web empaquetada con Capacitor (tech design). El diseño debe sentirse nativo sin dos diseños distintos:
- **Navegación:** barra de pestañas inferior en móvil; en pantallas ≥ 1024 px, **barra lateral** con las mismas cinco secciones (P6, cierra la open question del app flow).
- **Hojas inferiores** (bottom sheets) para Añadir comida, quitar de la Despensa y selecciones rápidas; pantallas completas para detalle y edición larga.
- **Respetar la plataforma** donde el usuario lo nota: áreas seguras y barra de estado (R17, #96), gesto de volver de iOS y botón atrás de Android, teclado numérico para cantidades, hápticos discretos al registrar y al marcar comprado, selectores de fecha del sistema.
- **Web ancha:** el Plan muestra la semana entera en rejilla; Hoy puede mostrar el día y la semana lado a lado. Ninguna función depende del ratón (hover solo como mejora).
- **Orientación:** vertical en móvil; la web responde de 320 px a escritorio.

## 7. Qué hay que diseñar
### Sistema de diseño (base de todo lo demás)
- **Tokens:** color (claro y oscuro), tipografía, espaciado, radios, elevación, movimiento. Nombrados para traducirse a variables CSS.
- **Componentes:**
  - Navegación: barra de pestañas, barra lateral, cabecera con selector de día, control segmentado (Lista | Despensa), indicador de sincronización/sin conexión.
  - Datos: anillo o barra de kcal con banda de tolerancia, barras de macros, tira semanal de días que cumplen, gráfica semanal, gráfica de peso y medidas, contador de agua y fibra.
  - Contenido: tarjeta de franja (planificado / registrado / + Añadir), fila de alimento con cantidad, fila deslizable con acciones, tarjeta de receta (lista y rejilla), tarjeta de ítem de Despensa con «caduca en X días», chips de filtro y de estado, insignia 💎.
  - Entrada: hoja Añadir comida con pestañas de origen, buscador, selector de cantidad (raciones / g / oz / unidades), visor de cámara (código de barras y ticket), formularios, interruptores.
  - Feedback: toast con deshacer, aviso no bloqueante, diálogo de confirmación destructiva, estados vacíos, esqueletos de carga, «Necesita conexión».
  - Monetización: paywall, tarjeta de uso de IA del mes, aviso de límite alcanzado.
- **Cada componente con sus estados:** normal, pulsado, desactivado, cargando, error, sin conexión, y en español/inglés con el texto más largo.

### Pantallas, por prioridad
| Prioridad | Pantallas | Flujos del app flow |
|---|---|---|
| 1 | Hoy (vacío, a mitad de día, día cumplido, día pasado) · hoja Añadir comida (todas las fuentes, desde Hoy y desde el Plan) | F-5, F-6 |
| 2 | Plan (semana vacía, a medias, completa; móvil y ancho) · Rellenar / Copiar semana · Cocina › Lista y Despensa | F-4, F-8 |
| 3 | Bienvenida, intro, crear cuenta, entrar, recuperar contraseña, consentimiento de salud, onboarding, consentimiento de analítica | F-1, F-2, F-3 |
| 4 | Recetas (lista, filtros, detalle, receta propia, importar URL, generar con IA) | — |
| 5 | Paywall, límite de IA, Escanear ticket y revisión | F-7 |
| 6 | Yo › Progreso y todos los Ajustes, borrar cuenta, avisos | F-9, F-10 |
| Transversal | Sin conexión, conflicto de sincronización, sesión caducada, vacíos, alérgenos, cambio de idioma y unidades | Estados transversales |

## 8. Pautas por área
- **Hoy:** la respuesta a «¿cómo voy?» ocupa la parte superior sin desplazarse; las franjas debajo, en el orden del día; la franja actual destacada según la hora. El botón «Registrar» de lo planificado es el elemento más fácil de pulsar de la pantalla.
- **Añadir comida:** se abre con la franja ya elegida y con Planificado o Recientes visibles sin escribir nada. El buscador mezcla recetas y alimentos con una marca clara de qué es cada cosa. La cantidad se ajusta con pasos rápidos (½, 1, 2 raciones; 50/100/150 g) además del teclado. Registrar cierra la hoja y anima el progreso de Hoy.
- **Plan:** cada día enseña de un vistazo si sus macros cuadran. Las acciones de semana (Rellenar, Copiar, Generar lista) están siempre a mano, no escondidas en un menú. Las sobras y el batch cooking se distinguen visualmente de una comida normal.
- **Cocina:** la Lista se lee como una lista de papel: grande, por categorías, con lo comprado tachado y al fondo. En la Despensa, la caducidad se lee por tiempo («caduca en 2 días») y el aviso cálido sustituye al rojo.
- **Recetas:** la foto y los macros por ración son lo primero. Alérgenos declarados siempre visibles en el detalle.
- **Yo:** el progreso corporal se presenta como tendencia (media móvil), no como subidas y bajadas diarias.
- **Paywall:** dice qué incluye en tres puntos, muestra precio mensual y anual con el ahorro real, la prueba de 7 días con la fecha en que se cobrará, «Restaurar compras» y cerrar siempre visible. Cumple las normas de App Store y Google Play.
- **Consentimientos:** una idea por pantalla, en lenguaje llano, con enlace a la política. El de salud explica por qué es obligatorio; el de analítica tiene «Ahora no» con el mismo peso visual que «Sí».
- **Borrar cuenta:** fricción deliberada (contraseña y confirmación), explicación de qué se pierde y aviso de que la suscripción de la tienda se cancela aparte.

## 9. Contenido, idiomas y unidades
- Diseñar con **textos reales**, nunca lorem ipsum: recetas, alimentos y cantidades verosímiles del plan de un usuario real.
- **Español e inglés** en todas las pantallas; dejar margen para textos un 30 % más largos y probar las etiquetas de pestaña y botones con el idioma más largo.
- **Unidades:** cada campo de cantidad se diseña en métrico e imperial (g/oz, kg/lb, cm/in, ml/fl oz). Formatos de número y fecha según el idioma (1.250 kcal / 1,250 kcal).
- Los datos que crea el usuario no se traducen: el diseño no debe sugerir lo contrario.

## 10. Accesibilidad
- **WCAG 2.2 AA** como mínimo: contraste 4,5:1 en texto y 3:1 en elementos gráficos, en claro y en oscuro.
- Objetivos táctiles de **al menos 44×44 pt (iOS) / 48×48 dp (Android)**.
- Ningún significado solo por color (macros, cumplido, caducidad, 💎 llevan texto o icono).
- Escalado de texto del sistema hasta 200 % sin cortar cifras ni solapar.
- Gráficas con resumen textual para lectores de pantalla («Esta semana: 5 de 7 días dentro de objetivo»).
- Respeta «reducir movimiento»: las animaciones se sustituyen por fundidos.
- Gestos (deslizar para quitar o cambiar de semana) siempre con alternativa visible.

## 11. Movimiento
Breve y funcional (150–250 ms): la hoja sube y baja, el progreso crece al registrar, lo comprado se desliza al fondo. Sin animaciones de celebración. Un háptico ligero al registrar y al marcar comprado en las apps nativas.

## 12. Restricciones técnicas para el diseño
- Se implementa en web (Next con export estático) dentro de Capacitor: todo debe ser realizable con HTML/CSS; fuentes alojadas en la app, sin dependencias de CDN (R17, #93).
- Los tokens se entregan con nombres que pasen directamente a variables CSS.
- La cámara (código de barras y ticket) usa plugins nativos: diseñar el visor y su permiso denegado.
- El estado del plan de pago viene del servidor: el paywall necesita estado de carga.

## 13. Entregables
1. **Moodboard y dirección visual** (P1–P5) para validar antes de seguir.
2. **Sistema de diseño:** tokens claro/oscuro y librería de componentes con estados.
3. **Pantallas** de la sección 7 por prioridad, en móvil (390 pt de ancho) y ancho (1280 px) donde aplique, en claro y oscuro, en español con una muestra en inglés.
4. **Prototipo navegable** de F-1 (primera vez) y F-5 (registrar una comida) para la prueba con usuarios.
5. **Handoff:** especificaciones de espaciado, tokens exportables y notas de comportamiento por pantalla.
6. **Assets de tienda:** icono de la app y capturas para App Store y Google Play (después de validar la dirección).

## 14. Cómo validamos
- **Revisión de la dirección visual** con el dueño del producto tras el entregable 1.
- **Prueba de usabilidad** con 5 personas que siguen un plan de alimentación, sobre el prototipo de F-1 y F-5. Tareas: crear cuenta y onboarding; registrar lo planificado; registrar un reciente; registrar un producto por código de barras; generar la lista de la compra.
- **Criterios de éxito:** las tareas se completan sin ayuda; registrar un reciente en < 10 s; nadie confunde una función 💎 con una gratis; nadie describe la app como «estresante» o «que juzga».
- **Revisión de accesibilidad** de contraste y tamaños en claro y oscuro antes del handoff.

## 15. Fuera de este brief
- Vista para nutricionistas (R31): necesita su propia spec.
- Web de marketing y landing de las tiendas, más allá del icono y las capturas.
- Naming y logotipo: se mantiene «MealPlan» salvo que se decida lo contrario (P7).
- Widgets o funciones exclusivas de cada plataforma (non-goal del PRD).

## Decisiones pendientes (dueño del producto)
- [ ] **P1.** Dirección visual «cocina luminosa» (frente a oscuro deportivo o clínico).
- [ ] **P2.** Primario verde salvia/hoja con acento cálido; nunca rojo para el objetivo.
- [ ] **P3.** Tipografía sans humanista con cifras tabulares.
- [ ] **P4.** Recetas con foto y marcador ilustrado cuando no la hay.
- [ ] **P5.** Modo oscuro desde la primera versión.
- [ ] **P6.** Barra lateral en pantallas anchas (cierra la open question del app flow).
- [ ] **P7.** ¿Se revisan el nombre y el logotipo antes de ir a las tiendas?
- [ ] **P8.** ¿Quién diseña (dueño del producto con Claude Design, o un diseñador externo) y con qué herramienta se entrega?

## Open questions
- [ ] ¿Las fotos de las recetas semilla existen o hay que producirlas o licenciarlas?
- [ ] ¿Se ofrece la prueba de 7 días al acabar el onboarding (open question del app flow)? Afecta al diseño de F-1.
- [ ] ¿Se recluta a los 5 usuarios de la prueba entre clientes de nutricionistas?
