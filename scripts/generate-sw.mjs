// Genera out/sw.js tras `next build` (issue #21, docs/pm/21-pwa-recordatorios/tech.md): lista todo lo que ha
// exportado Next, calcula una versión a partir de su contenido y la inyecta en scripts/sw.template.js.
// Se encadena al script `build`, que es lo que ejecuta IONOS Deploy Now.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Rutas de `out/` (relativas, con "/") → URLs a precachear. Excluye `sw.js` y los `.map`. */
export function collectPrecacheUrls(files) {
  return files
    .filter((file) => file !== "sw.js" && !file.endsWith(".map"))
    .map((file) => {
      if (file === "index.html") return "/";
      if (file.endsWith("/index.html")) return "/" + file.slice(0, -"index.html".length);
      return "/" + file;
    });
}

/** Hash estable del contenido del build (ruta → contenido), independiente del orden. */
export function buildVersion(files) {
  const hash = createHash("sha256");
  for (const path of Object.keys(files).sort()) {
    hash.update(path).update("\0").update(files[path]).update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

/** Sustituye `__SW_VERSION__` y `__SW_PRECACHE__` de la plantilla. */
export function renderSw(template, { version, urls }) {
  return template.split("__SW_VERSION__").join(version).split("__SW_PRECACHE__").join(JSON.stringify(urls));
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
  );
  return nested.flat();
}

async function main() {
  const out = fileURLToPath(new URL("../out/", import.meta.url));
  const files = (await listFiles(out)).map((file) => relative(out, file).split(sep).join("/"));
  const contents = {};
  for (const file of files) if (file !== "sw.js") contents[file] = await readFile(join(out, file));

  const urls = collectPrecacheUrls(files);
  const version = buildVersion(contents);
  const template = await readFile(new URL("./sw.template.js", import.meta.url), "utf8");
  await writeFile(join(out, "sw.js"), renderSw(template, { version, urls }));
  console.log(`sw.js: versión ${version}, ${urls.length} ficheros en el precache`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
