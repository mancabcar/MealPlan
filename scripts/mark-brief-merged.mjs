// Al mergear un PR, pasa de `in review` a `merged` el brief que lo enlaza.
// Uso (desde la Action): node scripts/mark-brief-merged.mjs <nº PR> <YYYY-MM-DD>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Devuelve el texto nuevo, o null si este brief no se toca.
export function markMerged(text, pr, date) {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(nl);
  const k = lines.findIndex((l) => l.startsWith("_Status:"));
  if (k < 0 || !/^_Status: in review\b/.test(lines[k])) return null;
  const prs = [...lines[k].matchAll(/\/pull\/(\d+)\)/g)].map((m) => m[1]);
  // Con varios PRs (entregas) solo se avanza al mergear el último: lo decide una persona.
  if (prs.length !== 1 || prs[0] !== String(pr)) return null;
  lines[k] = lines[k]
    .replace(/^_Status: in review(?: \(\d{4}-\d{2}-\d{2}\))?/, `_Status: merged (${date})`)
    .replace(/Updated: \d{4}-\d{2}-\d{2}/, `Updated: ${date}`);
  return lines.join(nl);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pr, date, root = "docs/pm"] = process.argv.slice(2);
  if (!/^\d+$/.test(pr ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    console.error("uso: node scripts/mark-brief-merged.mjs <nº PR> <YYYY-MM-DD>");
    process.exit(2);
  }
  for (const slug of fs.readdirSync(root)) {
    const file = path.join(root, slug, "brief.md");
    if (!fs.existsSync(file)) continue;
    const next = markMerged(fs.readFileSync(file, "utf8"), pr, date);
    if (next !== null) {
      fs.writeFileSync(file, next);
      console.log(`${file}: in review → merged (PR #${pr})`);
    }
  }
}
