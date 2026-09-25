# Copia de seguridad de mis datos: Spec
_Status: Approved · Owner: Manuel · Updated: 2026-09-24_
_Related: [brief](brief.md) · [issue #8](https://github.com/mancabcar/MealPlan/issues/8)_

## TL;DR
Todos los datos de la app viven solo en el `localStorage` de un navegador, así que borrarlo o cambiar de dispositivo los pierde. Añadimos a Perfil "Exportar mis datos", que descarga un `.json` con todo lo del usuario, e "Importar datos", que pide confirmación y sustituye los datos actuales por los del fichero. Sabremos que funciona cuando exportar en un navegador e importar en otro deje la app idéntica y un fichero malo no toque nada.

## Problema
Manuel usa la app a diario (diario, plan semanal, despensa, recetas generadas con IA). No hay backend: cada dato está en `localStorage` bajo `mp_<userId>_<dato>`. Si limpia los datos del navegador, cambia de ordenador o el navegador desaloja el almacenamiento, pierde meses de diario y todas las recetas generadas, sin forma de recuperarlos. Hoy no hay ninguna alternativa, salvo copiar claves a mano desde las DevTools.

## Objetivos
- Sacar una copia completa de los datos del usuario a un fichero que controla él.
- Restaurar esa copia en cualquier navegador (el mismo u otro) y dejar la app exactamente como estaba.
- Que un fichero equivocado o roto nunca estropee los datos actuales.

## Fuera de alcance
- **Sincronización automática o en la nube**, y copias programadas: solo exportación e importación manuales.
- **Fusionar** el fichero con los datos actuales: importar **sustituye** todo.
- **Credenciales y sesión**: no se exportan ni se importan cuentas, contraseñas (hash y sal), la sesión ni los usuarios recordados. Se importa siempre en la cuenta con la que se ha entrado.
- **Importar solo una parte** (p. ej. solo las recetas).
- Las copias internas de migración (`*_v1_backup`).
- Cifrar el fichero o protegerlo con contraseña.

## Usuarios y escenarios clave
Manuel, el único usuario, con una cuenta local.
1. **Copia de seguridad:** en Perfil pulsa "Exportar mis datos" y guarda el fichero.
2. **Cambio de navegador:** en un navegador nuevo crea una cuenta (con cualquier nombre), completa u omite el onboarding, va a Perfil, importa el fichero y ve su diario, plan, despensa, recetas y perfil tal como estaban.
3. **Me equivoco de fichero:** importa un `.json` que no es una copia de la app (o está cortado). Ve un error y sus datos siguen intactos.
4. **Copia antigua:** importa un fichero exportado cuando su perfil aún era v1 (o con comidas "Snack"). Todo se migra igual que al cargar datos guardados.

## Requisitos
| ID | Requisito | Prioridad |
|---|---|---|
| R1 | En Perfil, "Exportar mis datos" descarga un fichero `.json` llamado `mealplan-backup-AAAA-MM-DD.json` (fecha local del día). | Must |
| R2 | El fichero contiene los datos del usuario con sesión iniciada: perfil, recetas, diario, despensa, plan semanal y estado de la lista de la compra, tal como están guardados. | Must |
| R3 | El fichero incluye un identificador de la app, un `schemaVersion` del formato de copia (empieza en 1) y la fecha de exportación. | Must |
| R4 | El fichero no contiene nada de las credenciales ni de la sesión: ni hash, ni sal, ni id de cuenta, ni nombre de usuario, ni usuarios recordados. | Must |
| R5 | En Perfil, "Importar datos" deja elegir un fichero `.json`. Antes de cambiar nada, pide confirmación y avisa de que sustituirá **todos** los datos actuales (con la fecha de exportación del fichero). | Must |
| R6 | Si se confirma, los datos actuales del usuario se sustituyen por los del fichero y la app muestra los datos importados sin tener que recargar ni volver a iniciar sesión. Se muestra un mensaje de éxito. | Must |
| R7 | Los datos importados pasan por las mismas migraciones y normalizaciones que al cargar datos guardados (perfil v1→v2, "Snack"→"Merienda" en diario y plan, estado de la compra, siembra de recetas). | Must |
| R8 | Si el fichero no es JSON, no es una copia de esta app, tiene un `schemaVersion` que la app no conoce o algún dato no tiene la forma esperada, se muestra un error y **no se modifica ningún dato**. Todo o nada. | Must |
| R9 | Si se cancela la confirmación, no cambia nada. | Must |
| R10 | Exportar y después importar (en el mismo navegador o en otro) deja la app idéntica: mismos datos en todas las pantallas. | Must |
| R11 | Perfil muestra, junto a los botones, una línea que explica que los datos solo viven en este navegador y conviene exportarlos de vez en cuando. | Should |

## Flujos
**Exportar**
1. Perfil → sección "Tus datos" → "Exportar mis datos".
2. El navegador descarga `mealplan-backup-2026-09-24.json`.

**Importar**
1. Perfil → "Tus datos" → "Importar datos" → selector de ficheros.
2. La app lee y valida el fichero. Si no es válido, error en la sección y fin (R8).
3. Confirmación: "¿Sustituir todos tus datos por la copia del 24/09/2026? Lo que tengas ahora se perderá."
4. Aceptar → datos sustituidos, mensaje "Datos importados" y la app ya los muestra. Cancelar → nada cambia.

## Criterios de aceptación
**R1–R4**
- Dada una sesión con perfil, recetas, diario, despensa, plan y lista de la compra, cuando pulso "Exportar mis datos", entonces se descarga `mealplan-backup-<fecha de hoy>.json`, que contiene esos seis datos, un identificador de la app, `schemaVersion: 1` y `exportedAt`.
- El fichero no contiene las cadenas del hash ni de la sal de la cuenta, ni el id de usuario, ni el nombre de usuario.
- Los datos de otro usuario del mismo navegador no aparecen en el fichero.

**R5, R6, R9, R10**
- Dado un fichero exportado desde la cuenta A, cuando entro con una cuenta B vacía (en otro navegador o en otro perfil del mismo), importo y confirmo, entonces el Diario, el Plan, la Despensa, las Recetas, la Lista de la compra y el Perfil muestran lo mismo que en A, sin recargar.
- Dado el mismo fichero, cuando cancelo la confirmación, entonces los datos de B no cambian.
- Tras importar, recargar la página sigue mostrando los datos importados.

**R7**
- Dado un fichero cuyo perfil no tiene `schemaVersion` (v1, con `dietaryRestrictions: ["Vegetariano", "Sin gluten"]`) y entradas con `mealType: "Snack"`, cuando lo importo, entonces el perfil queda en v2 con dieta vegetariana y alergia al gluten, y las entradas aparecen en "Merienda".

**R8**
- Dado un fichero que no es JSON, un JSON sin el identificador de la app, un `schemaVersion` mayor que el conocido o `entries` que no es una lista, cuando lo importo, entonces se muestra un error que explica el motivo, no aparece la confirmación y todas las claves `mp_<userId>_*` quedan byte a byte iguales.

## Casos límite
- **Usuario sin perfil:** Perfil no se muestra sin perfil, así que no se puede exportar desde ahí. Un fichero con `profile: null` es válido: tras importarlo, la app lleva al onboarding.
- **Secciones ausentes** en el fichero (p. ej. una copia sin `shopping`): se tratan como vacías. Una sección presente pero con un tipo equivocado invalida el fichero (R8).
- **Recetas de ejemplo:** la siembra vuelve a añadir las de `recipes.json` que falten, igual que al cargar. Una copia que las contiene no las duplica.
- **Fichero grande** (años de diario): sin límite propio; manda la cuota de `localStorage`. Si la escritura falla por cuota, error y datos intactos (R8).
- **Otras cuentas del mismo navegador:** no se tocan.
- **Fichero de una versión más nueva de la app** (`schemaVersion` mayor): se rechaza con un mensaje que lo dice.

## Riesgos y dependencias
- **Todo o nada** con seis claves de `localStorage` separadas: hay que validar y migrar todo antes de escribir la primera clave. Si una escritura falla a mitad, hay que volver a los valores anteriores.
- **Refrescar el estado en memoria:** `AppProvider` lee `localStorage` una sola vez al montarse. Tras importar, el estado de React tiene que reflejar los datos nuevos sin recargar (R6).
- Futuras versiones de datos tienen que seguir entrando por las migraciones del store para que las copias viejas sigan siendo importables.

## Decisiones (Manuel, 2026-09-24)
- La copia incluye el estado de la lista de la compra (`shopping`) (R2).
- En esta versión no se exporta automáticamente una copia de los datos actuales antes de importar. Basta con la confirmación.
