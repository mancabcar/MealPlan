"use client";

// Lista de la compra (docs/pm/lista-compra). Toda la lógica está en lib/shopping; aquí solo se pinta.
// Detalle y hoja de "Pasar a la Despensa" van en estado local, no en la URL (sin useSearchParams).
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Circle, ShoppingCart } from "lucide-react";
import { useShoppingList } from "@/lib/shopping/useShoppingList";
import { AISLES, type Aisle } from "@/lib/shopping/classify";
import type { Row } from "@/lib/shopping/view";
import { PANTRY_CATEGORIES, todayStr, type MealType, type PantryCategory } from "@/lib/types";
import { DAY_NAMES, weekDates } from "@/lib/week";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { inputCls } from "@/components/ui/input";

/** Ubicación sugerida al pasar a la Despensa (R13): lo fresco a la Nevera, lo demás a la Despensa. */
const SUGGESTED: Record<Aisle, PantryCategory> = {
  "Frutas y verduras": "Nevera",
  "Carne y pescado": "Nevera",
  "Lácteos y huevos": "Nevera",
  "Despensa y conservas": "Despensa",
  Otros: "Despensa",
};

function joinMeals(meals: MealType[]): string {
  return meals.length <= 1 ? meals.join("") : `${meals.slice(0, -1).join(", ")} y ${meals[meals.length - 1]}`;
}

export default function ShoppingListPage() {
  const list = useShoppingList();
  const { view } = list;
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const allRows = [...Object.values(view.toBuy).flat(), ...view.haveIt, ...view.basics, ...view.bought];
  const detail = allRows.find((r) => r.item.key === detailKey);
  const plannedMeals = new Set(allRows.flatMap((r) => r.item.sources.map((s) => `${s.date}|${s.mealType}`))).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/plan" className="text-sm text-[var(--color-text-muted)] flex items-center gap-1 self-start">
          <ArrowLeft className="w-4 h-4" aria-hidden /> Plan
        </Link>
        <h1 className="font-display text-2xl font-bold">Lista de la compra</h1>
        {!list.empty && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {plannedMeals} {plannedMeals === 1 ? "comida planificada" : "comidas planificadas"} · {joinMeals(list.meals)}
          </p>
        )}
      </div>

      {list.empty ? (
        <Card className="flex flex-col items-center gap-3 text-center py-10">
          <ShoppingCart className="w-8 h-8 text-[var(--color-text-muted)]" aria-hidden />
          <p className="font-semibold">Nada que comprar todavía</p>
          <p className="text-sm text-[var(--color-text-muted)]">Asigna recetas a tus comidas de esta semana y aquí aparecerán sus ingredientes.</p>
          <Link
            href="/plan"
            className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Ir al Plan
          </Link>
        </Card>
      ) : (
        <>
          <Progress bought={view.counts.bought} total={view.counts.toBuyTotal} />

          {AISLES.map((aisle) =>
            view.toBuy[aisle].length === 0 ? null : (
              <Card as="section" key={aisle} aria-label={aisle}>
                <h2 className="text-sm font-semibold mb-1">{aisle}</h2>
                <ItemList rows={view.toBuy[aisle]} onTick={list.toggleBought} onOpen={setDetailKey} />
              </Card>
            ),
          )}

          <Group title="Ya lo tienes" count={view.haveIt.length} open>
            <ItemList rows={view.haveIt} onOpen={setDetailKey} />
          </Group>
          <Group title="Especias y básicos" count={view.basics.length}>
            <ItemList rows={view.basics} onTick={list.toggleBought} onOpen={setDetailKey} />
          </Group>
          <Group title="Comprados" count={view.bought.length}>
            <ItemList rows={view.bought} onTick={list.toggleBought} onOpen={setDetailKey} />
          </Group>

          {view.bought.length > 0 && (
            <button
              onClick={() => setMoving(true)}
              className="sticky bottom-24 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-full py-3 font-semibold text-sm shadow-lg shadow-black/40"
            >
              Pasar {view.bought.length} comprados a la Despensa
            </button>
          )}
        </>
      )}

      {detail && (
        <DetailSheet
          row={detail}
          onClose={() => setDetailKey(null)}
          onOverride={(on) => {
            list.setOverride(detail.item, on);
            setDetailKey(null);
          }}
        />
      )}
      {moving && <MoveSheet rows={view.bought} onClose={() => setMoving(false)} onConfirm={list.moveToPantry} />}
    </div>
  );
}

