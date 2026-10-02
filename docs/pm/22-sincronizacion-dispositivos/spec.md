# Sincronización entre dispositivos: Spec
_Status: Draft · Owner: Manuel · Updated: 2026-10-02_
_Related: [brief](brief.md) · [issue #22](https://github.com/mancabcar/MealPlan/issues/22) · relacionado: #66_

## TL;DR
Las cuentas y los datos viven en el `localStorage` de cada navegador, así que el móvil y el PC no comparten nada y borrar el navegador los pierde. Construimos cuentas reales en el servidor (`server/` de Vercel) y sincronizamos las 7 claves de datos como bloques JSON donde gana la última escritura, con refresco casi en vivo y migración automática de lo local. Sabremos que funciona cuando un cambio en un dispositivo aparezca en otro en ≤ 30 s, la migración no pierda nada y el coste sea 0 €/mes.

## Problem
Manuel (único usuario) necesita usar la app en el súper, la cocina o el móvil con los mismos datos que en el PC. Hoy el usuario creado en un navegador no existe en otro, y borrar los datos del navegador (o que iOS purgue `localStorage`) los pierde. La única salida es exportar/importar el JSON de `backup.ts` a mano, sin que se mantenga sincronizado. Esta spec unifica #22 (sincronización) y #66 (riesgo de pérdida de datos).

## Goals
- Entrar en el móvil con mi cuenta y ver mis datos.
- Un cambio en un dispositivo aparece en el otro en segundos.
- Migrar los datos locales existentes sin pérdida.
- No perder datos aunque borre el navegador.

## Non-goals
- **Cola de cambios offline y editar sin red con sincronización posterior completa** (segunda entrega). La v1 sigue con la copia local si no hay red, pero no garantiza sincronizar ediciones concurrentes.
- Merge por fila (dirección B) y avisos de conflicto.
- Websockets / tiempo real.
- Recuperación de contraseña por email, login con Google o enlace mágico.
- Cifrado extremo a extremo.
- Varios usuarios reales, compartir datos entre cuentas.
- Sincronizar el catálogo de recetas del bundle (solo las recetas del usuario).
- Migrar el hash de contraseña de las cuentas locales.

## Users & key scenarios
Manuel, único usuario real, con PC y móvil.
1. **Primer día:** en el PC, con datos locales, se registra en el servidor; sus datos se suben solos.
2. **Dispositivo nuevo:** en el móvil inicia sesión y ve su perfil, diario, plan, despensa, recetas, compra y medidas.
3. **Uso diario:** apunta una comida en el móvil; al volver a la pestaña del PC, o en unos segundos, aparece.
4. **Sin red:** en el súper no hay cobertura; la app sigue mostrando lo último y avisa de que no está sincronizada; al volver la red se pone al día.
5. **Dispositivo con datos viejos:** inicia sesión en un navegador con datos locales y el servidor ya tiene datos; elige conscientemente sustituir lo local.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El usuario puede registrarse e iniciar sesión con usuario y contraseña contra el servidor; la contraseña se hashea en el servidor. | Must |
| R2 | La sesión persiste entre visitas y viaja como token en cabecera (IONOS y Vercel son orígenes distintos); el usuario puede cerrar sesión. | Must |
| R3 | Las 7 claves de datos (perfil, recetas del usuario, diario, despensa, plan, lista de la compra, medidas) se guardan en el servidor como un bloque JSON cada una, con versión asignada por el servidor. | Must |
| R4 | Cada cambio local se sube al servidor; si hay conflicto en una clave, gana la última escritura según la marca del servidor. | Must |
| R5 | Los cambios hechos en otro dispositivo se descargan al volver a la pestaña y por polling periódico. | Must |
| R6 | Primer login con el servidor vacío: los datos locales del usuario se suben automáticamente, sin pérdida. | Must |
| R7 | Primer login con datos locales y en el servidor: gana el servidor, tras pedir confirmación y ofrecer descargar antes un backup JSON de lo local. | Must |
| R8 | Si no hay conexión o el servidor falla, la app sigue funcionando con la copia local y avisa de que no está sincronizada; al recuperar la conexión no pisa cambios más nuevos del servidor. | Must |
| R9 | Los datos de un usuario solo son accesibles con su sesión; los datos viajan por HTTPS. | Must |
| R10 | Un indicador sencillo muestra el estado (al día / sin sincronizar). | Should |
| R11 | Exportar/importar JSON sigue funcionando y lo importado se sincroniza. | Should |
| R12 | Al cerrar sesión se limpia la copia local de ese usuario en el dispositivo. | Could |

## User flows
**Registro con datos locales (R1, R6)**
1. Pantalla de login → Registrarse con usuario y contraseña.
2. El servidor crea la cuenta y está vacío; la app sube las 7 claves locales.
3. La app entra y muestra los mismos datos.

**Dispositivo nuevo (R1, R5)**
1. Login con usuario y contraseña → el servidor devuelve token.
2. La app descarga las 7 claves y las muestra.

**Datos en ambos lados (R7)**
1. Login → la app detecta datos locales y en servidor.
2. Aviso: «Este dispositivo tiene datos locales. Se sustituirán por los de tu cuenta.» Opción de descargar backup JSON; Aceptar / Cancelar.
3. Aceptar → datos del servidor; Cancelar → no se inicia sesión y lo local no cambia.

**Cambio en otro dispositivo (R4, R5)**
1. Se edita en el móvil → se sube.
2. El PC, al recuperar el foco o en el siguiente polling, descarga la clave nueva y la muestra.

## Acceptance criteria
**R1, R2**
- Dado un usuario nuevo, cuando se registra con usuario y contraseña válidos, entonces existe en el servidor y entra sin pasar por el almacén local de cuentas.
- Dado usuario y contraseña incorrectos, cuando intenta entrar, entonces ve un error y no hay sesión.
- Dada una sesión iniciada, cuando recarga la página, entonces sigue dentro; cuando cierra sesión, entonces el token deja de valer.
- La contraseña nunca se guarda ni se envía en claro tras el registro/login (solo por HTTPS) y el servidor guarda solo su hash.

**R3, R4**
- Dado un cambio en cualquiera de las 7 claves, entonces el servidor tiene ese valor tras la subida y su versión aumenta.
- Dadas dos escrituras a la misma clave desde dos dispositivos, entonces queda la que el servidor recibe última.

**R5**
- Dado un cambio hecho en el dispositivo A, cuando el B está abierto, entonces B lo muestra en ≤ 30 s o al recuperar el foco, sin recargar manualmente.

**R6**
- Dado un servidor vacío y datos locales, cuando el usuario se registra/inicia sesión, entonces las 7 claves del servidor son idénticas a las locales y nada se borra localmente.

**R7**
- Dados datos en ambos lados, cuando inicia sesión, entonces se pide confirmación antes de cambiar nada; si cancela, lo local queda intacto; si acepta, la app muestra los datos del servidor.

**R8**
- Dado que el servidor no responde, cuando el usuario edita o navega, entonces la app funciona con la copia local y muestra «sin sincronizar».
- Dada la conexión recuperada y un servidor con cambios más nuevos que los locales, entonces los cambios del servidor no se pierden.

**R9**
- Dada la sesión del usuario A, cuando pide datos del usuario B, entonces recibe un error de autorización.

**R10, R11**
- Cuando todo está subido, entonces el indicador muestra «al día»; cuando falla la subida, «sin sincronizar».
- Dado un backup importado, entonces las 7 claves se suben al servidor.

## Edge cases
- Cuenta local existente (`mp_users`) y registro con el mismo nombre en el servidor: nombre ya tomado → error claro.
- Datos locales corruptos o con migración pendiente: se aplican las migraciones antes de subir.
- Servidor vacío y sin datos locales: se entra con perfil vacío (onboarding).
- Sesión caducada o token inválido: pedir login sin perder la copia local.
- Dos pestañas del mismo navegador a la vez: no deben subir datos viejos encima de los nuevos.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Cambio visible en otro dispositivo | n/a (hoy no sincroniza) | ≤ 30 s con la pestaña activa | Prueba manual PC↔móvil |
| Pérdidas de datos en la migración | n/a | 0 (7 claves idénticas) | Comparar local y servidor tras migrar |
| Coste mensual | 0 € | 0 € | Capa gratuita del proveedor |

## Risks & dependencies
- Editar el mismo dato en dos dispositivos casi a la vez pierde una edición (última escritura gana); si molesta se pasa a la dirección B.
- Proveedor de base de datos y su capa gratuita (límites, latencia, pausas por inactividad).
- Token en cabecera entre orígenes distintos (IONOS ↔ Vercel) y CORS.
- Datos de salud sin cifrado extremo a extremo.
- Depende de #8 (formato de backup JSON, ya hecho) y del `server/` de Vercel.

## Open questions
- [ ] Proveedor de base de datos y de autenticación (Neon, Vercel Postgres, Supabase): capa gratuita, latencia, límites (tech design).
- [ ] Cómo se almacena la sesión en el navegador (token) y su caducidad (tech design).
- [ ] Intervalo de polling concreto para cumplir ≤ 30 s sin pasar los límites gratuitos (tech design).
- [ ] ¿Se mantiene la pantalla de usuarios recordados o se sustituye por el login único? (Manuel)
