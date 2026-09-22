import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isExpired, isExpiringSoon, type PantryItem } from "@/lib/types";

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
