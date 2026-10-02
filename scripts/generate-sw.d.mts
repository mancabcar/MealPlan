// Contrato de scripts/generate-sw.mjs (docs/pm/21-pwa-recordatorios/tech.md). La implementación llega con dev-code.
/** Rutas de `out/` (relativas, con "/") → URLs a precachear. Excluye `sw.js` y los `.map`. */
export function collectPrecacheUrls(files: string[]): string[];
/** Hash estable del contenido del build (ruta → contenido), independiente del orden. */
export function buildVersion(files: Record<string, string | Uint8Array>): string;
/** Sustituye `__SW_VERSION__` y `__SW_PRECACHE__` de la plantilla. */
export function renderSw(template: string, opts: { version: string; urls: string[] }): string;
