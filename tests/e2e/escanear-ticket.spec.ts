// Spec: docs/pm/67-escanear-ticket/spec.md › R1–R5, R7 y Edge cases. Tech: tech.md › UI, State & edge cases.
// Contrato de UI:
//   - Despensa: botón "Escanear ticket" que abre un Sheet (role="dialog") "Escanear ticket".
//   - Elegir: dos input file con nombre accesible "Hacer foto" (accept="image/*", capture="environment") y
//     "Elegir imagen" (accept="image/*"). La foto se reduce a JPEG (lado largo ≤ 1600 px) antes de enviarla.
//   - Cargando: texto "Leyendo el ticket…".
//   - Lista: una fila por línea, role="group" con nombre "Línea N" (desde 1), con checkbox "Añadir", campos
//     "Nombre" y "Cantidad" y select "Ubicación". Las líneas con isFood=false empiezan desmarcadas.
//     Botón "Añadir N productos" ("Añadir 1 producto" con N = 1), deshabilitado con N = 0 o con una línea
//     marcada sin nombre o sin cantidad (como el formulario manual; review #186).
//   - Error: role="alert" con el `message` de la respuesta (si la petición ni llega, ERROR_TEXTS.ai_failed) y los
//     botones "Reintentar" (vuelve a Elegir) y "Añadir a mano" (cierra el sheet y abre el formulario de la Despensa
//     con el foco en el nombre).
//   - 401 (sesión caducada): vuelve al login, como la sincronización (review #186).
//   - Al añadir: se cierra el sheet; aviso "N añadidos" con "Deshacer"; los artículos muestran el chip "Nuevo".
// La ruta `POST /api/pantry/receipt` se intercepta con page.route: ningún test toca el servidor ni Claude.
// Datos: tests/fixtures/escanear-ticket.ts. Hoy = martes 2026-09-22 (signIn fija el reloj).
import { expect, test, type Page, type Route } from "@playwright/test";
import type { PantryItem } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { ERROR_STATUS, ERROR_TEXTS, MAX_IMAGE_BASE64, RESPONSE_OK } from "../fixtures/escanear-ticket";
import { TODAY, readStored, signIn } from "./helpers";

const RECEIPT_ROUTE = "**/api/pantry/receipt";

const EXISTING: PantryItem = { id: "p-1", name: "Yogur griego", quantity: "2 uds", category: "Nevera" };

async function openDespensa(page: Page, pantry: PantryItem[] = []) {
  await signIn(page, { profile: lucia, pantry });
  await page.goto("/despensa");
  await expect(page.getByRole("heading", { name: "Despensa", level: 1 })).toBeVisible();
}

interface SentBody {
  image: string;
  mediaType: string;
}

/** Intercepta la ruta y guarda los cuerpos recibidos. */
async function mockScan(page: Page, handler: (route: Route) => Promise<void> | void) {
  const bodies: SentBody[] = [];
  await page.route(RECEIPT_ROUTE, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    bodies.push(route.request().postDataJSON());
    await handler(route);
  });
  return bodies;
}
const respondWith = (json: unknown, status = 200) => (route: Route) => route.fulfill({ status, json });
const respondError = (code: keyof typeof ERROR_TEXTS) =>
  respondWith({ error: code, message: ERROR_TEXTS[code] }, ERROR_STATUS[code]);

/** Imagen de un "ticket" dibujada en un canvas del navegador. */
async function receiptImage(page: Page, width = 800, height = 1200, type = "image/jpeg"): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h, t]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.font = `${Math.round(w / 25)}px monospace`;
      ["HAC YOG GRIEGO 4X125   1,85", "PECH POLLO FILETE      4,10", "ARROZ BASMATI 1KG      2,35", "BOLSA PLASTICO         0,15"].forEach(
        (line, i) => ctx.fillText(line, w / 20, (h / 10) * (i + 1)),
      );
      return canvas.toDataURL(t, 0.92);
    },
    [width, height, type] as const,
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Escanear ticket" });
const line = (page: Page, n: number) => sheet(page).getByRole("group", { name: `Línea ${n}` });
const addButton = (page: Page) => sheet(page).getByRole("button", { name: /^Añadir \d+ productos?$/ });
const storedPantry = (page: Page) => readStored<PantryItem[]>(page, "pantry");

