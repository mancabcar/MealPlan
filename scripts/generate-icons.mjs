// Genera los PNG de la PWA a partir de public/icons/icon.svg (docs/pm/21-pwa-recordatorios/tech.md).
// Uso: node scripts/generate-icons.mjs — los PNG se commitean; solo hay que regenerarlos si cambia el SVG.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const dir = fileURLToPath(new URL("../public/icons/", import.meta.url));
const svg = await readFile(`${dir}icon.svg`, "utf8");

// El SVG ocupa todo el lienzo, así que sirve igual para "any" y "maskable".
const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch();
try {
  for (const { file, size } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: `${dir}${file}` });
    await page.close();
  }
} finally {
  await browser.close();
}
