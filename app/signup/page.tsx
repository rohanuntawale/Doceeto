"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Name, BrandMark } from "@/components/brand/wordmark";
import { RegistryAutofill } from "@/components/auth/registry-autofill";
import { AuthShell, authPanelCls } from "@/components/auth/auth-shell";
import { useToast } from "@/components/ui/toast";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { setCurrentDoctorId } from "@/lib/hooks/use-current-doctor";
import { demoStore } from "@/lib/demo/store";
import { googleAuthEnabled as googleEnabled, isDemoMode } from "@/lib/config";
import { useWarmBackend } from "@/lib/hooks/use-warm-backend";
import { SIGNUP_HANDOFF_KEY } from "@/lib/auth/constants";
import {
  NURSE_ACCENT_VARS,
  NURSE_CADRES,
  NURSE_SERVICES,
  NURSE_TITLES,
  type NurseService,
} from "@/lib/nurse";
import { cn } from "@/lib/utils/cn";

type Role = "patient" | "doctor" | "nurse";

// Kept in step with components/doctor/edit-profile-dialog.tsx.
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

/**
 * Doceeto landing — the single onboarding, matched to the pitch deck:
 * deep-forest shell, paper text, gold accents, the serif "Doceeto" wordmark
 * (gold "ee") and the clinician figure. Patients sign up with name/email/password;
 * doctors continue to a second step that captures their full practice profile
 * (specialty, credentials, languages, fees) so patients see a complete card
 * from day one. `?as=doctor` preselects the doctor toggle (deep links).
 */
export default function Landing() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LandingShell />
    </Suspense>
  );
}

function LandingShell() {
  return (
    <AuthShell>
      <OnboardingPanel />
    </AuthShell>
  );
}

