# Copia de seguridad de mis datos: Review
_PR: [#32](https://github.com/mancabcar/MealPlan/pull/32) · Revisado: 2026-09-24 · Veredicto: ✅ approved_

## Resumen
El PR construye los once requisitos (10 Must y 1 Should) como describe tech.md: un registro compartido de las seis claves y sus migraciones (`src/lib/userData.ts`) que usan tanto `AppProvider` como la importación, un módulo puro `src/lib/backup.ts` que construye, valida y migra la copia entera en memoria y la escribe con vuelta atrás, `importData` en el store que relee las seis claves sin recargar, y la sección "Tus datos" en Perfil. Cada requisito y cada criterio de aceptación tiene test automático (unit y e2e). En la cabeza del PR (`a43a880`) están en verde los unit (451/451), los e2e (154/154), typecheck y lint. No hay nada bloqueante. Los hallazgos son de robustez frente a ficheros editados a mano, que el tech design ya aceptó validar solo con una forma mínima.

## Conformidad con el spec
| Req | Estado | Dónde | Test |
|---|---|---|---|
| R1 (Must) | ✅ Hecho | `backupFileName` con `todayStr()` (`src/lib/backup.ts:21`); descarga con `Blob` y `<a download>` (`src/components/perfil/DataSection.tsx:17`, botón `:78`) | ✅ unit + e2e (`suggestedFilename`) |
| R2 (Must) | ✅ Hecho | `buildBackup` lee las seis claves tal cual, `shopping` incluido (`src/lib/backup.ts:29`) | ✅ unit + e2e (igual a lo guardado, Brócoli marcado) |
| R3 (Must) | ✅ Hecho | `app: "mealplan"`, `schemaVersion: 1`, `exportedAt` ISO (`src/lib/backup.ts:7`–`9`, `:40`) | ✅ unit + e2e |
| R4 (Must) | ✅ Hecho | solo lee `mp_<userId>_<seis claves>` y no escribe el id (`src/lib/backup.ts:29`) | ✅ unit + e2e (sin hash, sal, id, "lucia", recordados ni otra cuenta) |
| R5 (Must) | ✅ Hecho | input `.json` oculto (`DataSection.tsx:86`); `confirm` con la fecha de `exportedAt` antes de escribir (`:54`–`:56`) | ✅ unit (`formatExportDate`) + e2e (un único diálogo con "22/09/2026") |
| R6 (Must) | ✅ Hecho | `importData` escribe y relee las seis claves (`src/lib/store.tsx:93`, `reload` en `:72`); "Datos importados" (`DataSection.tsx:64`); Perfil remonta sus secciones (`src/app/perfil/page.tsx:545`) | ✅ unit (`store.test.tsx`) + e2e (cuenta A → B sin recargar y tras recargar) |
| R7 (Must) | ✅ Hecho | `parseBackup` aplica `LOAD_OPTIONS[k].upgrade` (`src/lib/backup.ts:106`–`116`), el mismo registro que `AppProvider` (`src/lib/userData.ts:47`) | ✅ unit (incluido "store y parseBackup migran igual") + e2e (v1 → Gluten/Vegetariana, Snack → Merienda) |
| R8 (Must) | ✅ Hecho | JSON → cabecera → forma por sección → migración, todo en memoria (`src/lib/backup.ts:88`); `writeUserData` restaura en orden inverso (`:127`); error de cuota en la UI (`DataSection.tsx:58`–`:62`) | ✅ unit (fallo en la 1.ª, 4.ª y 6.ª escritura) + e2e (4 ficheros malos, byte a byte igual, sin diálogo) + caso axe |
| R9 (Must) | ✅ Hecho | cancelar sale antes de `importData` (`DataSection.tsx:56`) | ✅ e2e (byte a byte igual) |
| R10 (Must) | ✅ Hecho | exportar → importar da los mismos seis valores (upgrades idempotentes) | ✅ unit (ida y vuelta, campos extra) + e2e (mismo navegador y otro contexto; dos veces seguidas) |
| R11 (Should) | ✅ Hecho | texto fijo en "Tus datos" (`DataSection.tsx:75`) | ✅ e2e |

**Casos límite:** usuario sin perfil / `profile: null` → onboarding ✅ (unit + e2e) · secciones ausentes → vacías y recetas de ejemplo re-sembradas ✅ (unit) · recetas de ejemplo sin duplicados ✅ (e2e) · fichero grande / cuota → error y datos intactos ✅ (unit; UI comprobada a mano en dev-code) · otras cuentas del navegador intactas ✅ (unit + e2e) · `schemaVersion` mayor → mensaje propio ✅ (unit + e2e).

**Alcance:** no se ha construido nada de lo que el spec deja fuera: ni sincronización, ni fusión, ni importación parcial, ni credenciales, ni `*_v1_backup`, ni cifrado, ni copia automática antes de importar. El diff solo toca el store, Perfil, los dos módulos nuevos, tests, fixtures y docs. No se ha saltado, borrado ni relajado ningún test: en `store.test.tsx` solo cambian dos líneas de imports y el resto son tests nuevos; `accessibility.spec.ts` gana un caso.

**Tech design:** se ha seguido. Las desviaciones están documentadas en el brief y son razonables: la despensa pasa por `load` con upgrade (una clave ausente se guarda como `[]`, como ya pasaba con diario y plan); sin `exportedAt` válido la confirmación dice "esta copia"; `buildBackup` omite una clave que no sea JSON legible. Las seis propuestas de tech.md › Spec feedback están implementadas tal cual. Lo que tech.md deja sin test automático (texto del error de cuota en la UI y descarte de borradores de Perfil) se comprobó a mano en dev-code.

## Bloqueantes
Ninguno.

## No bloqueantes
1. **Perfil v2 validado solo por `schemaVersion`**: `src/lib/backup.ts:64`. Un fichero editado a mano con `profile: {"schemaVersion": 2, "name": "x"}` pasa la validación (`migrateProfile` lo devuelve tal cual) y, tras importar, las pantallas que leen `profile.meals` o `profile.allergies.preset` fallan hasta limpiar `localStorage` a mano. Una copia exportada por la app nunca lo provoca, y tech.md › Spec feedback 3 aceptó una forma mínima, pero el objetivo de esa forma era "que las pantallas no se rompan" y el perfil es justo lo que más pantallas leen. → Comprobar también los campos que leen las pantallas (`meals` y `dislikedIngredients` arrays, `allergies` objeto, objetivos numéricos).
2. **Versión actual del perfil escrita a mano**: `src/lib/backup.ts:64`. El validador compara con el literal `2`, igual que `migrate.ts:41` y `types.ts:135`. Cuando llegue un perfil v3, una copia exportada por esa misma app se rechazaría como "formato no esperado" si nadie se acuerda de este literal, y el registro compartido `LOAD_OPTIONS` (R7) no lo cubre. → Una constante `PROFILE_SCHEMA_VERSION` compartida, o un test que falle si `migrateProfile` produce una versión que el validador no acepta.
3. **Error de lectura del fichero sin mensaje**: `src/components/perfil/DataSection.tsx:49`. `await file.text()` está fuera de cualquier `try`; si el fichero no se puede leer (movido o borrado tras elegirlo, `NotReadableError`), la promesa queda sin manejar y la sección no muestra nada. → Envolverlo y mostrar un error `role="alert"`.

## Hallazgos de la revisión de código
- **Validación de `mealType`**: `src/lib/backup.ts:72`. En diario y plan se acepta cualquier cadena, así que una entrada con `mealType: "Brunch"` se importa, cuenta en los totales del día y no aparece en ninguna franja del Diario (no se puede ver ni borrar). Solo con ficheros editados a mano. → Comprobar contra `MEAL_TYPES` (más "Snack", que se migra).
- **`dietaryRestrictions` de un perfil v1 que no es lista**: `src/lib/backup.ts:64`. Con `"Sin gluten"` como cadena, `migrateProfile` la recorre letra a letra y deja alergias personalizadas "S", "i", "n"… → Rechazar el perfil v1 si `dietaryRestrictions` existe y no es una lista.
- **Reutilización**: `isObject` (`src/lib/backup.ts:52`) repite el `isRecord` privado de `src/lib/shopping/state.ts`. Opcional: exportar uno solo.
- **Nota de verificación**: los e2e se ejecutaron contra el dev server de esta rama que ya estaba corriendo en el puerto 3137 (Next 16 no deja arrancar un segundo dev server en la misma carpeta), con una configuración temporal que solo cambia `baseURL`.
