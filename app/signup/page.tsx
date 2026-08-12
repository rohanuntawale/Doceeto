"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Name, BrandMark } from "@/components/brand/wordmark";
import { DoctorFigure } from "@/components/brand/doctor-figure";
import { useToast } from "@/components/ui/toast";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { setCurrentDoctorId } from "@/lib/hooks/use-current-doctor";
import { demoStore } from "@/lib/demo/store";
import { googleAuthEnabled as googleEnabled, isDemoMode } from "@/lib/config";
import { useWarmBackend } from "@/lib/hooks/use-warm-backend";
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
    <main className="relative grid min-h-screen place-items-center px-4 pb-6 pt-16 sm:px-6 lg:pt-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[26px] border border-[var(--border)] shadow-card lg:min-h-[86vh] lg:grid-cols-[0.95fr_1.05fr]">
        <OnboardingPanel />
        <CoverPlate />
      </div>
    </main>
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
        return setError("Add your qualifications — patients see these first.");
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
          desc: "Your profile is live — go online when ready.",
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
          desc: "Your profile is live — go online when ready.",
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
        desc: "Your profile is live — go online when ready.",
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
        desc: "Your profile is in — verification comes next, then you can go online.",
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
    <section className="relative flex flex-col justify-center overflow-hidden bg-espresso-800 px-5 py-12 sm:px-10 sm:py-14 md:px-14">
      {/* soft ambient glow, like the rest of the app */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--c-tan) / 0.28), transparent 65%)",
        }}
      />

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

        {/* headline */}
        <h1
          className="animate-rise mt-8 font-serif text-4xl leading-[1.03] tracking-tight text-cream min-[380px]:text-[2.6rem] sm:text-[3rem]"
          style={{ animationDelay: "40ms" }}
        >
          {step === 2 ? (
            <>
              Your <span className="text-salmon">practice profile</span>
            </>
          ) : (
            <>
              Start your <span className="text-salmon">care journey</span>
            </>
          )}
        </h1>

        {step === 1 && (
          <>
            {/* social sign-in. Google is live; the ROLE rides in the query
                string because whichever toggle is active decides what kind of
                account Google's identity creates. Apple stays a teaser. */}
            <div
              className="animate-rise mt-7 flex justify-center"
              style={{ animationDelay: "90ms" }}
            >
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-espresso/60 p-1.5">
                <SocialButton label="Continue with Apple">
                  <AppleGlyph />
                </SocialButton>
                <SocialButton
                  label={
                    role === "doctor"
                      ? "Continue with Google as a doctor"
                      : role === "nurse"
                        ? "Continue with Google as a nurse"
                        : "Continue with Google"
                  }
                  // Whichever toggle is active decides what kind of account
                  // Google's identity creates — all three roles ride through.
                  href={
                    googleEnabled && !isDemoMode
                      ? `/api/auth/google/start?role=${role}`
                      : undefined
                  }
                >
                  <GoogleGlyph />
                </SocialButton>
              </div>
            </div>

            {/* or divider */}
            <div
              className="animate-rise mt-6 flex items-center gap-3"
              style={{ animationDelay: "120ms" }}
            >
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-faint)]">or</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>

            {/* role toggle */}
            <div
              className="animate-rise mt-6"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex rounded-full border border-[var(--border)] bg-espresso/60 p-1 text-sm">
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
                          ? "bg-terracotta text-on-accent"
                          : "text-[var(--text-muted)] hover:text-cream",
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] transition-colors hover:text-cream"
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
              {/* Step 2 (nurse) — what patients read on the nurse's card.
                  Blue accent from the first screen: nurse surfaces are blue
                  everywhere in the app. */}

              {/* A Google nurse never saw step 1 — same treatment as the
                  Google doctor: identity is proved, the profile is theirs
                  to state, starting with the name they practise under. */}
              {googleNurse && (
                <>
                  <div className="rounded-lg border border-[var(--border)] bg-espresso/60 px-3.5 py-3 text-left text-xs leading-relaxed text-[var(--text-muted)]">
                    Signed in with Google. Your account isn&rsquo;t created yet
                    — patients choose a nurse on what&rsquo;s below, so it has
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
                            ? "border-terracotta bg-terracotta/15 text-cream"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:text-cream",
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
              {/* Step 2 — the profile patients will read. Everything here
                  lands on the doctor's public card and detail page. */}

              {/* A Google doctor never saw step 1, so their name is asked for
                  here. Prefilled from Google, and editable — the name on the
                  card should be the one they practise under. */}
              {googleDoctor && (
                <>
                  <div className="rounded-lg border border-[var(--border)] bg-espresso/60 px-3.5 py-3 text-xs leading-relaxed text-[var(--text-muted)]">
                    Signed in with Google. Your account isn&rsquo;t created yet
                    — patients choose a doctor on what&rsquo;s below, so it has
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
                <div className="mt-1.5 flex rounded-xl border border-[var(--border)] bg-espresso/60 p-1 text-sm">
                  {(["practising", "resident"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 font-medium capitalize transition-colors",
                        kind === k
                          ? "bg-terracotta text-on-accent"
                          : "text-[var(--text-muted)] hover:text-cream",
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
                  placeholder="Vaishali Nagar, Nagpur — near City Hospital"
                  autoComplete="off"
                  maxLength={160}
                />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-terracotta-300">{error}</p>}

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

          {/* A Google doctor has no step 1 to go back to — their email and
              identity came from Google, not from a form. */}
          {step === 2 && !googleProvider && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className="mx-auto flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-cream"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to account details
            </button>
          )}

          <p className="text-center text-xs text-[var(--text-faint)]">
            {step === 2
              ? "Patients see this on your profile — you can edit it anytime"
              : role === "doctor"
                ? "Next: your specialty, credentials & fees"
                : role === "nurse"
                  ? "Next: your services, credentials & fee"
                  : "as a patient — no card, no wait"}
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
            className="font-medium text-cream transition-colors hover:text-salmon"
          >
            Log in
          </Link>
        </p>
        {/* Footer links — /about and /contact were unreachable islands
            before this: nothing in the app linked to them. */}
        <div
          className="animate-rise mt-8 space-y-2 text-[11px] text-[var(--text-faint)]"
          style={{ animationDelay: "280ms" }}
        >
          <div className="flex items-center justify-center gap-3">
            <Link href="/about" className="transition-colors hover:text-cream">
              About
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/contact"
              className="transition-colors hover:text-cream"
            >
              Contact
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/ops-signin"
              className="transition-colors hover:text-cream"
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
  "h-12 w-full rounded-xl border border-[var(--border)] bg-espresso/60 px-4 text-sm text-cream outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-terracotta focus:ring-1 focus:ring-terracotta/40";

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

// Small circular social button. With an href it is a real link (OAuth is a
// full-page journey, so the browser must navigate); without one it nudges the
// user with a toast so the affordance never feels broken. The link flips to a
// spinner on first click — a cold serverless redirect can take seconds, and a
// silent button invites the double-click that used to break the flow.
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
    "grid h-11 w-11 place-items-center rounded-full text-cream/80 transition-colors hover:bg-white/8 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50";
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
          <Loader2 className="h-5 w-5 animate-spin text-cream" />
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
function CoverPlate() {
  return (
    <section
      className="relative hidden flex-col items-center justify-center overflow-hidden lg:flex"
      style={{
        background:
          "radial-gradient(125% 95% at 80% 15%, rgb(var(--c-espresso-700)) 0%, rgb(var(--c-espresso-800)) 44%, rgb(var(--c-espresso)) 100%)",
      }}
    >
      {/* left hairline between the panels */}
      <div className="absolute inset-y-0 left-0 w-px bg-cream/10" />

      {/* concentric gold rings, echoing the deck cover */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-1/2 -translate-y-1/2"
      >
        <div className="relative h-[26rem] w-[26rem]">
          <span className="absolute inset-0 rounded-full border border-tan/25" />
          <span className="absolute inset-[13%] rounded-full border border-tan/15" />
          <span className="absolute inset-[26%] rounded-full border border-tan/10" />
          <span className="absolute inset-0 grid place-items-center">
            <DoctorFigure className="h-40 w-40 animate-float motion-reduce:animate-none" />
          </span>
        </div>
      </div>

      {/* brand block, lower-left */}
      <div className="relative z-10 mr-auto max-w-md px-12">
        <span className="text-sm font-semibold tracking-tight text-salmon">
          India&apos;s front door to care.
        </span>
        <div className="mt-4">
          <span className="font-serif text-6xl leading-none tracking-tight text-cream">
            Doc<span className="text-salmon">ee</span>to
          </span>
          {/* gold underline swoosh */}
          <svg viewBox="0 0 220 12" className="mt-2 h-3 w-56" aria-hidden>
            <path
              d="M2 7 C 60 1, 110 1, 150 6 C 170 8.5, 200 8, 218 3"
              fill="none"
              className="stroke-tan"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="mt-4 font-serif text-2xl text-salmon">
          Care that reaches you.
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream/70">
          A real doctor, on demand, at your door. One tap for urgent help, and
          medicine sent to you — all in one place.
        </p>
      </div>
    </section>
  );
}


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

function AppleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.46z" />
    </svg>
  );
}
