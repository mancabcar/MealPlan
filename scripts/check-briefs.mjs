// Valida la línea de estado de cada docs/pm/*/brief.md (formato fijado por la skill pm-pipeline).
// Uso: node scripts/check-briefs.mjs [carpeta-docs-pm]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const STATUSES = [
  "brainstorm", "prototype", "spec", "tech design", "tests", "coding",
  "in review", "merged", "shipped", "parked", "dropped",
];
export const VERDICTS = ["✅ approved", "⚠️ approved with follow-ups", "🔁 changes requested"];
const NEEDS_PR = ["in review", "merged", "shipped"];
const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const LINK = String.raw`\[#\d+\]\(https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+\)`;
const HEAD = new RegExp(String.raw`^_Status: ([a-z ]+?)(?: \((${DATE})\))?$`);
// Orden fijo de los campos tras el estado.
const FIELDS = [
  ["Updated", new RegExp(`^Updated: ${DATE}$`), true],
  ["Issue", new RegExp(String.raw`^Issue: ${LINK}(?: \(relacionado: ${LINK}\))?$`)],
  ["Prototype", /^Prototype: \[canvas\]\(https:\/\/\S+\)$/],
  ["Spec", /^Spec: \[spec\.md\]\(spec\.md\)$/],
  ["Tech", /^Tech: \[tech\.md\]\(tech\.md\)$/],
  ["PR", new RegExp(`^PR: ${LINK}(?:, ${LINK})*$`)],
  ["Review", /^Review: \[review\.md\]\(review\.md\) — (.+)$/],
];

export function checkBrief(text, dir) {
  const errors = [];
  const line = text.split(/\r?\n/).slice(0, 6).find((l) => l.startsWith("_Status:"));
  if (!line) return ["falta la línea `_Status: …_` en las primeras líneas"];
  if (!line.endsWith("_")) errors.push("la línea de estado debe terminar en `_`");
  const parts = line.replace(/_$/, "").split(" · ");
  const head = parts.shift().match(HEAD);
  if (!head) {
    return [...errors, "estado ilegible: tras `_Status:` va una sola palabra de la lista, con fecha opcional entre paréntesis"];
  }
  const status = head[1];
  if (!STATUSES.includes(status)) errors.push(`estado «${status}» no válido (${STATUSES.join(", ")})`);

  let pos = 0;
  const seen = {};
  for (const part of parts) {
    const i = FIELDS.findIndex(([name]) => part.startsWith(name + ":"));
    if (i < 0) { errors.push(`campo desconocido o texto libre: «${part.slice(0, 50)}»`); continue; }
    if (i < pos) errors.push(`campo ${FIELDS[i][0]} fuera de orden`);
    pos = Math.max(pos, i);
    const m = part.match(FIELDS[i][1]);
    if (!m) errors.push(`formato de ${FIELDS[i][0]} no válido: «${part.slice(0, 60)}»`);
    seen[FIELDS[i][0]] = m ?? true;
  }
  for (const [name, , required] of FIELDS) if (required && !seen[name]) errors.push(`falta ${name}`);
  if (NEEDS_PR.includes(status) && !seen.PR) errors.push(`el estado «${status}» exige un PR`);
  if (seen.Review?.[1] && !VERDICTS.includes(seen.Review[1])) {
    errors.push(`veredicto «${seen.Review[1]}» no válido (${VERDICTS.join(" · ")})`);
  }
  for (const [name, file] of [["Spec", "spec.md"], ["Tech", "tech.md"], ["Review", "review.md"]]) {
    if (seen[name] && !fs.existsSync(path.join(dir, file))) errors.push(`${name} enlaza ${file}, que no existe`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.argv[2] ?? "docs/pm";
  let failed = 0;
  for (const slug of fs.readdirSync(root).sort()) {
    const file = path.join(root, slug, "brief.md");
    if (!fs.existsSync(file)) continue;
    const errors = checkBrief(fs.readFileSync(file, "utf8"), path.join(root, slug));
    for (const e of errors) console.error(`${file}: ${e}`);
    failed += errors.length;
  }
  if (failed) {
    console.error(`\n${failed} problema(s) en las líneas de estado.`);
    process.exit(1);
  }
  console.log("Líneas de estado de los briefs: OK");
}
