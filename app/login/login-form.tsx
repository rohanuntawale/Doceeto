"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck, UserCheck, HeartHandshake, Stethoscope } from "lucide-react";
import { Wordmark, Name } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { isDemoMode } from "@/lib/config";
import { surfaceFromPath } from "@/lib/auth/constants";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { useWarmBackend } from "@/lib/hooks/use-warm-backend";

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[var(--bg)]" />}>
      <LoginShell googleEnabled={googleEnabled} />
    </Suspense>
  );
}

function LoginShell({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <main className="relative grid min-h-screen place-items-center px-4 pb-6 pt-16 sm:px-6 lg:pt-6 bg-[var(--bg)] text-[var(--text)]">
      {/* Top right Theme Switcher */}
      <div className="absolute right-5 top-5 z-20">
        <ThemeSwitcher />
      </div>

      {/* Main split-panel frame (matches /signup container aesthetic) */}
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[26px] border border-[var(--border)] shadow-card lg:min-h-[86vh] lg:grid-cols-[0.95fr_1.05fr] bg-[var(--surface)]">
        <LoginFormPanel googleEnabled={googleEnabled} />
        <LoginCoverPlate />
      </div>
    </main>
  );
}

function LoginFormPanel({ googleEnabled }: { googleEnabled: boolean }) {
  // Wake the database while they're still typing — sign-in lands warm.
  useWarmBackend();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/doctor";
  const wantedSurface = surfaceFromPath(params.get("next") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The OAuth callback reports failures by bouncing back here with ?error=
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);
  /** Google needs to know which app is being entered; default to the patient. */
  const googleRole = wantedSurface === "doctor" ? "doctor" : "patient";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not sign in.");
      return;
    }
    const home =
      data.role === "ops"
        ? "/ops"
        : data.role === "patient"
          ? "/patient"
          : data.role === "nurse"
            ? "/nurse"
            : "/doctor";
    const dest = next.startsWith(home) ? next : home;
    router.push(dest);
    router.refresh();
  }

  return (
    <section className="flex flex-col justify-between p-6 sm:p-10">
      <div>
        {/* Header navigation & Brand Lockup */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <Wordmark compact />
        </div>

        {/* Form Header */}
        <div className="mb-6">
          <span className="label text-[10px] tracking-[0.2em]">ACCESSIBLE PORTAL</span>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)]">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Sign in to access your Doceeto care app or practice cockpit.
          </p>
        </div>

        {/* Demo Mode Handler */}
        {isDemoMode ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 text-center shadow-soft">
            <div className="label mb-2 text-[var(--accent)] font-bold">DEMO MODE ACTIVE</div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Demonstration mode is currently enabled. Select a role below to jump straight to your workspace:
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button
                className="w-full bg-[var(--accent)] text-[var(--c-on-accent)] font-semibold"
                onClick={() => router.push("/doctor")}
              >
                <UserCheck className="w-4 h-4 mr-2" /> Sign in as Doctor
              </Button>
              <Button
                className="w-full bg-[#2F7BC4] hover:bg-[#2565A3] text-white font-semibold"
                onClick={() => router.push("/nurse")}
              >
                <Stethoscope className="w-4 h-4 mr-2" /> Sign in as Nurse
              </Button>
              <Button
                variant="outline"
                className="w-full border-[var(--border)] text-[var(--text)] font-semibold"
                onClick={() => router.push("/patient")}
              >
                <HeartHandshake className="w-4 h-4 mr-2" /> Sign in as Patient
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Surface Context Banner */}
            {wantedSurface && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>
                  {wantedSurface === "doctor"
                    ? "The doctor cockpit requires a doctor account."
                    : wantedSurface === "nurse"
                      ? "The nurse workspace requires a nurse account."
                      : "The patient portal requires a patient account."}
                </span>
              </div>
            )}

            {/* Google OAuth Option */}
            {googleEnabled && (
              <div className="space-y-4">
                <GoogleButton
                  role={googleRole}
                  next={params.get("next") ?? undefined}
                  label={`Continue with Google${googleRole === "doctor" ? " as doctor" : ""}`}
                />
                <AuthDivider>or sign in with password</AuthDivider>
              </div>
            )}

            {/* Input Fields */}
            <div className="space-y-3.5">
              <Field label="Email Address">
                <input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@doceeto.health"
                  className={inputCls}
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-xl bg-status-critical/10 border border-status-critical/30 p-3 text-xs font-medium text-status-critical">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-6 w-full h-12 text-sm font-bold bg-[var(--accent)] text-[var(--c-on-accent)] shadow-soft group"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>

            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              Don&apos;t have an account yet?{" "}
              <Link href="/signup" className="font-bold text-[var(--accent)] hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-faint)]">
        <div className="flex items-center gap-3">
          <Link href="/about" className="transition-colors hover:text-[var(--text)]">
            About
          </Link>
          <span>·</span>
          <Link href="/contact" className="transition-colors hover:text-[var(--text)]">
            Contact
          </Link>
          <span>·</span>
          <Link href="/terms" className="transition-colors hover:text-[var(--text)]">
            Terms
          </Link>
          <span>·</span>
          <Link href="/privacy" className="transition-colors hover:text-[var(--text)]">
            Privacy
          </Link>
        </div>
        <span>© {new Date().getFullYear()} Doceeto</span>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label text-[10px] tracking-wider mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40";

