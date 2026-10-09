// @vitest-environment jsdom
// Spec: docs/pm/54-copiar-diario/spec.md › Acceptance criteria R1 (la hoja y su resumen), R3 (aviso de conflicto),
// R6 (cuándo se puede copiar) y R7 (atajos y botón); Edge cases (doble toque).
// Tech: tech.md › APIs / interfaces y UI. Contrato del componente (`src/components/diario/CopyDaySheet.tsx`, export
// nombrado), acordado con Manuel:
//   <CopyDaySheet from="YYYY-MM-DD" today="YYYY-MM-DD" entries={MealEntry[]} recipes={Recipe[]}
//                 onCopy={(to: string) => void} onClose={() => void} />
//   - Va dentro de ui/Sheet: role="dialog" con el título «Copiar el lun 21 sep a…» («lun 21 sep» = formatDayShort).
//     Debajo, «5 entradas · 1428 kcal» («1 entrada · 300 kcal»), con las entradas de `from` y las kcal redondeadas.
//   - Paso «elegir»: un botón por atajo de copyTargets, con aria-pressed (el nombre empieza por «Hoy», «Mañana» o
//     «En 7 días»); un campo «Otra fecha» (input date); «Copiar» y «Cancelar». Al abrir no hay nada elegido.
//   - Botón principal: «Copiar» desactivado sin destino válido; «Copiar a hoy», «Copiar a mañana» y, para cualquier
//     otra fecha (también «En 7 días»), «Copiar al lun 29 sep». El campo «Otra fecha» muestra el destino elegido.
//   - Si el destino tiene entradas, «Copiar» no llama a onCopy: pasa al paso «conflicto», con el título «El mar 22 sep ya
//     tiene 2 entradas» («1 entrada»), la lista de las que hay («Tostadas con aguacate» y «Desayuno · 290 kcal»),
//     «Sumar las 5 entradas» («Sumar la entrada») y «Cancelar». «Sumar» llama a onCopy(destino); «Cancelar» a onClose.
//   - Sin entradas en el destino, «Copiar» llama directamente a onCopy(destino).
//   - Doble toque (detail > 1) en «Copiar» o «Sumar»: solo cuenta el primero.
// Fallan hasta que exista el componente (tarea 3 del tech design).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyDaySheet } from "@/components/diario/CopyDaySheet";
import type { MealEntry } from "@/lib/types";
import { DIARIO_RECIPES, GUISO } from "../fixtures/diario";
import { DESTINO_ENTRIES, ORIGEN_ENTRIES, ORIGEN_KCAL, TODAY, TOMORROW, YESTERDAY } from "../fixtures/copiar-dia";

afterEach(cleanup);

const RECIPES = [...DIARIO_RECIPES, GUISO];

function setup(props: Partial<React.ComponentProps<typeof CopyDaySheet>> = {}) {
  const onCopy = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <CopyDaySheet
      from={YESTERDAY}
      today={TODAY}
      entries={ORIGEN_ENTRIES}
      recipes={RECIPES}
      onCopy={onCopy}
      onClose={onClose}
      {...props}
    />,
  );
  return { onCopy, onClose, ...utils };
}

const dialog = () => screen.getByRole("dialog");
const atajo = (name: RegExp) => within(dialog()).getByRole("button", { name });
// En testing-library un `name` de texto es exacto: «Copiar» no coincide con «Copiar a hoy»
const copiar = (name = "Copiar") => within(dialog()).getByRole("button", { name }) as HTMLButtonElement;
const otraFecha = () => within(dialog()).getByLabelText("Otra fecha") as HTMLInputElement;

