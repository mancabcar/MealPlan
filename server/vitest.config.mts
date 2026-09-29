import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// "@/*" -> ../src/* (código compartido con la raíz, issue #69 docs/pm/69-hosting-estatico-ionos/tech.md).
// Se declara aquí en vez de con vite-tsconfig-paths: ese plugin no resuelve imports .json fuera de este
// proyecto (p. ej. "@/data/foods.json" desde src/lib/foods.ts).
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(dirname, "../src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