async function upload(page: Page, buffer?: Buffer, name = "ticket.jpg", mimeType = "image/jpeg") {
  const file = buffer ?? (await receiptImage(page));
  await sheet(page).getByLabel("Elegir imagen").setInputFiles({ name, mimeType, buffer: file });
}

async function openSheet(page: Page) {
  await page.getByRole("button", { name: "Escanear ticket" }).click();
  await expect(sheet(page)).toBeVisible();
}

async function scanToList(page: Page) {
  await openSheet(page);
  await upload(page);
  await expect(line(page, 1)).toBeVisible();
}

test.describe("R1: empezar con la cámara o con una imagen de la galería", () => {
  test("'Escanear ticket' abre el sheet con 'Hacer foto' (cámara trasera) y 'Elegir imagen'", async ({ page }) => {
    await openDespensa(page);
    await openSheet(page);
    const camera = sheet(page).getByLabel("Hacer foto");
    const gallery = sheet(page).getByLabel("Elegir imagen");
    await expect(camera).toHaveAttribute("type", "file");
    await expect(camera).toHaveAttribute("accept", "image/*");
    await expect(camera).toHaveAttribute("capture", "environment");
    await expect(gallery).toHaveAttribute("type", "file");
    await expect(gallery).toHaveAttribute("accept", "image/*");
    await expect(gallery).not.toHaveAttribute("capture", /.*/);
  });

  test("la foto con la cámara también lleva a la lista", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await openSheet(page);
    await sheet(page).getByLabel("Hacer foto").setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: await receiptImage(page) });
    await expect(line(page, 1)).toBeVisible();
  });

  test("la imagen se envía como JPEG con el lado largo de 1600 px como mucho y por debajo de 4 MB", async ({ page }) => {
    await openDespensa(page);
    const bodies = await mockScan(page, respondWith(RESPONSE_OK));
    await openSheet(page);
    await upload(page, await receiptImage(page, 3000, 4000, "image/png"), "ticket.png", "image/png");
    await expect(line(page, 1)).toBeVisible();

    expect(bodies).toHaveLength(1);
    const { image, mediaType } = bodies[0];
    expect(mediaType).toBe("image/jpeg");
    expect(image.startsWith("data:")).toBe(false);
    expect(image.length).toBeLessThanOrEqual(MAX_IMAGE_BASE64);
    const size = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }, image);
    expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(1600);
    expect(Math.max(size.w, size.h)).toBeGreaterThan(1000);
    expect(size.w / size.h).toBeCloseTo(3000 / 4000, 1);
  });

  test("la petición lleva la sesión", async ({ page }) => {
    await openDespensa(page);
    let auth: string | null = null;
    await page.route(RECEIPT_ROUTE, async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
      auth = await route.request().headerValue("authorization");
      await route.fulfill({ json: RESPONSE_OK });
    });
    await scanToList(page);
    expect(auth).toMatch(/^Bearer .+/);
  });
});

test.describe("R2: lista de productos detectados", () => {
  test("mientras lee muestra 'Leyendo el ticket…' y la Despensa no cambia", async ({ page }) => {
    await openDespensa(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await mockScan(page, async (route) => {
      await gate;
      await route.fulfill({ json: RESPONSE_OK });
    });
    await openSheet(page);
    await upload(page);
    await expect(sheet(page).getByText("Leyendo el ticket…")).toBeVisible();
    expect(await storedPantry(page)).toEqual([]);
    release();
    await expect(line(page, 1)).toBeVisible();
  });

  test("una fila por línea con nombre, cantidad y ubicación; la que no es comida, desmarcada", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);

    await expect(sheet(page).getByRole("group", { name: /^Línea \d+$/ })).toHaveCount(5);
    await expect(line(page, 1).getByLabel("Nombre")).toHaveValue("Yogur griego");
    await expect(line(page, 1).getByLabel("Cantidad")).toHaveValue("4 uds");
    await expect(line(page, 1).getByLabel("Ubicación")).toHaveValue("Nevera");
    await expect(line(page, 4).getByLabel("Ubicación")).toHaveValue("Congelador");
    for (const n of [1, 2, 3, 4]) await expect(line(page, n).getByRole("checkbox", { name: "Añadir" })).toBeChecked();
    await expect(line(page, 5).getByLabel("Nombre")).toHaveValue("Bolsa de plástico");
    await expect(line(page, 5).getByRole("checkbox", { name: "Añadir" })).not.toBeChecked();
    await expect(addButton(page)).toHaveText("Añadir 4 productos");
  });
});

