"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import type { Doctor } from "@/lib/types/domain";

const SPECIALTIES = [
  "General Physician",
  "Cardiologist",
  "Pediatrician",
  "Orthopedic",
  "Dermatologist",
  "Gynecologist",
  "ENT",
  "Psychiatrist",
];

export function EditProfileDialog({
  doctor,
  open,
  onClose,
}: {
  doctor: Doctor;
  open: boolean;
  onClose: () => void;
}) {
  const { updateDoctor } = useActions();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    consultFee: doctor.consultFee,
    homeVisitFee: doctor.homeVisitFee,
  });

  // Re-sync if the underlying doctor changes while closed.
  useEffect(() => {
    if (open) {
      setForm({
        fullName: doctor.fullName,
        specialty: doctor.specialty,
        consultFee: doctor.consultFee,
        homeVisitFee: doctor.homeVisitFee,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateDoctor(doctor.id, {
      fullName: form.fullName.trim() || doctor.fullName,
      specialty: form.specialty,
      consultFee: Number(form.consultFee) || 0,
      homeVisitFee: Number(form.homeVisitFee) || 0,
    });
    toast.push({ tone: "success", title: "Profile updated" });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="w-full max-w-md animate-fade-up rounded-t-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card sm:rounded-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="label">ZUMI · EDIT</div>
            <h3 className="font-serif text-xl text-cream">Edit profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Full name">
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className={inputCls}
              placeholder="Dr. Ananya Rao"
            />
          </Field>

          <Field label="Specialty">
            <select
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className={inputCls}
            >
              {[...new Set([doctor.specialty, ...SPECIALTIES])].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Consult fee (₹)">
              <input
                type="number"
                min={0}
                value={form.consultFee}
                onChange={(e) =>
                  setForm({ ...form, consultFee: Number(e.target.value) })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Home visit fee (₹)">
              <input
                type="number"
                min={0}
                value={form.homeVisitFee}
                onChange={(e) =>
                  setForm({ ...form, homeVisitFee: Number(e.target.value) })
                }
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="submit" className="flex-1">
            Save changes
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