// ── Left: the onboarding card ─────────────────────────────────
function OnboardingPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { update } = useCurrentPatient();
  // Wake the database while they're still reading — sign-in lands warm.
  useWarmBackend();

  /**
   * Arrived back from Google as a doctor. Google proved who they are but knows
   * nothing about their practice, so they land straight in the profile step —
   * no account exists yet, and none will until this form is submitted.
   */
  const googleDoctor = params.get("google") === "doctor";
  const googleNurse = params.get("google") === "nurse";
  /** Arrived back from Google as either provider cadre — no step 1, profile only. */
  const googleProvider = googleDoctor || googleNurse;
  const [role, setRole] = useState<Role>(
    googleDoctor || params.get("as") === "doctor"
      ? "doctor"
      : googleNurse || params.get("as") === "nurse"
        ? "nurse"
        : "patient",
  );
  /**
   * Keep the toggle honest when `?as=` changes under a mounted page.
   *
   * The initialiser above only runs on the first render, and Next does not
   * remount a page for a query-string change — so arriving at /signup, then
   * following a "For providers" link to /signup?as=doctor, left the form on
   * "I need care" while the URL claimed otherwise. Keyed on the param value,
   * so a visitor who then picks a different role by hand keeps their choice.
   */
  const asParam = params.get("as");
  useEffect(() => {
    if (asParam === "doctor" || asParam === "nurse" || asParam === "patient") {
      setRole(asParam);
    }
  }, [asParam]);

  const [name, setName] = useState(
    googleProvider ? (params.get("name") ?? "") : "",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Doctor onboarding is two steps: account basics, then the full practice
  // profile — everything a patient reads on the doctor's card and detail page.
  const [step, setStep] = useState<1 | 2>(googleProvider ? 2 : 1);

  /**
   * Account basics handed over by the sign-in switch.
   *
   * A doctor or nurse who typed their name, email and password there has
   * already answered step 1 — asking for the three of them again on arrival
   * is a form that forgot what it was just told. Read once and cleared, so a
   * password never outlives the navigation it was needed for.
   *
   * Deliberately skipped for the Google path: that identity is proved and
   * parked server-side, and a stale handoff must not smuggle a password into
   * a flow that has no use for one. Runs on mount only — a later click on the
   * role toggle is the visitor's own choice and is left alone.
   */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(SIGNUP_HANDOFF_KEY);
      if (raw) sessionStorage.removeItem(SIGNUP_HANDOFF_KEY);
    } catch {
      return; // private mode — step 1 asks for the basics as it always has
    }
    if (!raw || googleProvider) return;
    try {
      const handoff = JSON.parse(raw) as {
        role?: string;
        name?: string;
        email?: string;
        password?: string;
      };
      if (handoff.role !== "doctor" && handoff.role !== "nurse") return;
      if (!handoff.email || !handoff.password) return;
      setRole(handoff.role);
      setName(handoff.name ?? "");
      setEmail(handoff.email);
      setPassword(handoff.password);
      setStep(2);
    } catch {
      // Malformed. Nothing lost: step 1 is still there to fill in.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [kind, setKind] = useState<"practising" | "resident">("practising");
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const [age, setAge] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [languages, setLanguages] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [education, setEducation] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [consultFee, setConsultFee] = useState("400");
  const [homeVisitFee, setHomeVisitFee] = useState("900");
  const [clinicAddress, setClinicAddress] = useState("");

  // Nurse-only profile fields. Nurses reuse gender/age/experience/languages/
  // registrationNo from above; these are the parts that differ from a doctor.
  const [nurseTitle, setNurseTitle] = useState<string>(NURSE_TITLES[0]);
  const [nurseCadre, setNurseCadre] = useState<string>(NURSE_CADRES[1]); // GNM
  const [nurseSkills, setNurseSkills] = useState<NurseService[]>([]);
  const [nurseFee, setNurseFee] = useState("600");

  function toggleSkill(id: NurseService) {
    setNurseSkills((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (role === "doctor") {
      // Step 1 → 2: check the account basics here (mirroring the server's
      // rules) so nobody fills the whole profile only to bounce on a weak
      // password afterwards.
      if (step === 1) {
        if (!isDemoMode) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return setError("Enter a valid email address.");
          }
          if (
            password.length < 8 ||
            !/[a-zA-Z]/.test(password) ||
            !/\d/.test(password)
          ) {
            return setError(
              "Password must be 8+ characters and include a letter and a number.",
            );
          }
        }
        setStep(2);
        return;
      }

      // Step 2 — the profile itself. Demo keeps the doctor in the browser;
      // live creates the account + session on the backend.
      const ageNum = Math.round(Number(age));
      if (!gender) return setError("Select your gender.");
      if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
        return setError("Enter your age (18–100).");
      }
      const languageList = languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
      if (languageList.length === 0) {
        return setError("List at least one language you consult in.");
      }
      if (!qualifications.trim()) {
        return setError("Add your qualifications, patients see these first.");
      }
      const profile = {
        fullName: name.trim() || "Doctor",
        specialty,
        kind,
        gender,
        age: ageNum,
        experienceYears: Math.max(
          0,
          Math.min(70, Math.round(Number(experienceYears)) || 0),
        ),
        languages: languageList,
        qualifications: qualifications.trim(),
        education: education.trim(),
        registrationNo: registrationNo.trim(),
        consultFee: Math.max(0, Number(consultFee) || 400),
        homeVisitFee: Math.max(0, Number(homeVisitFee) || 900),
        clinicAddress: clinicAddress.trim(),
      };

      if (isDemoMode) {
        const doc = demoStore.registerDoctor(profile);
        setCurrentDoctorId(doc.id);
        toast.push({
          tone: "success",
          title: "Welcome to Doceeto",
          desc: "Your profile is live, go online when ready.",
        });
        router.push("/doctor");
        return;
      }

      // Google doctor: the identity is already proved and parked server-side,
      // so this submit carries the practice profile only — no email, no
      // password, and nothing about them taken from the browser's word.
      if (googleDoctor) {
        if (!registrationNo.trim()) {
          return setError("Add your medical registration number.");
        }
        setLoading(true);
        const res = await fetch("/api/auth/google/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(profile),
        });
        const data = await res.json().catch(() => ({}));
        setLoading(false);
        if (!res.ok)
          return setError(data.error ?? "Could not create the account.");
        toast.push({
          tone: "success",
          title: "Welcome to Doceeto",
          desc: "Your profile is live, go online when ready.",
        });
        router.push("/doctor");
        router.refresh();
        return;
      }

      setLoading(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "doctor", email, password, ...profile }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok)
        return setError(data.error ?? "Could not create the account.");
      toast.push({
        tone: "success",
        title: "Welcome to Doceeto",
        desc: "Your profile is live, go online when ready.",
      });
      router.push("/doctor");
      router.refresh();
      return;
    }

    if (role === "nurse") {
      // Step 1 → 2: same account checks as the doctor path. (A Google nurse
      // never sees step 1 — identity is already parked server-side.)
      if (step === 1) {
        if (!isDemoMode) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return setError("Enter a valid email address.");
          }
          if (
            password.length < 8 ||
            !/[a-zA-Z]/.test(password) ||
            !/\d/.test(password)
          ) {
            return setError(
              "Password must be 8+ characters and include a letter and a number.",
            );
          }
        }
        setStep(2);
        return;
      }

      // Step 2 — the nurse profile. Patients filter on skills, so at least
      // one is required; the server allowlists them against NURSE_SERVICES.
      if (isDemoMode) {
        return setError("Nurse signup needs the live backend.");
      }
      const ageNum = Math.round(Number(age));
      if (!gender) return setError("Select your gender.");
      if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
        return setError("Enter your age (18–100).");
      }
      const languageList = languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
      if (languageList.length === 0) {
        return setError("List at least one language you work in.");
      }
      if (nurseSkills.length === 0) {
        return setError("Pick at least one service you offer.");
      }
      if (!registrationNo.trim()) {
        return setError("Add your nursing council registration number.");
      }

      const nurseProfile = {
        fullName: name.trim() || "Nurse",
        title: nurseTitle,
        qualifications: nurseCadre,
        registrationNo: registrationNo.trim(),
        gender,
        age: ageNum,
        experienceYears: Math.max(
          0,
          Math.min(70, Math.round(Number(experienceYears)) || 0),
        ),
        languages: languageList,
        skills: nurseSkills,
        homeVisitFee: Math.max(0, Number(nurseFee) || 600),
      };

      setLoading(true);
      // Google nurse: identity is parked server-side, so this submit carries
      // the profile only. Password path registers the account whole.
      const res = googleNurse
        ? await fetch("/api/auth/google/complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(nurseProfile),
          })
        : await fetch("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              role: "nurse",
              email,
              password,
              ...nurseProfile,
            }),
          });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok)
        return setError(data.error ?? "Could not create the account.");
      toast.push({
        tone: "success",
        title: "Welcome to Doceeto",
        desc: "Your profile is in, verification comes next, then you can go online.",
      });
      router.push("/nurse");
      router.refresh();
      return;
    }

    // Patient — the effortless path. Demo keeps identity in the browser;
    // live creates the real account on the backend and sets the session.
    if (isDemoMode) {
      update({ name: name.trim() || "Guest" });
      toast.push({
        tone: "success",
        title: "Welcome to Doceeto",
        desc: "Your space is ready.",
      });
      router.push("/patient");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "patient",
        name,
        email,
        password,
        address: "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Could not create the account.");
    toast.push({
      tone: "success",
      title: "Welcome to Doceeto",
      desc: "Your account is ready.",
    });
    router.push("/patient");
    router.refresh();
  }

  return (
    <section className={authPanelCls}>
      {/* soft ambient glow, like the rest of the app */}
      <div className="relative mx-auto w-full max-w-[22rem] text-center">
        {/* wordmark */}
        <div className="flex items-center justify-center gap-2.5">
          <BrandMark />
          <div className="text-left leading-none">
            <Name className="text-lg" />
            <div className="mt-1 text-[10px] tracking-[0.14em] text-[var(--text-faint)]">
              Care that reaches you
            </div>
          </div>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* headline */}
        <h1
          className="animate-rise mt-8 font-serif text-4xl leading-[1.03] tracking-tight text-[var(--text)] min-[380px]:text-[2.6rem] sm:text-[3rem]"
          style={{ animationDelay: "40ms" }}
        >
          {step === 2 ? (
            <>
              Your <span className="text-[var(--accent)]">practice profile</span>
            </>
          ) : (
            <>
              Start your <span className="text-[var(--accent)]">care journey</span>
            </>
          )}
        </h1>

        {step === 1 && (
          <>
            {/* Google sign-in is shown only when its OAuth client is configured. */}
            {googleEnabled && (
              <div
                className="animate-rise mt-7 flex justify-center"
                style={{ animationDelay: "90ms" }}
              >
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] p-1.5">
                  <SocialButton
                    label={
                      role === "doctor"
                        ? "Continue with Google as a doctor"
                        : role === "nurse"
                          ? "Continue with Google as a nurse"
                          : "Continue with Google"
                    }
                    href={`/api/auth/google/start?role=${role}`}
                  >
                    <GoogleGlyph />
                  </SocialButton>
                </div>
              </div>
            )}

            {/* or divider */}
            {googleEnabled && (
              <div
                className="animate-rise mt-6 flex items-center gap-3"
                style={{ animationDelay: "120ms" }}
              >
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs text-[var(--text-faint)]">or</span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
            )}

            {/* role toggle */}
            <div
              className="animate-rise mt-6"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex rounded-full border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] p-1 text-sm">
                {(["patient", "doctor", "nurse"] as Role[]).map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setRole(r);
                        setError(null);
                      }}
                      // Nurse surfaces carry the blue accent app-wide; the
                      // active chip says so from the very first tap.
                      style={
                        r === "nurse" && active ? NURSE_ACCENT_VARS : undefined
                      }
                      className={cn(
                        "flex-1 rounded-full px-3 py-2 font-medium transition-colors",
                        active
                          ? "bg-[var(--accent)] text-on-accent"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]",
                      )}
                    >
                      {r === "patient"
                        ? "I need care"
                        : r === "doctor"
                          ? "Doctor"
                          : "Nurse"}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <form
          onSubmit={onSubmit}
          className="animate-rise mt-5 space-y-3 text-left"
          style={{ animationDelay: "190ms" }}
        >
          {step === 1 ? (
            <>
              <label className="block">
                <span className="sr-only">Full name</span>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="block">
                <span className="sr-only">Email</span>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required={!isDemoMode}
                />
              </label>
              <label className="relative block">
                <span className="sr-only">Password</span>
                <input
                  type={showPw ? "text" : "password"}
                  className={cn(inputCls, "pr-11")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                  required={!isDemoMode}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
                >
                  {showPw ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </label>
            </>
          ) : role === "nurse" ? (
            <div style={NURSE_ACCENT_VARS} className="space-y-4">
              {/* Step 2 (nurse), what patients read on the nurse's card.
                  Blue accent from the first screen: nurse surfaces are blue
                  everywhere in the app. */}

              {/* A Google nurse never saw step 1, same treatment as the
                  Google doctor: identity is proved, the profile is theirs
                  to state, starting with the name they practise under. */}
              {googleNurse && (
                <>
                  <div className="rounded-lg border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] px-3.5 py-3 text-left text-xs leading-relaxed text-[var(--text-muted)]">
                    Signed in with Google. Your account isn&rsquo;t created yet
                    patients choose a nurse on what&rsquo;s below, so it has
                    to come from you.
                  </div>
                  <Field label="Full name">
                    <input
                      className={inputCls}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                    />
                  </Field>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Title patients see">
                  <select
                    className={inputCls}
                    value={nurseTitle}
                    onChange={(e) => setNurseTitle(e.target.value)}
                  >
                    {NURSE_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nursing qualification">
                  <select
                    className={inputCls}
                    value={nurseCadre}
                    onChange={(e) => setNurseCadre(e.target.value)}
                  >
                    {NURSE_CADRES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Services you offer (pick all that apply)">
                <div className="flex flex-wrap gap-2 pt-1">
                  {NURSE_SERVICES.map((s) => {
                    const on = nurseSkills.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkill(s.id)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                          on
                            ? "border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.09)] text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender">
                  <select
                    className={inputCls}
                    value={gender}
                    onChange={(e) =>
                      setGender(e.target.value as "" | "female" | "male")
                    }
                    required
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </Field>
                <Field label="Age">
                  <input
                    className={inputCls}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    inputMode="numeric"
                    placeholder="29"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Experience (years)">
                  <input
                    className={inputCls}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    inputMode="numeric"
                    placeholder="6"
                  />
                </Field>
                <Field label="Nursing council reg. no.">
                  <input
                    className={inputCls}
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value)}
                    placeholder="MNC-11482"
                    required
                  />
                  <RegistryAutofill
                    registrationNo={registrationNo}
                    onApply={(m) => {
                      if (m.fullName) setName(m.fullName);
                      if (m.qualification) setQualifications(m.qualification);
                    }}
                  />
                </Field>
              </div>

              <Field label="Languages (comma-separated)">
                <input
                  className={inputCls}
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="Marathi, Hindi, English"
                  required
                />
              </Field>

              <Field label="Home visit fee (₹)">
                <input
                  className={inputCls}
                  value={nurseFee}
                  onChange={(e) => setNurseFee(e.target.value)}
                  inputMode="numeric"
                  placeholder="600"
                />
              </Field>
            </div>
          ) : (
            <>
              {/* Step 2, the profile patients will read. Everything here
                  lands on the doctor's public card and detail page. */}

              {/* A Google doctor never saw step 1, so their name is asked for
                  here. Prefilled from Google, and editable, the name on the
                  card should be the one they practise under. */}
              {googleDoctor && (
                <>
                  <div className="rounded-lg border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] px-3.5 py-3 text-xs leading-relaxed text-[var(--text-muted)]">
                    Signed in with Google. Your account isn&rsquo;t created yet
                    patients choose a doctor on what&rsquo;s below, so it has
                    to come from you.
                  </div>
                  <Field label="Full name">
                    <input
                      className={inputCls}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                    />
                  </Field>
                </>
              )}

              <Field label="Specialty">
                <select
                  className={inputCls}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <span className="label">Practice status</span>
                <div className="mt-1.5 flex rounded-xl border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] p-1 text-sm">
                  {(["practising", "resident"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 font-medium capitalize transition-colors",
                        kind === k
                          ? "bg-[var(--accent)] text-on-accent"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]",
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender">
                  <select
                    className={inputCls}
                    value={gender}
                    onChange={(e) =>
                      setGender(e.target.value as "" | "female" | "male")
                    }
                    required
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </Field>
                <Field label="Age">
                  <input
                    type="number"
                    min={18}
                    max={100}
                    className={inputCls}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="34"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Experience (years)">
                  <input
                    type="number"
                    min={0}
                    max={70}
                    className={inputCls}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="8"
                    required
                  />
                </Field>
                <Field label="Medical reg. no.">
                  <input
                    className={inputCls}
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value)}
                    placeholder="MH-12345"
                    maxLength={60}
                  />
                  <RegistryAutofill
                    registrationNo={registrationNo}
                    onApply={(m) => {
                      if (m.fullName) setName(m.fullName);
                      if (m.qualification) setQualifications(m.qualification);
                    }}
                  />
                </Field>
              </div>

              <Field label="Languages (comma-separated)">
                <input
                  className={inputCls}
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="English, Hindi, Marathi"
                  required
                />
              </Field>

              <Field label="Qualifications">
                <input
                  className={inputCls}
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="MBBS, MD (General Medicine)"
                  maxLength={200}
                  required
                />
              </Field>

              <Field label="Educational background">
                <input
                  className={inputCls}
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Seth GS Medical College, Mumbai"
                  maxLength={200}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Consult fee (₹)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={consultFee}
                    onChange={(e) => setConsultFee(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Home visit fee (₹)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={homeVisitFee}
                    onChange={(e) => setHomeVisitFee(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <Field label="Clinic address (optional)">
                <input
                  className={inputCls}
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  placeholder="Vaishali Nagar, Nagpur, near City Hospital"
                  autoComplete="off"
                  maxLength={160}
                />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-[var(--accent)]-300">{error}</p>}

          {/* primary CTA with a subtle sheen sweep on hover */}
          <div className="group relative overflow-hidden rounded-lg">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading
                ? "Setting up…"
                : step === 2
                  ? "Join"
                  : role === "patient"
                    ? "Start"
                    : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 group-hover:animate-sheen motion-reduce:hidden"
            />
          </div>

          {/* A Google doctor has no step 1 to go back to, their email and
              identity came from Google, not from a form. */}
          {step === 2 && !googleProvider && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className="mx-auto flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to account details
            </button>
          )}

          <p className="text-center text-xs text-[var(--text-faint)]">
            {step === 2
              ? "Patients see this on your profile, you can edit it anytime"
              : role === "doctor"
                ? "Next: your specialty, credentials & fees"
                : role === "nurse"
                  ? "Next: your services, credentials & fee"
                  : "as a patient, no card, no wait"}
          </p>
        </form>

        {/* sign-in + brand line */}
        <p
          className="animate-rise mt-6 text-sm text-[var(--text-muted)]"
          style={{ animationDelay: "240ms" }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--text)] transition-colors hover:text-[var(--accent)]"
          >
            Log in
          </Link>
        </p>
        {/* Footer links, /about and /contact were unreachable islands
            before this: nothing in the app linked to them. */}
        <div
          className="animate-rise mt-8 space-y-2 text-[11px] text-[var(--text-faint)]"
          style={{ animationDelay: "280ms" }}
        >
          <div className="flex items-center justify-center gap-3">
            <Link href="/about" className="transition-colors hover:text-[var(--text)]">
              About
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/contact"
              className="transition-colors hover:text-[var(--text)]"
            >
              Contact
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/ops-signin"
              className="transition-colors hover:text-[var(--text)]"
            >
              Ops sign in
            </Link>
          </div>
          <div>© 2026 Doceeto · Care that reaches you</div>
        </div>
      </div>
    </section>
  );
}

const inputCls =
  "h-12 w-full rounded-2xl border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] px-4 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[rgb(var(--accent-rgb)/0.4)]";

// Labelled field for the doctor profile step — unlike step 1's placeholder-only
// inputs, a dozen fields need visible labels to stay scannable.
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

// Small circular social button. The link flips to a spinner on first click —
// a cold serverless redirect can take seconds, and a silent button invites the
// double-click that used to break the flow.
function SocialButton({
  label,
  href,
  children,
}: {
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  const cls =
    "grid h-11 w-11 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[rgb(var(--accent-rgb)/0.07)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.4)]";
  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        title={label}
        aria-disabled={leaving}
        onClick={(e) => {
          if (leaving) e.preventDefault();
          else setLeaving(true);
        }}
        className={cn(cls, leaving && "cursor-wait")}
      >
        {leaving ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text)]" />
        ) : (
          children
        )}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() =>
        toast.push({
          tone: "info",
          title: "Coming soon",
          desc: "Social sign-in isn't wired up yet.",
        })
      }
      className={cls}
    >
      {children}
    </button>
  );
}

// ── Right: deck cover plate — green radial, gold rings, mascot ─
// Brand glyphs inlined (no lucide brand-icon dependency). Google keeps its
// colors to read at a glance; Apple rides currentColor.
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C39.99 34.955 44 30 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