test.describe("R3 y R4: editar, descartar y añadir", () => {
  test("añade solo las líneas marcadas, con lo editado, como artículos nuevos", async ({ page }) => {
    await openDespensa(page, [EXISTING]);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);

    await line(page, 2).getByLabel("Nombre").fill("Pechuga de pollo en filetes");
    await line(page, 2).getByLabel("Ubicación").selectOption("Congelador");
    await line(page, 3).getByRole("checkbox", { name: "Añadir" }).uncheck();
    await expect(addButton(page)).toHaveText("Añadir 3 productos");
    await addButton(page).click();

    await expect(sheet(page)).toBeHidden();
    const pantry = await storedPantry(page);
    expect(pantry).toHaveLength(4);
    expect(pantry[0]).toEqual(EXISTING);
    expect(pantry.slice(1).map(({ name, quantity, category }) => ({ name, quantity, category }))).toEqual([
      { name: "Yogur griego", quantity: "4 uds", category: "Nevera" },
      { name: "Pechuga de pollo en filetes", quantity: "512 g", category: "Congelador" },
      { name: "Guisantes congelados", quantity: "1 bolsa", category: "Congelador" },
    ]);
    // Ya había "Yogur griego": se añade otro artículo, no se suma (spec R4)
    expect(pantry.filter((i) => i.name === "Yogur griego")).toHaveLength(2);
    expect(pantry.slice(1).every((i) => i.addedFromReceiptAt === TODAY)).toBe(true);
  });

  test("marcar una línea que no es comida la añade también", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await line(page, 5).getByRole("checkbox", { name: "Añadir" }).check();
    await expect(addButton(page)).toHaveText("Añadir 5 productos");
  });

  test("con una sola línea marcada el botón dice 'Añadir 1 producto'", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    for (const n of [2, 3, 4]) await line(page, n).getByRole("checkbox", { name: "Añadir" }).uncheck();
    await expect(addButton(page)).toHaveText("Añadir 1 producto");
  });

  test("una línea marcada con el nombre vacío impide añadir hasta corregirla o desmarcarla", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await line(page, 1).getByLabel("Nombre").fill("  ");
    await expect(addButton(page)).toBeDisabled();
    await line(page, 1).getByRole("checkbox", { name: "Añadir" }).uncheck();
    await expect(addButton(page)).toBeEnabled();
    await line(page, 1).getByRole("checkbox", { name: "Añadir" }).check();
    await line(page, 1).getByLabel("Nombre").fill("Yogur natural");
    await expect(addButton(page)).toBeEnabled();
  });

  test("una línea marcada sin cantidad impide añadir hasta corregirla", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await line(page, 2).getByLabel("Cantidad").fill("");
    await expect(addButton(page)).toBeDisabled();
    await line(page, 2).getByLabel("Cantidad").fill("500 g");
    await expect(addButton(page)).toBeEnabled();
  });

  test("sin ninguna línea marcada no se puede añadir", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    for (const n of [1, 2, 3, 4]) await line(page, n).getByRole("checkbox", { name: "Añadir" }).uncheck();
    await expect(addButton(page)).toBeDisabled();
  });

  test("cerrar la lista sin confirmar no cambia la Despensa", async ({ page }) => {
    await openDespensa(page, [EXISTING]);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await sheet(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(sheet(page)).toBeHidden();
    expect(await storedPantry(page)).toEqual([EXISTING]);
  });
});

