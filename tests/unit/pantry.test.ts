import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expiresSoon, expiryLabel, isExpired, isExpiringSoon, type PantryItem } from "@/lib/types";

const item = (expiryDate?: string): PantryItem => ({
  id: "1",
  name: "Yogur natural",
  quantity: "4 uds",
  category: "Nevera",
  expiryDate,
});

describe("Despensa: avisos de caducidad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T10:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("caduca pronto si faltan menos de 3 días", () => {
    expect(isExpiringSoon(item("2026-09-24"))).toBe(true);
    expect(isExpiringSoon(item("2026-09-25"))).toBe(false);
  });

  it("hoy cuenta como 'caduca pronto', no como caducado", () => {
    expect(isExpiringSoon(item("2026-09-22"))).toBe(true);
    expect(isExpired(item("2026-09-22"))).toBe(false);
  });

  it("ayer ya está caducado", () => {
    expect(isExpired(item("2026-09-21"))).toBe(true);
    expect(isExpiringSoon(item("2026-09-21"))).toBe(false);
  });

  it("sin fecha no avisa", () => {
    expect(isExpiringSoon(item())).toBe(false);
    expect(isExpired(item())).toBe(false);
  });
});

// #72 (R9 de #16): chip de caducidad de la tarjeta de receta. El color usa la misma regla que la Despensa.
describe("Tarjeta de receta: chip de caducidad", () => {
  it("texto: hoy, mañana y en N días", () => {
    expect(expiryLabel(0)).toBe("caduca hoy");
    expect(expiryLabel(1)).toBe("caduca mañana");
    expect(expiryLabel(2)).toBe("caduca en 2 días");
    expect(expiryLabel(10)).toBe("caduca en 10 días");
  });

  it("naranja (pronto) con 0–2 días, neutro desde 3", () => {
    expect([0, 1, 2].map(expiresSoon)).toEqual([true, true, true]);
    expect([3, 10].map(expiresSoon)).toEqual([false, false]);
    expect(expiresSoon(-1)).toBe(false); // caducado
  });
});