describe("R1: la hoja de destino", () => {
  it("se titula con el día de origen y resume cuántas entradas y kcal se copian", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Copiar el lun 21 sep a…" })).toBeTruthy();
    expect(within(dialog()).getByText(`5 entradas · ${ORIGEN_KCAL} kcal`)).toBeTruthy();
  });

  it("con una sola entrada habla en singular", () => {
    setup({ entries: [ORIGEN_ENTRIES[0]] });
    expect(within(dialog()).getByText("1 entrada · 300 kcal")).toBeTruthy();
  });

  it("usa las entradas vivas: si cambian con la hoja abierta, el resumen cambia", () => {
    const { rerender, onCopy, onClose } = setup();
    rerender(
      <CopyDaySheet
        from={YESTERDAY}
        today={TODAY}
        entries={ORIGEN_ENTRIES.slice(0, 2)}
        recipes={RECIPES}
        onCopy={onCopy}
        onClose={onClose}
      />,
    );
    expect(within(dialog()).getByText("2 entradas · 468 kcal")).toBeTruthy();
  });

  it("solo cuenta las entradas del día de origen", () => {
    setup({ entries: [...ORIGEN_ENTRIES, ...DESTINO_ENTRIES] });
    expect(within(dialog()).getByText(`5 entradas · ${ORIGEN_KCAL} kcal`)).toBeTruthy();
  });

  it("Escape la cierra sin copiar", () => {
    const { onCopy, onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("Cancelar la cierra sin copiar", () => {
    const { onCopy, onClose } = setup();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });
});

describe("R7: atajos y botón principal", () => {
  it("ofrece Hoy, Mañana y En 7 días con su fecha", () => {
    setup();
    expect(atajo(/^Hoy/).textContent).toContain("mar 22 sep");
    expect(atajo(/^Mañana/).textContent).toContain("mié 23 sep");
    expect(atajo(/^En 7 días/).textContent).toContain("mar 29 sep");
  });

  it("no ofrece el atajo que coincide con el día de origen", () => {
    setup({ from: TODAY, entries: DESTINO_ENTRIES });
    expect(within(dialog()).queryByRole("button", { name: /^Hoy/ })).toBeNull();
    expect(atajo(/^Mañana/)).toBeTruthy();
  });

  it("al abrir no hay nada elegido: ningún atajo marcado, el campo vacío y «Copiar» desactivado", () => {
    setup();
    for (const name of [/^Hoy/, /^Mañana/, /^En 7 días/]) {
      expect(atajo(name).getAttribute("aria-pressed")).toBe("false");
    }
    expect(otraFecha().value).toBe("");
    expect(copiar().disabled).toBe(true);
  });

  it("elegir un atajo lo marca, rellena el campo y activa «Copiar a hoy»", () => {
    setup();
    fireEvent.click(atajo(/^Hoy/));
    expect(atajo(/^Hoy/).getAttribute("aria-pressed")).toBe("true");
    expect(atajo(/^Mañana/).getAttribute("aria-pressed")).toBe("false");
    expect(otraFecha().value).toBe(TODAY);
    expect(copiar("Copiar a hoy").disabled).toBe(false);
  });

  it("el botón nombra el destino: «a mañana» y «al mar 29 sep» (En 7 días)", () => {
    setup();
    fireEvent.click(atajo(/^Mañana/));
    expect(copiar("Copiar a mañana")).toBeTruthy();
    fireEvent.click(atajo(/^En 7 días/));
    expect(copiar("Copiar al mar 29 sep")).toBeTruthy();
  });

  it("una fecha tecleada en «Otra fecha» la nombra: «Copiar al jue 8 oct»", () => {
    setup();
    fireEvent.change(otraFecha(), { target: { value: "2026-10-08" } });
    expect(copiar("Copiar al jue 8 oct").disabled).toBe(false);
  });

  it("con un atajo elegido, «Copiar» llama a onCopy con esa fecha", () => {
    const { onCopy } = setup();
    fireEvent.click(atajo(/^Mañana/));
    fireEvent.click(copiar("Copiar a mañana"));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(TOMORROW);
  });
});

describe("R6: cuándo se puede copiar", () => {
  it("fecha pasada o futura distinta del origen: «Copiar» activo", () => {
    setup();
    for (const fecha of ["2026-08-18", "2026-12-31", "2099-01-01"]) {
      fireEvent.change(otraFecha(), { target: { value: fecha } });
      // Con una fecha tecleada el botón se llama «Copiar al <fecha>»: es el único botón que empieza por «Copiar»
      const principal = within(dialog()).getByRole("button", { name: /^Copiar/ }) as HTMLButtonElement;
      expect(principal.disabled, fecha).toBe(false);
    }
  });

  it("la fecha del propio origen: «Copiar» desactivado", () => {
    setup();
    fireEvent.change(otraFecha(), { target: { value: YESTERDAY } });
    expect(copiar().disabled).toBe(true);
  });

  it("fecha borrada: «Copiar» desactivado, también tras haber elegido un atajo", () => {
    setup();
    fireEvent.click(atajo(/^Hoy/));
    fireEvent.change(otraFecha(), { target: { value: "" } });
    expect(copiar().disabled).toBe(true);
  });

  it("«Copiar» desactivado no llama a onCopy", () => {
    const { onCopy } = setup();
    fireEvent.click(copiar());
    expect(onCopy).not.toHaveBeenCalled();
  });
});

describe("R3: aviso cuando el destino ya tiene entradas", () => {
  const todas = [...ORIGEN_ENTRIES, ...DESTINO_ENTRIES];

  function aConflicto(props: Partial<React.ComponentProps<typeof CopyDaySheet>> = {}) {
    const utils = setup({ entries: todas, ...props });
    fireEvent.click(atajo(/^Hoy/));
    fireEvent.click(copiar("Copiar a hoy"));
    return utils;
  }

  it("«Copiar» no copia todavía: muestra «El mar 22 sep ya tiene 2 entradas»", () => {
    const { onCopy } = aConflicto();
    expect(onCopy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "El mar 22 sep ya tiene 2 entradas" })).toBeTruthy();
  });

  it("lista las entradas que ya hay, con franja y kcal, y avisa de que no se borra nada", () => {
    aConflicto();
    const d = dialog();
    expect(within(d).getByText("Tostadas con aguacate")).toBeTruthy();
    expect(within(d).getByText("Desayuno · 290 kcal")).toBeTruthy();
    expect(within(d).getByText("Ensalada mixta")).toBeTruthy();
    expect(within(d).getByText("Comida · 210 kcal")).toBeTruthy();
    expect(d.textContent).toMatch(/No se borra nada/);
  });

  it("el nombre de una entrada de receta sale de la receta", () => {
    const conReceta: MealEntry = { ...ORIGEN_ENTRIES[2], id: "r1", date: TODAY, mealType: "Cena" };
    aConflicto({ entries: [...ORIGEN_ENTRIES, conReceta] });
    expect(within(dialog()).getByText("Lentejas")).toBeTruthy();
    expect(within(dialog()).getByText("Cena · 520 kcal")).toBeTruthy();
  });

  it("«Sumar las 5 entradas» llama a onCopy con el destino, una vez", () => {
    const { onCopy } = aConflicto();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Sumar las 5 entradas" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(TODAY);
  });

  it("«Cancelar» cierra todo sin copiar", () => {
    const { onCopy, onClose } = aConflicto();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("en singular: «ya tiene 1 entrada» y «Sumar la entrada»", () => {
    aConflicto({ entries: [ORIGEN_ENTRIES[0], DESTINO_ENTRIES[0]] });
    expect(screen.getByRole("dialog", { name: "El mar 22 sep ya tiene 1 entrada" })).toBeTruthy();
    expect(within(dialog()).getByRole("button", { name: "Sumar la entrada" })).toBeTruthy();
  });

  it("el conflicto depende del destino elegido: a mañana (sin entradas) copia directamente", () => {
    const { onCopy } = setup({ entries: todas });
    fireEvent.click(atajo(/^Mañana/));
    fireEvent.click(copiar("Copiar a mañana"));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(TOMORROW);
    expect(screen.queryByRole("dialog", { name: /ya tiene/ })).toBeNull();
  });

  it("destino sin entradas: «Copiar» llama directamente a onCopy, sin aviso", () => {
    const { onCopy } = setup();
    fireEvent.click(atajo(/^Hoy/));
    fireEvent.click(copiar("Copiar a hoy"));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: /ya tiene/ })).toBeNull();
  });

  it("Escape en el aviso cierra sin copiar", () => {
    const { onCopy, onClose } = aConflicto();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });
});

describe("Edge case: doble toque", () => {
  it("dos toques seguidos en «Copiar» copian una sola vez", () => {
    const { onCopy } = setup();
    fireEvent.click(atajo(/^Hoy/));
    const boton = copiar("Copiar a hoy");
    fireEvent.click(boton, { detail: 1 });
    fireEvent.click(boton, { detail: 2 });
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("dos toques seguidos en «Sumar» copian una sola vez", () => {
    const { onCopy } = setup({ entries: [...ORIGEN_ENTRIES, ...DESTINO_ENTRIES] });
    fireEvent.click(atajo(/^Hoy/));
    fireEvent.click(copiar("Copiar a hoy"));
    const sumar = within(dialog()).getByRole("button", { name: "Sumar las 5 entradas" });
    fireEvent.click(sumar, { detail: 1 });
    fireEvent.click(sumar, { detail: 2 });
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
