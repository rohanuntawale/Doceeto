"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActions } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { MED_CATALOG, DARK_STORES } from "@/lib/demo/seed";
import { formatINR } from "@/lib/utils/format";

export default function PatientMedicine() {
  const { patient } = useCurrentPatient();
  const { createOrder } = useActions();
  const toast = useToast();
  const [cart, setCart] = useState<Record<string, number>>({});

  const add = (name: string) =>
    setCart((c) => ({ ...c, [name]: (c[name] ?? 0) + 1 }));
  const sub = (name: string) =>
    setCart((c) => {
      const n = (c[name] ?? 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[name];
      else next[name] = n;
      return next;
    });

  const items = useMemo(
    () =>
      Object.entries(cart).map(([name, qty]) => ({
        name,
        qty,
        price: MED_CATALOG.find((m) => m.name === name)?.price ?? 0,
      })),
    [cart],
  );
  const total = items.reduce((a, i) => a + i.price * i.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);

  function placeOrder() {
    if (count === 0) return;
    createOrder({
      patientId: patient.id,
      patientName: patient.name,
      items: items.map((i) => ({ name: i.name, qty: i.qty })),
      total,
      address: patient.address,
      darkStore: DARK_STORES[0],
    });
    toast.push({
      tone: "success",
      title: "Order placed",
      desc: "Track it live on your home screen — ETA ~10 min.",
    });
    setCart({});
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <div className="font-jp text-sm text-salmon">薬 · AURAMED</div>
        <h1 className="mt-1 font-serif text-3xl text-cream">Order medicine</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
          <Store className="h-3.5 w-3.5" /> {DARK_STORES[0]} · ~10 min to{" "}
          {patient.address}
        </p>
      </div>

      <div className="space-y-2">
        {MED_CATALOG.map((m) => {
          const qty = cart[m.name] ?? 0;
          return (
            <div
              key={m.name}
              className="flex items-center gap-3 rounded-card border border-[var(--border)] bg-espresso-800 p-3.5 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cream">{m.name}</p>
                <p className="font-mono text-xs text-[var(--text-faint)]">
                  {formatINR(m.price)}
                </p>
              </div>
              {qty === 0 ? (
                <Button size="sm" variant="subtle" onClick={() => add(m.name)}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sub(m.name)}
                    className="grid h-7 w-7 place-items-center rounded-md bg-white/5 text-cream hover:bg-white/10"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm text-cream">{qty}</span>
                  <button
                    onClick={() => add(m.name)}
                    className="grid h-7 w-7 place-items-center rounded-md bg-terracotta text-cream hover:bg-terracotta-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky checkout bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[57px] z-20 border-t border-[var(--border)] bg-espresso/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="metric text-lg text-cream">{formatINR(total)}</div>
              <div className="label">
                {count} item{count > 1 ? "s" : ""}
              </div>
            </div>
            <Button onClick={placeOrder}>
              <ShoppingBag className="h-4 w-4" /> Place order
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
