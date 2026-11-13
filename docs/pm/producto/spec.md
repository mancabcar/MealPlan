# MealPlan, el producto: Spec
_Status: Draft · Owner: Manuel Cabrera · Updated: 2026-11-13_
_Related: [brief](brief.md) · [README](../../../README.md)_

## TL;DR
Seguir un plan nutricional obliga a combinar varias herramientas: un contador de macros, un plan semanal, una lista de la compra y la memoria de lo que caduca. MealPlan lo junta en un solo ciclo (planificar → comprar → cocinar → registrar → revisar), y este documento fija lo que ya existe como línea base y define la visión: abrirlo a cualquiera, con modelo freemium, en inglés y en las tiendas de iOS y Android. Sabremos que funciona por los días registrados por semana, los días dentro de objetivo, la parte de la semana planificada de antemano y la comida que se tira, medidos en el servidor.

## Problem
**Quién:** personas que siguen un plan de alimentación (propio o de su nutricionista) con objetivos de calorías y macros.

**Dolor:** cumplir el plan exige varias herramientas que no se hablan. Las apps de macros registran lo comido, pero no ayudan a planificar la semana, no generan la compra ni saben qué hay en la nevera. El resultado: registrar cuesta, la semana se improvisa y la comida caduca.

**Evidencia:** el propio dueño del producto sigue planes de nutricionista y ha construido MealPlan para sí mismo durante 2026 (unas 40 features en `docs/pm/`). Hoy el registro pide un código de invitación, así que no hay datos de otros usuarios.

## Goals
- **G1. El ciclo nutricional completo en una app:** planificar la semana, generar la compra, cocinar, registrar en el Diario y revisar la adherencia frente a los objetivos.
- **G2. Registrar en segundos:** recientes, favoritos, base de alimentos, código de barras, copiar un día y registrar desde el Plan.
- **G3. Tirar menos comida:** avisos de caducidad en la Despensa, recetas que aprovechan lo que caduca y escaneo de tickets.
- **G4. Tus datos en todas partes:** funciona sin conexión, se sincroniza entre dispositivos y se puede exportar e importar.
- **G5. Abierto a cualquiera:** cualquier persona puede registrarse, sin código de invitación.
- **G6. Monetización freemium:** el núcleo es gratis; lo que cuesta dinero por uso (la IA) es de pago.
- **G7. Traducible:** todo el producto, interfaz y contenido, en inglés además de español, con unidades imperiales.
- **G8. En las tiendas:** apps de iOS y Android en App Store y Google Play con las mismas funciones que la web.

## Non-goals
- **No es una herramienta médica:** ni diagnóstico ni consejo clínico. Los objetivos los calcula una fórmula estándar o los pone el usuario a partir de su plan.
- **Nada social:** ni compartir, ni feed, ni seguidores.
- **Sin integraciones de compra a domicilio** ni de wearables o apps de salud (Apple Health, Google Fit).
- **Sin anuncios.**
- **Las apps nativas no añaden funciones propias:** el requisito es paridad con la web, no widgets ni capacidades exclusivas de cada plataforma.
- **Más idiomas que español e inglés** quedan fuera de esta versión. El producto se prepara para traducirse, pero solo se entrega el inglés.

## Users & key scenarios
**Usuario principal:** adulto que sigue un plan de alimentación con objetivos diarios de kcal y macros, cocina en casa y usa el móvil como herramienta principal (y el PC para planificar).

**Usuario secundario (Could):** el nutricionista que quiere ver cómo cumple su cliente.

1. **Domingo, planificar:** el usuario rellena la semana (a mano, copiando la anterior o con IA según sus macros), ve los macros de cada día frente a su objetivo y genera la lista de la compra.
2. **En el súper y al volver:** marca la compra, escanea el ticket y la Despensa se actualiza con fechas de caducidad.
3. **Cada comida:** registra con un toque lo planificado, un reciente, un favorito o un producto por código de barras, y ve cómo va el día.
4. **Fin de semana:** revisa en el Diario la media semanal y qué días cumplió, y en Perfil la evolución del peso y las medidas.
5. **(Visión) Alguien nuevo** descarga la app en la tienda, se registra sin invitación, en inglés y con libras y onzas, usa gratis el núcleo y paga para generar recetas con IA.

