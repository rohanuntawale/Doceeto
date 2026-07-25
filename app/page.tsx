"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Name, BrandMark } from "@/components/brand/wordmark";
import { useToast } from "@/components/ui/toast";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { setCurrentDoctorId } from "@/lib/hooks/use-current-doctor";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/config";
import { cn } from "@/lib/utils/cn";

type Role = "patient" | "doctor";

/**
 * Doceeto landing — the single onboarding, matched to the pitch deck:
 * deep-forest shell, paper text, gold accents, the serif "Doceeto" wordmark
 * (gold "ee") and the doctor mascot. Patients and doctors both sign up here
 * with name/email/password; doctors set specialty/fees later in their
 * dashboard. `?as=doctor` preselects the doctor toggle (deep links).
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
    <main className="relative grid min-h-screen place-items-center px-4 py-6 sm:px-6">
      <div className="absolute right-5 top-5 z-20">
        <ThemeSwitcher />
      </div>

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

  const [role, setRole] = useState<Role>(params.get("as") === "doctor" ? "doctor" : "patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (role === "doctor") {
      // Minimal doctor sign-up — specialty, fees and availability are set
      // afterwards in the doctor profile. Demo keeps the doctor in the
      // browser; live creates the account + session on the backend.
      if (isDemoMode) {
        const doc = demoStore.registerDoctor({
          fullName: name.trim() || "Doctor",
          specialty: "General Physician",
          kind: "practising",
          gender: "female",
          experienceYears: 0,
          consultFee: 400,
          homeVisitFee: 900,
          clinicAddress: clinicAddress.trim(),
        });
        setCurrentDoctorId(doc.id);
        toast.push({ tone: "success", title: "Welcome to Doceeto", desc: "Set up your practice to go online." });
        router.push("/doctor");
        return;
      }
      setLoading(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "doctor", fullName: name, email, password, clinicAddress: clinicAddress.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) return setError(data.error ?? "Could not create the account.");
      toast.push({ tone: "success", title: "Welcome to Doceeto", desc: "Set up your practice to go online." });
      router.push("/doctor");
      router.refresh();
      return;
    }

    // Patient — the effortless path. Demo keeps identity in the browser;
    // live creates the real account on the backend and sets the session.
    if (isDemoMode) {
      update({ name: name.trim() || "Guest" });
      toast.push({ tone: "success", title: "Welcome to Doceeto", desc: "Your space is ready." });
      router.push("/patient");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "patient", name, email, password, address: "" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Could not create the account.");
    toast.push({ tone: "success", title: "Welcome to Doceeto", desc: "Your account is ready." });
    router.push("/patient");
    router.refresh();
  }

  return (
    <section className="relative flex flex-col justify-center overflow-hidden bg-espresso-800 px-7 py-14 sm:px-10 md:px-14">
      {/* soft ambient glow, like the rest of the app */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--c-tan) / 0.28), transparent 65%)" }}
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
          className="animate-rise mt-8 font-serif text-[2.6rem] leading-[1.03] tracking-tight text-cream sm:text-[3rem]"
          style={{ animationDelay: "40ms" }}
        >
          Start your <span className="text-salmon">care journey</span>
        </h1>

        {/* social trio — styled, not yet wired to OAuth */}
        <div className="animate-rise mt-7 flex justify-center" style={{ animationDelay: "90ms" }}>
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-espresso/60 p-1.5">
            <SocialButton label="Continue with Apple">
              <AppleGlyph />
            </SocialButton>
            <SocialButton label="Continue with Google">
              <GoogleGlyph />
            </SocialButton>
            <SocialButton label="Continue with GitHub">
              <GithubGlyph />
            </SocialButton>
          </div>
        </div>

        {/* or divider */}
        <div className="animate-rise mt-6 flex items-center gap-3" style={{ animationDelay: "120ms" }}>
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-faint)]">or</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        {/* role toggle */}
        <div className="animate-rise mt-6" style={{ animationDelay: "150ms" }}>
          <div className="flex rounded-full border border-[var(--border)] bg-espresso/60 p-1 text-sm">
            {(["patient", "doctor"] as Role[]).map((r) => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    setError(null);
                  }}
                  className={cn(
                    "flex-1 rounded-full px-3 py-2 font-medium transition-colors",
                    active
                      ? "bg-terracotta text-on-accent"
                      : "text-[var(--text-muted)] hover:text-cream",
                  )}
                >
                  {r === "patient" ? "I need care" : "I'm a doctor"}
                </button>
              );
            })}
          </div>
        </div>

        {/* the form — same minimal fields for both roles */}
        <form
          onSubmit={onSubmit}
          className="animate-rise mt-5 space-y-3 text-left"
          style={{ animationDelay: "190ms" }}
        >
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
              {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </label>

          {role === "doctor" && (
            <label className="block">
              <span className="sr-only">Clinic address (optional)</span>
              <input
                className={inputCls}
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
                placeholder="Clinic address (optional)"
                autoComplete="off"
                maxLength={160}
              />
            </label>
          )}

          {error && <p className="text-sm text-terracotta-300">{error}</p>}

          {/* primary CTA with a subtle sheen sweep on hover */}
          <div className="group relative overflow-hidden rounded-lg">
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Setting up…" : role === "doctor" ? "Join" : "Start"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 group-hover:animate-sheen motion-reduce:hidden"
            />
          </div>

          <p className="text-center text-xs text-[var(--text-faint)]">
            {role === "doctor"
              ? "Set your specialty & fees next, in your dashboard"
              : "as a patient — no card, no wait"}
          </p>
        </form>

        {/* sign-in + brand line */}
        <p className="animate-rise mt-6 text-sm text-[var(--text-muted)]" style={{ animationDelay: "240ms" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-cream transition-colors hover:text-salmon">
            Log in
          </Link>
        </p>
        <div className="animate-rise mt-8 text-[11px] text-[var(--text-faint)]" style={{ animationDelay: "280ms" }}>
          © 2026 Doceeto · Care that reaches you
        </div>
      </div>
    </section>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-[var(--border)] bg-espresso/60 px-4 text-sm text-cream outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-terracotta focus:ring-1 focus:ring-terracotta/40";

// Small circular social button. Non-functional until OAuth is wired — it just
// nudges the user with a toast so the affordance never feels broken.
function SocialButton({ label, children }: { label: string; children: React.ReactNode }) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() =>
        toast.push({ tone: "info", title: "Coming soon", desc: "Social sign-in isn't wired up yet." })
      }
      className="grid h-11 w-11 place-items-center rounded-full text-cream/80 transition-colors hover:bg-white/8 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50"
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
      <div aria-hidden className="pointer-events-none absolute right-[8%] top-1/2 -translate-y-1/2">
        <div className="relative h-[26rem] w-[26rem]">
          <span className="absolute inset-0 rounded-full border border-tan/25" />
          <span className="absolute inset-[13%] rounded-full border border-tan/15" />
          <span className="absolute inset-[26%] rounded-full border border-tan/10" />
          <span className="absolute inset-0 grid place-items-center">
            <DoctorMascot className="h-40 w-40 animate-float motion-reduce:animate-none" />
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
        <p className="mt-4 font-serif text-2xl text-salmon">Care that reaches you.</p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream/70">
          A real doctor, on demand, at your door. One tap for urgent help, and
          medicine sent to you — all in one place.
        </p>
      </div>
    </section>
  );
}

