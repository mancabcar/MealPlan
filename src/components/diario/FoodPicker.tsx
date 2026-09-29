"use client";

// Pestaña «Alimento» de «Añadir comida» (docs/pm/13-base-alimentos/tech.md › UI, prototipo variante 1A).
// Buscador con dos bloques: «Básicos» (tabla local, al escribir) y «Productos de marca» (Open Food Facts, solo al
// pulsar). Al tocar un resultado, la lista se sustituye por la tarjeta del alimento con la cantidad.
// El Diario la mantiene montada (oculta) mientras el formulario está abierto: así la búsqueda sobrevive a un cambio
// de pestaña (Edge cases).
import { useId, useState, type MouseEvent } from "react";
import { Camera, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  FOODS_CITATION,
  GRAMS_ERROR,
  GRAM_CHIPS,
  UNITS_ERROR,
  UNIT_CHIPS,
  displayMacro,
  parseGrams,
  parseUnits,
  scaleMacros,
  searchLocalFoods,
  type BrandProduct,
  type LocalFood,
  type Per100,
} from "@/lib/foods";
import { formatServings } from "@/lib/diary";
import { useBrandSearch } from "@/lib/useBrandSearch";
import { useBarcodeLookup } from "@/lib/useBarcodeLookup";
import { BarcodeScanner } from "./BarcodeScanner";
import { ChipRadios } from "@/components/ui/ChipRadios";
import { inputCls } from "@/components/ui/input";
import { normalize } from "@/lib/text";

/** Lo que el Diario necesita para crear la entrada (foodEntry). */
export interface PickedFood {
  foodId: string;
  name: string;
  per100: Per100;
}

interface Selected extends PickedFood {
  /** «Básico · 130 kcal / 100 g» o «<marca> · 122 kcal / 100 g». */
  subtitle: string;
  /** Peso de 1 ud: unitGrams de la tabla o servingGrams de OFF (R7). */
  unitGrams?: number;
}

type QtyMode = "grams" | "units";

const per100Of = (f: Per100): Per100 => ({ kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat });

function fromLocal(f: LocalFood): Selected {
  return {
    foodId: `local:${f.id}`,
    name: f.name,
    per100: per100Of(f),
    subtitle: `Básico · ${Math.round(f.kcal)} kcal / 100 g`,
    unitGrams: f.unitGrams,
  };
}

function fromBrand(p: BrandProduct): Selected {
  return {
    foodId: `off:${p.code}`,
    // R8: «Producto · Marca»; sin marca, solo el producto (Edge cases)
    name: p.brand ? `${p.name} · ${p.brand}` : p.name,
    per100: per100Of(p),
    subtitle: `${p.brand ?? "Producto de marca"} · ${Math.round(p.kcal)} kcal / 100 g`,
    unitGrams: p.servingGrams,
  };
}

/** R12: «0:30». */
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const sectionTitleCls = "font-display text-xs font-semibold uppercase tracking-wider";
const rowCls =
  "w-full min-h-12 flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-sm text-left";
const chipBtnCls = (active: boolean) =>
  `flex-1 min-h-11 rounded-lg border text-sm ${
    active
      ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)] font-bold"
      : "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)]"
  }`;

function ResultRow({ name, detail, kcal, onPick }: { name: string; detail?: string; kcal: number; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className={rowCls}>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="truncate">{name}</span>
        {detail && <span className="truncate text-xs text-[var(--color-text-muted)]">{detail}</span>}
      </span>
      <span className="shrink-0 text-right text-[13px] text-[var(--color-text-muted)]">
        {Math.round(kcal)} kcal
        <br />
        <span className="text-[11px]">/100 g</span>
      </span>
      <ChevronRight className="shrink-0 w-4 h-4 text-[var(--color-text-muted)]" aria-hidden />
    </button>
  );
}

