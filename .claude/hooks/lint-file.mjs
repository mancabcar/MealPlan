// PostToolUse (Edit|Write): eslint --fix sobre el archivo .ts/.tsx/.js/.mjs editado.
// Busca hacia arriba el eslint.config.mjs más cercano, así funciona igual en la raíz,
// en server/ (que tiene su propio config) y dentro de .claude/worktrees/*.
// Si quedan errores, exit 2 para que Claude los vea y los arregle.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = input.tool_input?.file_path;
if (!filePath || !/\.(m?[jt]sx?)$/.test(filePath)) process.exit(0);
if (/[\\/](node_modules|\.next|out)[\\/]/.test(filePath)) process.exit(0);

const abs = resolve(filePath);
let dir = dirname(abs);
let root = null;
while (true) {
  if (existsSync(join(dir, "eslint.config.mjs")) && existsSync(join(dir, "node_modules"))) {
    root = dir;
    break;
  }
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
if (!root) process.exit(0);

const eslintBin = join(root, "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(eslintBin)) process.exit(0);

const res = spawnSync(process.execPath, [eslintBin, "--fix", "--no-warn-ignored", abs], {
  cwd: root,
  encoding: "utf8",
  timeout: 60_000,
});

if (res.status === 1) {
  console.error(`ESLint encontró errores en ${filePath} tras --fix:\n${res.stdout}${res.stderr}`);
  process.exit(2);
}
process.exit(0);
