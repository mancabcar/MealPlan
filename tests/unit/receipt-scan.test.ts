// Spec: docs/pm/67-escanear-ticket/spec.md › R2, R4, R6. Tech: tech.md › APIs / interfaces (`src/lib/receiptScan.ts`).
// Contrato de `src/lib/receiptScan.ts` (puro, compartido por la ruta y el front):
//   - `parseReceiptReply(text)`: extrae `{ lines: ReceiptLine[] }` del texto de Claude (también dentro de ```json```).
//     Recorta textos; descarta líneas sin nombre; categoría sin distinguir mayúsculas, fuera de Nevera/Despensa/
//     Congelador → "Despensa"; `isFood` no booleano → true; cantidad ausente o vacía → "1 ud" (review #186). Si el JSON
//     está cortado, conserva las líneas completas. Devuelve `null` si no queda ninguna línea válida.
//   - `canConfirm(lines)`: alguna marcada y ninguna marcada sin nombre ni cantidad.
//   - `isJpegBase64(image)`: alfabeto base64 y cabecera /9j/.
//   - `toPantryItems(lines, today)`: un PantryItem nuevo por línea con `checked: true`, con id nuevo y
//     `addedFromReceiptAt: today`.
//   - `buildReceiptPrompt(foodNames)`: el prompt incluye los nombres de la Base de alimentos (R6).
import { describe, expect, it } from "vitest";
import { buildReceiptPrompt, canConfirm, isJpegBase64, parseReceiptReply, toPantryItems } from "@/lib/receiptScan";
import { CLAUDE_REPLY, RECEIPT_LINES } from "../fixtures/escanear-ticket";

const TODAY = "2026-09-22";

describe("R2: leer la respuesta de Claude", () => {
  it("devuelve las líneas de un JSON limpio", () => {
    expect(parseReceiptReply(CLAUDE_REPLY)).toEqual(RECEIPT_LINES);
  });

  it("acepta el JSON dentro de un bloque ```json``` con texto alrededor", () => {
    const reply = `Aquí tienes las líneas:\n\`\`\`json\n${CLAUDE_REPLY}\n\`\`\`\nEspero que sirva.`;
    expect(parseReceiptReply(reply)).toEqual(RECEIPT_LINES);
  });

  it("devuelve null si la respuesta no es JSON", () => {
    expect(parseReceiptReply("No puedo leer esta imagen.")).toBeNull();
  });

  it("devuelve null si no hay ninguna línea", () => {
    expect(parseReceiptReply(JSON.stringify({ lines: [] }))).toBeNull();
    expect(parseReceiptReply(JSON.stringify({ items: RECEIPT_LINES }))).toBeNull();
  });

  it("una ubicación desconocida pasa a Despensa", () => {
    const lines = parseReceiptReply(JSON.stringify({ lines: [{ name: "Leche", quantity: "1 l", category: "Armario", isFood: true }] }));
    expect(lines?.[0].category).toBe("Despensa");
  });

  it("descarta las líneas sin nombre o con el nombre en blanco y conserva el resto", () => {
    const lines = parseReceiptReply(
      JSON.stringify({
        lines: [
          { name: "  ", quantity: "1 ud", category: "Nevera", isFood: true },
          { quantity: "2 uds", category: "Nevera", isFood: true },
          { name: "Huevos", quantity: "12 uds", category: "Nevera", isFood: true },
        ],
      }),
    );
    expect(lines).toEqual([{ name: "Huevos", quantity: "12 uds", category: "Nevera", isFood: true }]);
  });

  it("devuelve null si todas las líneas son inválidas", () => {
    expect(parseReceiptReply(JSON.stringify({ lines: [{ name: "" }, { quantity: "1" }] }))).toBeNull();
  });

  it("isFood ausente o no booleano cuenta como comida", () => {
    const lines = parseReceiptReply(
      JSON.stringify({
        lines: [
          { name: "Tomate", quantity: "1 kg", category: "Nevera" },
          { name: "Pan", quantity: "1 ud", category: "Despensa", isFood: "sí" },
        ],
      }),
    );
    expect(lines?.map((l) => l.isFood)).toEqual([true, true]);
  });

  it("recorta espacios del nombre y la cantidad, y una cantidad ausente o vacía pasa a '1 ud'", () => {
    const lines = parseReceiptReply(
      JSON.stringify({
        lines: [
          { name: "  Queso fresco ", quantity: " 250 g ", category: "Nevera", isFood: true },
          { name: "Sal", category: "Despensa", isFood: true },
          { name: "Pimienta", quantity: "  ", category: "Despensa", isFood: true },
        ],
      }),
    );
    expect(lines).toEqual([
      { name: "Queso fresco", quantity: "250 g", category: "Nevera", isFood: true },
      { name: "Sal", quantity: "1 ud", category: "Despensa", isFood: true },
      { name: "Pimienta", quantity: "1 ud", category: "Despensa", isFood: true },
    ]);
  });

  it("la ubicación no distingue mayúsculas ni espacios", () => {
    const lines = parseReceiptReply(
      JSON.stringify({
        lines: [
          { name: "Yogur", quantity: "4 uds", category: "nevera", isFood: true },
          { name: "Guisantes", quantity: "1 bolsa", category: " CONGELADOR ", isFood: true },
        ],
      }),
    );
    expect(lines?.map((l) => l.category)).toEqual(["Nevera", "Congelador"]);
  });

  it("una respuesta cortada a mitad (límite de tokens) conserva las líneas completas", () => {
    const cut = CLAUDE_REPLY.slice(0, CLAUDE_REPLY.indexOf("Guisantes") + 5);
    expect(parseReceiptReply(cut)).toEqual(RECEIPT_LINES.slice(0, 3));
  });

  it("una respuesta cortada antes de la primera línea completa devuelve null", () => {
    expect(parseReceiptReply('{"lines": [{"name": "Yogur gri')).toBeNull();
  });
});

