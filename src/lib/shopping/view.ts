// Secciones y recuentos de la lista: lo único que leen la pantalla y la tarjeta de Plan, para que
// nunca discrepen (docs/pm/lista-compra › R1). Puro.
import type { PantryItem } from "@/lib/types";
import { amountSignature, formatAmount, type ShoppingItem } from "./aggregate";
import { AISLES, type Aisle } from "./classify";
import { indexPantry, matchIndexed } from "./pantryMatch";
import type { ShoppingWeekState } from "./state";

export interface Row {
  item: ShoppingItem;
  amount: string;
  bought: boolean;
  overridden: boolean;
  match?: PantryItem;
  expiredMatch?: PantryItem;
}

export interface ShoppingView {
  toBuy: Record<Aisle, Row[]>;
  haveIt: Row[];
  basics: Row[];
  bought: Row[];
  counts: { pending: number; toBuyTotal: number; bought: number; haveIt: number };
}

export function buildShoppingView(i: { items: ShoppingItem[]; pantry: PantryItem[]; state: ShoppingWeekState; today: string }): ShoppingView {
  const toBuy = Object.fromEntries(AISLES.map((a) => [a, [] as Row[]])) as Record<Aisle, Row[]>;
  const haveIt: Row[] = [];
  const basics: Row[] = [];
  const bought: Row[] = [];
  const pantryIndex = indexPantry(i.pantry);

  for (const item of i.items) {
    const signature = amountSignature(item);
    // Pasado a la Despensa y sin cambios de total desde entonces (R14)
    if (i.state.moved[item.key] === signature) continue;
    const row: Row = {
      item,
      amount: formatAmount(item),
      bought: i.state.bought[item.key] === signature,
      overridden: i.state.overrides.includes(item.key),
    };
    // Los básicos no se cruzan con la Despensa (R12)
    if (!item.basic) Object.assign(row, matchIndexed(item.key, pantryIndex, i.today));

    if (row.bought) bought.push(row);
    else if (item.basic) basics.push(row);
    else if (row.match && !row.overridden) haveIt.push(row);
    else toBuy[item.aisle].push(row);
  }

  const pending = Object.values(toBuy).reduce((n, rows) => n + rows.length, 0);
  const boughtCount = bought.filter((r) => !r.item.basic).length;
  return {
    toBuy,
    haveIt,
    basics,
    bought,
    counts: { pending, toBuyTotal: pending + boughtCount, bought: boughtCount, haveIt: haveIt.length },
  };
}
