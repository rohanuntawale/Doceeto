"use client";

import { useState } from "react";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import type { ConsultRequest } from "@/lib/types/domain";

type Item = { name: string; dosage: string; duration: string };

/** The clinical output of a visit: the doctor writes an e-prescription,
 *  which completes the request and appears in the patient's record. */
export function PrescriptionDialog({
  request,
  doctorId,
  onClose,
}: {
  request: ConsultRequest;
  doctorId: string;
  onClose: () => void;
}) {
  const { createPrescription } = useActions();
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [items, setItems] = useState<Item[]>([{ name: "", dosage: "", duration: "" }]);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  function submit() {
    const cleanItems = items.filter((it) => it.name.trim());
    createPrescription({
      requestId: request.id,
      doctorId,
      diagnosis: diagnosis.trim() || "Consultation",
      items: cleanItems,
      advice: advice.trim(),
    });
    toast.push({
      tone: "success",
      title: "Prescription issued",
      desc: `${request.patientName} — visit completed.`,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />
      <div className="glass-strong relative z-10 w-full max-w-lg rounded-card p-5">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--text-faint)] hover:text-cream"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-terracotta/12 text-salmon ring-1 ring-inset ring-terracotta/20">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <div className="label">Prescription</div>
            <p className="text-sm font-medium text-cream">
              {request.patientName} · {request.symptoms}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="label">Diagnosis</span>
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Viral fever"
              className={inputCls}
            />
          </label>

          <div>
            <span className="label">Medicines</span>
            <div className="mt-1.5 space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                    placeholder="Medicine"
                    className={`${inputCls} flex-[2]`}
                  />
                  <input
                    value={it.dosage}
                    onChange={(e) => setItem(i, { dosage: e.target.value })}
                    placeholder="1-0-1"
                    className={`${inputCls} flex-1`}
                  />
                  <input
                    value={it.duration}
                    onChange={(e) => setItem(i, { duration: e.target.value })}
                    placeholder="5 days"
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    onClick={() => setItems((l) => l.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded-lg px-2 text-[var(--text-faint)] hover:text-status-critical"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setItems((l) => [...l, { name: "", dosage: "", duration: "" }])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-salmon hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add medicine
            </button>
          </div>

          <label className="block">
            <span className="label">Advice</span>
            <textarea
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              rows={2}
              placeholder="Rest, fluids, follow up in 3 days if not better."
              className={`${inputCls} resize-none`}
            />
          </label>

          <Button className="w-full" onClick={submit}>
            Issue prescription & complete visit
          </Button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60";