function Progress({ bought, total }: { bought: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((bought / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-[var(--color-text-muted)]">
        {bought} de {total} comprados
      </p>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden" aria-hidden>
        <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Group({ title, count, open = false, children }: { title: string; count: number; open?: boolean; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <details open={open} className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
      <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">
        <span>
          {title} <span className="text-[var(--color-text-muted)] font-normal">· {count}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

function ItemList({ rows, onTick, onOpen }: { rows: Row[]; onTick?: (item: Row["item"]) => void; onOpen: (key: string) => void }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.item.key} className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-b-0">
          {onTick && (
            <button
              role="checkbox"
              aria-checked={row.bought}
              aria-label={row.item.name}
              onClick={() => onTick(row.item)}
              className={`mt-0.5 shrink-0 ${row.bought ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
            >
              {row.bought ? <Check className="w-5 h-5" aria-hidden /> : <Circle className="w-5 h-5" aria-hidden />}
            </button>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <button
              onClick={() => onOpen(row.item.key)}
              aria-label={`${row.item.name} · ${row.amount}`}
              className={`flex justify-between gap-3 text-left text-sm ${row.bought ? "line-through text-[var(--color-text-muted)]" : ""}`}
            >
              <span>{row.item.name}</span>
              <span className="text-[var(--color-text-muted)] shrink-0">{row.amount}</span>
            </button>
            {(row.match && !row.overridden) || row.expiredMatch || row.item.optional ? (
              <div className="flex flex-wrap gap-1.5">
                {row.match && !row.overridden && (
                  <Chip>
                    Tienes: {row.match.name} · {row.match.quantity}
                  </Chip>
                )}
                {row.expiredMatch && <Chip tone="expired">El de tu Despensa está caducado</Chip>}
                {row.item.optional && <Chip>opcional</Chip>}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DetailSheet({ row, onClose, onOverride }: { row: Row; onClose: () => void; onOverride: (on: boolean) => void }) {
  const dates = weekDates(todayStr());
  const { item, match, expiredMatch, overridden } = row;
  return (
    <Sheet title={item.name} onClose={onClose}>
      <p className="text-sm">
        <span className="text-[var(--color-text-muted)]">Total: </span>
        <span className="font-semibold">{row.amount}</span>
      </p>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Se usa en</h3>
        <ul className="flex flex-col">
          {item.sources.map((s, i) => (
            <li key={i} className="py-2 border-b border-[var(--color-border)] last:border-b-0 text-sm flex flex-col">
              <span>
                {DAY_NAMES[dates.indexOf(s.date)]} · {s.mealType} · {s.recipeName}
              </span>
              <span className="text-[var(--color-text-muted)]">{s.raw}</span>
            </li>
          ))}
        </ul>
      </div>
      {match && (
        <Card padding="sm" className="bg-[var(--color-surface-2)] text-sm flex flex-col gap-0.5">
          <span className="text-[var(--color-text-muted)] text-xs">En tu Despensa</span>
          <span>
            {match.name} · {match.quantity} · {match.category}
          </span>
        </Card>
      )}
      {expiredMatch && (
        <p className="text-sm text-[var(--color-expired)]">
          El de tu Despensa está caducado: {expiredMatch.name} · {expiredMatch.quantity}
        </p>
      )}
      {match && !overridden && (
        <button
          onClick={() => onOverride(true)}
          className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2.5 font-semibold text-sm"
        >
          Añadir a la lista de todos modos
        </button>
      )}
      {overridden && (
        <button onClick={() => onOverride(false)} className="border border-[var(--color-border)] rounded-lg py-2.5 text-sm">
          Quitar de la lista
        </button>
      )}
    </Sheet>
  );
}

function MoveSheet({
  rows,
  onClose,
  onConfirm,
}: {
  rows: Row[];
  onClose: () => void;
  onConfirm: (moves: { item: Row["item"]; category: PantryCategory }[]) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.item.key, { include: true, category: SUGGESTED[r.item.aisle] }])),
  );
  const selected = rows.filter((r) => draft[r.item.key]?.include);
  const set = (key: string, patch: Partial<{ include: boolean; category: PantryCategory }>) =>
    setDraft({ ...draft, [key]: { ...draft[key], ...patch } });

  const confirm = () => {
    onConfirm(selected.map((r) => ({ item: r.item, category: draft[r.item.key].category })));
    router.push("/despensa");
  };

  return (
    <Sheet title="Pasar a la Despensa" onClose={onClose}>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const d = draft[r.item.key];
          return (
            <li key={r.item.key} className="flex items-center gap-3 py-2 border-b border-[var(--color-border)] last:border-b-0">
              <input
                type="checkbox"
                aria-label={r.item.name}
                checked={d.include}
                onChange={(e) => set(r.item.key, { include: e.target.checked })}
                className="w-4 h-4 accent-[var(--color-accent)]"
              />
              <div className="flex-1 min-w-0 text-sm flex flex-col">
                <span>{r.item.name}</span>
                <span className="text-[var(--color-text-muted)] text-xs">{r.amount}</span>
              </div>
              <select
                aria-label={`Ubicación de ${r.item.name}`}
                value={d.category}
                onChange={(e) => set(r.item.key, { category: e.target.value as PantryCategory })}
                className={`${inputCls} w-auto`}
              >
                {PANTRY_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <button
        onClick={confirm}
        disabled={selected.length === 0}
        className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
      >
        Añadir {selected.length} a la Despensa
      </button>
    </Sheet>
  );
}
