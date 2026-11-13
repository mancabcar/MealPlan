// PreToolUse (Read|Edit|Write): bloquea tocar secretos y el lockfile.
// - .env* (salvo .env.example): ni leer ni escribir.
// - package-lock.json: no editar a mano (se regenera con npm install).
// Exit 2 = bloquear; el mensaje de stderr le llega a Claude.
import { basename } from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const tool = input.tool_name ?? "";
const filePath = input.tool_input?.file_path ?? "";
if (!filePath) process.exit(0);

const name = basename(filePath.replace(/\\/g, "/"));

if (name.startsWith(".env") && name !== ".env.example") {
  console.error(
    `Bloqueado: ${name} contiene secretos. Si hace falta cambiar una variable, pídeselo al usuario o edita .env.example.`,
  );
  process.exit(2);
}

if (name === "package-lock.json" && tool !== "Read") {
  console.error(
    "Bloqueado: package-lock.json no se edita a mano. Usa npm install / npm uninstall para cambiar dependencias.",
  );
  process.exit(2);
}

process.exit(0);