/** Right: Cover Plate matching /signup aesthetic */
function LoginCoverPlate() {
  return (
    <section
      className="relative hidden flex-col items-center justify-center overflow-hidden lg:flex p-12 text-cream"
      style={{
        background:
          "radial-gradient(125% 95% at 80% 15%, rgb(var(--c-espresso-700)) 0%, rgb(var(--c-espresso-800)) 44%, rgb(var(--c-espresso)) 100%)",
      }}
    >
      {/* Hairline separator */}
      <div className="absolute inset-y-0 left-0 w-px bg-white/10" />

      {/* Concentric gold rings */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-1/2 -translate-y-1/2"
      >
        <div className="relative h-[26rem] w-[26rem]">
          <span className="absolute inset-0 rounded-full border border-tan/25" />
          <span className="absolute inset-[14%] rounded-full border border-tan/15" />
          <span className="absolute inset-[28%] rounded-full border border-tan/10" />
          <span className="absolute inset-0 grid place-items-center">
            <DoctorMascot className="h-40 w-40 animate-float" />
          </span>
        </div>
      </div>

      {/* Brand block text */}
      <div className="relative z-10 mr-auto max-w-md">
        <span className="text-xs font-semibold tracking-widest uppercase text-salmon">
          India&apos;s Front Door to Care
        </span>
        <div className="mt-3">
          <Name className="text-5xl text-cream" />
          <svg viewBox="0 0 220 12" className="mt-2 h-3 w-48" aria-hidden>
            <path
              d="M2 7 C 60 1, 110 1, 150 6 C 170 8.5, 200 8, 218 3"
              fill="none"
              className="stroke-tan"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="mt-4 font-serif text-2xl text-salmon italic">
          Care that reaches you.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-cream/70 max-w-sm font-sans">
          One unified portal connecting patient care requests directly to certified doctors and registered home nurses.
        </p>
      </div>
    </section>
  );
}

/** Mascot SVG component */
function DoctorMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Doceeto doctor mascot"
    >
      <path
        d="M42 200 C42 164 68 148 100 148 C132 148 158 164 158 200 Z"
        className="fill-espresso-700"
      />
      <path
        d="M86 150 L100 168 L114 150"
        fill="none"
        className="stroke-cream"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="54"
        y="58"
        width="92"
        height="88"
        rx="30"
        className="fill-cream"
      />
      <rect
        x="66"
        y="72"
        width="68"
        height="60"
        rx="22"
        className="fill-espresso"
      />
      <path
        d="M80 100 q7 9 14 0"
        fill="none"
        className="stroke-tan"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M106 100 q7 9 14 0"
        fill="none"
        className="stroke-tan"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="100"
        y1="58"
        x2="100"
        y2="44"
        className="stroke-tan"
        strokeWidth="3"
      />
      <circle
        cx="100"
        cy="38"
        r="11"
        fill="none"
        className="stroke-tan"
        strokeWidth="3"
      />
      <circle cx="100" cy="38" r="3.5" className="fill-tan" />
    </svg>
  );
}
