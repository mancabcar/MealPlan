"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import {
  PANTRY_CATEGORIES,
  PANTRY_CATEGORY_ICONS,
  PantryCategory,
  isExpired,
  isExpiringSoon,
} from "@/lib/types";

export default function PantryPage() {
  const { pantry, addPantryItem, removePantryItem } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [category, setCategory] = useState<PantryCategory>("Nevera");

  const submit = () => {
    if (!name.trim() || !quantity.trim()) return;
    addPantryItem({
      id: crypto.randomUUID(),
      name: name.trim(),
      quantity: quantity.trim(),
      expiryDate: expiryDate || undefined,
      category,
    });
    setName("");
    setQuantity("");
    setExpiryDate("");
    setShowAdd(false);
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Despensa</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold"
        >
          + Añadir
        </button>
      </div>

      {showAdd && (
        <section className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm flex flex-col gap-3">
          <input className={inputCls} placeholder="Nombre (p.ej. pechuga de pollo)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Cantidad (p.ej. 200g, 1 bote)" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <label className="text-xs text-zinc-500 flex flex-col gap-1">
            Fecha de caducidad (opcional)
            <input type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as PantryCategory)}>
            {PANTRY_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button onClick={submit} className="bg-emerald-600 text-white rounded-lg py-2 font-semibold text-sm">
            Guardar
          </button>
        </section>
      )}

      {PANTRY_CATEGORIES.map((cat) => {
        const items = pantry.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-2">
              {PANTRY_CATEGORY_ICONS[cat]} {cat}
            </h2>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-1.5 text-sm">
                <div>
                  <span>{item.name}</span>
                  <span className="text-zinc-500 ml-2 text-xs">{item.quantity}</span>
                  {isExpired(item) && (
                    <span className="ml-2 text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full px-2 py-0.5">
                      caducado
                    </span>
                  )}
                  {isExpiringSoon(item) && (
                    <span className="ml-2 text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5">
                      caduca pronto
                    </span>
                  )}
                </div>
                <button onClick={() => removePantryItem(item.id)} className="text-rose-500">
                  ✕
                </button>
              </div>
            ))}
          </section>
        );
      })}

      {pantry.length === 0 && !showAdd && (
        <p className="text-zinc-500 text-sm text-center py-8">
          Tu despensa está vacía. Añade ingredientes para que la IA los tenga en cuenta al sugerir recetas.
        </p>
      )}
    </div>
  );
}
