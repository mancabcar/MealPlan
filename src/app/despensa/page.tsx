"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  PANTRY_CATEGORIES,
  PANTRY_CATEGORY_ICONS,
  PantryCategory,
  isExpired,
  isExpiringSoon,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Despensa</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-3 py-1.5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Añadir
        </button>
      </div>

      {showAdd && (
        <Card className="flex flex-col gap-3">
          <input className={inputCls} placeholder="Nombre (p.ej. pechuga de pollo)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Cantidad (p.ej. 200g, 1 bote)" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <label className="text-xs text-[var(--color-text-muted)] flex flex-col gap-1">
            Fecha de caducidad (opcional)
            <input type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as PantryCategory)}>
            {PANTRY_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={submit}
            className="bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg py-2 font-semibold text-sm"
          >
            Guardar
          </button>
        </Card>
      )}

      {PANTRY_CATEGORIES.map((cat) => {
        const items = pantry.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const CategoryIcon = PANTRY_CATEGORY_ICONS[cat];
        return (
          <Card key={cat}>
            {/* aria-label distingue esta cabecera de categoría del <h1> "Despensa" de la página: la
                categoría "Despensa" y el título de la página coinciden literalmente (ver R4 — antes el
                emoji delante del texto los diferenciaba sin querer; con el icono aria-hidden ya no). */}
            <h2 aria-label={`Categoría ${cat}`} className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <CategoryIcon className="w-4 h-4" aria-hidden /> {cat}
            </h2>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{item.name}</span>
                  <span className="text-[var(--color-text-muted)] text-xs">{item.quantity}</span>
                  {isExpired(item) && <Chip tone="expired">caducado</Chip>}
                  {isExpiringSoon(item) && <Chip tone="expiring">caduca pronto</Chip>}
                </div>
                <button onClick={() => removePantryItem(item.id)} aria-label="Eliminar" className="text-[var(--color-expired)]">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </div>
            ))}
          </Card>
        );
      })}

      {pantry.length === 0 && !showAdd && (
        <p className="text-[var(--color-text-muted)] text-sm text-center py-8">
          Tu despensa está vacía. Añade ingredientes para que la IA los tenga en cuenta al sugerir recetas.
        </p>
      )}
    </div>
  );
}
