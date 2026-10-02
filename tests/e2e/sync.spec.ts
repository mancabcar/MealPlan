// Spec: docs/pm/22-sincronizacion-dispositivos/spec.md › R1, R2, R5, R6, R7, R8, R10, R12 (flujos de usuario).
// Contrato de UI: tech.md › Test coverage › "UI test contract". Servidor: doble de tests/fixtures/fakeSyncBackend.ts.
// Cada BrowserContext es un dispositivo. El reloj es falso (page.clock) para llegar al polling de 15 s sin esperar.
import { expect, test } from "@playwright/test";
import { ACCOUNT_A_DATA } from "../fixtures/backup";
import { createFakeBackend, type FakeBackend } from "../fixtures/fakeSyncBackend";
import { emptyDevice, LOCAL_ID, login, mockBackend, register, seedLocalDevice, stored } from "./syncHelpers";

const PASSWORD = "secreto-123";
const SERVER_ID = "srv-1"; // el primer usuario del servidor simulado
const status = (page: import("@playwright/test").Page) => page.getByTestId("sync-status");

let backend: FakeBackend;
test.beforeEach(() => {
  backend = createFakeBackend();
});

test.describe("R1, R6: registro con los datos de este dispositivo", () => {
  test("R1/R6: crear la cuenta sube los datos locales y la app los muestra, con el estado «Al día»", async ({ page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    await register(page, "lucia", PASSWORD);

    // La cuenta local de la última sesión se ofrece y está preseleccionada: se suben sus datos sin pasos extra.
    await expect.poll(() => Object.keys(backend.dataOf("lucia")).sort()).toEqual(
      expect.arrayContaining(["entries", "pantry", "profile", "recipes", "weekplan"]),
    );
    expect(backend.dataOf("lucia").entries.value).toEqual(ACCOUNT_A_DATA.entries);
    expect(await stored(page, SERVER_ID, "entries")).toEqual(ACCOUNT_A_DATA.entries);
    await expect(status(page)).toHaveText("Al día");
    // lo local original sigue ahí hasta cerrar sesión (R12)
    expect(await stored(page, LOCAL_ID, "entries")).toEqual(ACCOUNT_A_DATA.entries);
  });

  test("R1: sin el código de invitación correcto se muestra un error y no se entra", async ({ page, context }) => {
    await mockBackend(context, backend);
    await emptyDevice(page);
    await register(page, "lucia", PASSWORD, "incorrecto");
    await expect(page.getByText("Código de invitación incorrecto")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
  });

  test("R1: usuario o contraseña incorrectos en el login muestran el error del servidor", async ({ page, context }) => {
    backend.seed("lucia", PASSWORD, {});
    await mockBackend(context, backend);
    await emptyDevice(page);
    await login(page, "lucia", "incorrecta");
    await expect(page.getByText("Usuario o contraseña incorrectos")).toBeVisible();
  });
});

test.describe("R2, R12: sesión", () => {
  test("R2: la sesión sobrevive a una recarga y cerrar sesión vuelve al login y limpia lo local", async ({ page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    await register(page, "lucia", PASSWORD);
    await expect(status(page)).toHaveText("Al día");

    await page.reload();
    await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
    await expect(status(page)).toBeVisible();

    await page.goto("/perfil/");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    // R12: la copia local de ese usuario desaparece del dispositivo
    expect(await stored(page, SERVER_ID, "entries")).toBeNull();
    // y el token ya no vale en el servidor
    expect(backend.requests.some((r) => r.path === "/api/auth/logout")).toBe(true);
  });
});

test.describe("R12 (review #98): cerrar sesión con cambios sin subir", () => {
  test("sin red avisa; cancelar mantiene la sesión y los datos, aceptar cierra", async ({ page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    await register(page, "lucia", PASSWORD);
    await expect(status(page)).toHaveText("Al día");

    await page.goto("/despensa/");
    backend.setOnline(false);
    await page.getByRole("button", { name: "Añadir" }).click();
    await page.getByPlaceholder("Nombre (p.ej. pechuga de pollo)").fill("Lentejas rojas");
    await page.getByPlaceholder("Cantidad (p.ej. 200g, 1 bote)").fill("1 kg");
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.clock.runFor(2_000);
    await expect(status(page)).toHaveText("Sin sincronizar");

    await page.goto("/perfil/");
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
    expect(JSON.stringify(await stored(page, SERVER_ID, "pantry"))).toContain("Lentejas rojas");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });
});

test.describe("R5: un cambio de otro dispositivo llega en ≤ 30 s", () => {
  test("R5: un segundo dispositivo inicia sesión, ve los datos y recibe un cambio sin recargar", async ({ browser, page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    await register(page, "lucia", PASSWORD);
    await expect(status(page)).toHaveText("Al día");

    const movil = await browser.newContext();
    await mockBackend(movil, backend);
    const phone = await movil.newPage();
    await emptyDevice(phone);
    await login(phone, "lucia", PASSWORD);
    await expect.poll(() => stored(phone, SERVER_ID, "entries")).toEqual(ACCOUNT_A_DATA.entries);

    backend.remoteWrite("lucia", "pantry", [{ id: "nuevo-desde-otro", name: "Leche de avena", quantity: "1 l", category: "Nevera" }]);
    await phone.goto("/despensa/");
    await phone.clock.runFor(16_000); // un ciclo de polling (15 s)
    await expect(phone.getByText("Leche de avena")).toBeVisible();
    await movil.close();
  });
});

test.describe("R7: datos en el dispositivo y en el servidor", () => {
  const SERVER_PANTRY = [{ id: "srv-p1", name: "Garbanzos", quantity: "500 g", category: "Despensa" }];

  test.beforeEach(() => {
    backend.seed("lucia", PASSWORD, { ...ACCOUNT_A_DATA, pantry: SERVER_PANTRY });
  });

  test("R7: aceptar sustituye lo local por lo del servidor", async ({ page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    await login(page, "lucia", PASSWORD);
    const dialog = page.getByRole("dialog", { name: "Sustituir los datos de este dispositivo" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Descargar copia de lo local" })).toBeVisible();
    await dialog.getByRole("button", { name: "Sustituir" }).click();
    await expect.poll(() => stored(page, SERVER_ID, "pantry")).toEqual(SERVER_PANTRY);
  });

  test("R7: cancelar cierra la sesión del servidor, vuelve al login y no toca lo local ni lo del servidor", async ({ page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    const serverBefore = JSON.stringify(backend.dataOf("lucia"));
    await login(page, "lucia", PASSWORD);
    await page.getByRole("dialog", { name: "Sustituir los datos de este dispositivo" }).getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    expect(await stored(page, LOCAL_ID, "pantry")).toEqual(ACCOUNT_A_DATA.pantry);
    expect(JSON.stringify(backend.dataOf("lucia"))).toBe(serverBefore);
    expect(backend.requests.some((r) => r.path === "/api/auth/logout")).toBe(true);
  });
});

test.describe("R8, R10: sin conexión", () => {
  test("R8/R10: sin red la app sigue, avisa «Sin sincronizar» y al volver la red sube el cambio y marca «Al día»", async ({ page, context }) => {
    await mockBackend(context, backend);
    await seedLocalDevice(page, ACCOUNT_A_DATA);
    await register(page, "lucia", PASSWORD);
    await expect(status(page)).toHaveText("Al día");

    await page.goto("/despensa/");
    backend.setOnline(false);
    await page.getByRole("button", { name: "Añadir" }).click();
    await page.getByPlaceholder("Nombre (p.ej. pechuga de pollo)").fill("Lentejas rojas");
    await page.getByPlaceholder("Cantidad (p.ej. 200g, 1 bote)").fill("1 kg");
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.clock.runFor(2_000);

    await expect(page.getByText("Lentejas rojas")).toBeVisible(); // la app sigue funcionando con la copia local
    await expect(status(page)).toHaveText("Sin sincronizar");

    backend.setOnline(true);
    await page.clock.runFor(16_000);
    await expect(status(page)).toHaveText("Al día");
    expect(JSON.stringify(backend.dataOf("lucia").pantry.value)).toContain("Lentejas rojas");
  });
});
