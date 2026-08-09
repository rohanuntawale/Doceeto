"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n";
import { NURSE_CADRES, NURSE_SERVICES, NURSE_TITLES, skillsOf } from "@/lib/nurse";
import { cn } from "@/lib/utils/cn";
import type { Doctor } from "@/lib/types/domain";

/**
 * Edit everything on a nurse's patient-facing profile — the counterpart to the
 * doctor's EditProfileDialog, with the fields a nurse is actually chosen on.
 *
 * The differences from the doctor form are the point: no specialty (a title
 * instead), no consult fee (nurses do not take video consults), no academic
 * background, and a services multi-select, because a patient books a nurse for
 * a task rather than for a discipline. The server re-checks every one of these
 * in sanitizeDoctorPatch — the services against the catalogue — so nothing here
 * is trusted just because the form produced it.
 */
export function EditNurseProfileDialog({
  nurse,
  open,
  onClose,
}: {
  nurse: Doctor;
  open: boolean;
  onClose: () => void;
}) {
  const { updateDoctor } = useActions();
  const toast = useToast();
  const { t } = useT();

  const snapshot = () => ({
    fullName: nurse.fullName,
    title: nurse.specialty,
    qualifications: nurse.qualifications ?? "",
    registrationNo: nurse.registrationNo ?? "",
    homeVisitFee: nurse.homeVisitFee,
    experienceYears: nurse.experienceYears,
    age: nurse.age ?? ("" as number | ""),
    languages: nurse.languages.join(", "),
    about: nurse.about ?? "",
    skills: skillsOf(nurse) as string[],
  });
  const [form, setForm] = useState(snapshot);

  // Re-sync if the underlying row changed while the dialog was closed.
  useEffect(() => {
    if (open) setForm(snapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggleSkill = (id: string) =>
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(id) ? f.skills.filter((x) => x !== id) : [...f.skills, id],
    }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateDoctor(nurse.id, {
      fullName: form.fullName.trim() || nurse.fullName,
      // The title rides on `specialty`: one column, one display path for every
      // provider, so nurses need no separate rendering anywhere.
      specialty: form.title,
      qualifications: form.qualifications.trim(),
      registrationNo: form.registrationNo.trim(),
      homeVisitFee: Math.max(0, Number(form.homeVisitFee) || 0),
      experienceYears: Math.max(0, Number(form.experienceYears) || 0),
      ...(form.age !== "" && Number(form.age) ? { age: Number(form.age) } : {}),
      languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
      about: form.about.trim(),
      skills: form.skills,
    });
    toast.push({ tone: "success", title: t("nurse.profileSaved") });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className={modalPanelCls}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="label">{t("nurse.editEyebrow")}</div>
            <h3 className="font-serif text-xl text-cream">{t("nurse.editTitle")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label={t("nurse.fullName")}>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className={inputCls}
              placeholder="Meera Joshi"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("nurse.title")}>
              <select
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls}
              >
                {/* The current value first, so a title set before this list
                    existed is never silently rewritten by the dropdown. */}
                {[...new Set([nurse.specialty, ...NURSE_TITLES])].filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("nurse.qualification")}>
              <select
                value={form.qualifications}
                onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                className={inputCls}
              >
                {[...new Set([nurse.qualifications ?? "", ...NURSE_CADRES])]
                  .filter(Boolean)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <div className="label pt-1 text-salmon">{t("nurse.whatPatientsSee")}</div>

          <div>
            <span className="label">{t("nurse.services")}</span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {NURSE_SERVICES.map((s) => {
                const on = form.skills.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSkill(s.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      on
                        ? "border-terracotta bg-terracotta/10 text-cream"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:text-cream",
                    )}
                  >
                    {s.short}
                  </button>
                );
              })}
            </div>
            {form.skills.length === 0 && (
              <p className="mt-2 text-xs text-tan">{t("nurse.pickOneService")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t("nurse.feeLabel")}>
              <input
                type="number"
                min={0}
                value={form.homeVisitFee}
                onChange={(e) => setForm({ ...form, homeVisitFee: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label={t("nurse.experienceYrs")}>
              <input
                type="number"
                min={0}
                max={70}
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label={t("nurse.age")}>
              <input
                type="number"
                min={18}
                max={100}
                value={form.age}
                onChange={(e) =>
                  setForm({ ...form, age: e.target.value === "" ? "" : Number(e.target.value) })
                }
                className={inputCls}
                placeholder="30"
              />
            </Field>
          </div>

          <Field label={t("nurse.councilNo")}>
            <input
              value={form.registrationNo}
              onChange={(e) => setForm({ ...form, registrationNo: e.target.value })}
              className={inputCls}
              placeholder="MNC-11482"
            />
          </Field>

          <Field label={t("nurse.languagesLabel")}>
            <input
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
              className={inputCls}
              placeholder="Marathi, Hindi, English"
            />
          </Field>

          <Field label={t("nurse.aboutYou")}>
            <textarea
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              rows={3}
              maxLength={600}
              className={`${inputCls} resize-none`}
              placeholder={t("nurse.aboutPlaceholder")}
            />
          </Field>
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="submit" className="flex-1">
            {t("nurse.saveChanges")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
