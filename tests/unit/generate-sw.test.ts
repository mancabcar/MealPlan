// Spec: docs/pm/21-pwa-recordatorios/spec.md › R4 (abre sin red en cualquier ruta) y R6 (versión nueva sin
// borrar caché). Diseño: tech.md › Design (scripts/generate-sw.mjs y plantilla sw.js).
import { describe, expect, it } from "vitest";
import { buildVersion, collectPrecacheUrls, renderSw } from "../../scripts/generate-sw.mjs";

const OUT = [
  "index.html",
  "index.txt",
  "plan/index.html",
  "plan/compra/index.html",
  "recetas/index.html",
  "_next/static/chunks/app-1a2b3c.js",
  "_next/static/media/manrope-4d5e.woff2",
  "_next/static/chunks/app-1a2b3c.js.map",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "favicon.ico",
  "sw.js",
];

describe("R4: lista de precache", () => {
  const urls = collectPrecacheUrls(OUT);

  it("cada página del export se precachea con la barra final (trailingSlash)", () => {
    expect(urls).toEqual(expect.arrayContaining(["/", "/plan/", "/plan/compra/", "/recetas/"]));
  });

  it("incluye los assets con hash, el manifest y los iconos", () => {
    expect(urls).toEqual(
      expect.arrayContaining([
        "/_next/static/chunks/app-1a2b3c.js",
        "/_next/static/media/manrope-4d5e.woff2",
        "/manifest.webmanifest",
        "/icons/icon-192.png",
      ]),
    );
  });

  it("incluye los payloads .txt que usa la navegación del cliente", () => {
    expect(urls).toContain("/index.txt");
  });

  it("excluye el propio sw.js y los source maps", () => {
    expect(urls).not.toContain("/sw.js");
    expect(urls.some((u) => u.endsWith(".map"))).toBe(false);
  });
});

describe("R6: versión del build", () => {
  const files = { "index.html": "<html>v1</html>", "_next/static/a.js": "console.log(1)" };

  it("es la misma para el mismo contenido, aunque cambie el orden", () => {
    const reordered = { "_next/static/a.js": "console.log(1)", "index.html": "<html>v1</html>" };
    expect(buildVersion(files)).toBe(buildVersion(reordered));
  });

  it("cambia si cambia el contenido de un fichero", () => {
    expect(buildVersion({ ...files, "index.html": "<html>v2</html>" })).not.toBe(buildVersion(files));
  });

  it("cambia si se añade un fichero", () => {
    expect(buildVersion({ ...files, "plan/index.html": "<html>plan</html>" })).not.toBe(buildVersion(files));
  });

  it("es un identificador seguro para un nombre de caché", () => {
    expect(buildVersion(files)).toMatch(/^[a-z0-9]{6,}$/);
  });
});

describe("R4/R6: plantilla del service worker", () => {
  const template = 'const VERSION = "__SW_VERSION__";\nconst PRECACHE = __SW_PRECACHE__;\n';

  it("inyecta la versión y la lista, sin dejar marcadores", () => {
    const sw = renderSw(template, { version: "abc123", urls: ["/", "/plan/"] });
    expect(sw).toContain('const VERSION = "abc123";');
    expect(sw).toContain('["/","/plan/"]');
    expect(sw).not.toContain("__SW_");
  });
});