## Requirements

### Línea base: lo que ya existe
Todo lo de esta tabla está en producción. El detalle (comportamiento, criterios de aceptación y casos límite) vive en la spec de cada feature, que sigue siendo la referencia.

| ID | Requirement | Priority |
|---|---|---|
| R1 | **Cuenta y perfil.** El usuario crea una cuenta, hace un onboarding que calcula sus objetivos (Mifflin-St Jeor) o recoge los de su nutricionista (la proteína puede ser un rango), elige sus comidas del día, declara alergias (exclusión estricta), dieta y gustos, y ajusta la tolerancia de «cumplido». Specs: [onboarding](../onboarding-profile/spec.md), [tolerancia](../49-tolerancia-cumplido/spec.md) | Must |
| R2 | **Diario.** El usuario registra comidas (receta con raciones, alimento por gramos o unidades, producto por código de barras, comida a mano, reciente o favorito), edita los gramos, copia un día a otra fecha, registra agua y fibra, y ve el progreso del día, la gráfica semanal con los días que cumplen y las medias de adherencia. Specs: [raciones](../raciones/spec.md), [registro rápido](../12-registro-rapido/spec.md), [alimentos](../13-base-alimentos/spec.md), [código de barras](../14-escaner-codigo-barras/spec.md), [favoritos](../55-mis-alimentos/spec.md), [editar gramos](../57-editar-gramos-diario/spec.md), [copiar día](../54-copiar-diario/spec.md), [agua y fibra](../23-agua-fibra-micros/spec.md), [medias](../11-medias-adherencia/spec.md), [días que cumplen](../50-marcar-dias-cumplen/spec.md) | Must |
| R3 | **Plan semanal.** El usuario planifica cada franja de cada día con raciones, navega entre semanas, copia la semana anterior, la rellena con IA según sus macros, ve los macros de cada día frente al objetivo y registra en el Diario lo planificado con un toque. Specs: [macros](../10-macros-plan/spec.md), [raciones](../29-raciones-plan/spec.md), [semanas](../78-plan-navegar-semanas/spec.md), [copiar semana](../53-copiar-semana-anterior/spec.md), [rellenar con IA](../15-autocompletar-semana-ia/spec.md), [del Plan al Diario](../diario-desde-plan/spec.md), [sobras y batch cooking](../17-sobras-batch-cooking/spec.md) | Must |
| R4 | **Lista de la compra.** Se genera a partir del Plan, descontando lo que hay en la Despensa, y lo comprado pasa a la Despensa. Spec: [lista de la compra](../lista-compra/spec.md) | Must |
| R5 | **Recetas.** Recetario en español con búsqueda, filtros, orden, favoritos y valoración 1–5; aviso de alérgenos; recetas propias; importación desde URL; generación con IA según perfil y despensa; frutas y verduras de temporada. Specs: [propias](../18-recetas-propias/spec.md), [importar URL](../19-importar-receta-url/spec.md), [favoritos](../20-recetas-filtros/spec.md), [valoración y filtros](../111-recetas-valoracion-filtros/spec.md), [selector](../combobox-recetas/spec.md), [temporada](../34-temporada/spec.md), [almacenamiento](../recetas-almacenamiento/spec.md) | Must |
| R6 | **Despensa.** Inventario por categoría con avisos de «caduca pronto» y «caducado», sugerencias de recetas para lo que caduca y escaneo del ticket de compra. Specs: [despensa → recetas](../16-despensa-recetas/spec.md), [escanear ticket](../67-escanear-ticket/spec.md) | Must |
| R7 | **Seguimiento corporal.** Historial de peso y medidas con gráfica. Spec: [historial de medidas](../9-historial-medidas/spec.md) | Must |
| R8 | **Datos y sincronización.** Los datos se guardan en el dispositivo, se sincronizan entre dispositivos de la misma cuenta y se pueden exportar e importar en JSON. Specs: [sincronización](../22-sincronizacion-dispositivos/spec.md), [copia de seguridad](../backup-datos/spec.md) | Must |
| R9 | **PWA.** La app se instala desde el navegador y abre sin conexión con los datos del dispositivo; lo que necesita red avisa. Spec: [PWA](../21-pwa-recordatorios/spec.md) | Must |

