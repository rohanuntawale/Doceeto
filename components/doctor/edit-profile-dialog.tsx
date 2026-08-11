"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, modalPanelCls } from "@/components/ui/modal";
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
  "Neurologist",
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
  const snapshot = () => ({
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    consultFee: doctor.consultFee,
    homeVisitFee: doctor.homeVisitFee,
    experienceYears: doctor.experienceYears,
    age: doctor.age ?? ("" as number | ""),
    languages: doctor.languages.join(", "),
    qualifications: doctor.qualifications ?? "",
    education: doctor.education ?? "",
    about: doctor.about ?? "",
    registrationNo: doctor.registrationNo ?? "",
    clinicAddress: doctor.clinicAddress ?? "",
  });
  const [form, setForm] = useState(snapshot);

  // Re-sync if the underlying doctor changes while closed.
  useEffect(() => {
    if (open) setForm(snapshot());
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
      experienceYears: Math.max(0, Number(form.experienceYears) || 0),
      // Only send age when set — the sanitizer clamps to 18–100.
      ...(form.age !== "" && Number(form.age) ? { age: Number(form.age) } : {}),
      // Comma-separated → array; empty entries dropped.
      languages: form.languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      // Empty strings are allowed — they revert the field to its
      // specialty-derived fallback on the patient profile.
      qualifications: form.qualifications.trim(),
      education: form.education.trim(),
      about: form.about.trim(),
      registrationNo: form.registrationNo.trim(),
      clinicAddress: form.clinicAddress.trim(),
    });
    toast.push({ tone: "success", title: "Profile updated" });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className={modalPanelCls}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="label">DOCEETO · EDIT</div>
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

          {/* Credentials patients see on your public profile */}
          <div className="label pt-1 text-salmon">What patients see</div>

          <Field label="Clinic address (optional)">
            <input
              value={form.clinicAddress}
              onChange={(e) =>
                setForm({ ...form, clinicAddress: e.target.value })
              }
              className={inputCls}
              maxLength={160}
              placeholder="Shivaji Nagar, Nagpur — near City Hospital"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Experience (yrs)">
              <input
                type="number"
                min={0}
                max={70}
                value={form.experienceYears}
                onChange={(e) =>
                  setForm({ ...form, experienceYears: Number(e.target.value) })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Age">
              <input
                type="number"
                min={18}
                max={100}
                value={form.age}
                onChange={(e) =>
                  setForm({
                    ...form,
                    age: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className={inputCls}
                placeholder="34"
              />
            </Field>
            <div className="col-span-2 sm:col-span-1">
              <Field label="Med. reg. no.">
                <input
                  value={form.registrationNo}
                  onChange={(e) =>
                    setForm({ ...form, registrationNo: e.target.value })
                  }
                  className={inputCls}
                  placeholder="MH-12345"
                />
              </Field>
            </div>
          </div>

          <Field label="Languages (comma-separated)">
            <input
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
              className={inputCls}
              placeholder="English, Hindi, Marathi"
            />
          </Field>

          <Field label="Qualifications">
            <input
              value={form.qualifications}
              onChange={(e) =>
                setForm({ ...form, qualifications: e.target.value })
              }
              className={inputCls}
              placeholder="MBBS, MD (General Medicine)"
            />
          </Field>

          <Field label="Academic background">
            <input
              value={form.education}
              onChange={(e) => setForm({ ...form, education: e.target.value })}
              className={inputCls}
              placeholder="Seth GS Medical College, Mumbai"
            />
          </Field>

          <Field label="About you">
            <textarea
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              rows={3}
              maxLength={600}
              className={`${inputCls} resize-none`}
              placeholder="A short bio patients will see on your profile."
            />
          </Field>
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
    </Modal>
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