test.describe("R5: ticket ilegible o error", () => {
  for (const code of ["unreadable", "ai_failed", "invalid_image", "rate_limited"] as const) {
    test(`con '${code}' muestra el mensaje con 'Reintentar' y 'Añadir a mano'`, async ({ page }) => {
      await openDespensa(page);
      await mockScan(page, respondError(code));
      await openSheet(page);
      await upload(page);
      await expect(sheet(page).getByRole("alert")).toHaveText(ERROR_TEXTS[code]);
      await expect(sheet(page).getByRole("button", { name: "Reintentar" })).toBeVisible();
      await expect(sheet(page).getByRole("button", { name: "Añadir a mano" })).toBeVisible();
      expect(await storedPantry(page)).toEqual([]);
    });
  }

  test("con la sesión caducada (401) vuelve al login sin tocar la Despensa", async ({ page }) => {
    await openDespensa(page, [EXISTING]);
    await mockScan(page, respondError("unauthorized"));
    await openSheet(page);
    await upload(page);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    expect(await storedPantry(page)).toEqual([EXISTING]);
  });

  test("si la petición no llega muestra el mensaje de error de proceso", async ({ page }) => {
    await openDespensa(page);
    await page.route(RECEIPT_ROUTE, (route) => route.abort("failed"));
    await openSheet(page);
    await upload(page);
    await expect(sheet(page).getByRole("alert")).toHaveText(ERROR_TEXTS.ai_failed);
  });

  test("'Reintentar' vuelve a elegir imagen y un segundo intento llega a la lista", async ({ page }) => {
    await openDespensa(page);
    let calls = 0;
    await mockScan(page, (route) => (++calls === 1 ? respondError("unreadable")(route) : respondWith(RESPONSE_OK)(route)));
    await openSheet(page);
    await upload(page);
    await sheet(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(sheet(page).getByRole("alert")).toBeHidden();
    await expect(sheet(page).getByLabel("Elegir imagen")).toBeAttached();
    await upload(page);
    await expect(line(page, 1)).toBeVisible();
  });

  test("'Añadir a mano' cierra el sheet y abre el formulario de la Despensa con el foco en el nombre", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondError("unreadable"));
    await openSheet(page);
    await upload(page);
    await sheet(page).getByRole("button", { name: "Añadir a mano" }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByPlaceholder("Nombre (p.ej. pechuga de pollo)")).toBeFocused();
  });
});

test.describe("R7: Deshacer y chip 'Nuevo'", () => {
  test("los artículos añadidos muestran 'Nuevo' y 'Deshacer' quita solo esos", async ({ page }) => {
    await openDespensa(page, [EXISTING]);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await addButton(page).click();

    await expect(page.getByText("4 añadidos")).toBeVisible();
    await expect(page.getByText("Nuevo", { exact: true })).toHaveCount(4);

    await page.getByRole("button", { name: "Deshacer" }).click();
    expect(await storedPantry(page)).toEqual([EXISTING]);
    await expect(page.getByText("Nuevo", { exact: true })).toHaveCount(0);
  });

  test("si se borra a mano uno de los añadidos, 'Deshacer' quita los demás sin fallar", async ({ page }) => {
    await openDespensa(page, [EXISTING]);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await addButton(page).click();
    await expect(page.getByText("4 añadidos")).toBeVisible();

    const pantry = await storedPantry(page);
    const rowOf = (name: string) =>
      page.locator("div").filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Eliminar" }) }).last();
    await rowOf("Arroz basmati").getByRole("button", { name: "Eliminar" }).click();
    expect(await storedPantry(page)).toHaveLength(pantry.length - 1);

    await page.getByRole("button", { name: "Deshacer" }).click();
    expect(await storedPantry(page)).toEqual([EXISTING]);
  });
});

test.describe("Estado del sheet (tech.md › State & edge cases)", () => {
  test("al reabrir empieza otra vez en elegir imagen, sin la lista anterior", async ({ page }) => {
    await openDespensa(page);
    await mockScan(page, respondWith(RESPONSE_OK));
    await scanToList(page);
    await sheet(page).getByRole("button", { name: "Cerrar" }).click();
    await openSheet(page);
    await expect(sheet(page).getByLabel("Elegir imagen")).toBeAttached();
    await expect(line(page, 1)).toHaveCount(0);
  });

  test("cerrar mientras lee cancela: aunque llegue la respuesta, no escribe nada ni reabre la lista", async ({ page }) => {
    await openDespensa(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await mockScan(page, async (route) => {
      await gate;
      await route.fulfill({ json: RESPONSE_OK }).catch(() => {});
    });
    await openSheet(page);
    await upload(page);
    await expect(sheet(page).getByText("Leyendo el ticket…")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(sheet(page)).toBeHidden();
    release();
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeHidden();
    expect(await storedPantry(page)).toEqual([]);

    await openSheet(page);
    await expect(line(page, 1)).toHaveCount(0);
  });
});
