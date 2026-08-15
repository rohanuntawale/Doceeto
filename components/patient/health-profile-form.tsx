"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeartPulse, Save } from "lucide-react";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import {
  ACTIVITY_CHOICES,
  BLOOD_GROUPS,
  WAIST_INCHES_MAX,
  WAIST_INCHES_MIN,
  bmiBand,
  bmiOf,
  cmToInches,
  healthProfileCompletion,
  inchesToCm,
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
  // Held in INCHES — what the patient types. Converted to cm on save,
  // because that is the unit IDRS is defined in (see lib/health/profile.ts).
  const [waistIn, setWaistIn] = useState(cmToInches(p.waistCm)?.toString() ?? "");
  const [activity, setActivity] = useState(p.activity ?? "");
  const [diabetes, setDiabetes] = useState(p.diabetes ?? "");
  const [hypertension, setHypertension] = useState(p.hypertension ?? "");
  const [dob, setDob] = useState(p.dob ?? "");
  const [gender, setGender] = useState(p.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState<string>(p.bloodGroup ?? "");
  const [allergies, setAllergies] = useState(p.allergies ?? "");
  const [conditions, setConditions] = useState(p.conditions ?? "");
  const [medications, setMedications] = useState(p.medications ?? "");
  const [surgeries, setSurgeries] = useState(p.surgeries ?? "");
  const [familyHistory, setFamilyHistory] = useState(p.familyHistory ?? "");
  const [ecName, setEcName] = useState(p.emergencyContactName ?? "");
  const [ecPhone, setEcPhone] = useState(p.emergencyContactPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const localDraftDirty = useRef(false);
  const currentDraftSignature = useRef("");

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

    // A save response can arrive after the patient has started editing the
    // next field. Keep that newer local draft instead of snapping the inputs
    // back to the older response.
    if (localDraftDirty.current) {
      hydratedFrom.current = stamp;
      return;
    }
    hydratedFrom.current = stamp;

    setHeightCm(saved.heightCm?.toString() ?? "");
    setWeightKg(saved.weightKg?.toString() ?? "");
    setWaistIn(cmToInches(saved.waistCm)?.toString() ?? "");
    setActivity(saved.activity ?? "");
    setDiabetes(saved.diabetes ?? "");
    setHypertension(saved.hypertension ?? "");
    setDob(saved.dob ?? "");
    setGender(saved.gender ?? "");
    setBloodGroup(saved.bloodGroup ?? "");
    setAllergies(saved.allergies ?? "");
    setConditions(saved.conditions ?? "");
    setMedications(saved.medications ?? "");
    setSurgeries(saved.surgeries ?? "");
    setFamilyHistory(saved.familyHistory ?? "");
    setEcName(saved.emergencyContactName ?? "");
    setEcPhone(saved.emergencyContactPhone ?? "");
  }, [patient.healthProfile]);

  // Live preview: the same math the dashboard and the score use.
  const bmi = useMemo(
    () => bmiOf({ heightCm: Number(heightCm) || undefined, weightKg: Number(weightKg) || undefined }),
    [heightCm, weightKg],
  );

  const completion = healthProfileCompletion(p);

  const buildProfile = useCallback((): HealthProfile => sanitizeHealthProfile({
    heightCm, weightKg,
    waistCm: inchesToCm(Number(waistIn) || undefined),
    dob, gender, bloodGroup, activity,
    diabetes, hypertension, allergies, conditions,
    medications, surgeries, familyHistory,
    emergencyContactName: ecName, emergencyContactPhone: ecPhone,
  }), [
    heightCm, weightKg, waistIn, dob, gender, bloodGroup, activity,
    diabetes, hypertension, allergies, conditions, medications, surgeries,
    familyHistory, ecName, ecPhone,
  ]);

  const profileSignature = useCallback((profile: HealthProfile) => {
    const { updatedAt: _updatedAt, ...persisted } = profile;
    return JSON.stringify(persisted);
  }, []);

  currentDraftSignature.current = profileSignature(buildProfile());

  const save = useCallback(async (silent = false) => {
    // Same sanitizer the server runs — what you see saved is what it keeps.
    const profile = buildProfile();

    setSaving(true);
    setSaveStatus("idle");
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
      // Only clear the dirty guard when the response contains the latest
      // draft. If the user edited during the request, the autosave effect will
      // persist that newer draft next.
      localDraftDirty.current = currentDraftSignature.current !== profileSignature(profile);
      setSaveStatus("saved");
      if (!silent) {
        toast.push({
          tone: "success",
          title: t("health.saved"),
          desc: t("health.savedDesc"),
        });
      }
    } catch (err) {
      setSaveStatus("error");
      toast.push({
        tone: "error",
        title: t("health.saveFailed"),
        desc: err instanceof Error ? err.message : t("common.retry"),
      });
    } finally {
      setSaving(false);
    }
  }, [buildProfile, profileSignature, update, toast, t]);

  /**
   * Persist edits after a short pause. The saved-profile signature prevents
   * hydration and the update caused by a successful save from triggering a
   * second request.
   */
  useEffect(() => {
    if (!patient.ready) return;
    const saved = patient.healthProfile;
    const stamp = saved?.updatedAt ?? "loaded";
    if (saved && hydratedFrom.current !== stamp) return;

    const draft = buildProfile();
    if (saved && profileSignature(draft) === profileSignature(saved)) {
      localDraftDirty.current = false;
      setSaveStatus("saved");
      return;
    }

    localDraftDirty.current = true;
    const timer = window.setTimeout(() => {
      void save(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    patient.ready, patient.healthProfile, buildProfile, profileSignature, save,
  ]);

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
            <input type="number" min={WAIST_INCHES_MIN} max={WAIST_INCHES_MAX} step={0.5}
              className={inputCls} value={waistIn}
              onChange={(e) => setWaistIn(e.target.value)} placeholder="34" />
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
          <Field label={t("field.ecName")}>
            <input className={inputCls} value={ecName} maxLength={80}
              onChange={(e) => setEcName(e.target.value)} placeholder="Who should we call?" />
          </Field>
          <Field label={t("field.ecPhone")}>
            <input type="tel" className={inputCls} value={ecPhone} maxLength={20}
              onChange={(e) => setEcPhone(e.target.value)} placeholder="+91…" />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white/[0.025] px-3 py-2.5">
          <span className="text-[11px] text-[var(--text-muted)]">
            {saving ? "Saving your changes…" : saveStatus === "error" ? "Couldn’t save — try again" : "Changes save automatically"}
          </span>
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              saving ? "animate-pulse bg-tan" : saveStatus === "error" ? "bg-[rgb(var(--c-status-critical))]" : "bg-[rgb(var(--c-status-ok))]",
            )}
            aria-hidden
          />
        </div>

        {/* Manual retry remains available for a failed network save. */}
        <button
          onClick={() => void save()}
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
