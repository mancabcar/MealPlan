import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Lógica pura por defecto (rápido). Tests de componentes: `// @vitest-environment jsdom` al inicio del archivo.
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