describe("R4: solo las líneas marcadas pasan a la Despensa, cada una como artículo nuevo", () => {
  const edited = RECEIPT_LINES.map((l) => ({ ...l, checked: l.isFood }));

  it("crea un artículo por línea marcada con su nombre, cantidad y ubicación", () => {
    const items = toPantryItems(edited, TODAY);
    expect(items.map(({ name, quantity, category }) => ({ name, quantity, category }))).toEqual([
      { name: "Yogur griego", quantity: "4 uds", category: "Nevera" },
      { name: "Pechuga de pollo", quantity: "512 g", category: "Nevera" },
      { name: "Arroz basmati", quantity: "1 kg", category: "Despensa" },
      { name: "Guisantes congelados", quantity: "1 bolsa", category: "Congelador" },
    ]);
  });

  it("cada artículo lleva un id distinto y la fecha de hoy en addedFromReceiptAt", () => {
    const items = toPantryItems(edited, TODAY);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.every((i) => i.id.length > 0)).toBe(true);
    expect(items.every((i) => i.addedFromReceiptAt === TODAY)).toBe(true);
  });

  it("no marca los artículos como llegados desde la lista de la compra ni pone caducidad", () => {
    const [item] = toPantryItems(edited, TODAY);
    expect(item.addedFromListAt).toBeUndefined();
    expect(item.expiryDate).toBeUndefined();
  });

  it("sin líneas marcadas no crea nada", () => {
    expect(toPantryItems(RECEIPT_LINES.map((l) => ({ ...l, checked: false })), TODAY)).toEqual([]);
  });
});

describe("R3: cuándo se puede confirmar", () => {
  const line = (patch: object) => ({ name: "Pan", quantity: "1 ud", category: "Despensa" as const, isFood: true, checked: true, ...patch });

  it("con alguna línea marcada completa, sí", () => {
    expect(canConfirm([line({}), line({ checked: false, name: "" })])).toBe(true);
  });

  it("sin líneas marcadas, no", () => {
    expect(canConfirm([line({ checked: false })])).toBe(false);
  });

  it("con una marcada sin nombre o sin cantidad, no (como el formulario manual)", () => {
    expect(canConfirm([line({}), line({ name: "  " })])).toBe(false);
    expect(canConfirm([line({}), line({ quantity: " " })])).toBe(false);
  });
});

describe("Validación de la imagen en la ruta", () => {
  it("acepta base64 con cabecera JPEG", () => {
    expect(isJpegBase64("/9j/4AAQSkZJRg==")).toBe(true);
  });

  it("rechaza otra cabecera, un prefijo data: o caracteres que no son base64", () => {
    expect(isJpegBase64("iVBORw0KGgo=")).toBe(false);
    expect(isJpegBase64("data:image/jpeg;base64,/9j/4AAQ")).toBe(false);
    expect(isJpegBase64("/9j/esto no es base64!")).toBe(false);
  });
});

describe("R6: el prompt incluye la Base de alimentos", () => {
  it("lleva los nombres que se le pasan", () => {
    const prompt = buildReceiptPrompt(["Yogur griego natural", "Pechuga de pollo, cruda"]);
    expect(prompt).toContain("Yogur griego natural");
    expect(prompt).toContain("Pechuga de pollo, cruda");
  });
});