export function FoodPicker({
  hidden,
  onAdd,
  onManual,
}: {
  hidden: boolean;
  /** Recibe el evento para que el Diario ignore el segundo clic de un doble toque (singleClick). */
  onAdd: (food: PickedFood, qty: { grams: number; units?: number }, ev: MouseEvent) => void;
  /** R14: «¿No lo encuentras?» → Personalizada con el nombre ya escrito. */
  onManual: (name: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [qtyMode, setQtyMode] = useState<QtyMode>("grams");
  const [gramsText, setGramsText] = useState("100");
  const [unitsText, setUnitsText] = useState("1");
  const brands = useBrandSearch();
  const barcode = useBarcodeLookup();
  const [scanning, setScanning] = useState(false);
  const [codeText, setCodeText] = useState("");

  const query = text.trim();
  const searching = normalize(query).length >= 2;
  const basics = searching ? searchLocalFoods(query) : [];

  const editText = (value: string) => {
    setText(value);
    // Edge cases: el bloque de marcas era de la búsqueda anterior
    if (brands.state !== "idle") brands.reset();
  };

  const pick = (s: Selected) => {
    setSelected(s);
    // R7: abre en Unidades si el alimento tiene unidad. Cada tarjeta empieza en 100 g / 1 ud.
    setQtyMode(s.unitGrams ? "units" : "grams");
    setGramsText("100");
    setUnitsText("1");
  };

  // R4, R5: al terminar una búsqueda por código (escaneado o escrito a mano), se abre la tarjeta si hay macros
  // completos, o se cae a Personalizada con el código anotado. Se reacciona en el propio manejador (no en un
  // efecto que observe el estado) para no encadenar un setState sobre otro.
  const onCodeResult = (result: Awaited<ReturnType<typeof barcode.lookup>>) => {
    if (result?.state === "ok" && result.product) {
      pick(fromBrand(result.product));
      barcode.reset();
    } else if (result?.state === "not_found") {
      onManual(`Código ${result.code}`);
      barcode.reset();
    }
  };
  const runCode = async (c: string) => onCodeResult(await barcode.lookup(c));
  const runRetry = async () => onCodeResult(await barcode.retry());

  if (selected) {
    const unitGrams = selected.unitGrams;
    const inUnits = qtyMode === "units" && unitGrams !== undefined;
    const units = inUnits ? parseUnits(unitsText) : null;
    const grams = inUnits ? (units !== null ? units * unitGrams : null) : parseGrams(gramsText);
    // «Añadir 150 g», «Añadir 2 ud»; con una cantidad no válida, lo escrito (el botón está desactivado)
    const typed = (inUnits ? unitsText : gramsText).trim() || "0";
    const qtyLabel = inUnits ? `${units !== null ? formatServings(units) : typed} ud` : `${grams ?? typed} g`;
    const macros = scaleMacros(selected.per100, grams ?? 0);
    const qtyId = `${id}-qty`;
    const errorId = `${qtyId}-error`;
    const invalid = grams === null;

    return (
      <div hidden={hidden} className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="self-start flex items-center gap-1 min-h-11 text-sm text-[var(--color-accent)]"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
          Otro alimento
        </button>
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-bold">{selected.name}</p>
          <p className="text-[13px] text-[var(--color-text-muted)]">{selected.subtitle}</p>
        </div>

        {unitGrams !== undefined && (
          <ChipRadios
            label="Cantidad en"
            name={`${id}-mode`}
            options={[
              { value: "grams", label: "Gramos" },
              { value: "units", label: "Unidades" },
            ]}
            value={qtyMode}
            onChange={(v: QtyMode) => setQtyMode(v)}
          />
        )}

        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={qtyId} className="text-[13px] text-[var(--color-text-muted)]">
            {inUnits ? "Unidades" : "Gramos"}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={qtyId}
              inputMode={inUnits ? "decimal" : "numeric"}
              value={inUnits ? unitsText : gramsText}
              onChange={(e) => (inUnits ? setUnitsText(e.target.value) : setGramsText(e.target.value))}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              className={`${inputCls} text-lg font-bold ${invalid ? "border-[var(--color-expired)]" : ""}`}
            />
            <span className="shrink-0 text-[var(--color-text-muted)]">{inUnits ? "ud" : "g"}</span>
          </div>
          <div className="flex gap-1.5">
            {inUnits
              ? UNIT_CHIPS.map((u) => (
                  <button key={u} type="button" onClick={() => setUnitsText(String(u))} className={chipBtnCls(units === u)}>
                    {u} ud
                  </button>
                ))
              : GRAM_CHIPS.map((g) => (
                  <button key={g} type="button" onClick={() => setGramsText(String(g))} className={chipBtnCls(grams === g)}>
                    {g} g
                  </button>
                ))}
          </div>
          {invalid && (
            <span id={errorId} role="alert" className="text-xs text-[var(--color-expired)]">
              {inUnits ? UNITS_ERROR : GRAMS_ERROR}
            </span>
          )}
          {/* R7: peso equivalente */}
          {inUnits && grams !== null && (
            <span className="text-[13px] text-[var(--color-text-muted)]">
              1 ud ≈ {Math.round(unitGrams)} g · total {Math.round(grams)} g
            </span>
          )}
        </div>

        {/* R6: macros en vivo, redondeados */}
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              ["kcal", displayMacro(macros.calories, "kcal"), "kcal"],
              ["protein", `${displayMacro(macros.protein, "protein")} g`, "Prot."],
              ["carbs", `${displayMacro(macros.carbs, "carbs")} g`, "Hidr."],
              ["fat", `${displayMacro(macros.fat, "fat")} g`, "Grasa"],
            ] as const
          ).map(([k, value, label]) => (
            <p key={k} className="flex flex-col items-center gap-0.5 rounded-lg bg-[var(--color-surface-2)] px-1 py-2">
              <span className="font-display text-lg font-bold">{invalid ? "–" : value}</span>{" "}
              <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
            </p>
          ))}
        </div>

        <button
          type="button"
          disabled={invalid}
          onClick={(ev) => grams !== null && onAdd(selected, inUnits ? { grams, units: units! } : { grams }, ev)}
          className="min-h-11 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] font-bold disabled:opacity-40"
        >
          Añadir {qtyLabel}
        </button>
      </div>
    );
  }

  const brandLabel = `Buscar «${query}» en productos de marca`;
  const showBrandButton = searching && (brands.state === "idle" || brands.state === "rate_limited");
  const failed = brands.state === "offline" || brands.state === "error";

  return (
    <div hidden={hidden} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-search`} className="text-[13px] text-[var(--color-text-muted)]">
          Buscar alimento
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" aria-hidden />
          <input
            id={`${id}-search`}
            type="search"
            autoComplete="off"
            value={text}
            onChange={(e) => editText(e.target.value)}
            className={`${inputCls} pl-9 pr-10`}
          />
          {text && (
            <button
              type="button"
              onClick={() => editText("")}
              aria-label="Borrar búsqueda"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[var(--color-text-muted)]"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* R1: botón «Escanear» + campo «Código de barras», siempre visibles (no dependen de `searching`) */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={barcode.cooldown > 0}
          className="min-h-11 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-accent)] px-3 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-60"
        >
          <Camera className="w-4 h-4 shrink-0" aria-hidden />
          Escanear
        </button>
        <div className="flex gap-1.5">
          <label htmlFor={`${id}-code`} className="sr-only">
            Código de barras
          </label>
          <input
            id={`${id}-code`}
            inputMode="numeric"
            placeholder="o escribe el código"
            value={codeText}
            onChange={(e) => setCodeText(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={() => void runCode(codeText.trim())}
            disabled={codeText.trim() === "" || barcode.cooldown > 0}
            className="min-h-11 px-4 rounded-lg border border-[var(--color-accent)] text-sm font-semibold text-[var(--color-accent)] disabled:opacity-60"
          >
            Buscar código
          </button>
        </div>
        {/* R5: no encontrado cae directo a Personalizada (efecto de arriba); red/límite muestran este aviso */}
        {(barcode.state === "offline" || barcode.state === "error" || barcode.state === "rate_limited") && (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 text-sm">
            <p className="font-semibold">No se ha podido comprobar ese código</p>
            <p className="text-[var(--color-text-muted)]">
              {barcode.state === "rate_limited"
                ? "Demasiadas búsquedas seguidas. Podrás volver a intentarlo en unos segundos."
                : barcode.state === "offline"
                  ? "Parece que no hay conexión. Puedes meterlo a mano en Personalizada."
                  : "Open Food Facts no responde ahora. Puedes meterlo a mano en Personalizada."}
            </p>
            <button
              type="button"
              onClick={() => void runRetry()}
              disabled={barcode.cooldown > 0}
              className="self-start min-h-11 px-4 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] font-semibold disabled:opacity-60"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
      {scanning && (
        <BarcodeScanner
          onDetected={(code) => {
            setScanning(false);
            setCodeText(code);
            void runCode(code);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {searching && (
        <section aria-labelledby={`${id}-basics`} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 id={`${id}-basics`} className={`${sectionTitleCls} text-[var(--color-accent)]`}>
              Básicos
            </h4>
            <span className="text-xs text-[var(--color-text-muted)]">Tabla de la app · por 100 g</span>
          </div>
          {basics.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Ningún básico coincide</p>
          ) : (
            <>
              {basics.map((f) => (
                <ResultRow key={f.id} name={f.name} kcal={f.kcal} onPick={() => pick(fromLocal(f))} />
              ))}
              <p className="text-xs text-[var(--color-text-muted)]">{FOODS_CITATION}</p>
            </>
          )}
        </section>
      )}

      {searching && brands.state !== "idle" && (
        <section aria-labelledby={`${id}-brands`} className="flex flex-col gap-1.5" aria-busy={brands.state === "loading"}>
          <div className="flex items-baseline justify-between gap-2">
            <h4 id={`${id}-brands`} className={`${sectionTitleCls} text-[var(--color-text)]`}>
              Productos de marca
            </h4>
            <span className="text-xs text-[var(--color-text-muted)]">Open Food Facts</span>
          </div>
          {brands.state === "loading" && <p className="text-sm text-[var(--color-text-muted)]">Buscando…</p>}
          {brands.state === "ok" &&
            (brands.products.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Ningún producto de marca con los valores completos</p>
            ) : (
              <>
                {brands.products.map((p) => (
                  <ResultRow key={p.code} name={p.name} detail={p.brand} kcal={p.kcal} onPick={() => pick(fromBrand(p))} />
                ))}
                <p className="text-xs text-[var(--color-text-muted)]">
                  Datos de Open Food Facts (ODbL). Pueden tener errores: revisa la etiqueta.
                </p>
              </>
            ))}
          {/* R11: el error se queda en este bloque; los básicos y Personalizada siguen */}
          {failed && (
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 text-sm">
              <p className="font-semibold">No se ha podido buscar en marcas</p>
              <p className="text-[var(--color-text-muted)]">
                {brands.state === "offline"
                  ? "Parece que no hay conexión. Los básicos siguen disponibles y puedes meterlo a mano en Personalizada."
                  : "Open Food Facts no responde ahora. Los básicos siguen disponibles y puedes meterlo a mano en Personalizada."}
              </p>
              <button
                type="button"
                onClick={brands.retry}
                className="self-start min-h-11 px-4 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
              >
                Reintentar
              </button>
            </div>
          )}
          {brands.state === "rate_limited" && (
            <div className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] p-3 text-sm">
              <p className="font-semibold">Demasiadas búsquedas seguidas</p>
              <p className="text-[var(--color-text-muted)]">
                Open Food Facts limita las búsquedas por minuto. Podrás volver a buscar en unos segundos.
              </p>
            </div>
          )}
        </section>
      )}

      {showBrandButton && (
        // R4: solo al pulsar. R12: desactivado con la cuenta atrás mientras dure el límite.
        <button
          type="button"
          onClick={() => brands.search(query)}
          disabled={brands.cooldown > 0}
          className="min-h-11 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-accent)] px-3 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-60"
        >
          <Search className="w-4 h-4 shrink-0" aria-hidden />
          {brands.cooldown > 0 ? `${brandLabel} · ${mmss(brands.cooldown)}` : brandLabel}
        </button>
      )}

      {searching && (
        <button
          type="button"
          onClick={() => onManual(query)}
          className="self-start min-h-11 text-sm text-[var(--color-accent)] underline underline-offset-2"
        >
          ¿No lo encuentras? Añádelo a mano
        </button>
      )}
    </div>
  );
}
