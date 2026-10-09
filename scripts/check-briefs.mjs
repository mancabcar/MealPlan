// Valida la línea de estado de cada docs/pm/*/brief.md (formato fijado por la skill pm-pipeline).
// Uso: node scripts/check-briefs.mjs [--github] [carpeta-docs-pm]
// Con --github (necesita `gh`) comprueba además que el estado cuadra con el PR y el issue reales.
import { execFileSync } from "node:child_process";
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

const EARLY = ["brainstorm", "prototype", "spec", "tech design", "tests", "coding", "in review"];

// Estado, PRs e issue que declara la línea de estado (null si no se puede leer).
export function githubRefs(text) {
  const line = text.split(/\r?\n/).slice(0, 6).find((l) => l.startsWith("_Status:"));
  const status = line?.match(/^_Status: ([a-z ]+?)(?: \(|$| ·)/)?.[1];
  if (!status) return null;
  const field = (name) => line.split(" · ").find((p) => p.startsWith(name + ":")) ?? "";
  const nums = (s, kind) => [...s.matchAll(new RegExp(`/${kind}/(\\d+)\\)`, "g"))].map((m) => Number(m[1]));
  return { status, prs: nums(field("PR"), "pull"), issue: nums(field("Issue"), "issues")[0] ?? null };
}

// Compara la línea con la realidad de GitHub. `errors` hacen fallar; `warnings` son juicios que decide una persona.
export function compareWithGitHub({ status, prs, issue }, prStates, issueState) {
  const errors = [];
  const warnings = [];
  for (const n of prs) {
    const s = prStates[n];
    if (s === "MERGED" && EARLY.includes(status)) errors.push(`el PR #${n} está mergeado y el estado es «${status}» (debería ser merged o shipped)`);
    if (s !== "MERGED" && (status === "merged" || status === "shipped")) errors.push(`el estado es «${status}» pero el PR #${n} está ${s ?? "desconocido"}`);
    if (s === "CLOSED" && EARLY.includes(status)) errors.push(`el PR #${n} se cerró sin mergear`);
  }
  if (issue && issueState === "CLOSED" && status === "merged") warnings.push(`el issue #${issue} está cerrado: ¿ya es shipped?`);
  if (issue && issueState === "OPEN" && status === "shipped") warnings.push(`es shipped pero el issue #${issue} sigue abierto`);
  return { errors, warnings };
}

function ghState(kind, n) {
  try {
    return execFileSync("gh", [kind, "view", String(n), "--json", "state", "-q", ".state"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const useGitHub = args.includes("--github");
  const root = args.find((a) => !a.startsWith("--")) ?? "docs/pm";
  let failed = 0;
  for (const slug of fs.readdirSync(root).sort()) {
    const file = path.join(root, slug, "brief.md");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const errors = checkBrief(text, path.join(root, slug));
    const warnings = [];
    const refs = useGitHub ? githubRefs(text) : null;
    if (refs) {
      const prStates = Object.fromEntries(refs.prs.map((n) => [n, ghState("pr", n)]));
      const gh = compareWithGitHub(refs, prStates, refs.issue ? ghState("issue", refs.issue) : null);
      errors.push(...gh.errors);
      warnings.push(...gh.warnings);
    }
    for (const e of errors) console.error(`${file}: ${e}`);
    for (const w of warnings) console.warn(`${file}: aviso: ${w}`);
    failed += errors.length;
  }
  if (failed) {
    console.error(`\n${failed} problema(s) en las líneas de estado.`);
    process.exit(1);
  }
  console.log(`Líneas de estado de los briefs: OK${useGitHub ? " (y coherentes con GitHub)" : ""}`);
}