/** Flat doctor mascot — a nod to the deck's 3D character: cream head with a
 *  gold head-mirror, happy eyes, and green scrubs. */
function DoctorMascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Doceeto doctor mascot">
      {/* scrubs / shoulders */}
      <path d="M42 200 C42 164 68 148 100 148 C132 148 158 164 158 200 Z" className="fill-espresso-700" />
      {/* collar */}
      <path d="M86 150 L100 168 L114 150" fill="none" className="stroke-cream" strokeWidth="4" strokeLinejoin="round" />
      {/* head */}
      <rect x="54" y="58" width="92" height="88" rx="30" className="fill-cream" />
      {/* face screen */}
      <rect x="66" y="72" width="68" height="60" rx="22" className="fill-espresso" />
      {/* happy eyes */}
      <path d="M80 100 q7 9 14 0" fill="none" className="stroke-tan" strokeWidth="5" strokeLinecap="round" />
      <path d="M106 100 q7 9 14 0" fill="none" className="stroke-tan" strokeWidth="5" strokeLinecap="round" />
      {/* head-mirror: band + reflector */}
      <line x1="100" y1="58" x2="100" y2="44" className="stroke-tan" strokeWidth="3" />
      <circle cx="100" cy="38" r="11" fill="none" className="stroke-tan" strokeWidth="3" />
      <circle cx="100" cy="38" r="3.5" className="fill-tan" />
    </svg>
  );
}

// Brand glyphs inlined (no lucide brand-icon dependency). Google keeps its
// colors to read at a glance; Apple/GitHub ride currentColor.
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C39.99 34.955 44 30 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.46z" />
    </svg>
  );
}

function GithubGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.523 2 12 2z"
      />
    </svg>
  );
}
