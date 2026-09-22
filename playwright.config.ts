import { defineConfig, devices } from "@playwright/test";

// Local: reutiliza el `npm run dev` que ya esté corriendo (Next 16 no permite dos dev servers en la misma carpeta)
const PORT = 3000;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    actionTimeout: 5_000,
    ...devices["Pixel 7"], // la app es mobile-first
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    // En CI se prueba el build de producción; en local se reutiliza el dev server si ya corre
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
