"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HeartPulse, Save } from "lucide-react";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import {
  ACTIVITY_CHOICES,
  ALCOHOL_CHOICES,
  BLOOD_GROUPS,
  FAMILY_DIABETES_CHOICES,
  SMOKING_CHOICES,
  bmiBand,
  bmiOf,
  healthProfileCompletion,
  sanitizeHealthProfile,
  type HealthProfile,
} from "@/lib/health/profile";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm text-cream outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-primary focus:ring-1 focus:ring-primary/30";

/**
 * The health basics every care app should hold, editable in place on the
 * account page. Saved to the account (server in live mode, browser store in
 * demo); doctors read it through the patient brief once they accept a consult.
 */
export function HealthProfileForm() {
  const { patient, update } = useCurrentPatient();
  const { t } = useT();
  const toast = useToast();
  const p = patient.healthProfile ?? {};

  const [heightCm, setHeightCm] = useState(p.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(p.weightKg?.toString() ?? "");
  const [waistCm, setWaistCm] = useState(p.waistCm?.toString() ?? "");
  const [activity, setActivity] = useState(p.activity ?? "");
  const [diabetes, setDiabetes] = useState(p.diabetes ?? "");
  const [hypertension, setHypertension] = useState(p.hypertension ?? "");
  const [familyDiabetes, setFamilyDiabetes] = useState(p.familyDiabetes ?? "");
  const [dob, setDob] = useState(p.dob ?? "");
  const [gender, setGender] = useState(p.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState<string>(p.bloodGroup ?? "");
  const [allergies, setAllergies] = useState(p.allergies ?? "");
  const [conditions, setConditions] = useState(p.conditions ?? "");
  const [medications, setMedications] = useState(p.medications ?? "");
  const [surgeries, setSurgeries] = useState(p.surgeries ?? "");
  const [familyHistory, setFamilyHistory] = useState(p.familyHistory ?? "");
  const [smoking, setSmoking] = useState(p.smoking ?? "");
  const [alcohol, setAlcohol] = useState(p.alcohol ?? "");
  const [ecName, setEcName] = useState(p.emergencyContactName ?? "");
  const [ecPhone, setEcPhone] = useState(p.emergencyContactPhone ?? "");
  const [saving, setSaving] = useState(false);

  /**
   * Fill the form once the saved profile arrives.
   *
   * The identity hydrates ASYNCHRONOUSLY from /api/auth/me, so on the first
   * render `patient.healthProfile` is still undefined and every useState above
   * captured an empty string. Without this the form looked blank on every
   * reload — which read as "my details were never saved" — and worse, saving
   * that blank form would have wiped the real record. Keyed on updatedAt so it
   * runs when the record actually arrives or changes, never on every keystroke.
   */
  const hydratedFrom = useRef<string | null>(null);
  useEffect(() => {
    const saved = patient.healthProfile;
    if (!saved) return;
    const stamp = saved.updatedAt ?? "loaded";
    if (hydratedFrom.current === stamp) return;
    hydratedFrom.current = stamp;

    setHeightCm(saved.heightCm?.toString() ?? "");
    setWeightKg(saved.weightKg?.toString() ?? "");
    setWaistCm(saved.waistCm?.toString() ?? "");
    setActivity(saved.activity ?? "");
    setDiabetes(saved.diabetes ?? "");
    setHypertension(saved.hypertension ?? "");
    setFamilyDiabetes(saved.familyDiabetes ?? "");
    setDob(saved.dob ?? "");
    setGender(saved.gender ?? "");
    setBloodGroup(saved.bloodGroup ?? "");
    setAllergies(saved.allergies ?? "");
    setConditions(saved.conditions ?? "");
    setMedications(saved.medications ?? "");
    setSurgeries(saved.surgeries ?? "");
    setFamilyHistory(saved.familyHistory ?? "");
    setSmoking(saved.smoking ?? "");
    setAlcohol(saved.alcohol ?? "");
    setEcName(saved.emergencyContactName ?? "");
    setEcPhone(saved.emergencyContactPhone ?? "");
  }, [patient.healthProfile]);

  // Live preview: the same math the dashboard and the score use.
  const bmi = useMemo(
    () => bmiOf({ heightCm: Number(heightCm) || undefined, weightKg: Number(weightKg) || undefined }),
    [heightCm, weightKg],
  );

  const completion = healthProfileCompletion(p);

  async function save() {
    // Same sanitizer the server runs — what you see saved is what it keeps.
    const profile: HealthProfile = sanitizeHealthProfile({
      heightCm, weightKg, waistCm, dob, gender, bloodGroup, activity,
      diabetes, hypertension, familyDiabetes, allergies, conditions,
      medications, surgeries, familyHistory, smoking, alcohol,
      emergencyContactName: ecName, emergencyContactPhone: ecPhone,
    });

    setSaving(true);
    try {
      if (!isDemoMode) {
        const res = await apiFetch("/api/auth/health-profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(profile),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Couldn't save your health profile.");
        update({ healthProfile: body.healthProfile ?? profile });
      } else {
        profile.updatedAt = new Date().toISOString();
        update({ healthProfile: profile });
      }
      toast.push({
        tone: "success",
        title: t("health.saved"),
        desc: t("health.savedDesc"),
      });
    } catch (err) {
      toast.push({
        tone: "error",
        title: t("health.saveFailed"),
        desc: err instanceof Error ? err.message : t("common.retry"),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl fh-card p-5 shadow-soft">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-cream">
          <span className="text-primary"><HeartPulse className="h-4 w-4" /></span>
          {t("health.profileTitle")}
        </h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold",
            completion >= 80
              ? "bg-[rgb(var(--c-status-ok))]/15 text-[rgb(var(--c-status-ok))]"
              : "bg-tan/15 text-tan",
          )}
        >
          {t("health.complete", { n: String(completion) })}
        </span>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
        {t("health.profileDesc")}
      </p>

      <div className="space-y-3">
        {/* Measurements — the pair that unlocks BMI */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.height")}>
            <input type="number" min={50} max={250} className={inputCls} value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)} placeholder="170" />
          </Field>
          <Field label={t("field.weight")}>
            <input type="number" min={2} max={400} className={inputCls} value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)} placeholder="65" />
          </Field>
        </div>

        {bmi !== undefined && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm",
              bmiBand(bmi) === "healthy"
                ? "bg-[rgb(var(--c-status-ok))]/10 text-[rgb(var(--c-status-ok))]"
                : "bg-tan/12 text-tan",
            )}
          >
            <span className="font-medium">{t("health.bmi")} {bmi}</span>
            <span className="text-xs">{t(`bmi.${bmiBand(bmi)}`)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.waist")}>
            <input type="number" min={40} max={200} className={inputCls} value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)} placeholder="85" />
          </Field>
          <Field label={t("field.activity")}>
            <select className={inputCls} value={activity}
              onChange={(e) => setActivity(e.target.value as typeof activity)}>
              <option value="">{t("opt.select")}</option>
              {ACTIVITY_CHOICES.map((c) => (
                <option key={c} value={c}>{t(`opt.${c}`)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.dob")}>
            <input type="date" className={inputCls} value={dob}
              onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label={t("field.gender")}>
            <select className={inputCls} value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}>
              <option value="">{t("opt.select")}</option>
              <option value="female">{t("opt.female")}</option>
              <option value="male">{t("opt.male")}</option>
              <option value="other">{t("opt.other")}</option>
            </select>
          </Field>
        </div>

        {/* The trio that, with waist + activity + age, forms the validated
            Indian Diabetes Risk Score behind the dashboard's risk pillar. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.diabetes")}>
            <select className={inputCls} value={diabetes}
              onChange={(e) => setDiabetes(e.target.value as typeof diabetes)}>
              <option value="">{t("opt.select")}</option>
              <option value="no">{t("opt.no")}</option>
              <option value="yes">{t("opt.yes")}</option>
            </select>
          </Field>
          <Field label={t("field.hypertension")}>
            <select className={inputCls} value={hypertension}
              onChange={(e) => setHypertension(e.target.value as typeof hypertension)}>
              <option value="">{t("opt.select")}</option>
              <option value="no">{t("opt.no")}</option>
              <option value="yes">{t("opt.yes")}</option>
            </select>
          </Field>
        </div>

        <Field label={t("field.familyDiabetes")}>
          <select className={inputCls} value={familyDiabetes}
            onChange={(e) => setFamilyDiabetes(e.target.value as typeof familyDiabetes)}>
            <option value="">{t("opt.select")}</option>
            {FAMILY_DIABETES_CHOICES.map((c) => (
              <option key={c} value={c}>{t(c === "none" ? "opt.noParent" : c === "one-parent" ? "opt.oneParent" : "opt.bothParents")}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.bloodGroup")}>
            <select className={inputCls} value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}>
              <option value="">{t("opt.select")}</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label={t("field.allergies")}>
            <input className={inputCls} value={allergies} maxLength={300}
              onChange={(e) => setAllergies(e.target.value)} placeholder="Penicillin, peanuts…" />
          </Field>
        </div>

        <Field label={t("field.conditions")}>
          <input className={inputCls} value={conditions} maxLength={500}
            onChange={(e) => setConditions(e.target.value)} placeholder="Diabetes, high blood pressure…" />
        </Field>
        <Field label={t("field.medications")}>
          <input className={inputCls} value={medications} maxLength={500}
            onChange={(e) => setMedications(e.target.value)} placeholder="Metformin 500mg daily…" />
        </Field>
        <Field label={t("field.surgeries")}>
          <input className={inputCls} value={surgeries} maxLength={500}
            onChange={(e) => setSurgeries(e.target.value)} placeholder="Appendix removed (2019)…" />
        </Field>
        <Field label={t("field.familyHistory")}>
          <input className={inputCls} value={familyHistory} maxLength={500}
            onChange={(e) => setFamilyHistory(e.target.value)} placeholder="Heart disease (father)…" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.smoking")}>
            <select className={inputCls} value={smoking}
              onChange={(e) => setSmoking(e.target.value as typeof smoking)}>
              <option value="">{t("opt.select")}</option>
              {SMOKING_CHOICES.map((c) => (
                <option key={c} value={c}>{t(`opt.${c}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("field.alcohol")}>
            <select className={inputCls} value={alcohol}
              onChange={(e) => setAlcohol(e.target.value as typeof alcohol)}>
              <option value="">{t("opt.select")}</option>
              {ALCOHOL_CHOICES.map((c) => (
                <option key={c} value={c}>{t(`opt.${c}`)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.ecName")}>
            <input className={inputCls} value={ecName} maxLength={80}
              onChange={(e) => setEcName(e.target.value)} placeholder="Who should we call?" />
          </Field>
          <Field label={t("field.ecPhone")}>
            <input type="tel" className={inputCls} value={ecPhone} maxLength={20}
              onChange={(e) => setEcPhone(e.target.value)} placeholder="+91…" />
          </Field>
        </div>

        {/* Disabled until the account has loaded: saving a form that hasn't
            been filled from the record yet would overwrite the record. */}
        <button
          onClick={save}
          disabled={saving || !patient.ready}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {!patient.ready ? "Loading your details…" : saving ? "Saving…" : t("health.save")}
        </button>

        {p.updatedAt && (
          <p className="text-center text-[11px] text-[var(--text-faint)]">
            {t("health.savedOn")} {new Date(p.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