### Visión: abrir el producto
| ID | Requirement | Priority |
|---|---|---|
| R10 | **Registro abierto.** Cualquiera puede crear una cuenta sin código de invitación. | Should |
| R11 | **Recuperar la contraseña** ([#114](https://github.com/mancabcar/MealPlan/issues/114)). | Should |
| R12 | **Borrar la cuenta.** El usuario puede borrar su cuenta y todos sus datos del servidor. | Should |
| R13 | **Privacidad y datos de salud.** Hay política de privacidad y el usuario da su consentimiento explícito antes de guardar datos de salud (dieta, peso, medidas, alergias), que el RGPD trata como categoría especial. | Should |
| R14 | **Límites de IA por usuario.** Los usuarios gratis no tienen IA. Los de pago tienen un límite mensual de usos de IA, para que el coste por usuario esté acotado. | Should |
| R15 | **Freemium.** El núcleo (Diario, Plan, Compra, Despensa, Recetas sin IA, Perfil y la sincronización entre dispositivos) es gratis. Las funciones con coste por uso (generar recetas con IA, rellenar la semana con IA, escanear el ticket, importar una receta cuando hace falta la IA) son de pago. El pago es una suscripción mensual o anual (importes iniciales: 3,99 €/mes o 29,99 €/año) con 7 días de prueba gratis. | Should |
| R16 | **Sincronización robusta.** Cambios sin conexión en cola, fusión por fila y aviso de conflictos ([#112](https://github.com/mancabcar/MealPlan/issues/112)); endurecimiento ([#101](https://github.com/mancabcar/MealPlan/issues/101)); timeout del sondeo ([#99](https://github.com/mancabcar/MealPlan/issues/99)). | Should |
| R17 | **Instalación y offline fiables.** Service worker robusto ([#94](https://github.com/mancabcar/MealPlan/issues/94)); el escáner no depende de un CDN ([#93](https://github.com/mancabcar/MealPlan/issues/93)); la barra de estado del iPhone no tapa la cabecera ([#96](https://github.com/mancabcar/MealPlan/issues/96)). | Should |
| R18 | **Avisos.** Recordatorios opcionales de comidas y caducidades ([#110](https://github.com/mancabcar/MealPlan/issues/110)). | Should |
| R19 | **«Tirado».** Al quitar algo de la Despensa, el usuario indica si se consumió o se tiró. | Should |
| R20 | **Inglés.** Todo el producto (interfaz, recetas semilla, nombres de alimentos, temporada) está en inglés además de en español, y el usuario elige idioma. | Should |
| R21 | **Unidades imperiales.** El usuario puede elegir unidades imperiales (oz, lb, fl oz) para pesos, cantidades y medidas corporales. | Should |
| R22 | **Apps en las tiendas.** Apps de iOS y Android publicadas en App Store y Google Play con las mismas funciones que la web, con la misma cuenta y los mismos datos. | Should |
| R23 | **Métricas en el servidor.** Las métricas de éxito se recogen en el servidor, agregadas entre usuarios, solo de quien da un consentimiento de analítica propio, aparte del de datos de salud (R13). | Should |
| R24 | Azúcar y sodio opcionales en el Diario ([#124](https://github.com/mancabcar/MealPlan/issues/124)). | Could |
| R25 | Combinar varios alimentos por gramos en un plato ([#56](https://github.com/mancabcar/MealPlan/issues/56)). | Could |
| R26 | Selector único con autocompletado sobre recetas y comidas guardadas ([#113](https://github.com/mancabcar/MealPlan/issues/113)). | Could |
| R27 | Diario: repetir una entrada suelta ([#154](https://github.com/mancabcar/MealPlan/issues/154)) y deshacer la copia de un día ([#155](https://github.com/mancabcar/MealPlan/issues/155)). | Could |
| R28 | Recientes ordenados por frecuencia en la franja ([#158](https://github.com/mancabcar/MealPlan/issues/158)). | Could |
| R29 | Plan: deslizar para cambiar de semana ([#107](https://github.com/mancabcar/MealPlan/issues/107)). | Could |
| R30 | Despensa → recetas: «caduca en X días» en la tarjeta ([#72](https://github.com/mancabcar/MealPlan/issues/72), PR #187 revisada). | Could |
| R31 | **Vista para nutricionistas.** Un nutricionista ve la adherencia de sus clientes. Cómo se vinculan y qué datos ve se define en su propia spec. | Could |

### Orden de entrega de los `Should`
1. **Antes de abrir:** R13 privacidad, R12 borrar la cuenta, R14 límites de IA, R11 recuperar la contraseña, R16–R17 fiabilidad.
2. **Abrir:** R10 registro abierto, R15 freemium, R19 «Tirado», R23 métricas.
3. **Alcance:** R20 inglés, R21 unidades imperiales, R22 apps en las tiendas, R18 avisos.

## User flows
1. **Planificar la semana (R3, R4):** Plan → elegir semana → rellenar franjas (a mano, «Copiar semana anterior» o «Rellenar semana») → revisar macros por día → «Lista de la compra».
2. **Comprar (R4, R6):** Compra → marcar lo comprado → pasar a la Despensa, o Despensa → «Escanear ticket» → revisar y guardar.
3. **Registrar (R2, R3):** Diario → «Añadir comida» → Recientes / Favoritos / Receta / Alimento / Código de barras / A mano; o Plan → registrar la franja con un toque.
4. **Revisar (R2, R7):** Diario → gráfica semanal y medias; Perfil → historial de medidas.
5. **(Visión) Primera vez desde la tienda (R10, R13, R20–R22):** instalar → elegir idioma y unidades → registrarse → consentir el tratamiento de datos de salud → onboarding → usar el núcleo gratis.
6. **(Visión) Pasar a pago (R14, R15):** pulsar una función de IA sin plan de pago → ver qué incluye el pago → pagar → la función se ejecuta.

## Acceptance criteria
Los criterios de R1–R9 están en la spec de cada feature. Los de R10–R31 se cierran en la spec propia de cada uno. Aquí solo va lo que este PRD ya fija.

**R10**
- Dado que no tengo cuenta, cuando me registro, entonces no se me pide ningún código de invitación.

**R12**
- Dado que borro mi cuenta, cuando termina el borrado, entonces el servidor no guarda ningún dato asociado a ella y no puedo volver a entrar con esas credenciales.

**R13**
- Dado que me registro, cuando aún no he dado el consentimiento para datos de salud, entonces la app no envía al servidor peso, medidas, dieta ni alergias.
- La política de privacidad es accesible antes de registrarse y desde Perfil.

**R14**
- Dado un usuario de pago que ha llegado a su límite mensual de IA, cuando pulsa una función de IA, entonces no se hace la llamada y ve cuándo vuelve a tener uso disponible.

**R15**
- Dado un usuario sin plan de pago, todas las funciones de R1–R9 que no usan IA, incluida la sincronización, funcionan igual que hoy.
- Dado un usuario sin plan de pago, cuando pulsa una función de IA, entonces ve qué incluye el pago y la prueba de 7 días en lugar de ejecutarla.
- Dado un usuario en la prueba gratis, tiene las mismas funciones que uno de pago hasta que acaba la prueba.

**R23**
- Dado un usuario que no ha dado el consentimiento de analítica, el servidor no recoge métricas de uso suyas, aunque sí haya dado el de datos de salud.

**R19**
- Dado un ítem de la Despensa, cuando lo quito, entonces elijo «Consumido» o «Tirado», y la elección queda guardada con la fecha.

**R20**
- Con el idioma en inglés, ninguna pantalla, receta semilla, alimento ni producto de temporada muestra texto en español.
- Los datos que crea el usuario (recetas propias, comidas a mano) no se traducen.

**R21**
- Con unidades imperiales, todo peso, cantidad y medida corporal se muestra y se introduce en unidades imperiales, y los macros calculados son los mismos que con el equivalente métrico.

**R22**
- Cada función de R1–R9 está disponible en las apps de iOS y Android.
- Un cambio hecho en la app nativa aparece en la web de la misma cuenta, y al revés.

## Edge cases
- **Usuarios actuales al abrir el registro (R10):** las cuentas creadas con invitación siguen funcionando sin cambios.
- **Datos locales sin consentimiento (R13):** un usuario actual que aún no ha consentido conserva sus datos en el dispositivo.
- **Límite de IA alcanzado a mitad de una acción (R14):** «Rellenar semana» no deja la semana a medias.
- **Cambio de idioma con datos ya guardados (R20):** las entradas del Diario que vienen de recetas o alimentos semilla se muestran en el idioma elegido.
- **Cambio de unidades (R21):** no cambia ningún valor guardado, solo cómo se muestra y se introduce.
- **Ítems de la Despensa quitados antes de R19:** no cuentan ni como consumidos ni como tirados en la métrica de desperdicio.

## Success metrics
Las cifras objetivo las ha fijado Claude a petición del dueño del producto `(delegated to Claude)` y se revisan cuando haya línea base. Solo cuentan los usuarios con consentimiento de analítica (R23).

| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Días registrados por semana (mediana por usuario activo) | TBD | ≥ 5 de 7 | Días con al menos una entrada en el Diario, en el servidor (R23) |
| Días dentro de objetivo (sobre los días registrados) | TBD | ≥ 60 % | Días que cumplen según la tolerancia de cada usuario (R1), en el servidor |
| Semana planificada de antemano | TBD | ≥ 50 % de las franjas planificadas antes del lunes | Franjas del Plan con algo asignado al empezar la semana, en el servidor |
| Comida tirada en la Despensa | TBD | ≤ 10 % de los ítems quitados | Ítems marcados «Tirado» sobre el total quitado (R19), en el servidor |

## Risks & dependencies
- **RGPD y datos de salud:** son categoría especial. Abrir el registro (R10) y recoger métricas en el servidor (R23) dependen de R13. Conviene asesoría legal antes de abrir.
- **Coste de la IA:** con registro abierto el gasto en la API de Claude crece con los usuarios. R10 depende de R14.
- **Tiendas de apps:** Apple cobra comisión por pagos dentro de la app y revisa las apps de salud con más cuidado. R15 y R22 se condicionan entre sí.
- **Traducción del contenido (R20):** los alimentos vienen de CIQUAL, USDA y Open Food Facts; los productos de marca de Open Food Facts no siempre tienen nombre en los dos idiomas.
- **Arquitectura actual:** la app web es estática y el servidor tiene pocas rutas; cuentas, pagos y métricas añaden carga al servidor (Vercel + Neon). Lo evalúa la tech design de cada requisito.
- **Sin línea base:** las métricas no se pueden comparar hasta que R19 y R23 estén en producción.
- **Sesgo de las métricas:** al contar solo a quien consiente la analítica (R23), las cifras pueden salir mejores que las del conjunto de usuarios.

## Open questions
- [ ] ¿Cuántos usos de IA al mes incluye el plan de pago (R14), y cuenta igual una receta que rellenar la semana? (dueño del producto, con el coste real por llamada)
- [ ] ¿Se mantienen los importes de R15 en las tiendas, donde Apple y Google se quedan una comisión? (dueño del producto)

## Appendix: mantenimiento fuera de la tabla
Issues abiertos de limpieza, tests o rendimiento que no cambian el comportamiento del producto: [#73](https://github.com/mancabcar/MealPlan/issues/73), [#74](https://github.com/mancabcar/MealPlan/issues/74), [#75](https://github.com/mancabcar/MealPlan/issues/75), [#76](https://github.com/mancabcar/MealPlan/issues/76), [#95](https://github.com/mancabcar/MealPlan/issues/95), [#105](https://github.com/mancabcar/MealPlan/issues/105), [#115](https://github.com/mancabcar/MealPlan/issues/115), [#117](https://github.com/mancabcar/MealPlan/issues/117), [#125](https://github.com/mancabcar/MealPlan/issues/125), [#128](https://github.com/mancabcar/MealPlan/issues/128), [#161](https://github.com/mancabcar/MealPlan/issues/161), [#163](https://github.com/mancabcar/MealPlan/issues/163).
